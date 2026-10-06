// How Claude Code on a PC and Planton on a phone pair and talk over the local Wi-Fi: the "bridge". This one file is
// used, unchanged, by the app and by the bridge itself (scripts/bridge, which skills:install builds into the planton
// skill), so both sides always agree. Pure: text and bytes are handled here, so it runs the same in Hermes, browsers
// and Node. See docs/superpowers/specs/2026-10-02-claude-code-bridge-design.md.

export const PROTOCOL_VERSION = 1;

/** How long a pairing code works after /planton-connect makes it. */
export const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;
/** How long a milestone ("Writing the plan") stays on the phone without news. */
export const STATUS_TTL_MS = 10 * 60 * 1000;
/** The largest plan file the bridge carries, in UTF-8 bytes. */
export const PLAN_MAX_BYTES = 2 * 1024 * 1024;
/** The longest milestone. */
export const STATUS_MAX = 200;
/** The longest question a phone can send Claude Code, in bytes of UTF-8. */
export const CHAT_TEXT_MAX = 32 * 1024;
/** A Claude Code reply is ended after this long. */
export const CHAT_TURN_LIMIT_MS = 10 * 60_000;
/** Where the chat's longer limits are measured: one piece of a reply, and an activity line. */
const CHAT_DELTA_MAX = 64 * 1024;
const CHAT_ACTIVITY_MAX = 120;
const FOLDERS_MAX = 50;
const FEATURES_MAX = 16;
/** The longest message from Claude Code a failed turn carries. */
export const CHAT_NOTE_MAX = 300;
/** The longest PC name a phone shows. */
export const PC_NAME_MAX = 64;

// ---------------------------------------------------------------------------------------------------------
// Text and bytes. Own helpers rather than TextEncoder, btoa or Buffer, which Hermes, browsers and Node don't share.
// ---------------------------------------------------------------------------------------------------------

/** UTF-8 bytes of a string, emoji and all. */
export function utf8Encode(text: string): Uint8Array {
  // At most 3 bytes per UTF-16 unit (a surrogate pair's 2 units make 4 bytes).
  const bytes = new Uint8Array(text.length * 3);
  let length = 0;
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    // A high surrogate followed by a low one is one character beyond U+FFFF, such as an emoji.
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
        i++;
      }
    }
    if (code < 0x80) {
      bytes[length++] = code;
    } else if (code < 0x800) {
      bytes[length++] = 0xc0 | (code >> 6);
      bytes[length++] = 0x80 | (code & 0x3f);
    } else if (code < 0x10000) {
      bytes[length++] = 0xe0 | (code >> 12);
      bytes[length++] = 0x80 | ((code >> 6) & 0x3f);
      bytes[length++] = 0x80 | (code & 0x3f);
    } else {
      bytes[length++] = 0xf0 | (code >> 18);
      bytes[length++] = 0x80 | ((code >> 12) & 0x3f);
      bytes[length++] = 0x80 | ((code >> 6) & 0x3f);
      bytes[length++] = 0x80 | (code & 0x3f);
    }
  }
  return bytes.slice(0, length);
}

