// The Planton bridge: a small server on the PC. The Planton skills push milestones and finished plans to it
// (push.mts), and a paired phone connects to it over the Wi-Fi to receive them. The phone can also chat with Claude
// Code here, read-only, in the folders allowed with `connect.mts allow` (claude-runner.mts). connect.mts (/planton-connect) starts
// it and makes pairing codes. Only the phones' WebSocket at /ws answers other machines; everything else, and a project's
// workspace page at /w/<token>/ (workspace-routes.mts), answers this PC alone. See docs/superpowers/specs/2026-10-02-claude-code-bridge-design.md.
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { networkInterfaces } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import nacl from "tweetnacl";
import { WebSocketServer, type WebSocket } from "ws";

import {
  HEARTBEAT_MS,
  PAIRING_CODE_TTL_MS,
  PLAN_MAX_BYTES,
  PROTOCOL_VERSION,
  STATUS_MAX,
  STATUS_TTL_MS,
  Sequence,
  buildPairingLink,
  deviceKeyFor,
  fromBase64,
  helloProof,
  lanAddresses,
  pairingProof,
  planFits,
  proofMatches,
  randomId,
  readFrame,
  readPhoneMessage,
  sameBytes,
  seal,
  sessionKeyFor,
  toBase64,
  toBase64Url,
  unseal,
  utf8Encode,
  type BridgeMessage,
  type ChatFailure,
  type ChatRequest,
  type DeniedReason,
  type Frame,
  type HelloFrame,
  type PairFrame,
  type PcInfo,
  type PhoneMessage,
  type PlanMessage,
  type Unnumbered,
} from "./bridge-protocol.ts";
import { CHOICES_INSTRUCTIONS } from "./chat-choices.ts";
import { runClaude } from "./claude-runner.mts";
import {
  changeFolders,
  changeWorkspaces,
  loadOrCreateSettings,
  samePath,
  settingsDir,
  writeSettings,
  type PairedPhone,
} from "./settings.mts";
import { isLocal, readBody, readJson, reply } from "./http.mts";
import { pairingPage } from "./page.mts";
import { workspaceRoutes } from "./workspace-routes.mts";

const FIRST_PORT = Number(process.env.PLANTON_BRIDGE_PORT ?? 4444);
/** 4444 to 4454: the first one that's free. */
const PORT_TRIES = 11;
const CODE_TTL_MS = Number(process.env.PLANTON_BRIDGE_CODE_TTL_MS ?? PAIRING_CODE_TTL_MS);
const HEARTBEAT_EVERY_MS = Number(process.env.PLANTON_BRIDGE_HEARTBEAT_MS ?? HEARTBEAT_MS);
/** One more address the QR code may use besides the PC's Wi-Fi and Ethernet ones: the tests use 127.0.0.1. */
const EXTRA_HOST = process.env.PLANTON_BRIDGE_HOST ?? null;
/** A phone has this long after connecting to prove itself. */
const AUTH_TIMEOUT_MS = 10_000;
const FAILURE_WINDOW_MS = 60_000;
const FAILURE_LIMIT = 5;
const LOCKOUT_MS = 5 * 60_000;
const OUTBOX_MAX = 10;
const OUTBOX_TTL_MS = 24 * 60 * 60 * 1000;

const settings = loadOrCreateSettings();
let port = 0;
let server: Server;

type Pairing = { code: string; viewToken: string; host: string; expiresAt: number; used: boolean };
/** The current pairing code. Kept in memory only: after a restart, /planton-connect makes a new one. */
let pairing: Pairing | null = null;

type Session = { socket: WebSocket; phoneId: string; key: Uint8Array; sequence: Sequence; alive: boolean };
const sessions = new Set<Session>();

type WaitingPlan = {
  id: string;
  path: string;
  source: string;
  fileName: string;
  text: string;
  at: number;
  ackedBy: Set<string>;
};
let outbox: WaitingPlan[] = [];
let latestStatus: { id: string; text: string; at: number } | null = null;

const failures = new Map<string, { count: number; since: number; lockedUntil: number }>();

