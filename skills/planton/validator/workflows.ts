/** Workflow data model and pure helpers. A workflow is a root node (parentId null); its cards are descendants. */

import { isBuiltInCover } from "./built-in-covers.ts";
import type { CardAppearance } from "./card-appearance.ts";
import {
  dateKey,
  formatWhen,
  getCurrentOccurrence,
  getNextStart,
  getScheduleState,
  type Schedule,
  type ScheduleState,
} from "./schedule.ts";

/**
 * Statuses change automatically (a time limit starts a card; running out of time fails it) or through the
 * card actions sheet. There is no free-form status picker.
 */
export type NodeStatus = "pending" | "in_progress" | "paused" | "done" | "failed" | "cancelled";

export const NODE_STATUSES: NodeStatus[] = ["pending", "in_progress", "paused", "done", "failed", "cancelled"];

export const STATUS_LABELS: Record<NodeStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  paused: "Paused",
  done: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

/**
 * How a workflow's cards are worked through. Free-form: any order. Step-by-step: its cards are steps done in
 * order, each unlocking the next. Scheduled: cards tied to times of day. Flowchart: a typical flowchart from Start to
 * End; its cards are flat, connected by hand, and each has a symbol (see FlowNodeType).
 */
export type WorkflowMode = "freeform" | "steps" | "scheduled" | "flowchart";

/**
 * How a step-by-step workflow's flowchart is arranged. Line: one row, left to right. Rows: wraps into rows of a few
 * steps, read like lines of text, so long procedures stay compact on a phone. Other workflow types use a tree.
 */
export type FlowLayout = "line" | "rows";

/** Step-by-step workflows with more steps than this use rows unless a layout was chosen. */
export const ROWS_LAYOUT_MIN_STEPS = 5;

/**
 * A card's symbol in a Flowchart workflow, from the standard flowchart symbols. Start and End (ovals) mark where the
 * flowchart begins and ends; every other symbol is a step, differing only in what kind of step it shows (a Decision is
 * a question, a Document produces a document, a Delay is a wait). Visual only: a Decision doesn't branch anything.
 */
export type FlowNodeType =
  | "start"
  | "process"
  | "decision"
  | "end"
  | "input-output"
  | "document"
  | "subprocess"
  | "delay"
  | "preparation"
  | "manual-operation"
  | "database"
  | "display";

/** Every symbol, in the order the shape picker shows them: the everyday four first. */
export const FLOW_NODE_TYPES: FlowNodeType[] = [
  "process",
  "decision",
  "start",
  "end",
  "input-output",
  "document",
  "subprocess",
  "delay",
  "preparation",
  "manual-operation",
  "database",
  "display",
];

export const FLOW_NODE_TYPE_LABELS: Record<FlowNodeType, string> = {
  start: "Start",
  process: "Process",
  decision: "Decision",
  end: "End",
  "input-output": "Input/output",
  document: "Document",
  subprocess: "Subprocess",
  delay: "Delay",
  preparation: "Preparation",
  "manual-operation": "Manual step",
  database: "Database",
  display: "Display",
};

export const WORKFLOW_MODE_LABELS: Record<WorkflowMode, string> = {
  freeform: "Free-form",
  steps: "Step-by-step",
  scheduled: "Scheduled",
  flowchart: "Flowchart",
};

/** Built-in workflows that became step-by-step after they were first seeded onto devices. */
const BUILT_IN_STEP_WORKFLOWS = ["chicken-adobo"];

/** Statuses whose time limit is still counting down. */
const RUNNING_STATUSES: NodeStatus[] = ["pending", "in_progress"];

export type BlockType = "heading" | "paragraph" | "bullet" | "checklist" | "resource";

export type ResourceBlock = {
  kind: "image" | "youtube";
  url: string;
  title: string;
  thumbnailUrl?: string;
};

export type ContentBlock = {
  id: string;
  type: BlockType;
  text: string;
  checked?: boolean;
  resource?: ResourceBlock;
  /** Another block's id earlier in the same array. Undefined: a top-level block (not nested under anything). */
  parentId?: string;
  /** Whether this block's descendants are hidden. Ignored (and never offered) on a block with no children. */
  collapsed?: boolean;
};

export type Point = { x: number; y: number };

export type WorkflowNode = {
  id: string;
  title: string;
  description: string;
  parentId: string | null;
  status: NodeStatus;
  blocks: ContentBlock[];
  /** Position on the flowchart canvas; null until the canvas first places it. */
  position: Point | null;
  /** Time limit as an epoch timestamp. Passing it while unfinished marks the card Failed. */
  deadline: number | null;
  /** The full length of the current time limit, so progress through it can be shown. Kept while a pause shifts the deadline. */
  timeLimitMs: number | null;
  /** A built-in timer length for this step (e.g. "simmer 30 minutes"), started from the card with one tap. */
  timerMs: number | null;
  /**
   * Whether the running time limit is a timer rather than a deadline: when a timer ends the card shows
   * "Time's up" and stays in progress, where a deadline running out marks the card Failed.
   */
  countdown: boolean;
  /** The status to restore when a paused workflow continues (set on the card that paused it). */
  resumeStatus: NodeStatus | null;
  /** Workflow roots only: when the workflow was paused. While set, timers are frozen and progress is blocked. */
  pausedAt: number | null;
  /**
   * Workflow roots only: read mode. Content and structure can't be edited (text, notes, cards, flowchart layout),
   * but the workflow can still be worked through (checklist ticks, card actions, pause/continue).
   */
  readOnly: boolean;
  /** When the user finished reading this card's notes (scrolled to their end). Part of its completion requirements. */
  readAt: number | null;
  /**
   * Who created it. null means the person using this device, so the name follows their profile;
   * built-in workflows (samples and templates) carry BUILT_IN_AUTHOR.
   */
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
  /** Workflow roots only: starred for quick access from the Favorites tab. */
  favorite: boolean;
  /** Workflow roots only: tucked out of the main list, still kept. Set when archived, cleared when restored. */
  archivedAt: number | null;
  /** Workflow roots only: moved to Trash, kept until restored or deleted forever. */
  deletedAt: number | null;
  /** Workflow roots only: how the cards are worked through. Cards inside a workflow are always "freeform". */
  mode: WorkflowMode;
  /** Cards in scheduled workflows: when the card happens. */
  schedule: Schedule | null;
  /**
   * The occurrence of the schedule the card's progress belongs to (see getCurrentOccurrence). When a new one
   * starts, a repeating card resets to pending with its checklist cleared.
   */
  scheduleCycle: string | null;
  /** When the card got its schedule; occurrences that ended before this aren't counted as missed. */
  scheduledSince: number | null;
  /** Occurrences the card was completed in, oldest first, for its history. */
  completions: string[];
  /** Occurrences the card was skipped in ("Skip this time"), oldest first, like `completions`. */
  skips: string[];
  /** When the card was last marked done. Only read while its status is "done", so reopening needs no clean-up. */
  doneAt: number | null;
  /** Workflow roots only: optional card customisation (cover artwork and style). Null uses the default look. */
  appearance: CardAppearance | null;
  /** Step-by-step workflow roots only: the chosen flowchart layout. Null picks one from the number of steps. */
  layout: FlowLayout | null;
  /** Cards in Flowchart workflows: the card's symbol. Null reads as Process. Kept, but ignored, in other types. */
  nodeType: FlowNodeType | null;
  /**
   * Cards in Flowchart and free-form workflows: the technology the card stands for (`tech` in a plan file), an id from
   * TECH_CATALOG or one a newer list added. Null for none.
   */
  tech: string | null;
};