/** The string in UTF-8 bytes. */
export function utf8Decode(bytes: Uint8Array): string {
  const parts: string[] = [];
  let units: number[] = [];
  let i = 0;
  while (i < bytes.length) {
    const first = bytes[i];
    let code: number;
    if (first < 0x80) {
      code = first;
      i += 1;
    } else if (first < 0xe0) {
      code = ((first & 0x1f) << 6) | (bytes[i + 1] & 0x3f);
      i += 2;
    } else if (first < 0xf0) {
      code = ((first & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f);
      i += 3;
    } else {
      code = ((first & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      i += 4;
    }
    if (code >= 0x10000) {
      code -= 0x10000;
      units.push(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
    } else {
      units.push(code);
    }
    // Turned into text in chunks: one call per character would be slow on a long plan.
    if (units.length >= 4096) {
      parts.push(String.fromCharCode(...units));
      units = [];
    }
  }
  parts.push(String.fromCharCode(...units));
  return parts.join("");
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_VALUES = (() => {
  const values = new Int16Array(128).fill(-1);
  for (let i = 0; i < 64; i++) values[BASE64_ALPHABET.charCodeAt(i)] = i;
  return values;
})();

export function toBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  let chunk = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const second = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const third = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (bytes[i] << 16) | (second << 8) | third;
    chunk +=
      BASE64_ALPHABET[(triple >> 18) & 63] +
      BASE64_ALPHABET[(triple >> 12) & 63] +
      (i + 1 < bytes.length ? BASE64_ALPHABET[(triple >> 6) & 63] : "=") +
      (i + 2 < bytes.length ? BASE64_ALPHABET[triple & 63] : "=");
    if (chunk.length >= 8192) {
      parts.push(chunk);
      chunk = "";
    }
  }
  parts.push(chunk);
  return parts.join("");
}

/** Standard base64 back to bytes; null for anything that isn't base64. */
export function fromBase64(text: string): Uint8Array | null {
  const clean = text.endsWith("==") ? text.slice(0, -2) : text.endsWith("=") ? text.slice(0, -1) : text;
  if (clean.length % 4 === 1) return null;
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let length = 0;
  for (let i = 0; i < clean.length; i += 4) {
    let triple = 0;
    for (let k = 0; k < 4; k++) {
      // Past the end, "A" (zero) fills the last group.
      const code = i + k < clean.length ? clean.charCodeAt(i + k) : 65;
      const value = code < 128 ? BASE64_VALUES[code] : -1;
      if (value < 0) return null;
      triple = (triple << 6) | value;
    }
    if (length < bytes.length) bytes[length++] = (triple >> 16) & 255;
    if (length < bytes.length) bytes[length++] = (triple >> 8) & 255;
    if (length < bytes.length) bytes[length++] = triple & 255;
  }
  return bytes;
}

/** Base64 that fits in a URL or a file name: - and _ instead of + and /, no padding. */
export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  return fromBase64(text.replace(/-/g, "+").replace(/_/g, "/"));
}

/** Whether two byte arrays are the same, taking as long whatever the difference, so timing gives nothing away. */
export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

// ---------------------------------------------------------------------------------------------------------
// The pairing link: what the QR code on the PC holds, and what a planton://connect link opens the app with.
// ---------------------------------------------------------------------------------------------------------

export type PcInfo = { id: string; name: string };
export type PairingLink = { host: string; port: number; pc: PcInfo; code: string };

const LINK_PREFIX = "planton://connect?";
const ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
/** A pairing code: 16 random bytes in base64url. */
const CODE_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const HOST_PATTERN = /^[A-Za-z0-9.-]{1,253}$/;

export function buildPairingLink(link: PairingLink): string {
  const params: [string, string][] = [
    ["v", String(PROTOCOL_VERSION)],
    ["host", link.host],
    ["port", String(link.port)],
    ["pc", link.pc.id],
    ["name", link.pc.name],
    ["code", link.code],
  ];
  return LINK_PREFIX + params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
}

/** A scanned code or an opened link, read as a pairing link; anything else, or another protocol version, is null. */
export function parsePairingLink(text: string): PairingLink | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith(LINK_PREFIX)) return null;
  const params: Record<string, string> = {};
  for (const pair of trimmed.slice(LINK_PREFIX.length).split("&")) {
    const at = pair.indexOf("=");
    if (at <= 0) continue;
    try {
      params[pair.slice(0, at)] = decodeURIComponent(pair.slice(at + 1));
    } catch {
      return null;
    }
  }
  return pairingFromParams(params);
}

