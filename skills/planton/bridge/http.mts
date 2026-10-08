import type { IncomingMessage, ServerResponse } from "node:http";

export function reply(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

/** From this PC, under its own name, so a web page can't reach the API by pointing a name at 127.0.0.1. */
export function isLocal(request: IncomingMessage): boolean {
  const remote = request.socket.remoteAddress ?? "";
  const host = (request.headers.host ?? "").toLowerCase().replace(/:\d+$/, "");
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote) && (host === "127.0.0.1" || host === "localhost");
}

export async function readBody(request: IncomingMessage, limit: number): Promise<string | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function readJson(
  request: IncomingMessage,
  limit: number,
): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; status: number }> {
  const text = await readBody(request, limit);
  if (text === null) return { ok: false, status: 413 };
  try {
    const value = JSON.parse(text || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? { ok: true, value } : { ok: false, status: 400 };
  } catch {
    return { ok: false, status: 400 };
  }
}

/** A write from the bridge's own page: browsers send Origin with every POST and PUT, and another site can't fake it. */
export function sameOrigin(request: IncomingMessage, port: number): boolean {
  const origin = request.headers.origin;
  return origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`;
}