/** Each phone's Claude Code reply that's still being written: one at a time per phone. */
const runningChats = new Map<string, { chatId: string; turnId: string; stop: () => void }>();
type ChatOutcome = Unnumbered<Extract<BridgeMessage, { type: "chat-done" | "chat-failed" }>>;
/**
 * Each phone's finished replies, kept until it says it has them, so one that ends while the phone is away still
 * arrives. In memory only: a reply cut off by a bridge restart reads as stopped on the phone.
 */
const chatOutcomes = new Map<string, ChatOutcome[]>();
const CHAT_OUTCOMES_KEPT = 20;
/** Why the last chat turn failed, for this PC's `connect.mts status`; never sent to the phone. */
let lastChatProblem: { at: number; reason: ChatFailure; detail: string } | null = null;
const CHAT_LIMIT_MS = Number(process.env.PLANTON_CHAT_LIMIT_MS) || undefined;

const pc = (): PcInfo => ({ id: settings.pcId, name: settings.pcName });
const log = (message: string) => console.log(`${new Date().toISOString()} ${message}`);

/**
 * Saves the settings after a change. They are also kept in memory, and memory is the truth: when the file can't be
 * written (another program has it open, the disk is full) that's logged, and the next change writes it again.
 */
function saveSettings() {
  try {
    writeSettings(settings);
  } catch (error) {
    log(`Couldn't save bridge.json: ${error instanceof Error ? error.message : error}`);
  }
}

/** The PC's addresses a phone could reach it on, likeliest first, plus the extra one when it's set. */
function addresses(): string[] {
  const found = lanAddresses(
    Object.entries(networkInterfaces()).flatMap(([name, entries]) =>
      (entries ?? []).map((entry) => ({ name, address: entry.address, family: entry.family, internal: entry.internal })),
    ),
  );
  return EXTRA_HOST && !found.includes(EXTRA_HOST) ? [...found, EXTRA_HOST] : found;
}

// ---------------------------------------------------------------------------------------------------------
// Pairing and proving.
// ---------------------------------------------------------------------------------------------------------

function newPairing(host: string): Pairing {
  pairing = { code: randomId(nacl), viewToken: randomId(nacl), host, expiresAt: Date.now() + CODE_TTL_MS, used: false };
  log("Made a new pairing code");
  return pairing;
}

const pairingLink = (current: Pairing) => buildPairingLink({ host: current.host, port, pc: pc(), code: current.code });

function acceptPairing(frame: PairFrame, challenge: string): { phone: PairedPhone } | { denied: DeniedReason } {
  if (!pairing || Date.now() > pairing.expiresAt) return { denied: "expired-code" };
  if (pairing.used) return { denied: "used-code" };
  if (!proofMatches(pairingProof(nacl, pairing.code, challenge), frame.proof)) return { denied: "bad-proof" };
  pairing.used = true;
  const now = Date.now();
  const phone: PairedPhone = {
    id: frame.deviceId,
    name: frame.deviceName.slice(0, 40),
    key: toBase64(deviceKeyFor(nacl, pairing.code, frame.deviceId)),
    pairedAt: now,
    lastSeenAt: now,
  };
  settings.phones = [...settings.phones.filter((existing) => existing.id !== phone.id), phone];
  saveSettings();
  log(`Paired ${phone.name}`);
  return { phone };
}

function acceptHello(frame: HelloFrame, challenge: string): { phone: PairedPhone } | { denied: DeniedReason } {
  const phone = settings.phones.find((candidate) => candidate.id === frame.deviceId);
  const key = phone ? fromBase64(phone.key) : null;
  if (!phone || !key) return { denied: "unknown-device" };
  if (!proofMatches(helloProof(nacl, key, challenge), frame.proof)) return { denied: "bad-proof" };
  return { phone };
}

function lockedOut(address: string): boolean {
  return (failures.get(address)?.lockedUntil ?? 0) > Date.now();
}

/** Five failed attempts within a minute from one address lock it out for five minutes. */
function noteFailure(address: string) {
  const now = Date.now();
  const previous = failures.get(address);
  const entry = previous && now - previous.since < FAILURE_WINDOW_MS ? previous : { count: 0, since: now, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= FAILURE_LIMIT) entry.lockedUntil = now + LOCKOUT_MS;
  failures.set(address, entry);
}

