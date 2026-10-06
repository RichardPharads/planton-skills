// Runs Claude Code for the phone's chat: the person's own `claude` command, headless, in one of the folders they
// allowed, able to read and search there and nothing else. See "What the spike found" in
// docs/superpowers/specs/2026-10-03-chat-sources-design.md for why each flag is here.
import { spawn, spawnSync, type ChildProcess, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { isAbsolute, relative } from "node:path";

import { CHAT_NOTE_MAX, CHAT_TURN_LIMIT_MS, type ChatFailure } from "./bridge-protocol.ts";

/** Read-only, whatever the person's own settings allow: see the design's spike notes. */
export const READ_ONLY_FLAGS = ["--restricted", "--tools", "Read,Grep,Glob", "--strict-mcp-config", "--disable-slash-commands"];

const OUTPUT_FLAGS = ["-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages"];

/**
 * Variables that tie a process to the Claude Code session that started it. The bridge is usually started from inside
 * one (/planton-connect), and a chat must never write into that session.
 */
const INHERITED_SESSION_VARIABLES = [
  "CLAUDECODE",
  "CLAUDE_CODE_SESSION_ID",
  "CLAUDE_CODE_CHILD_SESSION",
  "CLAUDE_CODE_ENTRYPOINT",
  "CLAUDE_CODE_SESSION_ATTENDED",
];

export type ClaudeEvent =
  | { kind: "delta"; text: string }
  | { kind: "activity"; label: string }
  | { kind: "result"; ok: boolean; text: string; session: string; errors: string[] };

/** A path as the phone should see it: relative to the folder when it's inside, otherwise just its name. */
function shownPath(path: string, folder: string): string {
  const inside = relative(folder, path);
  const shown = inside && !inside.startsWith("..") && !isAbsolute(inside) ? inside : path.split(/[\\/]/).pop() || path;
  return shown.replace(/\\/g, "/");
}

const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** What a tool use looks like on the phone: "Reading src/core/ai.ts", "Searching for 'bridge'". */
export function activityLabel(name: string, input: Record<string, unknown>, folder: string): string {
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  let label: string;
  switch (name) {
    case "Read":
      label = text(input.file_path) ? `Reading ${shownPath(text(input.file_path), folder)}` : "Reading";
      break;
    case "Grep":
      label = text(input.pattern) ? `Searching for '${text(input.pattern)}'` : "Searching";
      break;
    case "Glob":
      label = text(input.pattern) ? `Looking for ${text(input.pattern)}` : "Looking for files";
      break;
    default:
      label = "Working";
  }
  return cut(label, 120);
}

/** One line of `claude`'s stream-json output, as what the phone needs from it: nothing for most lines. */
export function readClaudeLine(line: string, folder: string): ClaudeEvent[] {
  let event: any;
  try {
    event = JSON.parse(line);
  } catch {
    return [];
  }
  if (!event || typeof event !== "object") return [];
  if (event.type === "stream_event") {
    const delta = event.event?.type === "content_block_delta" ? event.event.delta : null;
    return delta?.type === "text_delta" && typeof delta.text === "string" && delta.text
      ? [{ kind: "delta", text: delta.text }]
      : [];
  }
  if (event.type === "assistant" && Array.isArray(event.message?.content)) {
    return event.message.content
      .filter((block: any) => block?.type === "tool_use" && typeof block.name === "string")
      .map((block: any) => ({
        kind: "activity" as const,
        label: activityLabel(block.name, block.input && typeof block.input === "object" ? block.input : {}, folder),
      }));
  }
  if (event.type === "result") {
    return [
      {
        kind: "result",
        ok: event.subtype === "success" && !event.is_error,
        text: typeof event.result === "string" ? event.result : "",
        session: typeof event.session_id === "string" ? event.session_id : "",
        errors: Array.isArray(event.errors) ? event.errors.filter((error: unknown) => typeof error === "string") : [],
      },
    ];
  }
  return [];
}

/**
 * Why a run failed, in a line for the PC's own log and `connect.mts status`: the last thing `claude` printed, or what to
 * do about it when it's recognised. Never sent to the phone.
 */
export function failureDetail(output: string): string {
  const unknown = /unknown option '([^']+)'/i.exec(output);
  if (unknown) {
    return `This Claude Code doesn't know ${unknown[1]}, which the phone's chat needs to keep it read-only. Update it with \`claude update\`.`;
  }
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const last = lines.slice(-3).join(" · ");
  return last ? (last.length > 300 ? `${last.slice(0, 299)}…` : last) : "claude exited without saying why.";
}

/** The reason for a run that didn't succeed, from what it printed. */
export function failureOf(output: string): ChatFailure | "lost-session" {
  if (/No conversation found with session ID/i.test(output)) return "lost-session";
  if (/not (logged|signed) in|please (run \/login|log in|sign in)|invalid api key|authenticat/i.test(output)) {
    return "not-signed-in";
  }
  return "error";
}

export type RunResult =
  | { ok: true; text: string; session: string }
  | {
      ok: false;
      reason: ChatFailure;
      /** Why, for this PC's log and status. */
      detail?: string;
      /** Claude Code's own message to the person, when it gave one (a usage limit, say): shown on the phone. */
      note?: string;
    };

export type RunOptions = {
  folder: string;
  text: string;
  /** Claude Code's session to continue; a new one is started without it, or when it's gone. */
  session?: string;
  /** A file of instructions added to Claude Code's own (--append-system-prompt-file). */
  promptFile?: string;
  onDelta: (text: string) => void;
  onActivity: (label: string) => void;
  limitMs?: number;
};

