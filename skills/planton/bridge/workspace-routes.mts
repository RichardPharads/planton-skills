// The project workspace's web side (workspace.mts adds a project): one page per project at /w/<token>/, its plan files
// (plan-files.mts), live changes as Server-Sent Events, and Send to phone. This PC only: the bridge checks isLocal before
// handing a request here. Every write must also come from the bridge's own page (its Origin), so another website open in
// the browser can't change a plan. See docs/superpowers/specs/2026-10-07-project-workspace-design.md.
import { readFileSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { PLAN_MAX_BYTES, sameBytes, utf8Encode } from "./bridge-protocol.ts";
import { projectEnv, requestedNames } from "./env-files.mts";
import { readJson, reply, sameOrigin } from "./http.mts";
import {
  checkPlan,
  listPlans,
  newPlanFile,
  planPath,
  readPlanFile,
  scanPlans,
  readPlanForSave,
  writePlanFile,
  type PlanStamp,
} from "./plan-files.mts";
import type { WorkspaceSetting } from "./settings.mts";
import { listTemplates, readTemplate, saveTemplate } from "./templates.mts";

const here = dirname(fileURLToPath(import.meta.url));
const POLL_MS = Number(process.env.PLANTON_WORKSPACE_POLL_MS) || 500;
const PING_MS = 25_000;
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};
const PAGE_HEADERS = {
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

export type WorkspaceHost = {
  workspaces: () => WorkspaceSetting[];
  port: () => number;
  phonesPaired: () => number;
  pushPlan: (path: string, fileName: string, text: string) => number;
  log: (message: string) => void;
};

type Watch = { seen: Map<string, PlanStamp>; listeners: Set<ServerResponse>; timers: ReturnType<typeof setInterval>[] };

export function workspaceRoutes(host: WorkspaceHost) {
  const appDir = resolve(process.env.PLANTON_WORKSPACE_DIR ?? join(here, "workspace"));
  const watches = new Map<string, Watch>();

  function find(token: string): WorkspaceSetting | null {
    const asked = utf8Encode(token);
    return host.workspaces().find((workspace) => sameBytes(utf8Encode(workspace.token), asked)) ?? null;
  }

  function serveApp(response: ServerResponse, rest: string) {
    const path = resolve(appDir, rest || "index.html");
    if (!path.startsWith(appDir + sep)) return reply(response, 404, { error: "not-found" });
    let body: Buffer;
    try {
      if (!statSync(path).isFile()) return reply(response, 404, { error: "not-found" });
      body = readFileSync(path);
    } catch {
      return reply(response, 404, { error: "not-found" });
    }
    response.writeHead(200, {
      "content-type": TYPES[extname(path)] ?? "application/octet-stream",
      // Vite names assets by their content, so they never change; the page itself always comes fresh.
      "cache-control": rest.startsWith("assets/") ? "public, max-age=31536000, immutable" : "no-store",
      ...PAGE_HEADERS,
    });
    response.end(body);
  }

  function tick(workspace: WorkspaceSetting) {
    const watch = watches.get(workspace.id);
    if (!watch) return;
    const { seen, changes } = scanPlans(workspace.path, watch.seen);
    watch.seen = seen;
    for (const change of changes) {
      for (const listener of watch.listeners) listener.write(`data: ${JSON.stringify(change)}\n\n`);
    }
  }

  /** Checks the project's plans while at least one page listens; stops when the last one leaves. */
  function listen(workspace: WorkspaceSetting, response: ServerResponse) {
    response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
    response.write(": connected\n\n");
    let watch = watches.get(workspace.id);
    if (!watch) {
      const created: Watch = { seen: scanPlans(workspace.path, new Map()).seen, listeners: new Set(), timers: [] };
      created.timers.push(setInterval(() => tick(workspace), POLL_MS));
      created.timers.push(setInterval(() => created.listeners.forEach((listener) => listener.write(": ping\n\n")), PING_MS));
      watches.set(workspace.id, created);
      watch = created;
    }
    const current = watch;
    current.listeners.add(response);
    response.on("close", () => {
      current.listeners.delete(response);
      if (current.listeners.size > 0) return;
      current.timers.forEach(clearInterval);
      watches.delete(workspace.id);
    });
  }

  async function savePlan(request: IncomingMessage, response: ServerResponse, workspace: WorkspaceSetting, file: string) {
    const body = await readJson(request, PLAN_MAX_BYTES * 2);
    if (!body.ok) return reply(response, body.status, { error: "bad-request" });
    const { text, baseVersion } = body.value;
    if (typeof text !== "string") return reply(response, 400, { error: "bad-request" });
    const current = readPlanForSave(workspace.path, file);
    // From here on nothing awaits, so no other save can slip in between this check and the write.
    if (current === "busy") {
      // Not a conflict: the page keeps the edit and tries again (use-plan.ts).
      return reply(response, 503, { error: "the plan file is in use by another program; trying again in a moment." });
    }
    if ((current?.version ?? null) !== (typeof baseVersion === "string" ? baseVersion : null)) {
      return reply(response, 409, { error: "changed", text: current?.text ?? null, version: current?.version ?? null });
    }
    const checked = checkPlan(text);
    if (!checked.ok) return reply(response, 400, { error: checked.error });
    const version = writePlanFile(workspace.path, file, text);
    host.log(`Saved a plan in the ${workspace.name} workspace`);
    return reply(response, 200, { version });
  }

  async function createPlan(request: IncomingMessage, response: ServerResponse, workspace: WorkspaceSetting) {
    const body = await readJson(request, PLAN_MAX_BYTES * 2);
    if (!body.ok || typeof body.value.text !== "string")
      return reply(response, body.ok ? 400 : body.status, { error: "bad-request" });
    const checked = checkPlan(body.value.text);
    if (!checked.ok) return reply(response, 400, { error: checked.error });
    const file = newPlanFile(workspace.path, checked.title);
    const version = writePlanFile(workspace.path, file, body.value.text);
    host.log(`Made a plan in the ${workspace.name} workspace`);
    return reply(response, 201, { file, version });
  }

  async function createTemplate(request: IncomingMessage, response: ServerResponse) {
    const body = await readJson(request, PLAN_MAX_BYTES * 2);
    if (!body.ok || typeof body.value.text !== "string")
      return reply(response, body.ok ? 400 : body.status, { error: "bad-request" });
    const saved = saveTemplate(body.value.text);
    if (!saved.ok) return reply(response, 400, { error: saved.error });
    host.log("Saved a plan template");
    return reply(response, 201, { file: saved.file });
  }

  async function push(request: IncomingMessage, response: ServerResponse, workspace: WorkspaceSetting) {
    const body = await readJson(request, 4096);
    const file = body.ok && typeof body.value.file === "string" ? body.value.file : "";
    const path = planPath(workspace.path, file);
    const plan = path ? readPlanFile(workspace.path, file) : null;
    if (!path || !plan) return reply(response, 404, { error: "not-found" });
    const checked = checkPlan(plan.text);
    if (!checked.ok) return reply(response, 400, { error: checked.error });
    return reply(response, 200, { delivered: host.pushPlan(path, file, plan.text) });
  }

  async function handle(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
    const [, , token = "", ...parts] = url.pathname.split("/");
    const workspace = find(token);
    if (!workspace) return reply(response, 404, { error: "not-found" });
    if (parts.length === 0) {
      // The page's addresses are relative ("api/plans"), so it has to be opened with the trailing slash.
      response.writeHead(301, { location: `/w/${token}/` });
      response.end();
      return;
    }
    const rest = parts.join("/");
    const method = request.method ?? "GET";
    if (method !== "GET" && !sameOrigin(request, host.port())) return reply(response, 403, { error: "origin" });

    if (rest === "events" && method === "GET") return listen(workspace, response);
    if (rest === "api/project" && method === "GET") {
      return reply(response, 200, { name: workspace.name, phone: host.phonesPaired() > 0 });
    }
    if (rest === "api/env" && method === "GET") {
      // Only the names the page asks about (the ones its open plan lists) are answered: see env-files.mts.
      const names = requestedNames(url.searchParams.get("names"));
      if (!names) return reply(response, 400, { error: "too-many-names" });
      return reply(response, 200, projectEnv(workspace.path, names));
    }
    if (rest === "api/plans" && method === "GET") return reply(response, 200, { plans: listPlans(workspace.path) });
    if (rest === "api/plans" && method === "POST") return createPlan(request, response, workspace);
    if (rest.startsWith("api/plans/")) {
      const file = rest.slice("api/plans/".length);
      if (!planPath(workspace.path, file)) return reply(response, 404, { error: "not-found" });
      if (method === "GET") {
        const plan = readPlanFile(workspace.path, file);
        return plan ? reply(response, 200, plan) : reply(response, 404, { error: "not-found" });
      }
      if (method === "PUT") return savePlan(request, response, workspace, file);
      return reply(response, 405, { error: "method" });
    }
    if (rest === "api/templates" && method === "GET") return reply(response, 200, { templates: listTemplates() });
    if (rest === "api/templates" && method === "POST") return createTemplate(request, response);
    if (rest.startsWith("api/templates/") && method === "GET") {
      const template = readTemplate(rest.slice("api/templates/".length));
      return template ? reply(response, 200, template) : reply(response, 404, { error: "not-found" });
    }
    if (rest === "api/push" && method === "POST") return push(request, response, workspace);
    if (rest.startsWith("api/") || method !== "GET") return reply(response, 404, { error: "not-found" });
    return serveApp(response, rest);
  }

  function stop() {
    for (const watch of watches.values()) {
      watch.timers.forEach(clearInterval);
      watch.listeners.forEach((listener) => listener.end());
    }
    watches.clear();
  }

  return { handle, stop };
}