/** Author shown on workflows that ship with the app. */
export const BUILT_IN_AUTHOR = "Planton";

/** A connection drawn on the flowchart. Separate from parent/child nesting, like Obsidian links. */
export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  /**
   * Flowchart workflows: a short word on the connection, like a Decision's "Yes" or "No". Left out when there's
   * none, so connections saved before labels existed need no migrating.
   */
  label?: string;
};

/** The longest a connection's label can be: a word or two beside a line. */
export const EDGE_LABEL_MAX = 24;

export type WorkflowData = {
  nodes: Record<string, WorkflowNode>;
  edges: WorkflowEdge[];
};

export type Progress = {
  done: number;
  /** Cards that count toward progress (cancelled cards are excluded). */
  total: number;
  ratio: number;
};

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Workflows not in Trash (includes archived ones — filter those out separately for the main list). */
export function getWorkflows(data: WorkflowData): WorkflowNode[] {
  return Object.values(data.nodes).filter((node) => node.parentId === null && node.deletedAt == null);
}

/** Workflows moved to Trash, newest-deleted first. */
export function getDeletedWorkflows(data: WorkflowData): WorkflowNode[] {
  return Object.values(data.nodes)
    .filter((node) => node.parentId === null && node.deletedAt != null)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
}

// getChildren is the base of every traversal below (getDescendants walks it node by node), and the workflows
// list calls those traversals for every visible card. A plain `Object.values(data.nodes).filter(...)` rescans
// every node in the whole store — not just this workflow — on every single call, so cost grows with the total
// number of cards across all workflows, not the one being drawn. Past a couple dozen workflows that's enough
// redundant scanning per frame to stall the UI thread. This index groups nodes by parent once per `data`
// version (built lazily, on whichever call sees a given `data` object first) and is then reused by every
// getChildren call against that same version - orders of magnitude fewer node visits overall. `data` is always
// replaced (never mutated) on a store update, so a `WeakMap` keyed on the object itself invalidates naturally:
// a new `data` misses the cache and rebuilds, and the old entry is freed once nothing else references it.
const childrenIndexCache = new WeakMap<WorkflowData, Map<string, WorkflowNode[]>>();

function childrenIndex(data: WorkflowData): Map<string, WorkflowNode[]> {
  const cached = childrenIndexCache.get(data);
  if (cached) return cached;
  const index = new Map<string, WorkflowNode[]>();
  for (const node of Object.values(data.nodes)) {
    if (node.parentId === null) continue;
    const siblings = index.get(node.parentId);
    if (siblings) siblings.push(node);
    else index.set(node.parentId, [node]);
  }
  childrenIndexCache.set(data, index);
  return index;
}

export function getChildren(data: WorkflowData, id: string): WorkflowNode[] {
  // Sliced so callers keep getting a fresh array each time (as before) and can't mutate the shared index.
  return (childrenIndex(data).get(id) ?? []).slice();
}

/**
 * Per-`data` memo for the traversals below, keyed like childrenIndex: the workflows list asks each visible workflow
 * for its descendants, progress and status on every render (and a 30-second clock re-renders it), and each of those
 * walks the workflow's whole card tree. Caching them per `data` version turns every repeat into a map lookup.
 */
function memoPerData<T>(cache: WeakMap<WorkflowData, Map<string, T>>, data: WorkflowData, id: string, compute: () => T): T {
  let byId = cache.get(data);
  if (!byId) {
    byId = new Map();
    cache.set(data, byId);
  }
  if (byId.has(id)) return byId.get(id)!;
  const value = compute();
  byId.set(id, value);
  return value;
}

const descendantsCache = new WeakMap<WorkflowData, Map<string, WorkflowNode[]>>();
const progressCache = new WeakMap<WorkflowData, Map<string, Progress>>();
const workflowStatusCache = new WeakMap<WorkflowData, Map<string, NodeStatus>>();

export function getDescendants(data: WorkflowData, id: string): WorkflowNode[] {
  const cached = memoPerData(descendantsCache, data, id, () => {
    const index = childrenIndex(data);
    const result: WorkflowNode[] = [];
    // Breadth-first with a read pointer instead of queue.shift(), which re-indexes the whole array on every call.
    const queue = [id];
    for (let head = 0; head < queue.length; head++) {
      for (const child of index.get(queue[head]) ?? []) {
        result.push(child);
        queue.push(child.id);
      }
    }
    return result;
  });
  // Sliced like getChildren, so callers can't mutate the shared cache.
  return cached.slice();
}

/** The workflow's root node plus every card beneath it. */
export function getWorkflowNodes(data: WorkflowData, rootId: string): WorkflowNode[] {
  const root = data.nodes[rootId];
  return root ? [root, ...getDescendants(data, rootId)] : [];
}

export function getAncestors(data: WorkflowData, id: string): WorkflowNode[] {
  const result: WorkflowNode[] = [];
  let current = data.nodes[id]?.parentId ?? null;
  while (current) {
    const node = data.nodes[current];
    if (!node) break;
    result.unshift(node);
    current = node.parentId;
  }
  return result;
}