// ---------------------------------------------------------------------------------------------------------
// Sending, and what waits for phones.
// ---------------------------------------------------------------------------------------------------------

function sendFrame(socket: WebSocket, frame: Frame) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(frame));
}

function sendSealed(session: Session, message: Unnumbered<BridgeMessage>) {
  sendFrame(session.socket, seal(nacl, session.key, { ...message, seq: session.sequence.next() }));
}

function deny(socket: WebSocket, reason: DeniedReason) {
  sendFrame(socket, { t: "denied", reason });
  socket.close(1008);
}

/** Plans leave the outbox once every paired phone has acknowledged them, or after a day. */
function pruneOutbox() {
  const now = Date.now();
  const phoneIds = settings.phones.map((phone) => phone.id);
  outbox = outbox.filter(
    (plan) => now - plan.at < OUTBOX_TTL_MS && !(phoneIds.length > 0 && phoneIds.every((id) => plan.ackedBy.has(id))),
  );
}

function waitingFor(phoneId: string): WaitingPlan[] {
  pruneOutbox();
  return outbox.filter((plan) => !plan.ackedBy.has(phoneId));
}

function planMessage(plan: WaitingPlan): Unnumbered<PlanMessage> {
  return { type: "plan", id: plan.id, source: plan.source, fileName: plan.fileName, text: plan.text, at: plan.at };
}

/**
 * A phone that just connected gets the latest milestone, if it's recent, every plan it hasn't acknowledged, and every
 * chat reply that finished without it.
 */
function catchUp(session: Session) {
  const status = latestStatus;
  if (status && Date.now() - status.at < STATUS_TTL_MS) sendSealed(session, { type: "status", ...status });
  for (const plan of waitingFor(session.phoneId)) sendSealed(session, planMessage(plan));
  for (const outcome of chatOutcomes.get(session.phoneId) ?? []) sendSealed(session, outcome);
}

function pushStatus(text: string): number {
  const status = { id: randomId(nacl), text, at: Date.now() };
  latestStatus = status;
  for (const session of sessions) sendSealed(session, { type: "status", ...status });
  return sessions.size;
}

function pushPlan(path: string, fileName: string, text: string): number {
  // A finished plan ends the milestones that led up to it.
  latestStatus = null;
  const plan: WaitingPlan = {
    id: randomId(nacl),
    path,
    // Lets the phone match an updated plan without learning where it's stored.
    source: toBase64Url(nacl.hash(utf8Encode(path)).slice(0, 16)),
    fileName,
    text,
    at: Date.now(),
    ackedBy: new Set(),
  };
  pruneOutbox();
  outbox = [...outbox.filter((waiting) => waiting.path !== path), plan].slice(-OUTBOX_MAX);
  for (const session of sessions) sendSealed(session, planMessage(plan));
  log(`Sent ${fileName} to ${sessions.size} connected phone(s)`);
  return sessions.size;
}

function forgetPhone(phoneId: string) {
  const phone = settings.phones.find((candidate) => candidate.id === phoneId);
  if (!phone) return;
  runningChats.get(phoneId)?.stop();
  runningChats.delete(phoneId);
  chatOutcomes.delete(phoneId);
  settings.phones = settings.phones.filter((candidate) => candidate.id !== phoneId);
  saveSettings();
  for (const session of sessions) if (session.phoneId === phoneId) session.socket.close(1000);
  pruneOutbox();
  log(`Forgot ${phone.name}`);
}

function touchPhone(phoneId: string) {
  settings.phones = settings.phones.map((phone) => (phone.id === phoneId ? { ...phone, lastSeenAt: Date.now() } : phone));
  saveSettings();
}