/** The same checks, on a link's parameters as the router hands them to the screen a planton://connect link opens. */
export function pairingFromParams(params: Record<string, string | string[] | undefined>): PairingLink | null {
  const value = (key: string) => {
    const raw = params[key];
    return typeof raw === "string" ? raw : undefined;
  };
  const host = value("host");
  const port = Number(value("port"));
  const id = value("pc");
  const name = value("name")?.trim();
  const code = value("code");
  if (value("v") !== String(PROTOCOL_VERSION)) return null;
  if (!host || !HOST_PATTERN.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  if (!id || !ID_PATTERN.test(id) || !code || !CODE_PATTERN.test(code) || !name) return null;
  return { host, port, pc: { id, name: name.slice(0, PC_NAME_MAX) }, code };
}

// ---------------------------------------------------------------------------------------------------------
// Which of the PC's addresses goes in the QR code.
// ---------------------------------------------------------------------------------------------------------

/** One address of one network adapter, as Node's os.networkInterfaces() lists it (flattened, with the adapter's name). */
export type NetworkAddress = { name: string; address: string; family: string | number; internal: boolean };

const VIRTUAL_ADAPTER = /vethernet|wsl|hyper-v|virtualbox|vboxnet|vmware|vmnet|docker|br-|virbr/i;
const WIFI_ADAPTER = /wi-?fi|wlan|wireless|^en0$/i;
const ETHERNET_ADAPTER = /ethernet|^eth\d|^en\d/i;

function isPrivateIPv4(address: string): boolean {
  const [a, b] = address.split(".").map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** The PC's addresses a phone on the same Wi-Fi could reach it on, likeliest first: Wi-Fi, then Ethernet, then others. */
export function lanAddresses(interfaces: NetworkAddress[]): string[] {
  const rank = (name: string) => (WIFI_ADAPTER.test(name) ? 0 : ETHERNET_ADAPTER.test(name) ? 1 : 2);
  return interfaces
    .filter(
      (entry) =>
        (entry.family === "IPv4" || entry.family === 4) &&
        !entry.internal &&
        isPrivateIPv4(entry.address) &&
        !VIRTUAL_ADAPTER.test(entry.name),
    )
    .sort((a, b) => rank(a.name) - rank(b.name))
    .map((entry) => entry.address)
    .filter((address, index, all) => all.indexOf(address) === index);
}

// ---------------------------------------------------------------------------------------------------------
// The phone's inbox: plans from the PC waiting to be added.
// ---------------------------------------------------------------------------------------------------------

export type InboxPlan = {
  id: string;
  pcId: string;
  pcName: string;
  /** A hash of the plan file's path on the PC: the same file pushed again replaces its older copy. */
  source: string;
  fileName: string;
  text: string;
  receivedAt: number;
};

export const INBOX_MAX = 10;
export const INBOX_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function pruneInbox(inbox: InboxPlan[], now: number): InboxPlan[] {
  return inbox.filter((plan) => now - plan.receivedAt < INBOX_TTL_MS);
}

/** The inbox with a plan that just arrived: its older copy goes, expired plans go, and the newest 10 stay. */
export function addToInbox(inbox: InboxPlan[], plan: InboxPlan, now: number): InboxPlan[] {
  const others = pruneInbox(inbox, now).filter(
    (item) => item.id !== plan.id && !(item.pcId === plan.pcId && item.source === plan.source),
  );
  return [...others, plan].slice(-INBOX_MAX);
}

/** A saved inbox, checked; anything malformed is dropped. */
export function normalizeInbox(raw: unknown): InboxPlan[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is InboxPlan => {
    if (typeof item !== "object" || item === null) return false;
    const plan = item as Record<string, unknown>;
    return (
      ["id", "pcId", "pcName", "source", "fileName", "text"].every((key) => typeof plan[key] === "string") &&
      typeof plan.receivedAt === "number"
    );
  });
}

// ---------------------------------------------------------------------------------------------------------
// Timing.
// ---------------------------------------------------------------------------------------------------------

const RETRY_DELAYS_MS = [1000, 2000, 5000, 10000];
export const RETRY_LATER_MS = 30_000;
/** After this many failed tries in a row, the phone says it can't reach the PC (and keeps trying). */
export const UNREACHABLE_AFTER = 3;
/** How often the bridge sends each phone a heartbeat. */
export const HEARTBEAT_MS = 25_000;
/** How long the phone waits without hearing anything before it treats the connection as dropped. */
export const SILENCE_LIMIT_MS = 60_000;

/** How long to wait before reconnecting after this many failed tries in a row. */
export function retryDelay(failures: number): number {
  return failures >= 1 && failures <= RETRY_DELAYS_MS.length ? RETRY_DELAYS_MS[failures - 1] : RETRY_LATER_MS;
}

/** Whether a milestone is still worth showing. */
export function statusIsCurrent(status: { at: number } | null, now: number): boolean {
  return status !== null && now - status.at < STATUS_TTL_MS;
}

// ---------------------------------------------------------------------------------------------------------
// Proofs and keys. No secret crosses the network: the pairing code reaches the phone only through its camera, and
// each side proves what it knows by hashing it with the bridge's one-time challenge.
// ---------------------------------------------------------------------------------------------------------

/** TweetNaCl, passed in by the caller: the app gives it the phone's random number source first (src/core/nacl.ts). */
export type Nacl = typeof import("tweetnacl");

const KEY_BYTES = 32;

/** SHA-512 of the parts joined by newlines, cut to 32 bytes: every proof and key below is one of these. */
function derive(nacl: Nacl, label: string, ...parts: string[]): Uint8Array {
  return nacl.hash(utf8Encode([label, ...parts].join("\n"))).slice(0, KEY_BYTES);
}

/** Random bytes in base64url: ids, pairing codes, challenges. */
export function randomId(nacl: Nacl, bytes = 16): string {
  return toBase64Url(nacl.randomBytes(bytes));
}

/** What the phone sends to prove it scanned the current code, without sending the code. */
export function pairingProof(nacl: Nacl, code: string, challenge: string): string {
  return toBase64(derive(nacl, "planton-pair", code, challenge));
}

/** The key a paired phone and the PC share from then on, worked out on both sides from the code. */
export function deviceKeyFor(nacl: Nacl, code: string, deviceId: string): Uint8Array {
  return derive(nacl, "planton-device", code, deviceId);
}

/** What a paired phone sends to prove it has the device key. */
export function helloProof(nacl: Nacl, deviceKey: Uint8Array, challenge: string): string {
  return toBase64(derive(nacl, "planton-hello", toBase64(deviceKey), challenge));
}

/** The key that seals one connection's messages: new for every connection, so an old message can't be replayed. */
export function sessionKeyFor(nacl: Nacl, deviceKey: Uint8Array, challenge: string): Uint8Array {
  return derive(nacl, "planton-session", toBase64(deviceKey), challenge);
}

/** Whether a proof the other side sent is the expected one, compared in constant time. */
export function proofMatches(expected: string, received: string): boolean {
  const a = fromBase64(expected);
  const b = fromBase64(received);
  return a !== null && b !== null && sameBytes(a, b);
}

// ---------------------------------------------------------------------------------------------------------
// Frames: JSON text on the WebSocket. Plain until the phone has proved itself; sealed after that.
// ---------------------------------------------------------------------------------------------------------

export type DeniedReason = "expired-code" | "used-code" | "unknown-device" | "bad-proof" | "too-many-tries" | "version";
const DENIED_REASONS: DeniedReason[] = ["expired-code", "used-code", "unknown-device", "bad-proof", "too-many-tries", "version"];

export type ChallengeFrame = { t: "challenge"; v: number; nonce: string; pc: PcInfo };
export type PairFrame = { t: "pair"; v: number; deviceId: string; deviceName: string; proof: string };
export type HelloFrame = { t: "hello"; v: number; deviceId: string; proof: string };
export type DeniedFrame = { t: "denied"; reason: DeniedReason };
export type SealedFrame = { t: "sealed"; n: string; b: string };
export type Frame = ChallengeFrame | PairFrame | HelloFrame | DeniedFrame | SealedFrame;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;

function readPc(value: unknown): PcInfo | null {
  return isRecord(value) && isText(value.id, 64) && isText(value.name, PC_NAME_MAX) ? { id: value.id, name: value.name } : null;
}

/** One frame off the socket, checked; anything else is null. */
export function readFrame(text: string): Frame | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  switch (value.t) {
    case "challenge": {
      const pc = readPc(value.pc);
      return isCount(value.v) && isText(value.nonce, 64) && pc ? { t: "challenge", v: value.v, nonce: value.nonce, pc } : null;
    }
    case "pair":
      return isCount(value.v) && isText(value.deviceId, 64) && isText(value.deviceName, 40) && isText(value.proof, 128)
        ? { t: "pair", v: value.v, deviceId: value.deviceId, deviceName: value.deviceName, proof: value.proof }
        : null;
    case "hello":
      return isCount(value.v) && isText(value.deviceId, 64) && isText(value.proof, 128)
        ? { t: "hello", v: value.v, deviceId: value.deviceId, proof: value.proof }
        : null;
    case "denied":
      return DENIED_REASONS.includes(value.reason as DeniedReason) ? { t: "denied", reason: value.reason as DeniedReason } : null;
    case "sealed":
      return isText(value.n, 64) && isText(value.b, PLAN_MAX_BYTES * 4) ? { t: "sealed", n: value.n, b: value.b } : null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------------------------------------
// Sealed messages: what travels inside a sealed frame, numbered by the side that sends it.
// ---------------------------------------------------------------------------------------------------------

/**
 * Whether a plan's text is within PLAN_MAX_BYTES once encoded as UTF-8, the unit the limit is in. No UTF-16 unit takes
 * more than 3 bytes, so text of up to a third of the limit fits without encoding it.
 */
export function planFits(text: string): boolean {
  return textFits(text, PLAN_MAX_BYTES);
}

/** Whether text is within `maxBytes` once encoded as UTF-8 (see planFits). */
export function textFits(text: string, maxBytes: number): boolean {
  return text.length * 3 <= maxBytes || utf8Encode(text).length <= maxBytes;
}

export type PlanMessage = { type: "plan"; seq: number; id: string; source: string; fileName: string; text: string; at: number };

/** Why Claude Code couldn't answer, as the PC tells the phone. */
export const CHAT_FAILURES = ["busy", "no-claude", "not-signed-in", "folder", "timeout", "stopped", "error"] as const;
export type ChatFailure = (typeof CHAT_FAILURES)[number];

/** A folder on the PC that the phone may chat about: an id the PC gave it, and its name. Never its path. */
export type ChatFolder = { id: string; name: string };

export type BridgeMessage =
  | { type: "welcome"; seq: number; pc: PcInfo; waiting: number; features?: string[] }
  | { type: "status"; seq: number; id: string; text: string; at: number }
  | PlanMessage
  | { type: "heartbeat"; seq: number; at: number }
  | { type: "folders"; seq: number; folders: ChatFolder[] }
  | { type: "chat-delta"; seq: number; chatId: string; turnId: string; text: string }
  | { type: "chat-activity"; seq: number; chatId: string; turnId: string; label: string }
  | { type: "chat-done"; seq: number; chatId: string; turnId: string; session: string; text: string }
  | {
      type: "chat-failed";
      seq: number;
      chatId: string;
      turnId: string;
      reason: ChatFailure;
      /**
       * Claude Code's own words for why, when it gave them ("You've hit your weekly limit · resets …"). Optional, so an
       * older app, which builds the message from the fields it knows, still reads the reason.
       */
      note?: string;
    };

export type ChatRequest = {
  type: "chat";
  seq: number;
  chatId: string;
  turnId: string;
  folder: string;
  /** Claude Code's session to continue, from the last reply's `chat-done`. */
  session?: string;
  text: string;
};

export type PhoneMessage =
  | { type: "ack"; seq: number; id: string }
  | { type: "forget"; seq: number }
  | { type: "folders"; seq: number }
  | ChatRequest
  | { type: "chat-stop"; seq: number; chatId: string; turnId: string }
  | { type: "chat-ack"; seq: number; chatId: string; turnId: string };

/** What the phone says when Claude Code couldn't answer. */
export function chatFailureText(reason: ChatFailure, pcName: string): string {
  switch (reason) {
    case "busy":
      return `Claude Code on ${pcName} is still answering your last message. Wait for it, or stop it, then try again.`;
    case "no-claude":
      return `Claude Code isn't installed on ${pcName}, or isn't on its PATH. Install it, then try again.`;
    case "not-signed-in":
      return `Claude Code on ${pcName} isn't signed in. Run claude on ${pcName} and sign in, then try again.`;
    case "folder":
      return `That folder isn't allowed on ${pcName} any more. Pick another, or allow it again with /planton-connect.`;
    case "timeout":
      return "Claude Code took more than 10 minutes, so the reply was stopped. Try asking for something smaller.";
    case "stopped":
      return "The reply was stopped on the PC.";
    case "error":
      return `Claude Code on ${pcName} ran into a problem. To see why, run /planton-connect status (or connect.mts status) on ${pcName}.`;
  }
}

/** A message before it's numbered: what a side hands to seal, adding the next `seq`. */
export type Unnumbered<T> = T extends unknown ? Omit<T, "seq"> : never;

/** A message from the bridge, checked; a message only a phone sends, or anything malformed, is null. */
export function readBridgeMessage(value: unknown): BridgeMessage | null {
  if (!isRecord(value) || !isCount(value.seq) || value.seq < 1) return null;
  const seq = value.seq;
  switch (value.type) {
    case "welcome": {
      const pc = readPc(value.pc);
      if (!pc || !isCount(value.waiting)) return null;
      const welcome: BridgeMessage = { type: "welcome", seq, pc, waiting: value.waiting };
      // What the bridge can do besides plans ("chat"). Entries the phone can't read are dropped.
      if (Array.isArray(value.features)) {
        welcome.features = value.features.filter((feature): feature is string => isText(feature, 32)).slice(0, FEATURES_MAX);
      }
      return welcome;
    }
    case "status":
      return isText(value.id, 64) && isText(value.text, STATUS_MAX) && isCount(value.at)
        ? { type: "status", seq, id: value.id, text: value.text, at: value.at }
        : null;
    case "plan":
      return isText(value.id, 64) &&
        isText(value.source, 64) &&
        isText(value.fileName, 200) &&
        typeof value.text === "string" &&
        planFits(value.text) &&
        isCount(value.at)
        ? { type: "plan", seq, id: value.id, source: value.source, fileName: value.fileName, text: value.text, at: value.at }
        : null;
    case "heartbeat":
      return isCount(value.at) ? { type: "heartbeat", seq, at: value.at } : null;
    case "folders": {
      if (!Array.isArray(value.folders) || value.folders.length > FOLDERS_MAX) return null;
      const folders: ChatFolder[] = [];
      for (const folder of value.folders) {
        if (!isRecord(folder) || !isText(folder.id, 64) || !isText(folder.name, 120)) return null;
        folders.push({ id: folder.id, name: folder.name });
      }
      return { type: "folders", seq, folders };
    }
    case "chat-delta":
      return isTurn(value) && isText(value.text, CHAT_DELTA_MAX)
        ? { type: "chat-delta", seq, chatId: value.chatId, turnId: value.turnId, text: value.text }
        : null;
    case "chat-activity":
      return isTurn(value) && isText(value.label, CHAT_ACTIVITY_MAX)
        ? { type: "chat-activity", seq, chatId: value.chatId, turnId: value.turnId, label: value.label }
        : null;
    case "chat-done":
      // A reply can be empty; it can't be bigger than a plan.
      return isTurn(value) && isText(value.session, 200) && typeof value.text === "string" && planFits(value.text)
        ? { type: "chat-done", seq, chatId: value.chatId, turnId: value.turnId, session: value.session, text: value.text }
        : null;
    case "chat-failed": {
      if (!isTurn(value) || !(CHAT_FAILURES as readonly unknown[]).includes(value.reason)) return null;
      const failed: BridgeMessage = {
        type: "chat-failed",
        seq,
        chatId: value.chatId,
        turnId: value.turnId,
        reason: value.reason as ChatFailure,
      };
      if (isText(value.note, CHAT_NOTE_MAX)) failed.note = value.note;
      return failed;
    }
    default:
      return null;
  }
}

/** A chat message's conversation and turn. */
function isTurn(value: Record<string, unknown>): value is Record<string, unknown> & { chatId: string; turnId: string } {
  return isText(value.chatId, 64) && isText(value.turnId, 64);
}

/** A message from a phone, checked; a message only the bridge sends, or anything malformed, is null. */
export function readPhoneMessage(value: unknown): PhoneMessage | null {
  if (!isRecord(value) || !isCount(value.seq) || value.seq < 1) return null;
  const seq = value.seq;
  switch (value.type) {
    case "ack":
      return isText(value.id, 64) ? { type: "ack", seq, id: value.id } : null;
    case "forget":
      return { type: "forget", seq };
    case "folders":
      return { type: "folders", seq };
    case "chat": {
      if (!isTurn(value) || !isText(value.folder, 64) || !isText(value.text, CHAT_TEXT_MAX * 3)) return null;
      if (!textFits(value.text, CHAT_TEXT_MAX)) return null;
      const request: ChatRequest = {
        type: "chat",
        seq,
        chatId: value.chatId,
        turnId: value.turnId,
        folder: value.folder,
        text: value.text,
      };
      if (value.session !== undefined) {
        if (!isText(value.session, 200)) return null;
        request.session = value.session;
      }
      return request;
    }
    case "chat-stop":
    case "chat-ack":
      return isTurn(value) ? { type: value.type, seq, chatId: value.chatId, turnId: value.turnId } : null;
    default:
      return null;
  }
}

/** A message sealed for the other side: encrypted and authenticated under the session key (XSalsa20-Poly1305). */
export function seal(nacl: Nacl, key: Uint8Array, message: object): SealedFrame {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  return { t: "sealed", n: toBase64(nonce), b: toBase64(nacl.secretbox(utf8Encode(JSON.stringify(message)), nonce, key)) };
}

/** What a sealed frame holds, or null when it was sealed under another key or changed on the way. */
export function unseal(nacl: Nacl, key: Uint8Array, frame: SealedFrame): unknown {
  const nonce = fromBase64(frame.n);
  const box = fromBase64(frame.b);
  if (!nonce || !box || nonce.length !== nacl.secretbox.nonceLength) return null;
  const opened = nacl.secretbox.open(box, nonce, key);
  if (!opened) return null;
  try {
    return JSON.parse(utf8Decode(opened));
  } catch {
    return null;
  }
}

/** Numbers one side's messages from 1, and accepts only the other side's messages that are newer than the last. */
export class Sequence {
  private sent = 0;
  private received = 0;

  next(): number {
    this.sent += 1;
    return this.sent;
  }

  accept(seq: number): boolean {
    if (seq <= this.received) return false;
    this.received = seq;
    return true;
  }
}
