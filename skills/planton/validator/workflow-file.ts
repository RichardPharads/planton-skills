/**
 * The Planton workflow file (`*.planton.json`): a simple, hand- and AI-writable description of a workflow that the
 * app imports. The Planton skill for Claude Code writes these files. Ids, positions, and timestamps are left out;
 * the importer creates them.
 */

import type { CardAppearance, CardFade, CardStyle } from "./card-appearance.ts";
import type { Schedule } from "./schedule.ts";
import { addWorkflowTemplate, card, type WorkflowTemplate } from "./workflow-templates.ts";
import {
  EDGE_LABEL_MAX,
  FLOW_NODE_TYPES,
  blockDepth,
  getChildren,
  getDescendants,
  getWorkflows,
  removeBlock,
  trashWorkflow,
  type BlockType,
  type ContentBlock,
  type FlowLayout,
  type FlowNodeType,
  type WorkflowData,
  type WorkflowEdge,
  type WorkflowMode,
  type WorkflowNode,
  type ResourceBlock,
} from "./workflows.ts";

export const WORKFLOW_FILE_FORMAT = "planton.workflow";
export const WORKFLOW_FILE_VERSION = 1;

/** Author shown on imported workflows when the file doesn't name one. */
export const IMPORTED_AUTHOR = "Imported";

const MAX_CARDS = 400;
const MAX_DEPTH = 4;
const MAX_TITLE = 120;
const MAX_TEXT = 4000;
const KEY_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const WIKILINK_PATTERN = /\[\[([^[\]|]+)\|([^[\]]+)\]\]/g;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type WorkflowFileBlock =
  | string
  | { type: Exclude<BlockType, "resource">; text: string; checked?: boolean; indent?: number }
  | { type: "resource"; kind: ResourceBlock["kind"]; url: string; title: string; thumbnailUrl?: string; indent?: number };

export type WorkflowFileSchedule =
  | {
      time: string;
      days?: number[] | "every-day" | "weekdays" | "weekends";
      /** First and last day it happens, "YYYY-MM-DD". */
      startDate?: string;
      endDate?: string;
    }
  | { at: string };

export type WorkflowFileCard = {
  /** A name for the card that links can refer to, unique within the file. */
  key?: string;
  title: string;
  description?: string;
  status?: "pending" | "done";
  notes?: WorkflowFileBlock[];
  /** A built-in timer for the card, in minutes. */
  timerMinutes?: number;
  /** Only used in scheduled workflows. */
  schedule?: WorkflowFileSchedule;
  /** Only used in Flowchart workflows: the card's symbol. Left out for Process. */
  shape?: FlowNodeType;
  cards?: WorkflowFileCard[];
};

export type WorkflowFile = {
  format: typeof WORKFLOW_FILE_FORMAT;
  version: typeof WORKFLOW_FILE_VERSION;
  /** Who made the file, e.g. "Claude Code". Shown as the workflow's author. */
  author?: string;
  workflow: WorkflowFileCard & {
    type?: WorkflowMode;
    appearance?: { cover?: string; style?: CardStyle; fade?: CardFade };
    /** Step-by-step workflows only: "rows" wraps the flowchart into compact rows, "line" keeps one line. */
    layout?: FlowLayout;
    /**
     * Extra flowchart connections between cards, by their keys, beyond each card's link to its parent. In a Flowchart
     * workflow a link can carry a short label, like a Decision's "Yes" or "No".
     */
    links?: { from: string; to: string; label?: string }[];
  };
};

export type WorkflowFileSummary = { title: string; mode: WorkflowMode; cardCount: number; topLevelCount: number; author: string };

export type ParseResult = { ok: true; template: WorkflowTemplate; summary: WorkflowFileSummary } | { ok: false; error: string };

const MODES: WorkflowMode[] = ["freeform", "steps", "scheduled", "flowchart"];
const BLOCK_TYPES: BlockType[] = ["heading", "paragraph", "bullet", "checklist", "resource"];
const STYLES: CardStyle[] = ["thumbnail", "background"];
const FADES: CardFade[] = ["soft", "medium", "strong"];
const DAY_PRESETS: Record<string, number[]> = {
  "every-day": [0, 1, 2, 3, 4, 5, 6],
  weekdays: [1, 2, 3, 4, 5],
  weekends: [0, 6],
};