export function getRootId(data: WorkflowData, id: string): string {
  return getAncestors(data, id)[0]?.id ?? id;
}

export function getWorkflowMode(data: WorkflowData, anyId: string): WorkflowMode {
  return data.nodes[getRootId(data, anyId)]?.mode ?? "freeform";
}

/** Whether a card's saved symbol is Start or End. Only means anything inside a Flowchart workflow. */
function hasTerminatorType(node: WorkflowNode): boolean {
  return node.nodeType === "start" || node.nodeType === "end";
}

/**
 * How far along a card's own work is, for where it stands on a chart (cardState in graph.ts): the cards inside it that
 * are done and its own checklist ticked, out of both. Cancelled cards and a Flowchart's Start and End don't count.
 * Unlike getProgress, a card with nothing inside it counts its checklist, not itself. `started` says whether anything
 * inside it has begun (a card started or done, or a step on one ticked), so an overview's column whose parts are part
 * way set up reads as in progress before any of them is done.
 */
export function getWorkProgress(data: WorkflowData, id: string): { done: number; total: number; started: boolean } {
  const node = data.nodes[id];
  if (!node) return { done: 0, total: 0, started: false };
  const flowchart = getWorkflowMode(data, id) === "flowchart";
  const inside = getDescendants(data, id).filter(
    (card) => card.status !== "cancelled" && !(flowchart && hasTerminatorType(card)),
  );
  const checklist = node.blocks.filter((block) => block.type === "checklist");
  return {
    done: inside.filter((card) => card.status === "done").length + checklist.filter((block) => block.checked).length,
    total: inside.length + checklist.length,
    started: inside.some(
      (card) =>
        card.status === "in_progress" ||
        card.status === "done" ||
        card.blocks.some((block) => block.type === "checklist" && block.checked),
    ),
  };
}

/** A card's symbol when it's in a Flowchart workflow; null for the workflow itself and for cards in any other type. */
export function getNodeShape(data: WorkflowData, id: string): FlowNodeType | null {
  const node = data.nodes[id];
  if (!node || node.parentId === null || getWorkflowMode(data, id) !== "flowchart") return null;
  return node.nodeType ?? "process";
}

/** Start and End cards of a Flowchart: markers, not tasks. They don't count toward progress and can't be completed. */
export function isTerminator(data: WorkflowData, id: string): boolean {
  const shape = getNodeShape(data, id);
  return shape === "start" || shape === "end";
}

export type StepInfo = {
  /** 0-based position among the workflow's steps. */
  index: number;
  total: number;
  previous: WorkflowNode | null;
  next: WorkflowNode | null;
  /** The earliest step before this one that isn't done or skipped yet; while there is one, this step is locked. */
  blocking: WorkflowNode | null;
  blockingIndex: number;
};

/** A skipped (cancelled) step counts as finished for unlocking the steps after it. */
function isStepFinished(step: WorkflowNode): boolean {
  return step.status === "done" || step.status === "cancelled";
}

/**
 * Where a card sits in a step-by-step workflow, or null if it isn't one of its steps. A step-by-step
 * workflow's steps are its direct cards, in the order they were added; deeper sub-cards are ordinary cards.
 */
export function getStepInfo(data: WorkflowData, id: string): StepInfo | null {
  const node = data.nodes[id];
  const parent = node?.parentId ? data.nodes[node.parentId] : undefined;
  if (!node || !parent || parent.parentId !== null || parent.mode !== "steps") return null;
  const steps = getChildren(data, parent.id);
  const index = steps.findIndex((step) => step.id === id);
  const blockingIndex = steps.slice(0, index).findIndex((step) => !isStepFinished(step));
  return {
    index,
    total: steps.length,
    previous: steps[index - 1] ?? null,
    next: steps[index + 1] ?? null,
    blocking: blockingIndex === -1 ? null : steps[blockingIndex],
    blockingIndex,
  };
}

/** A one-line summary of where a step-by-step workflow is up to, or null for other workflow types. */
export function getStepSummary(data: WorkflowData, rootId: string): string | null {
  if (data.nodes[rootId]?.mode !== "steps") return null;
  const steps = getChildren(data, rootId);
  if (steps.length === 0) return "No steps yet";
  const current = getCurrentStep(data, rootId);
  return current ? `Step ${current.index + 1} of ${current.total} · ${current.step.title}` : `All ${steps.length} steps finished`;
}

/** The step to pick up from in a step-by-step workflow: the first one not done or skipped. Null once all are finished. */
export function getCurrentStep(data: WorkflowData, rootId: string): { step: WorkflowNode; index: number; total: number } | null {
  const steps = getChildren(data, rootId);
  const index = steps.findIndex((step) => !isStepFinished(step));
  return index === -1 ? null : { step: steps[index], index, total: steps.length };
}

/**
 * Cards with sub-cards: done sub-cards ÷ all non-cancelled sub-cards, counted across every level below.
 * Cards without sub-cards: follow their own status. In a Flowchart, Start and End cards aren't counted.
 */
export function getProgress(data: WorkflowData, id: string): Progress {
  // A copy, so callers can't mutate the shared cache.
  return { ...memoPerData(progressCache, data, id, () => computeProgress(data, id)) };
}

function computeProgress(data: WorkflowData, id: string): Progress {
  const node = data.nodes[id];
  if (!node) return { done: 0, total: 0, ratio: 0 };
  const flowchart = getWorkflowMode(data, id) === "flowchart";
  if (flowchart && node.parentId !== null && hasTerminatorType(node)) return { done: 0, total: 0, ratio: 0 };

  const all = getDescendants(data, id);
  const descendants = flowchart ? all.filter((card) => !hasTerminatorType(card)) : all;
  if (descendants.length === 0) {
    // A Flowchart that has only its Start and End has nothing to do yet.
    if (all.length > 0) return { done: 0, total: 0, ratio: 0 };
    if (node.status === "cancelled") return { done: 0, total: 0, ratio: 0 };
    const done = node.status === "done" ? 1 : 0;
    return { done, total: 1, ratio: done };
  }

  const counted = descendants.filter((card) => card.status !== "cancelled");
  const done = counted.filter((card) => card.status === "done").length;
  return { done, total: counted.length, ratio: counted.length === 0 ? 0 : done / counted.length };
}

