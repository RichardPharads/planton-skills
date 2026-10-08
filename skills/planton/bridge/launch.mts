// Starting the Planton bridge and opening pages, shared by connect.mts and workspace.mts.
import { spawn } from "node:child_process";
import { mkdirSync, openSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { callBridge, logPath, settingsDir } from "./settings.mts";

const here = dirname(fileURLToPath(import.meta.url));

export type Status = {
  pc: { name: string };
  port: number;
  phones: { name: string; connected: boolean }[];
  waiting: number;
  folders?: { name: string; path: string }[];
  workspaces?: { name: string; path: string; url: string }[];
  lastChatProblem?: { at: number; reason: string; detail: string } | null;
};

export function isFolder(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export async function status(): Promise<Status | null> {
  const reply = await callBridge("/api/status");
  return reply?.status === 200 ? (reply.body as Status) : null;
}

export async function startBridge(): Promise<Status | null> {
  mkdirSync(settingsDir(), { recursive: true });
  const log = openSync(logPath(), "a");
  // Its own process, so it outlives this command and the terminal that ran it.
  const child = spawn(process.execPath, [...process.execArgv, join(here, "bridge.mts")], {
    detached: true,
    stdio: ["ignore", log, log],
    windowsHide: true,
    env: process.env,
  });
  child.unref();
  for (let attempt = 0; attempt < 50; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const running = await status();
    if (running) return running;
  }
  return null;
}

export function openInBrowser(url: string) {
  const [program, programArgs]: [string, string[]] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  const opener = spawn(program, programArgs, { detached: true, stdio: "ignore", windowsHide: true });
  // No opener here (xdg-open on a bare Linux, in a container): the Page: line above is enough.
  opener.on("error", () => {});
  opener.unref();
}
