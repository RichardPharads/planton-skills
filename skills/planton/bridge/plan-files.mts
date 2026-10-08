// One project's plan files, for the workspace (workspace-routes.mts): the .planton.json files directly inside its
// planton/ folder. Nothing else on the disk can be named: a file name must match PLAN_FILE_PATTERN, and the path it
// makes must sit directly in that folder, and one that is a link is followed only to a file inside it. Writes go to a temporary file that is then renamed, so nobody ever reads half a
// plan. Plans are checked with the app's own importer (workflow-file.ts, copied in by build.mjs).
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

import { PLAN_MAX_BYTES } from "./bridge-protocol.ts";
import { renameWhenFree } from "./settings.mts";
import { parseWorkflowFile, workflowFileName } from "./workflow-file.ts";

export const PLAN_FILE_PATTERN = /^[a-z0-9][a-z0-9-]{0,80}\.planton\.json$/;

export type PlanListing = { file: string; title: string; type: string; cards: number; version: string; error: string | null };
export type PlanChange = { file: string; version: string } | { file: string; removed: true };
/** What scanPlans last saw of a file: a file whose size and modified time haven't moved isn't read again. */
export type PlanStamp = { size: number; modified: number; version: string };

export const plansFolder = (project: string) => join(project, "planton");

/** A short hash of a plan's text: the version a save must name to replace it. */
export const planVersion = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 16);

/** The full path of a plan file directly inside `folder`, or null for a name that isn't one. */
export function planPathIn(folder: string, file: string): string | null {
  if (!PLAN_FILE_PATTERN.test(file)) return null;
  const base = resolve(folder);
  const path = resolve(base, file);
  return dirname(path) === base ? path : null;
}

/** The full path of one of the project's plan files, or null for a name that isn't one. */
export const planPath = (project: string, file: string) => planPathIn(plansFolder(project), file);

/**
 * Whether a name in the folder is a link that leads out of it (say, a committed `x.planton.json -> ../.env`), or nowhere.
 * Such a file is treated as absent: never listed, read or scanned. A link to a file inside the folder is followed.
 */
function linksOut(folder: string, file: string): boolean {
  const path = join(folder, file);
  try {
    if (!lstatSync(path).isSymbolicLink()) return false;
    const root = realpathSync(folder);
    return !realpathSync(path).startsWith(root.endsWith(sep) ? root : root + sep);
  } catch {
    // A file gone this moment isn't a link out: whoever reads it next finds that out. A link that leads nowhere is.
    try {
      return lstatSync(path).isSymbolicLink();
    } catch {
      return false;
    }
  }
}

export function readPlanFileIn(folder: string, file: string): { text: string; version: string } | null {
  const path = planPathIn(folder, file);
  if (!path || linksOut(folder, file)) return null;
  try {
    const text = readFileSync(path, "utf8");
    return { text, version: planVersion(text) };
  } catch {
    return null;
  }
}

export const readPlanFile = (project: string, file: string) => readPlanFileIn(plansFolder(project), file);

/** Errors that mean the file isn't there (or a folder on its path isn't): anything else is a file that won't open. */
const MISSING_ERRORS = ["ENOENT", "ENOTDIR"];
const BUSY_READ_TRIES = 10;
const BUSY_READ_PAUSE_MS = 50;

/**
 * The plan a save is about to replace: its text and version, null when there is none, or "busy" when the file is there but
 * won't open (on Windows, while another program holds it). A save must never take "won't open" for "not there": that
 * answers 409 with no file, and the page drops the edit. A busy file is tried a few times first, synchronously, so no
 * other save can slip in between this read and the write that follows it.
 */
export function readPlanForSave(project: string, file: string): { text: string; version: string } | null | "busy" {
  const folder = plansFolder(project);
  const path = planPathIn(folder, file);
  if (!path || linksOut(folder, file)) return null;
  for (let attempt = 1; ; attempt++) {
    try {
      const text = readFileSync(path, "utf8");
      return { text, version: planVersion(text) };
    } catch (error) {
      if (MISSING_ERRORS.includes((error as { code?: string }).code ?? "")) return null;
      if (attempt === BUSY_READ_TRIES) return "busy";
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, BUSY_READ_PAUSE_MS);
    }
  }
}

