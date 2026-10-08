// The bridge's settings on this PC, ~/.claude/planton/bridge.json: this PC's id and name, the private key the
// skills' push uses, the port, the paired phones, and the folders a phone may ask Claude Code about. Written by the
// bridge (or by connect.mts while the bridge isn't running), readable only by this user.
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { basename, join } from "node:path";
import nacl from "tweetnacl";

import { PC_NAME_MAX, randomId } from "./bridge-protocol.ts";

export type PairedPhone = { id: string; name: string; key: string; pairedAt: number; lastSeenAt: number | null };
/** A folder the phone's chat may use: Claude Code runs in it, read-only. The phone sees its id and name, never its path. */
export type ChatFolderSetting = { id: string; path: string; name: string };
/** A project folder with a workspace page at /w/<token>/ (workspace.mts). Only this PC ever sees the token. */
export type WorkspaceSetting = { id: string; path: string; name: string; token: string };
export type BridgeSettings = {
  pcId: string;
  pcName: string;
  localKey: string;
  port: number | null;
  phones: PairedPhone[];
  folders: ChatFolderSetting[];
  workspaces: WorkspaceSetting[];
};

/** ~/.claude/planton, or PLANTON_HOME when it's set (the tests use a temporary folder). */
export function settingsDir(): string {
  return process.env.PLANTON_HOME ?? join(homedir(), ".claude", "planton");
}

export const settingsPath = () => join(settingsDir(), "bridge.json");
export const logPath = () => join(settingsDir(), "bridge.log");

const defaultName = () => hostname().slice(0, PC_NAME_MAX) || "This PC";

function isPairedPhone(value: unknown): value is PairedPhone {
  if (typeof value !== "object" || value === null) return false;
  const phone = value as Record<string, unknown>;
  return (
    typeof phone.id === "string" &&
    typeof phone.name === "string" &&
    typeof phone.key === "string" &&
    typeof phone.pairedAt === "number"
  );
}

function isChatFolder(value: unknown): value is ChatFolderSetting {
  if (typeof value !== "object" || value === null) return false;
  const folder = value as Record<string, unknown>;
  return typeof folder.id === "string" && typeof folder.path === "string" && typeof folder.name === "string";
}

const WORKSPACE_TOKEN_MIN = 40;

function isWorkspace(value: unknown): value is WorkspaceSetting {
  if (typeof value !== "object" || value === null) return false;
  const workspace = value as Record<string, unknown>;
  // A token is 43 characters (randomId(nacl, 32)); a hand-edited short or empty one must never open /w/<token>/.
  return (
    ["id", "path", "name", "token"].every((field) => typeof workspace[field] === "string") &&
    (workspace.token as string).length >= WORKSPACE_TOKEN_MIN
  );
}

export function readSettings(): BridgeSettings | null {
  try {
    const raw = JSON.parse(readFileSync(settingsPath(), "utf8"));
    if (typeof raw?.pcId !== "string" || typeof raw?.localKey !== "string") return null;
    return {
      pcId: raw.pcId,
      pcName: typeof raw.pcName === "string" && raw.pcName ? raw.pcName : defaultName(),
      localKey: raw.localKey,
      port: Number.isInteger(raw.port) ? raw.port : null,
      phones: Array.isArray(raw.phones) ? raw.phones.filter(isPairedPhone) : [],
      folders: Array.isArray(raw.folders) ? raw.folders.filter(isChatFolder) : [],
      workspaces: Array.isArray(raw.workspaces) ? raw.workspaces.filter(isWorkspace) : [],
    };
  } catch {
    return null;
  }
}

export function loadOrCreateSettings(): BridgeSettings {
  return (
    readSettings() ?? {
      pcId: randomId(nacl),
      pcName: defaultName(),
      localKey: randomId(nacl, 32),
      port: null,
      phones: [],
      folders: [],
      workspaces: [],
    }
  );
}

const RENAME_BUSY_ERRORS = ["EPERM", "EBUSY", "EACCES"];
const RENAME_TRIES = 10;
const RENAME_PAUSE_MS = 50;

/** Windows refuses to replace a file another process has open (a push reading it, an antivirus), so a refusal is retried. */
export function renameWhenFree(from: string, to: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      renameSync(from, to);
      return;
    } catch (error) {
      if (attempt === RENAME_TRIES || !RENAME_BUSY_ERRORS.includes((error as { code?: string }).code ?? "")) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, RENAME_PAUSE_MS);
    }
  }
}

/** Written whole, then renamed into place, so a crash mid-write never leaves half a file. */
export function writeSettings(settings: BridgeSettings) {
  mkdirSync(settingsDir(), { recursive: true });
  const temporary = `${settingsPath()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
  try {
    renameWhenFree(temporary, settingsPath());
  } catch (error) {
    try {
      rmSync(temporary, { force: true });
    } catch {
      // Failing to tidy up is no reason to hide why the write failed.
    }
    throw error;
  }
}

/** A request to the running bridge's API, with this PC's key; null when no bridge answers. */
export async function callBridge(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ status: number; body: any } | null> {
  const settings = readSettings();
  if (!settings?.port) return null;
  try {
    const response = await fetch(`http://127.0.0.1:${settings.port}${path}`, {
      method: init.method ?? "GET",
      headers: { authorization: `Bearer ${settings.localKey}`, "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  } catch {
    return null;
  }
}

/**
 * Adds a folder for the chat, or takes it out; the folders afterwards. A folder is matched by its full path, and one
 * already allowed keeps its id, so a phone's chats about it carry on. Its name is the folder's own name.
 */
export function changeFolders(folders: ChatFolderSetting[], path: string, remove: boolean): ChatFolderSetting[] {
  const kept = folders.filter((folder) => !samePath(folder.path, path));
  if (remove) return kept;
  if (kept.length < folders.length) return folders;
  const name = basename(path) || path;
  return [...kept, { id: randomId(nacl), path, name: name.slice(0, 120) }];
}

/**
 * Adds a project's workspace, or takes it out; the workspaces afterwards. A project is matched by its full path, and one
 * already added keeps its token, so its address stays the same and can be bookmarked.
 */
export function changeWorkspaces(workspaces: WorkspaceSetting[], path: string, remove: boolean): WorkspaceSetting[] {
  const kept = workspaces.filter((workspace) => !samePath(workspace.path, path));
  if (remove) return kept;
  if (kept.length < workspaces.length) return workspaces;
  const name = (basename(path) || path).slice(0, 120);
  return [...kept, { id: randomId(nacl), path, name, token: randomId(nacl, 32) }];
}

/** Windows paths don't care about case or which slash. */
export function samePath(a: string, b: string): boolean {
  if (process.platform !== "win32") return a === b;
  const tidy = (path: string) => path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  return tidy(a) === tidy(b);
}