export function getStats(data: WorkflowData) {
  // Start and End cards of a Flowchart are markers, not steps.
  const cards = Object.values(data.nodes).filter(
    (node) => node.parentId !== null && !(hasTerminatorType(node) && getWorkflowMode(data, node.id) === "flowchart"),
  );
  return {
    workflows: getWorkflows(data).length,
    steps: cards.length,
    completed: cards.filter((card) => card.status === "done").length,
  };
}

export function formatUpdatedAt(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${Math.floor(hours / 24)}d ago`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** e.g. "Sep 14, 2026". Formatted by hand so it reads the same on every device and locale. */
export function formatCreatedAt(timestamp: number): string {
  const date = new Date(timestamp);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function isWorkflowPaused(data: WorkflowData, id: string): boolean {
  return data.nodes[getRootId(data, id)]?.pausedAt != null;
}

/** Whether the workflow containing this card is in read mode. */
export function isReadOnly(data: WorkflowData, id: string): boolean {
  return data.nodes[getRootId(data, id)]?.readOnly === true;
}

/** A workflow's status is never set directly; it follows its cards. */
export function getWorkflowStatus(data: WorkflowData, rootId: string): NodeStatus {
  return memoPerData(workflowStatusCache, data, rootId, () => computeWorkflowStatus(data, rootId));
}

function computeWorkflowStatus(data: WorkflowData, rootId: string): NodeStatus {
  if (data.nodes[rootId]?.pausedAt != null) return "paused";
  const flowchart = data.nodes[rootId]?.mode === "flowchart";
  const cards = getDescendants(data, rootId).filter(
    (card) => card.status !== "cancelled" && !(flowchart && hasTerminatorType(card)),
  );
  if (cards.length > 0 && cards.every((card) => card.status === "done")) return "done";
  if (cards.some((card) => card.status === "failed")) return "failed";
  if (cards.some((card) => card.status === "in_progress" || card.status === "done")) return "in_progress";
  return "pending";
}

/** Status to show for any node: workflows derive theirs, cards use their own. */
export function getDisplayStatus(data: WorkflowData, id: string): NodeStatus {
  const node = data.nodes[id];
  if (!node) return "pending";
  return node.parentId === null ? getWorkflowStatus(data, id) : node.status;
}

/** Milliseconds left on a card's time limit, frozen at the pause moment while its workflow is paused. */
export function getTimeLeft(data: WorkflowData, id: string, now: number): number | null {
  const node = data.nodes[id];
  if (!node?.deadline) return null;
  const pausedAt = data.nodes[getRootId(data, id)]?.pausedAt;
  return node.deadline - (pausedAt ?? now);
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (ms < 60000) return `${Math.max(0, Math.ceil(ms / 1000))}s`;
  return `${minutes}m`;
}

// ---------------------------------------------------------------------------------------------------------
// State transitions. Pure so they can be tested directly; the store applies them.
// ---------------------------------------------------------------------------------------------------------

function withNode(data: WorkflowData, id: string, patch: Partial<WorkflowNode>): WorkflowData {
  const node = data.nodes[id];
  if (!node) return data;
  return { ...data, nodes: { ...data.nodes, [id]: { ...node, ...patch } } };
}

/** Marks every unfinished card whose time limit has passed as Failed. Paused workflows are skipped. */
export function failOverdueCards(data: WorkflowData, now: number): WorkflowData {
  let next = data;
  for (const node of Object.values(data.nodes)) {
    if (!node.deadline || node.countdown || node.deadline > now || !RUNNING_STATUSES.includes(node.status)) continue;
    if (isWorkflowPaused(data, node.id)) continue;
    next = withNode(next, node.id, { status: "failed", updatedAt: now });
  }
  return next;
}

/** Starts a countdown on a card; it becomes In progress and fails if not done in time. */
export function setTimeLimit(data: WorkflowData, id: string, durationMs: number, now: number): WorkflowData {
  return withNode(data, id, {
    deadline: now + durationMs,
    timeLimitMs: durationMs,
    countdown: false,
    status: "in_progress",
    updatedAt: now,
  });
}

/** Starts the card's built-in timer. Unlike a time limit, the card doesn't fail when it ends. */
export function startTimer(data: WorkflowData, id: string, now: number): WorkflowData {
  const node = data.nodes[id];
  if (!node?.timerMs) return data;
  return withNode(data, id, {
    deadline: now + node.timerMs,
    timeLimitMs: node.timerMs,
    countdown: true,
    status: "in_progress",
    updatedAt: now,
  });
}

export function clearTimeLimit(data: WorkflowData, id: string, now: number): WorkflowData {
  const node = data.nodes[id];
  if (!node) return data;
  return withNode(data, id, {
    deadline: null,
    timeLimitMs: null,
    countdown: false,
    status: node.status === "failed" ? "pending" : node.status,
    updatedAt: now,
  });
}

export function startCard(data: WorkflowData, id: string, now: number): WorkflowData {
  return withNode(data, id, { status: "in_progress", updatedAt: now });
}

// About 13 months of a daily routine, for the calendar to page back through. Applies to completions and skips.
const MAX_COMPLETIONS = 400;

/** An occurrence list with `key` added at its end, once, keeping the newest MAX_COMPLETIONS. */
function withOccurrence(list: string[], key: string): string[] {
  return list.includes(key) ? list : [...list, key].slice(-MAX_COMPLETIONS);
}

export function markDone(data: WorkflowData, id: string, now: number): WorkflowData {
  const node = data.nodes[id];
  const occurrence = node?.schedule ? getCurrentOccurrence(node.schedule, now) : null;
  return withNode(data, id, {
    status: "done",
    deadline: null,
    timeLimitMs: null,
    countdown: false,
    updatedAt: now,
    doneAt: now,
    // A routine card's day is recorded as done, and is no longer skipped.
    ...(node && occurrence
      ? {
          completions: withOccurrence(node.completions, occurrence.key),
          skips: node.skips.filter((key) => key !== occurrence.key),
        }
      : {}),
  });
}

// ---------------------------------------------------------------------------------------------------------
// Schedules. Cards in a scheduled workflow happen at set times; repeating ones start fresh each occurrence.
// ---------------------------------------------------------------------------------------------------------

/** Where a scheduled card stands right now, or null if it has no schedule. */
export function getCardScheduleState(node: WorkflowNode, now: number): ScheduleState | null {
  if (!node.schedule) return null;
  const finished = node.status === "done" ? "done" : node.status === "cancelled" ? "skipped" : null;
  return getScheduleState(node.schedule, finished, now, node.scheduledSince);
}

/** Sets or removes a card's schedule. The current occurrence counts as already started, so nothing resets now. */
export function setSchedule(data: WorkflowData, id: string, schedule: Schedule | null, now: number): WorkflowData {
  const occurrence = schedule ? getCurrentOccurrence(schedule, now) : null;
  return withNode(data, id, {
    schedule,
    scheduleCycle: occurrence?.key ?? null,
    scheduledSince: schedule ? now : null,
    updatedAt: now,
  });
}

/**
 * Starts repeating scheduled cards afresh when a new occurrence begins, with the cards inside them: back to pending,
 * checklists unticked, notes unread, any timer cleared. Returns the same data object when nothing needed resetting.
 */
export function resetScheduledCards(data: WorkflowData, now: number): WorkflowData {
  let next = data;
  for (const node of Object.values(data.nodes)) {
    if (node.schedule?.kind !== "repeat") continue;
    const occurrence = getCurrentOccurrence(node.schedule, now);
    if (!occurrence || occurrence.key === node.scheduleCycle) continue;
    // A card scheduled before cycles were tracked just adopts the current one.
    if (node.scheduleCycle === null) {
      next = withNode(next, node.id, { scheduleCycle: occurrence.key });
      continue;
    }
    next = withNode(next, node.id, { scheduleCycle: occurrence.key, ...freshOccurrence(node, now) });
    // The cards inside it are part of the same session, so they start fresh with it, however deep. One with its own
    // schedule keeps its own cycle.
    for (const inner of getDescendants(next, node.id)) {
      if (!inner.schedule) next = withNode(next, inner.id, freshOccurrence(inner, now));
    }
  }
  return next;
}

/** A card as it is when its routine comes round again: not started, checklists clear, notes unread, no countdown. */
function freshOccurrence(node: WorkflowNode, now: number): Partial<WorkflowNode> {
  return {
    status: node.status === "paused" ? "paused" : "pending",
    resumeStatus: node.status === "paused" ? "pending" : node.resumeStatus,
    blocks: node.blocks.map((block) => (block.type === "checklist" ? { ...block, checked: false } : block)),
    readAt: null,
    deadline: null,
    timeLimitMs: null,
    countdown: false,
    updatedAt: now,
  };
}

/** Scheduled cards in a workflow with where they stand, due ones first, then by when they next start. */
export function getScheduledCards(data: WorkflowData, rootId: string, now: number) {
  return getDescendants(data, rootId)
    .filter((node) => node.schedule)
    .map((node) => {
      const state = getCardScheduleState(node, now)!;
      const occurrence = getCurrentOccurrence(node.schedule!, now);
      return { node, state, occurrence, nextStart: getNextStart(node.schedule!, now) };
    });
}

/** The card a scheduled workflow should open on: the earliest one that's due now, if any. */
export function getDueCard(data: WorkflowData, rootId: string, now: number): WorkflowNode | null {
  const due = getScheduledCards(data, rootId, now)
    .filter((entry) => entry.state === "due")
    .sort((a, b) => (a.occurrence?.start ?? 0) - (b.occurrence?.start ?? 0));
  return due[0]?.node ?? null;
}

/**
 * A one-line summary of a scheduled workflow for its card: what's due now, otherwise what's next, plus how many
 * were missed. Null for other workflow types.
 */
export function getScheduleSummary(data: WorkflowData, rootId: string, now: number): string | null {
  if (data.nodes[rootId]?.mode !== "scheduled") return null;
  const cards = getScheduledCards(data, rootId, now);
  if (cards.length === 0) return "No schedule yet — add times to its cards";
  // Only today's misses: earlier days' ones stay on their cards until those days come round again.
  const today = dateKey(now);
  const missed = cards.filter((entry) => entry.state === "missed" && entry.occurrence?.key === today).length;
  const missedText = missed > 0 ? ` · ${missed} missed today` : "";
  const due = getDueCard(data, rootId, now);
  if (due) return `Due now: ${due.title}${missedText}`;
  const upcoming = cards
    .filter((entry) => entry.state !== "done" && entry.state !== "skipped" && entry.nextStart !== null)
    .sort((a, b) => a.nextStart! - b.nextStart!)[0];
  const later = upcoming ?? cards.filter((entry) => entry.nextStart !== null).sort((a, b) => a.nextStart! - b.nextStart!)[0];
  if (!later) return `Nothing else scheduled${missedText}`;
  return `Next: ${later.node.title} · ${formatWhen(later.nextStart!, now)}${missedText}`;
}

export function resetToPending(data: WorkflowData, id: string, now: number): WorkflowData {
  const node = data.nodes[id];
  // Reopening a routine card takes back what was recorded for its day, done or skipped.
  const occurrence = node?.schedule ? getCurrentOccurrence(node.schedule, now) : null;
  return withNode(data, id, {
    status: "pending",
    deadline: null,
    timeLimitMs: null,
    countdown: false,
    updatedAt: now,
    ...(node && occurrence
      ? {
          completions: node.completions.filter((key) => key !== occurrence.key),
          skips: node.skips.filter((key) => key !== occurrence.key),
        }
      : {}),
  });
}

export function cancelCard(data: WorkflowData, id: string, now: number): WorkflowData {
  const node = data.nodes[id];
  // Skipping a routine card is remembered for its day, so the calendar shows it as skipped rather than missed.
  const occurrence = node?.schedule ? getCurrentOccurrence(node.schedule, now) : null;
  return withNode(data, id, {
    status: "cancelled",
    deadline: null,
    timeLimitMs: null,
    countdown: false,
    updatedAt: now,
    ...(node && occurrence
      ? {
          skips: withOccurrence(node.skips, occurrence.key),
          completions: node.completions.filter((key) => key !== occurrence.key),
        }
      : {}),
  });
}

/** Pauses the whole workflow from one of its cards: every timer freezes and progress is blocked until it continues. */
export function pauseWorkflow(data: WorkflowData, fromId: string, now: number): WorkflowData {
  const rootId = getRootId(data, fromId);
  if (data.nodes[rootId]?.pausedAt != null) return data;
  let next = withNode(data, rootId, { pausedAt: now, updatedAt: now });
  const card = next.nodes[fromId];
  if (card && card.parentId !== null) {
    next = withNode(next, fromId, { status: "paused", resumeStatus: card.status, updatedAt: now });
  }
  return next;
}

/** Continues a paused workflow: deadlines move later by the time spent paused, and paused cards resume. */
export function continueWorkflow(data: WorkflowData, anyId: string, now: number): WorkflowData {
  const rootId = getRootId(data, anyId);
  const pausedAt = data.nodes[rootId]?.pausedAt;
  if (pausedAt == null) return data;
  const pausedFor = now - pausedAt;
  let next = withNode(data, rootId, { pausedAt: null, updatedAt: now });
  for (const card of getDescendants(next, rootId)) {
    const patch: Partial<WorkflowNode> = {};
    if (card.deadline) patch.deadline = card.deadline + pausedFor;
    if (card.status === "paused") {
      patch.status = card.resumeStatus ?? "pending";
      patch.resumeStatus = null;
    }
    if (Object.keys(patch).length > 0) next = withNode(next, card.id, patch);
  }
  return next;
}

// ---------------------------------------------------------------------------------------------------------
// Favorite, archive, and trash. Workflow roots only — the whole workflow moves together, not individual cards.
// ---------------------------------------------------------------------------------------------------------

/**
 * Changes how a workflow is worked through. Card positions are cleared so the flowchart lays the cards out
 * again to suit the new type (a step-by-step workflow reads left to right as one line).
 */
export function setWorkflowMode(data: WorkflowData, rootId: string, mode: WorkflowMode, now: number): WorkflowData {
  const root = data.nodes[rootId];
  if (!root || root.parentId !== null || root.mode === mode) return data;
  const nodes = { ...data.nodes };
  for (const node of getWorkflowNodes(data, rootId)) {
    nodes[node.id] = { ...node, position: null };
  }
  nodes[rootId] = { ...nodes[rootId], mode, updatedAt: now };
  return { ...data, nodes };
}

/** The flowchart layout for a workflow: its chosen one, or rows for long step-by-step workflows. Null for other types. */
export function getFlowLayout(data: WorkflowData, rootId: string): FlowLayout | null {
  const root = data.nodes[rootId];
  if (root?.mode !== "steps") return null;
  return root.layout ?? (getChildren(data, rootId).length >= ROWS_LAYOUT_MIN_STEPS ? "rows" : "line");
}

/** Chooses a step-by-step workflow's flowchart layout. The flowchart re-arranges its cards when it changes. */
export function setFlowLayout(data: WorkflowData, rootId: string, layout: FlowLayout, now: number): WorkflowData {
  return withNode(data, rootId, { layout, updatedAt: now });
}

/**
 * Sets a card's flowchart symbol. A card that becomes Start or End goes back to pending with any time limit or timer
 * cleared, since those markers have no status of their own.
 */
export function setNodeType(data: WorkflowData, id: string, nodeType: FlowNodeType, now: number): WorkflowData {
  const node = data.nodes[id];
  if (!node || node.parentId === null) return data;
  const terminator = nodeType === "start" || nodeType === "end";
  return withNode(data, id, {
    nodeType,
    updatedAt: now,
    ...(terminator
      ? { status: "pending" as const, deadline: null, timeLimitMs: null, countdown: false, resumeStatus: null }
      : {}),
  });
}

/** Removes one connection. */
export function removeEdge(data: WorkflowData, edgeId: string): WorkflowData {
  if (!data.edges.some((edge) => edge.id === edgeId)) return data;
  return { ...data, edges: data.edges.filter((edge) => edge.id !== edgeId) };
}

/**
 * Labels one connection, e.g. a Decision's "Yes", or clears its label with null or blank text. The label is trimmed and
 * cut to EDGE_LABEL_MAX. The connection is replaced with a new object, which is how a save notices it changed.
 */
export function setEdgeLabel(data: WorkflowData, edgeId: string, label: string | null): WorkflowData {
  const edge = data.edges.find((candidate) => candidate.id === edgeId);
  if (!edge) return data;
  const text = (label ?? "").trim().slice(0, EDGE_LABEL_MAX);
  if ((edge.label ?? "") === text) return data;
  const next: WorkflowEdge = { id: edge.id, source: edge.source, target: edge.target, ...(text ? { label: text } : {}) };
  return { ...data, edges: data.edges.map((candidate) => (candidate === edge ? next : candidate)) };
}

/** Customises how a workflow's card looks, or resets it to the default with null. */
export function setAppearance(data: WorkflowData, id: string, appearance: CardAppearance | null, now: number): WorkflowData {
  return withNode(data, id, { appearance, updatedAt: now });
}

export function setFavorite(data: WorkflowData, id: string, favorite: boolean, now: number): WorkflowData {
  return withNode(data, id, { favorite, updatedAt: now });
}

export function archiveWorkflow(data: WorkflowData, id: string, now: number): WorkflowData {
  return withNode(data, id, { archivedAt: now, updatedAt: now });
}

export function unarchiveWorkflow(data: WorkflowData, id: string, now: number): WorkflowData {
  return withNode(data, id, { archivedAt: null, updatedAt: now });
}

/** Moves a workflow to Trash. Reversible with restoreWorkflow until it's deleted forever. */
export function trashWorkflow(data: WorkflowData, id: string, now: number): WorkflowData {
  return withNode(data, id, { deletedAt: now, updatedAt: now });
}

export function restoreWorkflow(data: WorkflowData, id: string, now: number): WorkflowData {
  return withNode(data, id, { deletedAt: null, updatedAt: now });
}

/** Permanently removes a workflow and everything under it. Not reversible — only for cards already in Trash. */
export function deleteWorkflowForever(data: WorkflowData, id: string): WorkflowData {
  const removedIds = new Set([id, ...getDescendants(data, id).map((node) => node.id)]);
  const nodes = Object.fromEntries(Object.entries(data.nodes).filter(([nodeId]) => !removedIds.has(nodeId)));
  const edges = data.edges.filter((edge) => !removedIds.has(edge.source) && !removedIds.has(edge.target));
  return { nodes, edges };
}

// ---------------------------------------------------------------------------------------------------------
// Completion requirements. A card can only be completed once each requirement that applies to it is met.
// ---------------------------------------------------------------------------------------------------------

export type RequirementKind = "checklist" | "read" | "cards";

export type CompletionRequirement = {
  kind: RequirementKind;
  label: string;
  met: boolean;
  /** Short progress text such as "2/3". */
  detail?: string;
};

/** Cards with text notes (not just checklist items) need to be read before they can be completed. */
export function hasReadableNotes(node: WorkflowNode): boolean {
  return node.blocks.some((block) => block.type !== "checklist" && block.text.trim().length > 0);
}

export function getCompletionRequirements(data: WorkflowData, id: string): CompletionRequirement[] {
  const node = data.nodes[id];
  if (!node) return [];
  const requirements: CompletionRequirement[] = [];

  const checklist = node.blocks.filter((block) => block.type === "checklist");
  if (checklist.length > 0) {
    const ticked = checklist.filter((block) => block.checked).length;
    requirements.push({
      kind: "checklist",
      label: "Tick every checklist item",
      met: ticked === checklist.length,
      detail: `${ticked}/${checklist.length}`,
    });
  }

  if (hasReadableNotes(node)) {
    requirements.push({ kind: "read", label: "Read the notes", met: node.readAt != null });
  }

  const children = getChildren(data, id);
  if (children.length > 0) {
    const finished = children.filter((child) => child.status === "done" || child.status === "cancelled").length;
    requirements.push({
      kind: "cards",
      label: "Finish every card inside it",
      met: finished === children.length,
      detail: `${finished}/${children.length}`,
    });
  }

  return requirements;
}

/** Why a card can't be completed right now, or null if it can. */
export function getCompletionBlocker(data: WorkflowData, id: string): string | null {
  const node = data.nodes[id];
  if (!node) return "This card no longer exists";
  if (node.parentId === null) return "Workflows complete automatically when all their cards are done";
  if (isTerminator(data, id)) return "Start and End mark where the flowchart begins and ends — they aren't completed";
  if (node.status === "done") return "Already completed";
  if (node.status === "cancelled") return "Restore this card before completing it";
  if (isWorkflowPaused(data, id)) return "The workflow is paused — continue it first";
  const step = getStepInfo(data, id);
  if (step?.blocking) return `Finish step ${step.blockingIndex + 1} first`;
  const unmet = getCompletionRequirements(data, id).find((requirement) => !requirement.met);
  if (unmet) return unmet.detail ? `${unmet.label} (${unmet.detail})` : unmet.label;
  return null;
}

/** How many parentId hops from the top level. 0 for a top-level block. */
export function blockDepth(blocks: ContentBlock[], blockId: string): number {
  const byId = new Map(blocks.map((block) => [block.id, block]));
  let depth = 0;
  let current = byId.get(blockId)?.parentId;
  while (current !== undefined) {
    depth += 1;
    current = byId.get(current)?.parentId;
  }
  return depth;
}

/** Whether any block's parentId is this one. */
function hasChildren(blocks: ContentBlock[], blockId: string): boolean {
  return blocks.some((block) => block.parentId === blockId);
}

export type VisibleBlock = { block: ContentBlock; depth: number; hasChildren: boolean };

/** The blocks to render, in order, skipping any block whose nearest collapsed ancestor hides it. */
export function visibleBlocks(blocks: ContentBlock[]): VisibleBlock[] {
  const hidden = new Set<string>();
  const result: VisibleBlock[] = [];
  for (const block of blocks) {
    if (block.parentId !== undefined && hidden.has(block.parentId)) {
      hidden.add(block.id);
      continue;
    }
    result.push({ block, depth: blockDepth(blocks, block.id), hasChildren: hasChildren(blocks, block.id) });
    if (block.collapsed) hidden.add(block.id);
  }
  return result;
}

/** How many blocks sit under this one, at every level below — only meaningful while it's collapsed. */
export function descendantBlockCount(blocks: ContentBlock[], blockId: string): number {
  const childrenOf = new Map<string, ContentBlock[]>();
  for (const block of blocks) {
    if (block.parentId === undefined) continue;
    const siblings = childrenOf.get(block.parentId);
    if (siblings) siblings.push(block);
    else childrenOf.set(block.parentId, [block]);
  }
  let count = 0;
  const queue = [blockId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const child of childrenOf.get(current) ?? []) {
      count += 1;
      queue.push(child.id);
    }
  }
  return count;
}

/**
 * Makes a block a child of the block immediately above it, so every adjacent pair of blocks stays at most one level
 * apart and a depth can always be found by walking parentId backward. A no-op on the first block (nothing above it) or
 * a block already a child of the one above it (can't skip a level in one press).
 */
export function indentBlock(blocks: ContentBlock[], blockId: string): ContentBlock[] {
  const index = blocks.findIndex((block) => block.id === blockId);
  if (index <= 0) return blocks;
  const above = blocks[index - 1];
  if (blocks[index].parentId === above.id) return blocks;
  return blocks.map((block) => (block.id === blockId ? { ...block, parentId: above.id } : block));
}

/** Moves a block up to its parent's own parent (one level up), or clears parentId if it was already top-level. */
export function outdentBlock(blocks: ContentBlock[], blockId: string): ContentBlock[] {
  const current = blocks.find((block) => block.id === blockId);
  if (!current || current.parentId === undefined) return blocks;
  const parent = blocks.find((block) => block.id === current.parentId);
  const grandparentId = parent?.parentId;
  return blocks.map((block) => (block.id === blockId ? { ...block, parentId: grandparentId } : block));
}

/** Removes a block; its direct children are re-parented to its own parent, not deleted or orphaned. */
export function removeBlock(blocks: ContentBlock[], blockId: string): ContentBlock[] {
  const removed = blocks.find((block) => block.id === blockId);
  if (!removed) return blocks;
  return blocks
    .filter((block) => block.id !== blockId)
    .map((block) => (block.parentId === blockId ? { ...block, parentId: removed.parentId } : block));
}

/**
 * Moves a block, with every block nested under it, to just before another block (or to the end with null). It joins
 * the level of the block it lands before (a top-level block at the end), so neighbours stay at most one level apart. A
 * no-op when the target is the block itself or one of its own descendants.
 */
export function moveBlock(blocks: ContentBlock[], blockId: string, beforeId: string | null): ContentBlock[] {
  const start = blocks.findIndex((block) => block.id === blockId);
  if (start === -1) return blocks;
  const depth = blockDepth(blocks, blockId);
  let end = start + 1;
  while (end < blocks.length && blockDepth(blocks, blocks[end].id) > depth) end += 1;
  const moving = blocks.slice(start, end);
  if (beforeId !== null && moving.some((block) => block.id === beforeId)) return blocks;
  const rest = [...blocks.slice(0, start), ...blocks.slice(end)];
  const at = beforeId === null ? rest.length : rest.findIndex((block) => block.id === beforeId);
  if (at === -1) return blocks;
  const parentId = beforeId === null ? undefined : rest[at].parentId;
  const [head, ...tail] = moving;
  const { parentId: _old, ...withoutParent } = head;
  const moved: ContentBlock = parentId === undefined ? withoutParent : { ...withoutParent, parentId };
  const result: ContentBlock[] = [...rest.slice(0, at), moved, ...tail, ...rest.slice(at)];
  return result.every((block, index) => block.id === blocks[index].id && block.parentId === blocks[index].parentId)
    ? blocks
    : result;
}

/** Flips whether a block's descendants are hidden. No-op on a block with no children. */
export function toggleCollapsed(blocks: ContentBlock[], blockId: string): ContentBlock[] {
  if (!hasChildren(blocks, blockId)) return blocks;
  return blocks.map((block) => (block.id === blockId ? { ...block, collapsed: !block.collapsed } : block));
}

export type TextSpan = { text: string; linkId?: string };

const WIKILINK_PATTERN = /\[\[([^[\]|]+)\|([^[\]]+)\]\]/g;

/**
 * Splits text on well-formed [[id|Title]] wikilink spans, alternating plain and link spans in order. A span with
 * linkId is a link — its text is the Title half, shown to the reader. Malformed brackets (no "|", or an empty id
 * or title) are left as plain text: this never throws, so a hand-edited or AI-written file with a stray [[ doesn't
 * crash the app.
 */
export function parseWikilinks(text: string): TextSpan[] {
  const spans: TextSpan[] = [];
  let lastIndex = 0;
  WIKILINK_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WIKILINK_PATTERN.exec(text)) !== null) {
    const [whole, id, title] = match;
    if (id.trim().length === 0 || title.trim().length === 0) continue;
    if (match.index > lastIndex) spans.push({ text: text.slice(lastIndex, match.index) });
    spans.push({ text: title, linkId: id });
    lastIndex = match.index + whole.length;
  }
  if (lastIndex < text.length || spans.length === 0) spans.push({ text: text.slice(lastIndex) });
  return spans;
}

/** Marks a card done only if its requirements are met; otherwise leaves the data unchanged. */
export function completeCard(data: WorkflowData, id: string, now: number): WorkflowData {
  return getCompletionBlocker(data, id) === null ? markDone(data, id, now) : data;
}

/** Records that the card's notes have been read. Allowed in read mode, since reading is part of working through it. */
export function markRead(data: WorkflowData, id: string, now: number): WorkflowData {
  const node = data.nodes[id];
  if (!node || node.readAt != null) return data;
  return withNode(data, id, { readAt: now });
}

export function setReadOnly(data: WorkflowData, anyId: string, readOnly: boolean): WorkflowData {
  return withNode(data, getRootId(data, anyId), { readOnly });
}

/** Fills in fields added after data was first saved on a device. */
/**
 * A card's appearance as the app knows it now. Until 2026-09-22 a cover could also be a gradient preset, with no photo,
 * and phones still have those saved: anything but a photo or a built-in picture this version has is dropped, keeping
 * the card's style and fade.
 */
function normalizeAppearance(appearance: CardAppearance | null | undefined): CardAppearance | null {
  if (!appearance) return null;
  const cover = appearance.cover as { kind?: unknown; uri?: unknown; name?: unknown } | null;
  const known =
    (cover?.kind === "image" && typeof cover.uri === "string") || (cover?.kind === "built-in" && isBuiltInCover(cover.name));
  return cover && !known ? { ...appearance, cover: null } : appearance;
}

export function normalizeData(data: WorkflowData): WorkflowData {
  const nodes = Object.fromEntries(
    Object.entries(data.nodes).map(([id, node]) => {
      // Built-in step-by-step workflows saved before types existed: switch them over, and drop their saved
      // flowchart layout so the steps get laid out as a line.
      const legacyStepWorkflow =
        node.mode === undefined && BUILT_IN_STEP_WORKFLOWS.some((rootId) => id === rootId || node.parentId === rootId);
      return [
        id,
        {
          ...node,
          mode: node.mode ?? (legacyStepWorkflow && node.parentId === null ? "steps" : "freeform"),
          position: legacyStepWorkflow ? null : node.position,
          deadline: node.deadline ?? null,
          // Limits set before their length was recorded: assume they started at the card's last update.
          timeLimitMs: node.timeLimitMs ?? (node.deadline ? Math.max(node.deadline - node.updatedAt, 60_000) : null),
          timerMs: node.timerMs ?? null,
          countdown: node.countdown ?? false,
          resumeStatus: node.resumeStatus ?? null,
          pausedAt: node.pausedAt ?? null,
          readOnly: node.readOnly ?? false,
          readAt: node.readAt ?? null,
          // Before authors were recorded, the only workflows were the built-in ones the app seeded.
          createdBy: node.createdBy === undefined ? BUILT_IN_AUTHOR : node.createdBy,
          createdAt: node.createdAt ?? node.updatedAt,
          favorite: node.favorite ?? false,
          archivedAt: node.archivedAt ?? null,
          deletedAt: node.deletedAt ?? null,
          schedule: node.schedule ?? null,
          scheduleCycle: node.scheduleCycle ?? null,
          scheduledSince: node.scheduledSince ?? (node.schedule ? node.updatedAt : null),
          completions: node.completions ?? [],
          skips: node.skips ?? [],
          // Cards finished before this was recorded count from when they last changed.
          doneAt: node.doneAt ?? (node.status === "done" ? node.updatedAt : null),
          appearance: normalizeAppearance(node.appearance),
          layout: node.layout ?? null,
          nodeType: node.nodeType ?? null,
          tech: node.tech ?? null,
        },
      ];
    }),
  );
  return { ...data, nodes };
}