/** Whether the app would import this plan; its title when it would, the importer's message when it wouldn't. */
export function checkPlan(text: string): { ok: true; title: string } | { ok: false; error: string } {
  if (Buffer.byteLength(text, "utf8") > PLAN_MAX_BYTES) return { ok: false, error: "file: is too large" };
  const parsed = parseWorkflowFile(text, { idPrefix: "check", now: 0 });
  return parsed.ok ? { ok: true, title: parsed.summary.title } : { ok: false, error: parsed.error };
}

function planFileNames(folder: string): string[] {
  try {
    return readdirSync(folder)
      .filter((name) => PLAN_FILE_PATTERN.test(name) && !linksOut(folder, name))
      .sort();
  } catch {
    return [];
  }
}

/** Every plan in the folder. One that can't be read this moment (locked, or mid-save) is still listed, with the reason. */
export function listPlansIn(folder: string): PlanListing[] {
  return planFileNames(folder).flatMap((file): PlanListing[] => {
    const plan = readPlanFileIn(folder, file);
    if (!plan) return [{ file, title: file, type: "", cards: 0, version: "", error: "couldn't be read" }];
    const parsed = parseWorkflowFile(plan.text, { idPrefix: "list", now: 0 });
    return parsed.ok
      ? [
          {
            file,
            title: parsed.summary.title,
            type: parsed.summary.mode,
            cards: parsed.summary.cardCount,
            version: plan.version,
            error: null,
          },
        ]
      : [{ file, title: file, type: "", cards: 0, version: plan.version, error: parsed.error }];
  });
}

export const listPlans = (project: string) => listPlansIn(plansFolder(project));

/** Writes a plan (check it first) into `folder` and returns its new version. */
export function writePlanFileIn(folder: string, file: string, text: string): string {
  const path = planPathIn(folder, file);
  if (!path) throw new Error(`Not a plan file name: ${file}`);
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  // A write that fails half way (a full disk) leaves no temporary file in the person's repository either.
  try {
    writeFileSync(temporary, text);
    renameWhenFree(temporary, path);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
  return planVersion(text);
}

/** Writes a plan (check it first) and returns its new version. */
export const writePlanFile = (project: string, file: string, text: string) => writePlanFileIn(plansFolder(project), file, text);

/** A file name for a new plan in `folder`: its title's slug, then -2, -3 while one is taken, the way handoff.md names them. */
export function newPlanFileIn(folder: string, title: string): string {
  const base = workflowFileName(title).replace(/\.planton\.json$/, "");
  for (let n = 1; ; n++) {
    const file = `${n === 1 ? base : `${base}-${n}`}.planton.json`;
    if (!existsSync(join(folder, file))) return file;
  }
}

export const newPlanFile = (project: string, title: string) => newPlanFileIn(plansFolder(project), title);

/**
 * What changed since `seen`: new and changed files with their versions, and removed ones. A file the folder still lists
 * but that can't be read this moment (locked, or an editor mid-save) keeps what was last seen of it: no change, and not
 * removed. Only a file the folder no longer lists is removed.
 */
export function scanPlans(
  project: string,
  seen: Map<string, PlanStamp>,
): { seen: Map<string, PlanStamp>; changes: PlanChange[] } {
  const next = new Map<string, PlanStamp>();
  const changes: PlanChange[] = [];
  for (const file of planFileNames(plansFolder(project))) {
    const before = seen.get(file);
    const keep = () => {
      if (before) next.set(file, before);
    };
    let size: number;
    let modified: number;
    try {
      const stats = statSync(join(plansFolder(project), file));
      size = stats.size;
      modified = stats.mtimeMs;
    } catch {
      keep();
      continue;
    }
    if (before && before.size === size && before.modified === modified) {
      keep();
      continue;
    }
    const plan = readPlanFile(project, file);
    if (!plan) {
      keep();
      continue;
    }
    next.set(file, { size, modified, version: plan.version });
    if (before?.version !== plan.version) changes.push({ file, version: plan.version });
  }
  for (const file of seen.keys()) {
    if (!next.has(file)) changes.push({ file, removed: true });
  }
  return { seen: next, changes };
}