/** The command that runs Claude Code: `claude`, or PLANTON_CLAUDE_BIN (the tests' stand-in). */
const command = () => process.env.PLANTON_CLAUDE_BIN || "claude";

/** Ends the process and everything it started. On Windows `claude` may be a .cmd run by cmd.exe, so the whole tree. */
function end(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32" && child.pid) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

function runOnce(
  options: RunOptions,
  session: { id: string; resume: boolean },
): { done: Promise<RunResult | { ok: false; reason: "lost-session"; detail?: string; note?: string }>; stop: () => void } {
  const env = { ...process.env };
  for (const name of INHERITED_SESSION_VARIABLES) delete env[name];
  const args = [
    ...OUTPUT_FLAGS,
    ...READ_ONLY_FLAGS,
    ...(session.resume ? ["--resume", session.id] : ["--session-id", session.id]),
    ...(options.promptFile ? ["--append-system-prompt-file", options.promptFile] : []),
  ];
  // npm installs `claude` on Windows as a .cmd, which only starts through the shell. Every argument here is a flag, a
  // UUID or a path we chose, quoted, and the question itself goes in on stdin, so the shell has nothing of the phone's
  // to read.
  const windows = process.platform === "win32";
  const spawnOptions = { cwd: options.folder, env, windowsHide: true, stdio: "pipe" as const };
  const child: ChildProcessWithoutNullStreams = windows
    ? spawn([command(), ...args].map((arg) => `"${arg}"`).join(" "), { ...spawnOptions, shell: true })
    : spawn(command(), args, spawnOptions);

  let stopped = false;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    end(child);
  }, options.limitMs ?? CHAT_TURN_LIMIT_MS);

  const done = new Promise<RunResult | { ok: false; reason: "lost-session"; detail?: string; note?: string }>((resolve) => {
    let buffer = "";
    let errors = "";
    let result: Extract<ClaudeEvent, { kind: "result" }> | null = null;
    const finish = (value: RunResult | { ok: false; reason: "lost-session"; detail?: string; note?: string }) => {
      clearTimeout(timer);
      resolve(value);
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        for (const event of readClaudeLine(line, options.folder)) {
          if (stopped || timedOut) continue;
          if (event.kind === "delta") options.onDelta(event.text);
          else if (event.kind === "activity") options.onActivity(event.label);
          else result = event;
        }
      }
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      // Kept only to tell why a run failed; never sent to the phone.
      if (errors.length < 20_000) errors += chunk;
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      finish({ ok: false, reason: error.code === "ENOENT" ? "no-claude" : "error", detail: error.message });
    });
    child.on("close", (code: number | null) => {
      for (const event of readClaudeLine(buffer, options.folder)) if (event.kind === "result") result = event;
      if (stopped) return finish({ ok: false, reason: "stopped" });
      if (timedOut) return finish({ ok: false, reason: "timeout" });
      const finished = result as Extract<ClaudeEvent, { kind: "result" }> | null;
      if (finished?.ok) return finish({ ok: true, text: finished.text, session: finished.session || session.id });
      // cmd.exe reports a missing command itself, with exit code 9009, rather than failing the spawn.
      if (windows && code === 9009) return finish({ ok: false, reason: "no-claude" });
      const said = `${errors}\n${finished?.errors.join("\n") ?? ""}\n${finished?.text ?? ""}`;
      const reason = failureOf(said);
      // A run that ended with Claude Code's own message (its usage limit, an API error) says it to the person; that's
      // its reply, not anything from the folder.
      const note =
        finished && !finished.ok && finished.text && finished.text.length <= CHAT_NOTE_MAX ? finished.text.trim() : undefined;
      finish({ ok: false, reason, detail: failureDetail(said), ...(note && reason !== "lost-session" ? { note } : {}) });
    });

    child.stdin.on("error", () => {
      // The process ended before reading the question: its exit says why.
    });
    child.stdin.end(options.text);
  });

  return {
    done,
    stop: () => {
      stopped = true;
      end(child);
    },
  };
}

/**
 * Asks Claude Code once. Text and activity arrive through `onDelta` and `onActivity` while it works; the result has the
 * whole reply and the session to continue next time. A session that's gone (Claude Code's own files were cleared) is
 * replaced by a new one, so the question is still answered, without the earlier turns.
 */
export function runClaude(options: RunOptions): { done: Promise<RunResult>; stop: () => void } {
  let current = runOnce(options, options.session ? { id: options.session, resume: true } : { id: randomUUID(), resume: false });
  let stopped = false;
  const done = (async (): Promise<RunResult> => {
    const first = await current.done;
    if (first.ok || first.reason !== "lost-session" || stopped)
      return first.ok ? first : { ok: false, reason: lost(first.reason), detail: first.detail, note: noteOf(first) };
    current = runOnce(options, { id: randomUUID(), resume: false });
    const second = await current.done;
    return second.ok ? second : { ok: false, reason: lost(second.reason), detail: second.detail, note: noteOf(second) };
  })();
  return {
    done,
    stop: () => {
      stopped = true;
      current.stop();
    },
  };
}

const lost = (reason: ChatFailure | "lost-session"): ChatFailure => (reason === "lost-session" ? "error" : reason);
const noteOf = (result: { note?: string }) => result.note;
