// Which settings a project has set, for the workspace (workspace-routes.mts): for each name the page asks about, whether
// the project's .env files give it a value. A value is looked at only to see if it is empty, then dropped: no value is
// kept, returned, logged or put in an error message, and no name the page didn't ask about is answered, so nothing read
// from a file comes back but booleans. Only these fixed file names, directly in the project's folder, are ever read.
import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, sep } from "node:path";

import { ENV_NAME_PATTERN } from "./workflow-file.ts";

/** Files that give settings their values, in Expo's priority, lowest first: a later one wins. */
const SET_FILES = [".env", ".env.development", ".env.local", ".env.development.local"];
/** Files that only list which settings a project needs. */
const EXAMPLE_FILES = [".env.example", ".env.sample"];
/** A real .env is a few lines; anything bigger than this isn't read. */
const MAX_BYTES = 256 * 1024;
/** The most names one request may ask about: 20 cards' worth of a card's 20. */
export const MAX_REQUESTED_NAMES = 400;

export type EnvFile = { name: string; gitignored: boolean | null };
export type ProjectEnv = { names: Record<string, { set: boolean; example: boolean }>; files: EnvFile[] };

const ASSIGNMENT = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=(.*)$/;
const QUOTES = ['"', "'", "`"];

/** Where `quote` closes in `text` from `from` on: the first one not escaped by a backslash, or -1. */
function closingQuote(text: string, quote: string, from: number): number {
  for (let index = from; index < text.length; index++) {
    if (text[index] === "\\") index++;
    else if (text[index] === quote) return index;
  }
  return -1;
}

/**
 * Each `NAME=value` line gives NAME → whether the value is empty; the last line for a name counts. As in dotenv, a value
 * that opens a quote and doesn't close it on its line goes on to the line that does (a private key, some JSON), and the
 * lines inside it are never read as assignments; one never closed takes the rest of the file. An unquoted value ends at a
 * ` #` comment. Only names a card could list (ENV_NAME_PATTERN) are kept.
 */
export function parseEnvNames(text: string): Map<string, boolean> {
  const names = new Map<string, boolean>();
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const trimmed = lines[index].trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = ASSIGNMENT.exec(trimmed);
    if (!match) continue;
    const [, name, raw] = match;
    const value = raw.trim();
    let filled: boolean;
    if (QUOTES.includes(value[0])) {
      const end = closingQuote(value, value[0], 1);
      if (end !== -1) {
        filled = end > 1;
      } else {
        // The value carries on over the next lines; what they hold is skipped, not parsed. It holds a line break at
        // least, so it isn't empty.
        filled = true;
        while (index + 1 < lines.length && closingQuote(lines[index + 1], value[0], 0) === -1) index++;
        index++;
      }
    } else {
      filled = value.replace(/(^|\s)#.*$/, "").trim().length > 0;
    }
    if (ENV_NAME_PATTERN.test(name)) names.set(name, filled);
  }
  return names;
}

/**
 * The names a request asks about (`names=A,B,…`): the valid ones, once each, in order; anything else is ignored. Null for
 * a request naming more than MAX_REQUESTED_NAMES.
 */
export function requestedNames(list: string | null): string[] | null {
  const entries = list ? list.split(",") : [];
  if (entries.length > MAX_REQUESTED_NAMES) return null;
  return [...new Set(entries.filter((name) => ENV_NAME_PATTERN.test(name)))];
}

/** A file's names; "unreadable" for one that is there but too big or can't be read; null for one that isn't there. */
function readNames(project: string, name: string): Map<string, boolean> | "unreadable" | null {
  let path = join(project, name);
  try {
    if (lstatSync(path).isSymbolicLink()) {
      // A link (say, a committed one in a cloned repository) is followed only to a file inside the project.
      const root = realpathSync(project);
      path = realpathSync(path);
      if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) return null;
    }
    if (!statSync(path).isFile()) return null;
  } catch {
    return null;
  }
  try {
    if (statSync(path).size > MAX_BYTES) return "unreadable";
    return parseEnvNames(readFileSync(path, "utf8"));
  } catch {
    return "unreadable";
  }
}

/**
 * `git check-ignore` for all the files in one call: it prints the ignored ones and exits 0, or 1 when none is; anything
 * else (no repository, no git) can't be told, for any of them.
 */
function gitignored(project: string, files: string[], gitEnv: Record<string, string>): Map<string, boolean | null> {
  const answers = new Map<string, boolean | null>(files.map((file) => [file, null]));
  if (files.length === 0) return answers;
  // The repository is found from the project's folder, so a package inside a monorepo gets its repository's answer; one
  // named by this process's own environment is never used.
  const { GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE, ...rest } = process.env;
  const result = spawnSync("git", ["check-ignore", "--", ...files], {
    cwd: project,
    stdio: ["ignore", "pipe", "ignore"],
    encoding: "utf8",
    timeout: 5000,
    env: { ...rest, ...gitEnv },
  });
  if (result.status !== 0 && result.status !== 1) return answers;
  const ignored = new Set(result.stdout.split(/\r?\n/).map((line) => line.trim()));
  for (const file of files) answers.set(file, ignored.has(file));
  return answers;
}

/**
 * Whether each of `wanted` (valid names only, see requestedNames) is set in the project, and its env files. `gitEnv` is
 * extra environment for the git call; the workspace passes none (the tests use it to keep git out of the temp folder's
 * surroundings).
 */
export function projectEnv(project: string, wanted: string[], gitEnv: Record<string, string> = {}): ProjectEnv {
  const state = new Map<string, { set: boolean; example: boolean }>(
    wanted.filter((name) => ENV_NAME_PATTERN.test(name)).map((name) => [name, { set: false, example: false }]),
  );
  const listed: string[] = [];
  for (const file of [...SET_FILES, ...EXAMPLE_FILES]) {
    const names = readNames(project, file);
    if (names === null) continue;
    listed.push(file);
    if (names === "unreadable") continue;
    const example = EXAMPLE_FILES.includes(file);
    for (const [name, filled] of names) {
      const entry = state.get(name);
      if (!entry) continue;
      if (example) entry.example = true;
      else entry.set = filled;
    }
  }
  const ignored = gitignored(project, listed, gitEnv);
  return {
    names: Object.fromEntries(state),
    files: listed.map((name) => ({ name, gitignored: ignored.get(name) ?? null })),
  };
}