class FileError extends Error {}

function fail(path: string, message: string): never {
  throw new FileError(`${path}: ${message}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown, path: string, max: number, required: boolean): string {
  if (value === undefined || value === null) {
    if (required) fail(path, "is required");
    return "";
  }
  if (typeof value !== "string") fail(path, "must be text");
  const text = value.trim();
  if (required && text.length === 0) fail(path, "can't be empty");
  return text.slice(0, max);
}

/** Pasted files often arrive wrapped in a Markdown code fence or with text around them; keep just the JSON object. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start === -1 || end <= start ? body : body.slice(start, end + 1);
}

function readSchedule(value: unknown, path: string): Schedule {
  if (!isObject(value)) fail(path, "must be an object");
  if ("at" in value) {
    const at = typeof value.at === "string" ? Date.parse(value.at) : Number.NaN;
    if (Number.isNaN(at)) fail(`${path}.at`, 'must be a date and time, e.g. "2026-10-01T09:00"');
    return { kind: "once", at };
  }
  const time = value.time;
  if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    fail(`${path}.time`, 'must be "HH:MM" in 24-hour time');
  const days = value.days ?? "every-day";
  if (typeof days === "string") {
    const preset = DAY_PRESETS[days];
    if (!preset) fail(`${path}.days`, 'must be "every-day", "weekdays", "weekends", or a list of 0–6 (0 = Sunday)');
    return { kind: "repeat", time, days: preset, ...readDateRange(value, path) };
  }
  if (!Array.isArray(days) || days.length === 0 || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    fail(`${path}.days`, "must be a list of days from 0 (Sunday) to 6 (Saturday)");
  }
  return { kind: "repeat", time, days: [...new Set(days as number[])].sort(), ...readDateRange(value, path) };
}

/** A real calendar date as "YYYY-MM-DD", or undefined when the field is missing. */
function readDate(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) fail(path, 'must be a date like "2026-09-16"');
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) fail(path, "isn't a real date");
  return value;
}

function readDateRange(value: Record<string, unknown>, path: string): { startDate?: string; endDate?: string } {
  const startDate = readDate(value.startDate, `${path}.startDate`);
  const endDate = readDate(value.endDate, `${path}.endDate`);
  if (startDate && endDate && endDate < startDate) fail(`${path}.endDate`, "must be on or after startDate");
  return { ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}) };
}

/**
 * indent is relative to the previous block: 0 or omitted stays at the same depth, 1 nests one level deeper, a
 * negative number moves that many levels shallower. It's clamped, not rejected — at most one level deeper than the
 * previous block, never below 0 — so a slightly-wrong file still imports with a reasonable structure.
 */
function readBlocks(value: unknown, path: string, idPrefix: string): ContentBlock[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail(path, "must be a list");
  const indents: number[] = [];
  const blocks = value.map((entry, index): ContentBlock => {
    const entryPath = `${path}[${index}]`;
    const id = `${idPrefix}-b${index + 1}`;
    if (typeof entry === "string") {
      indents.push(0);
      return { id, type: "paragraph", text: readText(entry, entryPath, MAX_TEXT, true) };
    }
    if (!isObject(entry)) fail(entryPath, "must be text or an object with type and text");
    if (entry.indent !== undefined && (typeof entry.indent !== "number" || !Number.isInteger(entry.indent))) {
      fail(`${entryPath}.indent`, "must be a whole number");
    }
    indents.push(typeof entry.indent === "number" ? entry.indent : 0);
    const type = entry.type as BlockType;
    if (!BLOCK_TYPES.includes(type)) fail(`${entryPath}.type`, `must be one of ${BLOCK_TYPES.join(", ")}`);
    if (type === "resource") {
      const kind = entry.kind;
      if (kind !== "image" && kind !== "youtube") fail(`${entryPath}.kind`, 'must be "image" or "youtube"');
      const url = readUrl(entry.url, `${entryPath}.url`);
      const title = readText(entry.title, `${entryPath}.title`, 200, true);
      const thumbnailUrl =
        entry.thumbnailUrl === undefined ? undefined : readUrl(entry.thumbnailUrl, `${entryPath}.thumbnailUrl`);
      return { id, type, text: title, resource: { kind, url, title, ...(thumbnailUrl ? { thumbnailUrl } : {}) } };
    }
    const text = readText(entry.text, `${entryPath}.text`, MAX_TEXT, true);
    return type === "checklist" ? { id, type, text, checked: entry.checked === true } : { id, type, text };
  });

  // Second pass: turn each relative indent into a parentId. Blocks left at the top level get no parentId key at all,
  // so a flat file imports exactly as it always has.
  const stackAtDepth: string[] = [];
  let previousDepth = 0;
  return blocks.map((block, index) => {
    const depth = Math.max(0, Math.min(previousDepth + indents[index], previousDepth + 1));
    const parentId = depth > 0 ? stackAtDepth[depth - 1] : undefined;
    stackAtDepth[depth] = block.id;
    stackAtDepth.length = depth + 1;
    previousDepth = depth;
    return parentId === undefined ? block : { ...block, parentId };
  });
}

/** A card's built-in timer, given in minutes in a file and kept in milliseconds. */
function readTimer(value: unknown, path: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || value <= 0 || value > 24 * 60) fail(path, "must be a number of minutes between 1 and 1440");
  return Math.round(value * 60_000);
}

function readUrl(value: unknown, path: string): string {
  const url = readText(value, path, 2000, true);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
  } catch {
    fail(path, "must be an http or https URL");
  }
  return url;
}

/**
 * Reads a Planton workflow file. Ids are `${idPrefix}` for the workflow and `${idPrefix}-c1`, `-c2`, … for its cards.
 * Errors name the part of the file that's wrong, e.g. `workflow.cards[2].title: is required`.
 */
export function parseWorkflowFile(text: string, options: { idPrefix: string; now: number }): ParseResult {
  const { idPrefix, now } = options;
  try {
    let raw: unknown;
    try {
      raw = JSON.parse(extractJson(text));
    } catch {
      return { ok: false, error: "This isn't valid JSON. Copy the whole .planton.json file and try again." };
    }
    if (!isObject(raw)) fail("file", "must be a JSON object");
    if (raw.format !== WORKFLOW_FILE_FORMAT) fail("format", `must be "${WORKFLOW_FILE_FORMAT}"`);
    if (raw.version !== WORKFLOW_FILE_VERSION) fail("version", `must be ${WORKFLOW_FILE_VERSION}`);
    if (!isObject(raw.workflow)) fail("workflow", "is required");

    const author = readText(raw.author, "author", 60, false) || IMPORTED_AUTHOR;
    const workflow = raw.workflow;
    const mode = (workflow.type ?? "freeform") as WorkflowMode;
    if (!MODES.includes(mode)) fail("workflow.type", `must be one of ${MODES.join(", ")}`);

    const nodes: WorkflowNode[] = [];
    const edges: WorkflowEdge[] = [];
    const idsByKey = new Map<string, string>();
    let counter = 0;

    const build = (value: unknown, path: string, parentId: string | null, depth: number): WorkflowNode => {
      if (!isObject(value)) fail(path, "must be an object");
      if (depth > MAX_DEPTH) fail(path, `cards can be nested at most ${MAX_DEPTH} levels deep`);
      const id = parentId === null ? idPrefix : `${idPrefix}-c${++counter}`;
      if (counter > MAX_CARDS) fail(path, `a workflow can have at most ${MAX_CARDS} cards`);
      if (value.key !== undefined) {
        if (typeof value.key !== "string" || !KEY_PATTERN.test(value.key)) {
          fail(`${path}.key`, "must be 1–64 letters, digits, dashes, or underscores");
        }
        if (idsByKey.has(value.key)) fail(`${path}.key`, `"${value.key}" is used by another card`);
        idsByKey.set(value.key, id);
      }

      const status = value.status ?? "pending";
      if (status !== "pending" && status !== "done") fail(`${path}.status`, 'must be "pending" or "done"');
      const timerMs = readTimer(value.timerMinutes, `${path}.timerMinutes`);

      const node: WorkflowNode = {
        ...card(
          id,
          readText(value.title, `${path}.title`, MAX_TITLE, true),
          parentId,
          readBlocks(value.notes, `${path}.notes`, id),
          readText(value.description, `${path}.description`, MAX_TEXT, false),
          now,
        ),
        createdBy: author,
        status: parentId === null ? "pending" : status,
        doneAt: parentId !== null && status === "done" ? now : null,
        timerMs,
      };
      if (value.schedule !== undefined && parentId !== null && mode === "scheduled") {
        node.schedule = readSchedule(value.schedule, `${path}.schedule`);
        node.scheduledSince = now;
      }
      if (value.shape !== undefined && parentId !== null && mode === "flowchart") {
        if (!FLOW_NODE_TYPES.includes(value.shape as FlowNodeType)) {
          fail(`${path}.shape`, `must be one of ${FLOW_NODE_TYPES.join(", ")}`);
        }
        node.nodeType = value.shape as FlowNodeType;
      }
      nodes.push(node);

      if (value.cards !== undefined && !Array.isArray(value.cards)) fail(`${path}.cards`, "must be a list");
      // A Flowchart's flow is its links: its cards sit side by side under the workflow.
      if (mode === "flowchart" && parentId !== null && Array.isArray(value.cards) && value.cards.length > 0) {
        fail(`${path}.cards`, "a flowchart's cards can't be nested — connect them with links instead");
      }
      let previousId: string | null = null;
      for (const [index, child] of ((value.cards as unknown[] | undefined) ?? []).entries()) {
        const childNode = build(child, `${path}.cards[${index}]`, id, depth + 1);
        // A Flowchart doesn't draw the workflow's card, so its cards aren't connected to it.
        if (mode === "flowchart") continue;
        // Steps connect themselves on the flowchart. Cards inside a step hang below it in a chain; everything else
        // connects to its parent.
        if (mode === "steps" && parentId === null) continue;
        const source: string = mode === "steps" && previousId ? previousId : id;
        edges.push({ id: `${source}->${childNode.id}`, source, target: childNode.id });
        if (mode === "steps") previousId = childNode.id;
      }
      return node;
    };

    const root = build(workflow, "workflow", null, 0);
    root.mode = mode;

    if (workflow.layout !== undefined) {
      if (workflow.layout !== "rows" && workflow.layout !== "line") fail("workflow.layout", 'must be "rows" or "line"');
      if (mode !== "steps") fail("workflow.layout", 'only applies to "steps" workflows');
      root.layout = workflow.layout;
    }

    if (workflow.links !== undefined) {
      if (!Array.isArray(workflow.links)) fail("workflow.links", "must be a list");
      const edgeIds = new Set(edges.map((edge) => edge.id));
      workflow.links.forEach((link, index) => {
        const path = `workflow.links[${index}]`;
        if (!isObject(link)) fail(path, 'must be an object with "from" and "to"');
        const source = typeof link.from === "string" ? idsByKey.get(link.from) : undefined;
        const target = typeof link.to === "string" ? idsByKey.get(link.to) : undefined;
        if (!source) fail(`${path}.from`, "must be the key of a card in this file");
        if (!target) fail(`${path}.to`, "must be the key of a card in this file");
        if (source === target) fail(path, "can't link a card to itself");
        // Like card symbols, labels only mean something in a Flowchart, so elsewhere they're ignored.
        const label = readText(link.label, `${path}.label`, EDGE_LABEL_MAX, false);
        const id = `${source}->${target}`;
        if (edgeIds.has(id)) return;
        edgeIds.add(id);
        edges.push({ id, source, target, ...(label && mode === "flowchart" ? { label } : {}) });
      });
    }

    // Notes were read with their [[key|Title]] text verbatim, since a note can reference a card whose key hasn't been
    // read yet. Now that every key in the file is known, rewrite them to real ids. A key with no match (not declared
    // in this file, e.g. a real id from an earlier export) is left exactly as it was.
    for (const node of nodes) {
      node.blocks = node.blocks.map((block) => ({
        ...block,
        text: block.text.replace(WIKILINK_PATTERN, (whole: string, key: string, title: string) => {
          const linkedId = idsByKey.get(key);
          return linkedId ? `[[${linkedId}|${title}]]` : whole;
        }),
      }));
    }

    const appearance = workflow.appearance;
    if (appearance !== undefined) {
      if (!isObject(appearance)) fail("workflow.appearance", "must be an object");
      const style = (appearance.style ?? "thumbnail") as CardStyle;
      const fade = (appearance.fade ?? "medium") as CardFade;
      if (!STYLES.includes(style)) fail("workflow.appearance.style", `must be one of ${STYLES.join(", ")}`);
      if (!FADES.includes(fade)) fail("workflow.appearance.fade", `must be one of ${FADES.join(", ")}`);
      // A plan file's "cover" preset is no longer supported (the app only offers a plain fill or a photo); ignored
      // rather than rejected, so an older file still imports.
      root.appearance = { cover: null, style, fade } satisfies CardAppearance;
    }

    const topLevelCount = nodes.filter((node) => node.parentId === idPrefix).length;
    return {
      ok: true,
      template: { rootId: idPrefix, nodes, edges },
      summary: { title: root.title, mode, cardCount: nodes.length - 1, topLevelCount, author },
    };
  } catch (error) {
    if (error instanceof FileError) return { ok: false, error: error.message };
    throw error;
  }
}

/** Author written into files exported from the app. */
export const EXPORTED_AUTHOR = "Planton";

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

/** A local "YYYY-MM-DDTHH:MM", the form readSchedule parses back as local time. */
function localDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}T${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

function writeSchedule(schedule: Schedule): WorkflowFileSchedule | undefined {
  if (schedule.kind === "once") return { at: localDateTime(schedule.at) };
  if (schedule.days.length === 0) return undefined;
  const days = [...schedule.days].sort();
  const preset = Object.entries(DAY_PRESETS).find(([, presetDays]) => presetDays.join() === days.join())?.[0];
  return {
    time: schedule.time,
    days: (preset as "every-day" | "weekdays" | "weekends" | undefined) ?? days,
    ...(schedule.startDate ? { startDate: schedule.startDate } : {}),
    ...(schedule.endDate ? { endDate: schedule.endDate } : {}),
  };
}

/**
 * The reverse of readBlocks. An empty-text block is dropped, re-parenting its own children to its parent (the same
 * rule removeBlock applies in the editor), so a blank block never orphans or silently deletes real content. indent is
 * omitted when it's 0 (same depth as the previous kept block), so a flat file exports exactly as it always has.
 */
function writeBlocks(blocks: ContentBlock[]): WorkflowFileBlock[] {
  let live = blocks;
  for (const block of blocks) {
    if (block.text.trim().length === 0) live = removeBlock(live, block.id);
  }
  let previousDepth = 0;
  return live.map((block): WorkflowFileBlock => {
    const depth = blockDepth(live, block.id);
    const indent = depth - previousDepth;
    previousDepth = depth;
    const withIndent = indent !== 0 ? { indent } : {};
    if (block.type === "resource") {
      // A resource block that lost its resource data is kept as plain text.
      if (!block.resource) return indent === 0 ? block.text : { type: "paragraph", text: block.text, ...withIndent };
      return {
        type: "resource",
        kind: block.resource.kind,
        title: block.resource.title,
        url: block.resource.url,
        ...(block.resource.thumbnailUrl ? { thumbnailUrl: block.resource.thumbnailUrl } : {}),
        ...withIndent,
      };
    }
    if (block.type === "paragraph" && indent === 0) return block.text;
    return {
      type: block.type,
      text: block.text,
      ...(block.type === "checklist" && block.checked ? { checked: true } : {}),
      ...withIndent,
    };
  });
}

/**
 * Writes a workflow as a Planton workflow file, the reverse of parseWorkflowFile: its cards, notes, schedules,
 * timers, done/pending status, appearance, and flowchart links with their labels. It's a plan to share, not a backup, so progress
 * history, running timers, favorites, archive state, and card positions are left out, as are photo covers.
 */
export function serializeWorkflow(data: WorkflowData, rootId: string): WorkflowFile | null {
  const root = data.nodes[rootId];
  if (!root || root.parentId !== null) return null;
  const mode = root.mode;
  const liveChildren = (id: string) => getChildren(data, id).filter((node) => node.deletedAt === null);
  const flowchart = mode === "flowchart";
  // A Flowchart's cards are written flat under the workflow, whatever their nesting: its flow is its connections.
  const cardsOf = (id: string): WorkflowNode[] =>
    flowchart ? (id === rootId ? getDescendants(data, rootId).filter((node) => node.deletedAt === null) : []) : liveChildren(id);

  // The connections parseWorkflowFile creates on its own; any other edge between these cards becomes a link.
  const included = new Set<string>([rootId]);
  const implicitEdges = new Set<string>();
  const visit = (id: string) => {
    let previousId: string | null = null;
    for (const child of cardsOf(id)) {
      included.add(child.id);
      if (!flowchart && !(mode === "steps" && id === rootId)) {
        implicitEdges.add(`${mode === "steps" && previousId ? previousId : id}->${child.id}`);
        if (mode === "steps") previousId = child.id;
      }
      visit(child.id);
    }
  };
  visit(rootId);

  const extraEdges = data.edges.filter(
    (edge) =>
      edge.source !== edge.target &&
      included.has(edge.source) &&
      included.has(edge.target) &&
      !implicitEdges.has(`${edge.source}->${edge.target}`) &&
      !(flowchart && (edge.source === rootId || edge.target === rootId)),
  );
  const keys = new Map<string, string>();
  const keyFor = (id: string) => {
    if (!keys.has(id)) keys.set(id, `card-${keys.size + 1}`);
    return keys.get(id)!;
  };
  const links = extraEdges.map((edge) => ({
    from: keyFor(edge.source),
    to: keyFor(edge.target),
    ...(flowchart && edge.label ? { label: edge.label } : {}),
  }));
  const seenLinks = new Set<string>();
  const uniqueLinks = links.filter((link) => {
    const id = `${link.from}->${link.to}`;
    if (seenLinks.has(id)) return false;
    seenLinks.add(id);
    return true;
  });

  const write = (node: WorkflowNode): WorkflowFileCard => {
    // A link to a card included in this export becomes a [[key|Title]] reference, resolved back to a real id on
    // import. A link to a card outside this export is left with its real id — only keys local to this file resolve.
    const rewrittenBlocks = node.blocks.map((block) => ({
      ...block,
      text: block.text.replace(WIKILINK_PATTERN, (whole: string, id: string, title: string) =>
        included.has(id) ? `[[${keyFor(id)}|${title}]]` : whole,
      ),
    }));
    const notes = writeBlocks(rewrittenBlocks);
    const children = cardsOf(node.id);
    const timerMinutes = node.timerMs ? node.timerMs / 60_000 : 0;
    const schedule = mode === "scheduled" && node.parentId !== null && node.schedule ? writeSchedule(node.schedule) : undefined;
    const shape = flowchart && node.parentId !== null && node.nodeType && node.nodeType !== "process" ? node.nodeType : undefined;
    return {
      ...(keys.has(node.id) ? { key: keys.get(node.id) } : {}),
      title: node.title.trim() || "Untitled card",
      ...(node.description.trim() ? { description: node.description } : {}),
      ...(node.parentId !== null && node.status === "done" ? { status: "done" as const } : {}),
      ...(notes.length > 0 ? { notes } : {}),
      ...(timerMinutes > 0 && timerMinutes <= 24 * 60 ? { timerMinutes } : {}),
      ...(schedule ? { schedule } : {}),
      ...(shape ? { shape } : {}),
      ...(children.length > 0 ? { cards: children.map(write) } : {}),
    };
  };

  const appearance = root.appearance;
  return {
    format: WORKFLOW_FILE_FORMAT,
    version: WORKFLOW_FILE_VERSION,
    author: EXPORTED_AUTHOR,
    workflow: {
      ...write(root),
      type: mode,
      ...(appearance ? { appearance: { style: appearance.style, fade: appearance.fade } } : {}),
      ...(mode === "steps" && root.layout ? { layout: root.layout } : {}),
      ...(uniqueLinks.length > 0 ? { links: uniqueLinks } : {}),
    },
  };
}

/** A file name for an exported workflow, e.g. "Morning routine" → "morning-routine.planton.json". */
export function workflowFileName(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "workflow"}.planton.json`;
}

function normalTitle(title: string): string {
  return title.trim().toLowerCase();
}

function sameTitle(a: string, b: string): boolean {
  return normalTitle(a) === normalTitle(b);
}

/** At most this many cards per "add cards with AI" request, so one prompt can't flood a workflow. */
export const MAX_CARD_ADDITIONS = 8;

/** A card Claude suggests adding under an existing one: content only, no ids or position yet. */
export type CardDraft = {
  title: string;
  description: string;
  blocks: ContentBlock[];
  /** A built-in timer, for a card that's mostly timed ("30 arm circles" for 2 minutes). */
  timerMs: number | null;
};

/**
 * What a split makes of the card it splits: its notes cut down to an overview (the actions now live in the new cards)
 * and its timer, usually none once the time has moved to the new cards.
 */
export type ParentUpdate = { blocks: ContentBlock[]; timerMs: number | null };

export type CardAdditionsResult =
  { ok: true; cards: CardDraft[]; /** Only from a split. */ parent: ParentUpdate | null } | { ok: false; error: string };

/**
 * Reads the AI's reply to "add cards to this card": `{ "cards": [ { "title", "description", "notes", "timerMinutes" } ] }`,
 * the same card fields as a workflow file but flat, with no workflow wrapper, type, schedule, or nesting. Block ids use
 * `${idPrefix}-c1-b1`, … so they're unique within each card.
 */
export function parseCardAdditions(text: string, options: { idPrefix: string }): CardAdditionsResult {
  try {
    let raw: unknown;
    try {
      raw = JSON.parse(extractJson(text));
    } catch {
      return { ok: false, error: "the reply wasn't valid JSON" };
    }
    if (!isObject(raw)) fail("reply", "must be a JSON object");
    if (!Array.isArray(raw.cards)) fail("cards", "must be a list");
    if (raw.cards.length === 0) fail("cards", "must have at least one card");
    if (raw.cards.length > MAX_CARD_ADDITIONS) fail("cards", `can have at most ${MAX_CARD_ADDITIONS} cards`);
    const cards = raw.cards.map((value, index): CardDraft => {
      const path = `cards[${index}]`;
      if (!isObject(value)) fail(path, "must be an object");
      return {
        title: readText(value.title, `${path}.title`, MAX_TITLE, true),
        description: readText(value.description, `${path}.description`, MAX_TEXT, false),
        blocks: readBlocks(value.notes, `${path}.notes`, `${options.idPrefix}-c${index + 1}`),
        timerMs: readTimer(value.timerMinutes, `${path}.timerMinutes`),
      };
    });
    let parent: ParentUpdate | null = null;
    if (raw.parent !== undefined && raw.parent !== null) {
      if (!isObject(raw.parent)) fail("parent", "must be an object");
      if (!Array.isArray(raw.parent.notes)) fail("parent.notes", "must be a list");
      parent = {
        blocks: readBlocks(raw.parent.notes, "parent.notes", `${options.idPrefix}-p`),
        timerMs: readTimer(raw.parent.timerMinutes, "parent.timerMinutes"),
      };
    }
    return { ok: true, cards, parent };
  } catch (error) {
    if (error instanceof FileError) return { ok: false, error: error.message };
    throw error;
  }
}

/**
 * Adds cards the person asked for under a card, with the ids given, and applies what a split makes of that card. On a
 * step-by-step workflow's own card the new cards join the step track instead of hanging off it.
 */
export function applyCardAdditions(
  data: WorkflowData,
  parentId: string,
  cards: CardDraft[],
  ids: string[],
  now: number,
  parentUpdate: ParentUpdate | null,
): WorkflowData {
  const parent = data.nodes[parentId];
  if (!parent) return data;
  const nodes = { ...data.nodes };
  const edges = [...data.edges];
  const onTrack = parent.parentId === null && parent.mode === "steps";
  cards.forEach((draft, index) => {
    const id = ids[index];
    // The person asked for these, so they're authored by them (null), not by the built-in author card() uses.
    nodes[id] = {
      ...card(id, draft.title, parentId, draft.blocks, draft.description, now),
      createdBy: null,
      timerMs: draft.timerMs,
    };
    if (!onTrack) edges.push({ id: `${parentId}->${id}`, source: parentId, target: id });
  });
  if (parentUpdate) {
    // A timer counting down from the old one stops with it.
    const stopTimer = parent.countdown && parentUpdate.timerMs === null;
    nodes[parentId] = {
      ...parent,
      blocks: parentUpdate.blocks,
      timerMs: parentUpdate.timerMs,
      ...(stopTimer ? { countdown: false, deadline: null, timeLimitMs: null } : {}),
      updatedAt: now,
    };
  }
  return { nodes, edges };
}

/** A workflow (not in Trash) with the same title as the one being imported: most likely an earlier import of the same plan. */
export function findExistingWorkflow(data: WorkflowData, title: string): WorkflowNode | null {
  return getWorkflows(data).find((workflow) => sameTitle(workflow.title, title)) ?? null;
}

/**
 * Brings progress from an existing copy of a workflow into a newly imported version of it, so re-importing an updated
 * plan doesn't lose work done in the app. Cards are matched by their titles from the top of the workflow down; a card
 * that moved to a different parent (e.g. when a plan is regrouped) is still matched by its title if that title is
 * unique. A card done in the app stays done, ticked checklist items with the same text stay ticked, and read notes
 * stay read. The workflow keeps its favourite star, and its customised card look and flowchart layout unless the file
 * sets them.
 */
export function carryOverProgress(data: WorkflowData, existingId: string, template: WorkflowTemplate): WorkflowTemplate {
  const existingRoot = data.nodes[existingId];
  if (!existingRoot) return template;

  const pathOf = (nodes: Record<string, WorkflowNode>, node: WorkflowNode, rootId: string): string => {
    const titles: string[] = [];
    let current: WorkflowNode | undefined = node;
    while (current && current.id !== rootId) {
      titles.unshift(normalTitle(current.title));
      current = current.parentId ? nodes[current.parentId] : undefined;
    }
    return titles.join("\n");
  };

  // Cards with the same path (e.g. two "Test" tasks in one phase) are matched in order.
  const oldByPath = new Map<string, WorkflowNode[]>();
  for (const node of getDescendants(data, existingId)) {
    const path = pathOf(data.nodes, node, existingId);
    oldByPath.set(path, [...(oldByPath.get(path) ?? []), node]);
  }

  const newNodes = Object.fromEntries(template.nodes.map((node) => [node.id, node]));
  const matches = new Map<string, WorkflowNode>();
  for (const node of template.nodes) {
    if (node.id === template.rootId) continue;
    const old = oldByPath.get(pathOf(newNodes, node, template.rootId))?.shift();
    if (old) matches.set(node.id, old);
  }

  // Cards that moved: match the rest by title alone, when the title appears only once on each side.
  const matchedOldIds = new Set([...matches.values()].map((node) => node.id));
  const countTitles = (list: WorkflowNode[]) => {
    const counts = new Map<string, number>();
    for (const node of list) counts.set(normalTitle(node.title), (counts.get(normalTitle(node.title)) ?? 0) + 1);
    return counts;
  };
  const unmatchedOld = getDescendants(data, existingId).filter((node) => !matchedOldIds.has(node.id));
  const unmatchedNew = template.nodes.filter((node) => node.id !== template.rootId && !matches.has(node.id));
  const oldTitleCounts = countTitles(unmatchedOld);
  const newTitleCounts = countTitles(unmatchedNew);
  for (const node of unmatchedNew) {
    const title = normalTitle(node.title);
    if (oldTitleCounts.get(title) !== 1 || newTitleCounts.get(title) !== 1) continue;
    const old = unmatchedOld.find((candidate) => normalTitle(candidate.title) === title);
    if (old) matches.set(node.id, old);
  }

  const nodes = template.nodes.map((node): WorkflowNode => {
    if (node.id === template.rootId) {
      return {
        ...node,
        favorite: existingRoot.favorite,
        appearance: node.appearance ?? existingRoot.appearance,
        layout: node.layout ?? existingRoot.layout,
        readAt: existingRoot.readAt,
      };
    }
    const old = matches.get(node.id);
    if (!old) return node;
    const tickedTexts = new Set(
      old.blocks.filter((block) => block.type === "checklist" && block.checked).map((block) => block.text.trim().toLowerCase()),
    );
    return {
      ...node,
      status: old.status === "done" ? "done" : node.status,
      // The card's history comes with it, so the calendar keeps its days.
      doneAt: old.status === "done" ? old.doneAt : node.doneAt,
      completions: old.completions,
      skips: old.skips,
      readAt: old.readAt,
      blocks: node.blocks.map((block) =>
        block.type === "checklist" && !block.checked && tickedTexts.has(block.text.trim().toLowerCase())
          ? { ...block, checked: true }
          : block,
      ),
    };
  });
  return { ...template, nodes };
}

/** Swaps an existing workflow for a newly imported version of it, keeping progress; the old copy goes to Trash. */
export function replaceWithImport(data: WorkflowData, existingId: string, template: WorkflowTemplate, now: number): WorkflowData {
  const carried = carryOverProgress(data, existingId, template);
  return addWorkflowTemplate(trashWorkflow(data, existingId, now), carried);
}