function handlePhoneMessage(session: Session, message: PhoneMessage) {
  switch (message.type) {
    case "ack":
      outbox.find((plan) => plan.id === message.id)?.ackedBy.add(session.phoneId);
      pruneOutbox();
      return;
    case "forget":
      return forgetPhone(session.phoneId);
    case "folders":
      // Names only: where a folder is on this PC stays on this PC.
      return sendSealed(session, { type: "folders", folders: settings.folders.map(({ id, name }) => ({ id, name })) });
    case "chat":
      return startChat(session.phoneId, message);
    case "chat-stop": {
      const running = runningChats.get(session.phoneId);
      if (running && running.chatId === message.chatId && running.turnId === message.turnId) running.stop();
      return;
    }
    case "chat-ack": {
      const kept = chatOutcomes.get(session.phoneId) ?? [];
      chatOutcomes.set(
        session.phoneId,
        kept.filter((outcome) => outcome.chatId !== message.chatId || outcome.turnId !== message.turnId),
      );
      return;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------
// Chatting with Claude Code, read-only, in the allowed folders.
// ---------------------------------------------------------------------------------------------------------

function sendToPhone(phoneId: string, message: Unnumbered<BridgeMessage>) {
  for (const session of sessions) if (session.phoneId === phoneId) sendSealed(session, message);
}

/** A finished turn: kept until the phone acknowledges it, and sent to it now if it's connected. */
function finishChat(phoneId: string, outcome: ChatOutcome) {
  const kept = (chatOutcomes.get(phoneId) ?? []).filter(
    (earlier) => earlier.chatId !== outcome.chatId || earlier.turnId !== outcome.turnId,
  );
  chatOutcomes.set(phoneId, [...kept, outcome].slice(-CHAT_OUTCOMES_KEPT));
  sendToPhone(phoneId, outcome);
}

function startChat(phoneId: string, message: ChatRequest) {
  const { chatId, turnId } = message;
  const failed = (reason: ChatFailure, note?: string) =>
    finishChat(phoneId, { type: "chat-failed", chatId, turnId, reason, ...(note ? { note } : {}) });
  if (runningChats.has(phoneId)) return failed("busy");
  const folder = settings.folders.find((candidate) => candidate.id === message.folder);
  if (!folder || !isFolder(folder.path)) return failed("folder");

  const started = Date.now();
  const run = runClaude({
    folder: folder.path,
    text: message.text,
    session: message.session,
    promptFile: chatPromptFile(),
    limitMs: CHAT_LIMIT_MS,
    onDelta: (text) => sendToPhone(phoneId, { type: "chat-delta", chatId, turnId, text }),
    onActivity: (label) => sendToPhone(phoneId, { type: "chat-activity", chatId, turnId, label }),
  });
  runningChats.set(phoneId, { chatId, turnId, stop: run.stop });
  log("Chat turn started");
  run.done
    .then((result) => {
      const outcome = result.ok ? "answered" : result.reason;
      const detail = !result.ok && result.reason !== "stopped" && result.detail ? `: ${result.detail}` : "";
      log(`Chat turn finished (${Date.now() - started} ms, ${outcome})${detail}`);
      if (!result.ok) {
        if (result.reason !== "stopped" && result.reason !== "busy") {
          lastChatProblem = { at: Date.now(), reason: result.reason, detail: result.detail ?? "" };
        }
        return failed(result.reason, result.note);
      }
      // A reply bigger than a plan is cut rather than lost.
      const text = planFits(result.text) ? result.text : result.text.slice(0, PLAN_MAX_BYTES / 4);
      finishChat(phoneId, { type: "chat-done", chatId, turnId, session: result.session, text });
    })
    .catch((error) => {
      log(`Chat turn failed: ${error}`);
      failed("error");
    })
    .finally(() => {
      if (runningChats.get(phoneId)?.turnId === turnId) runningChats.delete(phoneId);
    });
}

function isFolder(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * What Claude Code is told on top of its own instructions: that it's answering on a phone, read-only, and how to write
 * a Planton plan. The plan format is the planton skill's reference/format.md, next to this bridge when it's installed;
 * read here because Claude Code itself can only read inside the chat's folder.
 */
let promptFile: string | null = null;
function chatPromptFile(): string {
  if (promptFile && existsSync(promptFile)) return promptFile;
  const here = dirname(fileURLToPath(import.meta.url));
  const formatPath = join(here, "..", "reference", "format.md");
  const format = existsSync(formatPath) ? readFileSync(formatPath, "utf8") : "";
  const text = [
    "You're answering someone on their phone, in the Planton app, through the Planton bridge on their PC.",
    "Keep answers short and easy to read on a small screen: short paragraphs and short lists, no wide tables.",
    "You can read and search this folder, and nothing else: you can't change files or run commands. When asked to, say so in one line and suggest what they could do instead.",
    "When they ask for a plan, reply with one short sentence, then the plan as JSON in a ```json code block, in Planton's workflow format below. Only one plan per reply.",
    "",
    CHOICES_INSTRUCTIONS,
    format ? `\n${format}` : "",
  ].join("\n");
  const path = join(settingsDir(), "chat-prompt.md");
  writeFileSync(path, text, { mode: 0o600 });
  promptFile = path;
  return path;
}

// ---------------------------------------------------------------------------------------------------------
// A phone's connection: challenge, proof, then sealed messages both ways.
// ---------------------------------------------------------------------------------------------------------

function welcomePhone(socket: WebSocket, address: string) {
  const challenge = randomId(nacl);
  let session: Session | null = null;
  sendFrame(socket, { t: "challenge", v: PROTOCOL_VERSION, nonce: challenge, pc: pc() });
  const deadline = setTimeout(() => {
    if (!session) socket.terminate();
  }, AUTH_TIMEOUT_MS);

  socket.on("message", (data) => {
    try {
      const frame = readFrame(String(data));
      if (!frame) {
        socket.close(1008);
        return;
      }
      if (session) {
        // After the welcome, only sealed messages, each newer than the last.
        if (frame.t !== "sealed") {
          socket.close(1008);
          return;
        }
        const message = readPhoneMessage(unseal(nacl, session.key, frame));
        if (message && session.sequence.accept(message.seq)) handlePhoneMessage(session, message);
        return;
      }
      if (frame.t !== "pair" && frame.t !== "hello") {
        socket.close(1008);
        return;
      }
      if (lockedOut(address)) return deny(socket, "too-many-tries");
      if (frame.v !== PROTOCOL_VERSION) return deny(socket, "version");
      const result = frame.t === "pair" ? acceptPairing(frame, challenge) : acceptHello(frame, challenge);
      if ("denied" in result) {
        noteFailure(address);
        return deny(socket, result.denied);
      }
      clearTimeout(deadline);
      const deviceKey = fromBase64(result.phone.key) as Uint8Array;
      const opened: Session = {
        socket,
        phoneId: result.phone.id,
        key: sessionKeyFor(nacl, deviceKey, challenge),
        sequence: new Sequence(),
        alive: true,
      };
      session = opened;
      sessions.add(opened);
      touchPhone(opened.phoneId);
      log(`${result.phone.name} connected`);
      sendSealed(opened, { type: "welcome", pc: pc(), waiting: waitingFor(opened.phoneId).length, features: ["chat"] });
      catchUp(opened);
    } catch (error) {
      // ws doesn't catch what a listener throws, which would end the whole bridge: an error here ends this connection only.
      log(`A phone's message failed: ${error}`);
      socket.close(1011);
    }
  });
  socket.on("pong", () => {
    if (session) session.alive = true;
  });
  socket.on("close", () => {
    clearTimeout(deadline);
    if (session) sessions.delete(session);
  });
  socket.on("error", () => socket.terminate());
}

// A heartbeat tells each phone the connection is alive; a phone that hasn't answered the last ping is dropped.
setInterval(() => {
  for (const session of sessions) {
    if (!session.alive) {
      session.socket.terminate();
      continue;
    }
    session.alive = false;
    session.socket.ping();
    sendSealed(session, { type: "heartbeat", at: Date.now() });
  }
}, HEARTBEAT_EVERY_MS);

// ---------------------------------------------------------------------------------------------------------
// The local API: this PC only, with its key.
// ---------------------------------------------------------------------------------------------------------

function hasKey(request: IncomingMessage): boolean {
  return sameBytes(utf8Encode(request.headers.authorization ?? ""), utf8Encode(`Bearer ${settings.localKey}`));
}

const workspaceUrl = (token: string) => `http://127.0.0.1:${port}/w/${token}/`;
const workspaceList = () => settings.workspaces.map(({ name, path, token }) => ({ name, path, url: workspaceUrl(token) }));

function statusReport() {
  pruneOutbox();
  const connected = new Set([...sessions].map((session) => session.phoneId));
  return {
    pc: pc(),
    port,
    phones: settings.phones.map((phone) => ({
      id: phone.id,
      name: phone.name,
      connected: connected.has(phone.id),
      lastSeenAt: phone.lastSeenAt,
    })),
    waiting: outbox.length,
    addresses: addresses(),
    folders: settings.folders.map(({ name, path }) => ({ name, path })),
    workspaces: workspaceList(),
    lastChatProblem,
  };
}

/** The pairing page connect.mts opens: the QR code, the PC's other addresses, and the paired phones. */
async function handlePage(request: IncomingMessage, response: ServerResponse, url: URL) {
  const match = /^\/pair\/([A-Za-z0-9_-]+)(\/remove)?$/.exec(url.pathname);
  const current = pairing;
  if (!match || !current || !sameBytes(utf8Encode(match[1]), utf8Encode(current.viewToken))) {
    return reply(response, 404, { error: "not-found" });
  }
  const viewPath = `/pair/${current.viewToken}`;
  if (match[2]) {
    if (request.method !== "POST") return reply(response, 405, { error: "method" });
    const body = await readBody(request, 4096);
    const phoneId = body === null ? null : new URLSearchParams(body).get("phone");
    if (phoneId) forgetPhone(phoneId);
    response.writeHead(303, { location: viewPath });
    response.end();
    return;
  }
  const asked = url.searchParams.get("host");
  if (asked && addresses().includes(asked)) current.host = asked;
  const connected = new Set([...sessions].map((session) => session.phoneId));
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(
    pairingPage({
      pcName: settings.pcName,
      link: !current.used && Date.now() < current.expiresAt ? pairingLink(current) : null,
      expiresAt: current.expiresAt,
      host: current.host,
      addresses: addresses(),
      phones: settings.phones.map((phone) => ({ id: phone.id, name: phone.name, connected: connected.has(phone.id) })),
      folders: settings.folders.map(({ name, path }) => ({ name, path })),
      viewPath,
    }),
  );
}

async function handle(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (!isLocal(request)) return reply(response, 404, { error: "not-found" });
  if (url.pathname.startsWith("/w/")) return workspaces.handle(request, response, url);
  if (url.pathname.startsWith("/pair/")) return handlePage(request, response, url);
  if (!url.pathname.startsWith("/api/")) return reply(response, 404, { error: "not-found" });
  if (!hasKey(request)) return reply(response, 401, { error: "no-key" });
  switch (`${request.method} ${url.pathname}`) {
    case "GET /api/status":
      return reply(response, 200, statusReport());
    case "POST /api/pairing": {
      const body = await readJson(request, 4096);
      if (!body.ok) return reply(response, body.status, { error: "bad-request" });
      const choices = addresses();
      const asked = typeof body.value.host === "string" ? body.value.host : null;
      const host = asked && choices.includes(asked) ? asked : choices[0];
      if (!host) return reply(response, 409, { error: "no-network" });
      const made = newPairing(host);
      return reply(response, 200, {
        link: pairingLink(made),
        viewUrl: `http://127.0.0.1:${port}/pair/${made.viewToken}`,
        expiresAt: made.expiresAt,
      });
    }
    case "POST /api/push": {
      const body = await readJson(request, PLAN_MAX_BYTES * 2 + 4096);
      if (!body.ok) return reply(response, body.status, { error: body.status === 413 ? "too-large" : "bad-request" });
      const { kind, text, path, fileName } = body.value;
      if (kind === "status") {
        if (typeof text !== "string" || !text.trim() || text.length > STATUS_MAX) {
          return reply(response, 400, { error: "bad-status" });
        }
        return reply(response, 200, { delivered: pushStatus(text.trim()) });
      }
      if (kind === "plan") {
        if (typeof text !== "string" || typeof path !== "string" || typeof fileName !== "string" || !fileName) {
          return reply(response, 400, { error: "bad-plan" });
        }
        if (!planFits(text)) return reply(response, 413, { error: "too-large" });
        return reply(response, 200, { delivered: pushPlan(path, fileName.slice(0, 200), text) });
      }
      return reply(response, 400, { error: "bad-kind" });
    }
    case "POST /api/folders": {
      // connect.mts allow: a folder the phone's chat may use, or (remove) not any more.
      const body = await readJson(request, 8192);
      const { path, remove } = body.ok ? body.value : {};
      if (typeof path !== "string" || !isAbsolute(path)) return reply(response, 400, { error: "bad-path" });
      const full = resolve(path);
      if (remove !== true && !isFolder(full)) return reply(response, 400, { error: "not-a-folder" });
      settings.folders = changeFolders(settings.folders, full, remove === true);
      saveSettings();
      log(remove === true ? "Removed a chat folder" : "Allowed a chat folder");
      return reply(response, 200, { folders: settings.folders.map(({ name, path }) => ({ name, path })) });
    }
    case "POST /api/workspaces": {
      // workspace.mts: a project folder's workspace page, or (remove) not any more.
      const body = await readJson(request, 8192);
      const { path, remove } = body.ok ? body.value : {};
      if (typeof path !== "string" || !isAbsolute(path)) return reply(response, 400, { error: "bad-path" });
      const full = resolve(path);
      if (remove !== true && !isFolder(full)) return reply(response, 400, { error: "not-a-folder" });
      settings.workspaces = changeWorkspaces(settings.workspaces, full, remove === true);
      saveSettings();
      log(remove === true ? "Removed a workspace" : "Added a workspace");
      const added = remove === true ? undefined : settings.workspaces.find((workspace) => samePath(workspace.path, full));
      return reply(response, 200, { url: added ? workspaceUrl(added.token) : null, workspaces: workspaceList() });
    }
    case "POST /api/forget": {
      const body = await readJson(request, 4096);
      if (!body.ok || typeof body.value.phoneId !== "string") return reply(response, 400, { error: "bad-request" });
      forgetPhone(body.value.phoneId);
      return reply(response, 200, { forgotten: true });
    }
    case "POST /api/stop":
      reply(response, 200, { stopping: true });
      return stop();
    default:
      return reply(response, 404, { error: "not-found" });
  }
}

// ---------------------------------------------------------------------------------------------------------
// Starting and stopping.
// ---------------------------------------------------------------------------------------------------------

const workspaces = workspaceRoutes({
  workspaces: () => settings.workspaces,
  port: () => port,
  phonesPaired: () => settings.phones.length,
  pushPlan,
  log,
});

const phoneSockets = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

function makeServer(): Server {
  const made = createServer((request, response) => {
    handle(request, response).catch((error) => {
      log(`A request failed: ${error}`);
      if (!response.headersSent) reply(response, 500, { error: "internal" });
    });
  });
  made.on("upgrade", (request, socket, head) => {
    if ((request.url ?? "").split("?")[0] !== "/ws") {
      socket.destroy();
      return;
    }
    phoneSockets.handleUpgrade(request, socket, head, (ws) => welcomePhone(ws, request.socket.remoteAddress ?? "unknown"));
  });
  return made;
}

async function listen(): Promise<{ server: Server; port: number }> {
  for (let candidate = FIRST_PORT; candidate < FIRST_PORT + PORT_TRIES; candidate++) {
    const attempt = makeServer();
    const listening = await new Promise<boolean>((resolve) => {
      attempt.once("error", () => resolve(false));
      attempt.once("listening", () => resolve(true));
      attempt.listen(candidate, "0.0.0.0");
    });
    if (listening) return { server: attempt, port: candidate };
  }
  throw new Error(`No free port from ${FIRST_PORT} to ${FIRST_PORT + PORT_TRIES - 1}`);
}

function stop() {
  log("Stopping");
  for (const running of runningChats.values()) running.stop();
  for (const session of sessions) session.socket.close(1001);
  workspaces.stop();
  server.close();
  setTimeout(() => process.exit(0), 200);
}

({ server, port } = await listen());
settings.port = port;
writeSettings(settings);
log(`Planton bridge for ${settings.pcName} listening on port ${port}`);
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
