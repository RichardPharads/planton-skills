import type { ScheduleState } from "./schedule.ts";
import type { FlowLayout, FlowNodeType, NodeStatus, Point, Progress, WorkflowEdge, WorkflowNode } from "./workflows.ts";

export type { Point } from "./workflows.ts";

export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 76;
export const ROOT_NODE_HEIGHT = 100;
/** A Decision diamond is taller than other cards so two lines of title fit inside it. */
export const DECISION_NODE_HEIGHT = 112;
/** Card heights by symbol, where they differ: a Database and a Document are a little taller for their curved edges. */
const SHAPE_HEIGHTS: Partial<Record<FlowNodeType, number>> = { decision: DECISION_NODE_HEIGHT, database: 88, document: 84 };
// A rounded outline's largest corner radius.
const PROCESS_RADIUS = 10;
/** How far out a chart can zoom, unless it's too big to fit on screen that way (see zoomFloor). */
export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 2;
/** The furthest out any chart can go: enough for the biggest workflow a plan file can hold to fit on a phone. */
export const ABSOLUTE_MIN_ZOOM = 0.02;
// A big chart's zoom floor sits this far beyond its Fit zoom, so there's room around it when zoomed all the way out.
const FLOOR_MARGIN = 0.8;
// A Flowchart connection starts this far inside the card it leaves, under its fill, so it meets a wavy or curved edge.
const EDGE_TUCK = 14;
const COLUMN_GAP = 110;
const ROW_GAP = 28;
// Rows layout: steps wrap into rows, two per row for plain steps or three when steps have cards stacked under them.
const ROWS_COLUMN_GAP = 64;
const ROWS_ROW_GAP = 72;
const ROWS_PER_ROW_PLAIN = 2;
const ROWS_PER_ROW_STACKED = 3;
// Cards nested under a step stack below it; deeper levels are indented a little, up to two levels.
const STACK_GAP = 24;
const STACK_INDENT = 20;
const MAX_STACK_INDENT_LEVELS = 2;
// Connection routing, in world units. Stacked cards join along a rail just left of their column; connections back to
// an earlier column travel in a channel just above the target's row.
const RAIL_GAP = 18;
const RAIL_START_OFFSET = 14;
const ENTRY_GAP = 36;
const CHANNEL_GAP = 30;
const CORNER_RADIUS = 10;
// Flowchart workflows read top to bottom, the way flowcharts are drawn on paper.
const FLOW_ROW_GAP = 48;
const FLOW_COLUMN_GAP = 48;
// A connection turns this far below the card it leaves (or above the card it goes into).
const FLOW_JOG = 20;
// Cards closer together than this vertically are connected side to side instead of top to bottom.
const FLOW_MIN_GAP = 12;
// A loop back up the chart runs up a channel this far right of the cards it joins.
const LOOP_GAP = 28;
// A connection's label sits this far from its line and from the card the line leaves.
const LABEL_GAP = 8;

export type Positions = Record<string, Point>;

/** What a card on the canvas needs to render, derived from the workflow store. */
export type FlowNode = {
  id: string;
  title: string;
  isRoot: boolean;
  status: NodeStatus;
  progress: Progress;
  hasChildren: boolean;
  /** A running (or paused) time limit, shown as a border that runs down. */
  timer: { deadline: number; totalMs: number; pausedAt: number | null } | null;
  /** Step-by-step workflows: this card's step, 1-based, and where it stands. Null for other cards. */
  step: { number: number; state: StepState; locked: boolean } | null;
  /** Whether connections can be dragged from this card (not between the fixed steps of a step-by-step workflow). */
  connectable: boolean;
  /** Scheduled cards: where they stand right now, e.g. "Due now · 7:30 AM". */
  schedule: { text: string; state: ScheduleState } | null;
  /** Flowchart workflows: the card's symbol, which sets its outline. Null everywhere else. */
  shape: FlowNodeType | null;
  /** Whether the card has notes or a description, which only its page shows; a Flowchart card shows a small icon. */
  hasNotes: boolean;
  /** The card's technology id (see tech-catalog.ts), shown under its title. Null for none. */
  tech: string | null;
  /** Where the card stands (cardState) and how far along its own work is (getWorkProgress), for its outline, its badge
   * and the connections into it. */
  work: { state: CardState; done: number; total: number };
};

export type StepState = "done" | "current" | "ahead";

/** Where a card stands on a chart (docs/superpowers/specs/2026-10-08-card-and-link-states-design.md). */
export type CardState = "todo" | "doing" | "done";
/** A connection follows the cards it joins: in place once both are done, active while it leads into work in progress. */
export type LinkState = "planned" | "active" | "done";

/**
 * Done when the card is, or for the workflow's own card (never done by itself in a plan file) when everything in it is;
 * in progress once it's started, some of its work is done or anything inside it has begun (getWorkProgress); otherwise
 * to do. A card on hold (paused, failed, cancelled) is to do here: it keeps its own status look, and nothing flows into it.
 */
export function cardState(
  status: NodeStatus,
  progress: { done: number; total: number; started?: boolean },
  isRoot: boolean,
): CardState {
  if (status === "done" || (isRoot && progress.total > 0 && progress.done === progress.total)) return "done";
  if (status === "paused" || status === "failed" || status === "cancelled") return "todo";
  return status === "in_progress" || progress.done > 0 || progress.started === true ? "doing" : "todo";
}

/**
 * A connection between two cards is in place once both are done. One from a card to a card inside it (the workflow's
 * own card to a step, a group to its cards) shows what the card holds, not an order of work, so it's in place as soon as
 * the inner card is done.
 */
export function linkState(from: CardState, to: CardState, contains: boolean): LinkState {
  if (to === "done" && (contains || from === "done")) return "done";
  return to === "doing" ? "active" : "planned";
}

/**
 * How a connection is drawn. "free": an ordinary connection. The rest are the automatic track between the steps of a
 * step-by-step workflow: "done" (solid green) into a finished step, "progress" (flowing green) from a finished step
 * into the step you're on, "current" (flowing accent) into the first step before anything is finished, and "ahead".
 */
export type EdgeKind = "free" | "flow" | StepState | "progress" | ScheduledEdgeKind;
// "flow": a connection in a Flowchart workflow, drawn top to bottom with an arrowhead (see flowchartRoute).

/** A connection into a scheduled card, styled by how that card stands: coming up, missed, or done. */
export type ScheduledEdgeKind = "scheduled" | "scheduledMissed" | "scheduledDone";

export type FlowEdge = WorkflowEdge & {
  kind: EdgeKind;
  /** Flowchart and free connections: drawn by how the cards they join stand (linkState). The step track has its own kinds. */
  state?: LinkState;
  /** Scheduled workflows: the card's time, shown in a chip on the connection into it. (`label` is the stored one.) */
  timeLabel?: string;
};

export function nodeHeight(node: Pick<FlowNode, "isRoot" | "shape">): number {
  if (node.isRoot) return ROOT_NODE_HEIGHT;
  return (node.shape ? SHAPE_HEIGHTS[node.shape] : undefined) ?? NODE_HEIGHT;
}

/** The area every placed card covers, in canvas units; null when nothing is placed yet. */
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export function chartBounds(nodes: Pick<FlowNode, "id" | "isRoot" | "shape">[], positions: Positions): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const position = positions[node.id];
    if (!position) continue;
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
    maxX = Math.max(maxX, position.x + NODE_WIDTH);
    maxY = Math.max(maxY, position.y + nodeHeight(node));
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

/**
 * The zoom that fits bounds into the space available, up to maxZoom. Unlike clampZoom it isn't held at MIN_ZOOM, so a
 * chart of any size fits (down to ABSOLUTE_MIN_ZOOM).
 */
export function fitZoom(bounds: Bounds, availableWidth: number, availableHeight: number, maxZoom: number): number {
  const zoom = Math.min(
    availableWidth / Math.max(bounds.maxX - bounds.minX, 1),
    availableHeight / Math.max(bounds.maxY - bounds.minY, 1),
    maxZoom,
  );
  return Math.max(ABSOLUTE_MIN_ZOOM, zoom);
}

/**
 * How far out pinching and the zoom buttons go: MIN_ZOOM for a chart that fits at that zoom, and further for a bigger
 * one (a little beyond its Fit zoom), so a large workflow can always be seen whole.
 */
export function zoomFloor(bounds: Bounds | null, availableWidth: number, availableHeight: number): number {
  if (!bounds) return MIN_ZOOM;
  const fit = fitZoom(bounds, availableWidth, availableHeight, MAX_ZOOM);
  return Math.max(ABSOLUTE_MIN_ZOOM, Math.min(MIN_ZOOM, fit * FLOOR_MARGIN));
}

/** Lays a workflow out left-to-right: the workflow on the left, each level of cards in the next column. */
function treeLayout(nodes: WorkflowNode[], rootId: string): Positions {
  const positions: Positions = {};
  let nextLeafTop = 0;

  // Returns the vertical center of the placed card so parents can center on their children.
  function place(id: string, depth: number): number {
    const height = depth === 0 ? ROOT_NODE_HEIGHT : NODE_HEIGHT;
    const children = nodes.filter((node) => node.parentId === id);
    let centerY: number;
    if (children.length === 0) {
      centerY = nextLeafTop + height / 2;
      nextLeafTop += height + ROW_GAP;
    } else {
      const centers = children.map((child) => place(child.id, depth + 1));
      centerY = (centers[0] + centers[centers.length - 1]) / 2;
    }
    positions[id] = { x: depth * (NODE_WIDTH + COLUMN_GAP), y: centerY - height / 2 };
    return centerY;
  }

  place(rootId, 0);
  return positions;
}

// A columns overview: room between columns for two lanes' padding and an indented card, and below the workflow's card
// for its connections to bend into the columns.
const COLUMNS_GAP = 88;
const COLUMNS_DROP = 72;
const LANE_PADDING = 16;

/**
 * A free-form workflow laid out as an overview (its file's `layout: "columns"`): the workflow's card on top, centred; its
 * cards side by side below it, one column each; and everything inside each of those stacked under it in order, deeper
 * levels slightly indented, as under a step.
 */
export function columnsLayout(nodes: Pick<WorkflowNode, "id" | "parentId">[], rootId: string): Positions {
  const positions: Positions = {};
  const groups = nodes.filter((node) => node.parentId === rootId);
  const top = ROOT_NODE_HEIGHT + COLUMNS_DROP;
  groups.forEach((group, column) => {
    const x = column * (NODE_WIDTH + COLUMNS_GAP);
    positions[group.id] = { x, y: top };
    let y = top + NODE_HEIGHT + STACK_GAP;
    const stack = (parentId: string, level: number) => {
      for (const child of nodes) {
        if (child.parentId !== parentId) continue;
        positions[child.id] = { x: x + Math.min(level, MAX_STACK_INDENT_LEVELS) * STACK_INDENT, y };
        y += NODE_HEIGHT + STACK_GAP;
        stack(child.id, level + 1);
      }
    };
    stack(group.id, 0);
  });
  const width = Math.max(NODE_WIDTH, groups.length * NODE_WIDTH + (groups.length - 1) * COLUMNS_GAP);
  positions[rootId] = { x: (width - NODE_WIDTH) / 2, y: 0 };
  return positions;
}

/** The shaded column behind a group of cards in an overview: around all of them, with some room. Null for none. */
export function laneAround(cards: { x: number; y: number; width: number; height: number }[]): Bounds | null {
  if (cards.length === 0) return null;
  return {
    minX: Math.min(...cards.map((card) => card.x)) - LANE_PADDING,
    minY: Math.min(...cards.map((card) => card.y)) - LANE_PADDING,
    maxX: Math.max(...cards.map((card) => card.x + card.width)) + LANE_PADDING,
    maxY: Math.max(...cards.map((card) => card.y + card.height)) + LANE_PADDING,
  };
}

/**
 * Step-by-step workflows. Line: the workflow, then each step in order, left to right. Rows: the same order wrapped into
 * rows read like lines of text, so a long procedure stays compact. Either way, the cards nested under a step stack
 * below it in order (deeper levels slightly indented), and a row leaves room for its tallest stack.
 */
export function stepLayout(
  nodes: Pick<WorkflowNode, "id" | "parentId">[],
  rootId: string,
  stepIds: string[],
  layout: FlowLayout = "line",
): Positions {
  const positions: Positions = {};
  const stepSet = new Set(stepIds);
  const stackOf = (stepId: string) => {
    const stack: { id: string; level: number }[] = [];
    const visit = (parentId: string, level: number) => {
      for (const child of nodes) {
        if (child.parentId !== parentId || stepSet.has(child.id)) continue;
        stack.push({ id: child.id, level });
        visit(child.id, level + 1);
      }
    };
    visit(stepId, 0);
    return stack;
  };

  const items = [rootId, ...stepIds];
  const stacks = new Map(stepIds.map((id) => [id, stackOf(id)]));
  const hasStacks = stepIds.some((id) => stacks.get(id)!.length > 0);
  const perRow = layout === "line" ? items.length : hasStacks ? ROWS_PER_ROW_STACKED : ROWS_PER_ROW_PLAIN;
  const columnGap = layout === "line" ? COLUMN_GAP : ROWS_COLUMN_GAP;

  let rowTop = 0;
  for (let start = 0; start < items.length; start += perRow) {
    const row = items.slice(start, start + perRow);
    const lineHeight = start === 0 ? ROOT_NODE_HEIGHT : NODE_HEIGHT;
    let rowBottom = rowTop + lineHeight;
    row.forEach((id, column) => {
      const height = id === rootId ? ROOT_NODE_HEIGHT : NODE_HEIGHT;
      const x = column * (NODE_WIDTH + columnGap);
      const y = rowTop + (lineHeight - height) / 2;
      positions[id] = { x, y };
      let top = y + height + STACK_GAP;
      for (const entry of stacks.get(id) ?? []) {
        positions[entry.id] = { x: x + Math.min(entry.level, MAX_STACK_INDENT_LEVELS) * STACK_INDENT, y: top };
        top += NODE_HEIGHT + STACK_GAP;
      }
      rowBottom = Math.max(rowBottom, top - STACK_GAP);
    });
    rowTop = rowBottom + ROWS_ROW_GAP;
  }
  return positions;
}

/**
 * Positions for every card in a workflow. Saved positions win; if nothing was ever placed, use the tree layout
 * (or the step line for step-by-step workflows); otherwise each unplaced card goes one column right of its
 * parent, below that parent's already-placed children — and a new step goes after the last step.
 */
export function resolvePositions(
  nodes: WorkflowNode[],
  rootId: string,
  known: Positions,
  stepIds: string[] = [],
  layout: FlowLayout = "line",
): Positions {
  const positions: Positions = { ...known };
  for (const node of nodes) {
    if (!positions[node.id] && node.position) positions[node.id] = node.position;
  }

  const unplaced = nodes.filter((node) => !positions[node.id]);
  if (unplaced.length === 0) return positions;
  if (unplaced.length === nodes.length)
    return stepIds.length > 0 ? stepLayout(nodes, rootId, stepIds, layout) : treeLayout(nodes, rootId);

  // A workflow card with no place of its own (a plan arranged in the workspace, which never writes one) goes where the
  // tree layout puts it: a column left of its placed cards, midway between the highest and the lowest. A step-by-step
  // workflow's card keeps its slot at the start of the line (0, 0), below.
  const rootCards = nodes.filter((node) => node.parentId === rootId && positions[node.id]).map((node) => positions[node.id]);
  if (!positions[rootId] && stepIds.length === 0 && rootCards.length > 0) {
    const ys = rootCards.map((point) => point.y);
    const middle = (Math.min(...ys) + Math.max(...ys)) / 2 + NODE_HEIGHT / 2;
    positions[rootId] = {
      x: Math.min(...rootCards.map((point) => point.x)) - NODE_WIDTH - COLUMN_GAP,
      y: middle - ROOT_NODE_HEIGHT / 2,
    };
  }

  // In rows, a step added later takes its slot in the rows. In a line, it lines up after the step before it.
  const slots = layout === "rows" ? stepLayout(nodes, rootId, stepIds, "rows") : null;
  for (const id of stepIds) {
    if (!positions[id] && slots?.[id]) positions[id] = slots[id];
    if (positions[id]) continue;
    const index = stepIds.indexOf(id);
    const before = index === 0 ? positions[rootId] : positions[stepIds[index - 1]];
    if (before) {
      positions[id] = {
        x: before.x + NODE_WIDTH + COLUMN_GAP,
        y: index === 0 ? before.y + (ROOT_NODE_HEIGHT - NODE_HEIGHT) / 2 : before.y,
      };
    }
  }

  // Parents before children, so a new card under a new card still finds its parent's position.
  const depthOf = (node: WorkflowNode): number => {
    let depth = 0;
    let parent = node.parentId;
    while (parent) {
      depth += 1;
      parent = nodes.find((candidate) => candidate.id === parent)?.parentId ?? null;
    }
    return depth;
  };

  for (const node of [...unplaced].sort((a, b) => depthOf(a) - depthOf(b))) {
    // Steps were placed above.
    if (positions[node.id]) continue;
    const parentPosition = node.parentId ? positions[node.parentId] : undefined;
    if (!parentPosition) {
      positions[node.id] = { x: 0, y: 0 };
      continue;
    }
    const x = parentPosition.x + NODE_WIDTH + COLUMN_GAP;
    const siblingBottoms = nodes
      .filter((sibling) => sibling.parentId === node.parentId && sibling.id !== node.id && positions[sibling.id])
      .map((sibling) => positions[sibling.id].y + NODE_HEIGHT);
    let y = siblingBottoms.length > 0 ? Math.max(...siblingBottoms) + ROW_GAP : parentPosition.y;
    // Another branch's cards may already fill that column; move down a row at a time until the spot is free.
    const taken = (top: number) =>
      Object.entries(positions).some(
        ([id, other]) =>
          id !== node.id &&
          Math.abs(other.x - x) < NODE_WIDTH &&
          top < other.y + NODE_HEIGHT + ROW_GAP &&
          other.y < top + NODE_HEIGHT + ROW_GAP,
      );
    while (taken(y)) y += NODE_HEIGHT + ROW_GAP;
    positions[node.id] = { x, y };
  }
  return positions;
}

/**
 * Re-arranges nodes into columns by distance along connections from where the chart starts: the workflow's own card,
 * or in a Flowchart (which doesn't draw it) its Start cards, or else the cards nothing connects into. Cards it can't
 * reach go in the second column.
 */
export function autoLayout(nodes: FlowNode[], edges: FlowEdge[]): Positions {
  const root = nodes.find((node) => node.isRoot);
  const connectedInto = new Set(edges.map((edge) => edge.target));
  const starts = root
    ? [root]
    : nodes.some((node) => node.shape === "start")
      ? nodes.filter((node) => node.shape === "start")
      : nodes.filter((node) => !connectedInto.has(node.id));
  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const start of starts.length > 0 ? starts : nodes.slice(0, 1)) {
    depth.set(start.id, 0);
    queue.push(start.id);
  }
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.source === current && !depth.has(edge.target)) {
        depth.set(edge.target, depth.get(current)! + 1);
        queue.push(edge.target);
      }
    }
  }

  const columns = new Map<number, FlowNode[]>();
  for (const node of nodes) {
    const column = depth.get(node.id) ?? 1;
    columns.set(column, [...(columns.get(column) ?? []), node]);
  }

  const columnHeight = (column: FlowNode[]) =>
    column.reduce((sum, node) => sum + nodeHeight(node), 0) + ROW_GAP * (column.length - 1);
  const tallest = Math.max(...[...columns.values()].map(columnHeight));

  const positions: Positions = {};
  for (const [column, columnNodes] of columns) {
    let top = (tallest - columnHeight(columnNodes)) / 2;
    for (const node of columnNodes) {
      positions[node.id] = { x: column * (NODE_WIDTH + COLUMN_GAP), y: top };
      top += nodeHeight(node) + ROW_GAP;
    }
  }
  return positions;
}

/**
 * Flowchart workflows, top to bottom. Each card sits a row below every card that leads into it — a loop back up the
 * chart doesn't count — so the chart always reads downward. The first way on from a card carries straight on in its
 * column; each other way (a Decision's second branch) starts a new column to the right. Cards nothing reaches get
 * columns of their own. Rows are as tall as their tallest card, with shorter cards centred in them.
 */
export function flowchartLayout(nodes: FlowNode[], edges: FlowEdge[]): Positions {
  const ids = new Set(nodes.map((node) => node.id));
  const outgoing = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
  const connected = new Set<string>();
  for (const edge of edges) {
    if (edge.source === edge.target || !ids.has(edge.source) || !ids.has(edge.target)) continue;
    const targets = outgoing.get(edge.source)!;
    if (!targets.includes(edge.target)) targets.push(edge.target);
    connected.add(edge.source).add(edge.target);
  }
  const hasIncoming = new Set([...outgoing.values()].flat());
  // Where to begin: Start cards, then cards that lead somewhere but nothing leads into, then everything else.
  const roots = [
    ...nodes.filter((node) => node.shape === "start"),
    ...nodes.filter((node) => !hasIncoming.has(node.id) && connected.has(node.id)),
    ...nodes,
  ].map((node) => node.id);

  // Loops: a connection into a card that's still being walked leads back up the chart.
  const loops = new Set<string>();
  const walked = new Map<string, "open" | "done">();
  const walk = (id: string) => {
    walked.set(id, "open");
    for (const next of outgoing.get(id)!) {
      if (walked.get(next) === "open") loops.add(`${id}\n${next}`);
      else if (!walked.has(next)) walk(next);
    }
    walked.set(id, "done");
  };
  for (const id of roots) if (!walked.has(id)) walk(id);
  const forward = (id: string) => outgoing.get(id)!.filter((next) => !loops.has(`${id}\n${next}`));

  // Rows: the longest way down to each card, so a card always sits below everything that leads into it.
  const row = new Map(nodes.map((node) => [node.id, 0]));
  const waiting = new Map(nodes.map((node) => [node.id, 0]));
  for (const node of nodes) for (const next of forward(node.id)) waiting.set(next, waiting.get(next)! + 1);
  const queue = nodes.filter((node) => waiting.get(node.id) === 0).map((node) => node.id);
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head];
    for (const next of forward(id)) {
      row.set(next, Math.max(row.get(next)!, row.get(id)! + 1));
      waiting.set(next, waiting.get(next)! - 1);
      if (waiting.get(next) === 0) queue.push(next);
    }
  }

  // Columns: a column is one chain of cards, each carried on from the one above it, so its rows never collide.
  const column = new Map<string, number>();
  let columns = 0;
  const place = (id: string, index: number) => {
    column.set(id, index);
    let carried = false;
    for (const next of forward(id)) {
      if (column.has(next)) continue;
      place(next, carried ? columns++ : index);
      carried = true;
    }
  };
  for (const id of roots) if (!column.has(id)) place(id, columns++);

  const rowHeights: number[] = [];
  for (const node of nodes) {
    const index = row.get(node.id)!;
    rowHeights[index] = Math.max(rowHeights[index] ?? 0, nodeHeight(node));
  }
  const rowTops: number[] = [];
  let top = 0;
  for (let index = 0; index < rowHeights.length; index++) {
    rowTops[index] = top;
    top += (rowHeights[index] ?? 0) + FLOW_ROW_GAP;
  }

  const positions: Positions = {};
  for (const node of nodes) {
    const index = row.get(node.id)!;
    positions[node.id] = {
      x: column.get(node.id)! * (NODE_WIDTH + FLOW_COLUMN_GAP),
      y: rowTops[index] + (rowHeights[index] - nodeHeight(node)) / 2,
    };
  }
  return positions;
}

/** A number rounded to hundredths, so outlines stay short strings. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The point `distance` along the edge from `from` toward `to`, never past the edge's middle, as "x y". */
function alongEdge(from: [number, number], to: [number, number], distance: number): string {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy);
  const step = Math.min(distance, length / 2);
  return `${round(from[0] + (dx / length) * step)} ${round(from[1] + (dy / length) * step)}`;
}

/** A closed polygon with its corners rounded by up to `radius`, as an SVG path. */
function roundedPolygon(points: [number, number][], radius: number): string {
  const parts = points.map((point, index) => {
    const previous = points[(index + points.length - 1) % points.length];
    const next = points[(index + 1) % points.length];
    const corner = `${round(point[0])} ${round(point[1])}`;
    return `${index === 0 ? "M" : "L"} ${alongEdge(point, previous, radius)} Q ${corner} ${alongEdge(point, next, radius)}`;
  });
  return `${parts.join(" ")} Z`;
}

/**
 * A card's outline for its flowchart symbol, in a width × height box, inset so its stroke isn't clipped. Every
 * proportion follows the box's height, so the same outlines draw a full card and a small picker icon. Each symbol's
 * top middle sits on the top edge of the box, where arrows arrive. Not a worklet: drawn once per render.
 */
export function shapeOutline(shape: FlowNodeType, width: number, height: number, inset: number): string {
  const x = inset;
  const y = inset;
  const w = width - inset * 2;
  const h = height - inset * 2;
  const corner = Math.min(PROCESS_RADIUS, h * 0.14);
  const soft = h * 0.09;
  const top = y;
  const bottom = y + h;
  const middle = y + h / 2;
  const left = x;
  const right = x + w;
  switch (shape) {
    case "decision":
      return `M ${width / 2} ${y} L ${x + w} ${height / 2} L ${width / 2} ${y + h} L ${x} ${height / 2} Z`;
    case "input-output": {
      const skew = h * 0.26;
      return roundedPolygon(
        [
          [left + skew, top],
          [right, top],
          [right - skew, bottom],
          [left, bottom],
        ],
        soft,
      );
    }
    case "manual-operation": {
      const taper = h * 0.24;
      return roundedPolygon(
        [
          [left, top],
          [right, top],
          [right - taper, bottom],
          [left + taper, bottom],
        ],
        soft,
      );
    }
    case "preparation": {
      const point = h * 0.3;
      return roundedPolygon(
        [
          [left + point, top],
          [right - point, top],
          [right, middle],
          [right - point, bottom],
          [left + point, bottom],
          [left, middle],
        ],
        soft,
      );
    }
    case "document": {
      // The bottom is one wave: up in the right half, down to the edge of the box in the left half.
      const wave = h * 0.085;
      return (
        `M ${round(left + corner)} ${top} H ${round(right - corner)} Q ${right} ${top} ${right} ${round(top + corner)} ` +
        `V ${round(bottom - wave)} Q ${round(left + w * 0.75)} ${round(bottom - 3 * wave)} ${round(left + w / 2)} ${round(bottom - wave)} ` +
        `Q ${round(left + w * 0.25)} ${round(bottom + wave)} ${left} ${round(bottom - wave)} ` +
        `V ${round(top + corner)} Q ${left} ${top} ${round(left + corner)} ${top} Z`
      );
    }
    case "subprocess": {
      // A process with a bar down each side: a process defined elsewhere.
      const bar = h * 0.16;
      return (
        `${shapeOutline("process", width, height, inset)} ` +
        `M ${round(left + bar)} ${top} V ${bottom} M ${round(right - bar)} ${top} V ${bottom}`
      );
    }
    case "delay": {
      const radius = round(h / 2);
      return (
        `M ${round(left + soft)} ${top} H ${round(right - h / 2)} A ${radius} ${radius} 0 0 1 ${round(right - h / 2)} ${bottom} ` +
        `H ${round(left + soft)} Q ${left} ${bottom} ${left} ${round(bottom - soft)} V ${round(top + soft)} Q ${left} ${top} ${round(left + soft)} ${top} Z`
      );
    }
    case "display": {
      const radius = round(h / 2);
      const point = h * 0.3;
      return (
        `M ${left} ${round(middle)} L ${round(left + point)} ${top} H ${round(right - h / 2)} ` +
        `A ${radius} ${radius} 0 0 1 ${round(right - h / 2)} ${bottom} H ${round(left + point)} Z`
      );
    }
    case "database": {
      // A cylinder: the outline, then the front edge of its top as a line of its own.
      const cap = round(h * 0.12);
      const radius = round(w / 2);
      return (
        `M ${left} ${round(top + cap)} A ${radius} ${cap} 0 0 1 ${right} ${round(top + cap)} V ${round(bottom - cap)} ` +
        `A ${radius} ${cap} 0 0 1 ${left} ${round(bottom - cap)} Z ` +
        `M ${left} ${round(top + cap)} A ${radius} ${cap} 0 0 0 ${right} ${round(top + cap)}`
      );
    }
    default: {
      // Process is a rounded rectangle; Start and End are ovals.
      const r = shape === "process" ? corner : h / 2;
      return (
        `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} ` +
        `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} ` +
        `A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
      );
    }
  }
}

/**
 * Where a card's state badge sits (its centre, in the card's own coordinates): on the shape's top-right edge, clear of
 * the top middle, where a Flowchart's connections arrive. A rectangle's on its corner; a Decision's halfway along its
 * upper-right side; a shape with a round right end (Start, End, Delay, Display) on that curve, 45° up.
 */
export function stateBadgePoint(shape: FlowNodeType | null, width: number, height: number): Point {
  const round45 = 1 - Math.SQRT1_2;
  switch (shape) {
    case "decision":
      return { x: width * 0.75, y: height * 0.25 };
    case "start":
    case "end":
    case "delay":
    case "display":
      return { x: width - (height / 2) * round45, y: (height / 2) * round45 };
    case "preparation":
      return { x: width - height * 0.3, y: 0 };
    case "database":
      return { x: width, y: height * 0.12 };
    default:
      return { x: width - 2, y: 2 };
  }
}

// Worklets become constants when compiled, so a worklet must be defined above any worklet that calls it.

/** Curved connection from a node's right handle to another node's left handle (same shape as React Flow's bezier edge). */
export function edgePath(from: Point, to: Point): string {
  "worklet";
  const curve = Math.max(Math.abs(to.x - from.x) / 2, 40);
  return `M ${from.x} ${from.y} C ${from.x + curve} ${from.y}, ${to.x - curve} ${to.y}, ${to.x} ${to.y}`;
}

/** The same curve running downward, from a card's bottom edge: the connection being dragged out in a Flowchart. */
export function verticalEdgePath(from: Point, to: Point): string {
  "worklet";
  const curve = Math.max(Math.abs(to.y - from.y) / 2, 40);
  return `M ${from.x} ${from.y} C ${from.x} ${from.y + curve}, ${to.x} ${to.y - curve}, ${to.x} ${to.y}`;
}

/**
 * How a connection is routed. 0: the target is to the right, so a curve from the source's right side to the target's
 * left side. 1: the target is stacked in the same column, so a rail down the column's left side. 2: the target is back
 * to the left (e.g. the start of the next row), so a path through the channel above the target.
 */
export function edgeRouteKind(source: Point, target: Point): 0 | 1 | 2 {
  "worklet";
  if (target.x >= source.x + NODE_WIDTH + 24) return 0;
  return target.x < source.x + NODE_WIDTH && target.x + NODE_WIDTH > source.x ? 1 : 2;
}

/** A path through world-space points with rounded corners, drawn in screen space. */
function polylinePath(xs: number[], ys: number[], tx: number, ty: number, zoom: number): string {
  "worklet";
  let d = `M ${tx + xs[0] * zoom} ${ty + ys[0] * zoom}`;
  for (let index = 1; index < xs.length - 1; index += 1) {
    const inLength = Math.hypot(xs[index] - xs[index - 1], ys[index] - ys[index - 1]);
    const outLength = Math.hypot(xs[index + 1] - xs[index], ys[index + 1] - ys[index]);
    const radius = Math.min(CORNER_RADIUS, inLength / 2, outLength / 2);
    if (radius < 0.5) {
      d += ` L ${tx + xs[index] * zoom} ${ty + ys[index] * zoom}`;
      continue;
    }
    const beforeX = xs[index] - ((xs[index] - xs[index - 1]) / inLength) * radius;
    const beforeY = ys[index] - ((ys[index] - ys[index - 1]) / inLength) * radius;
    const afterX = xs[index] + ((xs[index + 1] - xs[index]) / outLength) * radius;
    const afterY = ys[index] + ((ys[index + 1] - ys[index]) / outLength) * radius;
    d += ` L ${tx + beforeX * zoom} ${ty + beforeY * zoom}`;
    d += ` Q ${tx + xs[index] * zoom} ${ty + ys[index] * zoom} ${tx + afterX * zoom} ${ty + afterY * zoom}`;
  }
  const last = xs.length - 1;
  return `${d} L ${tx + xs[last] * zoom} ${ty + ys[last] * zoom}`;
}

/**
 * A connection between two cards, routed by where they sit (see edgeRouteKind) and drawn in screen space. endInset
 * (world units) stops the line short of the target's left side, leaving room for an arrowhead.
 */
export function routeEdgePath(
  source: Point,
  sourceHeight: number,
  target: Point,
  targetHeight: number,
  endInset: number,
  tx: number,
  ty: number,
  zoom: number,
): string {
  "worklet";
  const startX = source.x + NODE_WIDTH;
  const startY = source.y + sourceHeight / 2;
  const endX = target.x - endInset;
  const endY = target.y + targetHeight / 2;
  const kind = edgeRouteKind(source, target);
  if (kind === 0) {
    return edgePath({ x: tx + startX * zoom, y: ty + startY * zoom }, { x: tx + endX * zoom, y: ty + endY * zoom });
  }
  if (kind === 1) {
    const railX = Math.min(source.x, target.x) - RAIL_GAP;
    const railY = startY + RAIL_START_OFFSET;
    return polylinePath([source.x, railX, railX, endX], [railY, railY, endY, endY], tx, ty, zoom);
  }
  const exitX = startX + RAIL_GAP;
  const entryX = target.x - ENTRY_GAP;
  const channelY = target.y - CHANNEL_GAP;
  return polylinePath(
    [startX, exitX, exitX, entryX, entryX, endX],
    [startY, startY, channelY, channelY, endY, endY],
    tx,
    ty,
    zoom,
  );
}

/** The middle of a routed connection in world space, where a label chip sits. */
export function edgeMidpoint(source: Point, sourceHeight: number, target: Point, targetHeight: number): Point {
  "worklet";
  const startY = source.y + sourceHeight / 2;
  const endY = target.y + targetHeight / 2;
  const kind = edgeRouteKind(source, target);
  if (kind === 0) return { x: (source.x + NODE_WIDTH + target.x) / 2, y: (startY + endY) / 2 };
  if (kind === 1) return { x: Math.min(source.x, target.x) - RAIL_GAP, y: (startY + RAIL_START_OFFSET + endY) / 2 };
  return { x: (source.x + NODE_WIDTH + RAIL_GAP + target.x - ENTRY_GAP) / 2, y: target.y - CHANNEL_GAP };
}

/** A card's box on the chart, in world space. */
export type Box = { x: number; y: number; width: number; height: number };
/** An overview link's route (columnsRoute): its corners in world space, and which way it arrives (1 rightward, -1 left). */
export type ColumnsRoute = { xs: number[]; ys: number[]; dir: 1 | -1 };

/** The room an overview link keeps from a card it passes. */
const ROUTE_CLEARANCE = 6;

/** Drops repeated corners and corners on a straight run, so every corner left is a real turn. */
function squareCorners(xs: number[], ys: number[]): { xs: number[]; ys: number[] } {
  const keptX: number[] = [];
  const keptY: number[] = [];
  for (let index = 0; index < xs.length; index += 1) {
    const last = keptX.length - 1;
    if (last >= 0 && keptX[last] === xs[index] && keptY[last] === ys[index]) continue;
    if (last >= 1) {
      const straight =
        (keptX[last - 1] === keptX[last] && keptX[last] === xs[index]) ||
        (keptY[last - 1] === keptY[last] && keptY[last] === ys[index]);
      if (straight) {
        keptX[last] = xs[index];
        keptY[last] = ys[index];
        continue;
      }
    }
    keptX.push(xs[index]);
    keptY.push(ys[index]);
  }
  return { xs: keptX, ys: keptY };
}

/**
 * An overview's link between cards in different columns, in world space: out of the source's side facing the target,
 * square turns in the gap between columns, into the target's facing side. One that would cross a card on the way (it
 * skips a column, say Frontend to Services) leaves into the gap past its own column, runs along the free gap between
 * rows nearest to a straight line, and turns into the target from the gap before the target's column; with no free gap
 * it runs above or below every card. `others` is every card but these two. Null when the two overlap sideways (the
 * same column), which routeEdgePath draws.
 */
export function columnsRoute(source: Box, target: Box, others: Box[]): ColumnsRoute | null {
  const dir = target.x >= source.x + source.width ? 1 : target.x + target.width <= source.x ? -1 : 0;
  if (dir === 0) return null;
  const startX = dir === 1 ? source.x + source.width : source.x;
  const endX = dir === 1 ? target.x : target.x + target.width;
  const startY = source.y + source.height / 2;
  const endY = target.y + target.height / 2;
  const crosses = (x1: number, y1: number, x2: number, y2: number) =>
    others.some(
      (card) =>
        Math.max(x1, x2) > card.x - ROUTE_CLEARANCE &&
        Math.min(x1, x2) < card.x + card.width + ROUTE_CLEARANCE &&
        Math.max(y1, y2) > card.y - ROUTE_CLEARANCE &&
        Math.min(y1, y2) < card.y + card.height + ROUTE_CLEARANCE,
    );
  const clear = (xs: number[], ys: number[]) => xs.every((x, i) => i === 0 || !crosses(xs[i - 1], ys[i - 1], x, ys[i]));
  const route = (xs: number[], ys: number[]): ColumnsRoute => ({ ...squareCorners(xs, ys), dir });

  const midX = (startX + endX) / 2;
  const direct = { xs: [startX, midX, midX, endX], ys: [startY, startY, endY, endY] };
  if (clear(direct.xs, direct.ys)) return route(direct.xs, direct.ys);

  // The turns sit in the gaps beside the two columns (an overview's columns are COLUMNS_GAP apart), or both halfway
  // when the cards are closer than that.
  let exitX = startX + (dir * COLUMNS_GAP) / 2;
  let entryX = endX - (dir * COLUMNS_GAP) / 2;
  if (dir * (entryX - exitX) < 0) {
    exitX = midX;
    entryX = midX;
  }
  // Where a run across can go: between the cards it passes, kept clear of them, nearest a straight line first.
  const low = Math.min(exitX, entryX);
  const high = Math.max(exitX, entryX);
  const blocked = others
    .filter((card) => card.x - ROUTE_CLEARANCE < high && card.x + card.width + ROUTE_CLEARANCE > low)
    .map((card) => [card.y - ROUTE_CLEARANCE, card.y + card.height + ROUTE_CLEARANCE])
    .sort((a, b) => a[0] - b[0]);
  const spans: number[][] = [];
  for (const [top, bottom] of blocked) {
    const last = spans[spans.length - 1];
    if (last && top <= last[1]) last[1] = Math.max(last[1], bottom);
    else spans.push([top, bottom]);
  }
  const runs = [startY, endY];
  for (let index = 0; index + 1 < spans.length; index += 1) runs.push((spans[index][1] + spans[index + 1][0]) / 2);
  if (spans.length > 0) runs.push(spans[0][0] - LOOP_GAP, spans[spans.length - 1][1] + LOOP_GAP);
  let best: { xs: number[]; ys: number[]; cost: number } | null = null;
  for (const y of runs) {
    const xs = [startX, exitX, exitX, entryX, entryX, endX];
    const ys = [startY, startY, y, y, endY, endY];
    const cost = Math.abs(y - startY) + Math.abs(y - endY);
    if ((!best || cost < best.cost) && clear(xs, ys)) best = { xs, ys, cost };
  }
  return best ? route(best.xs, best.ys) : route(direct.xs, direct.ys);
}

/** An overview link's route drawn in world space, stopping endInset short of the target for its arrowhead. */
export function columnsRoutePath(route: ColumnsRoute, endInset: number): string {
  const xs = [...route.xs];
  xs[xs.length - 1] -= route.dir * endInset;
  return polylinePath(xs, route.ys, 0, 0, 1);
}

/**
 * A Flowchart connection's route in world space, ending where it touches the target. It runs top to bottom, out of
 * the bottom of one card and into the top of the next; a Decision's branch to the side leaves from the diamond's side
 * point, as flowcharts are drawn. A loop back up the chart leaves the source's right side, runs up a channel right of
 * both cards and comes in from the right — into a Decision on its upper-right edge, clear of a branch leaving its
 * right point. Cards side by side are joined from their facing sides.
 */
export function flowchartRoute(
  source: Point,
  sourceHeight: number,
  sourceIsDecision: boolean,
  target: Point,
  targetHeight: number,
  targetIsDecision: boolean,
): { xs: number[]; ys: number[] } {
  "worklet";
  const sourceCenterX = source.x + NODE_WIDTH / 2;
  const sourceMiddleY = source.y + sourceHeight / 2;
  const sourceBottom = source.y + sourceHeight;
  const targetCenterX = target.x + NODE_WIDTH / 2;
  const targetMiddleY = target.y + targetHeight / 2;

  if (target.y >= sourceBottom + FLOW_MIN_GAP) {
    const across = targetCenterX - sourceCenterX;
    if (Math.abs(across) < 1) return { xs: [sourceCenterX, targetCenterX], ys: [sourceBottom, target.y] };
    if (sourceIsDecision && Math.abs(across) >= NODE_WIDTH / 2) {
      const sideX = across > 0 ? source.x + NODE_WIDTH : source.x;
      return { xs: [sideX, targetCenterX, targetCenterX], ys: [sourceMiddleY, sourceMiddleY, target.y] };
    }
    // New branches open to the right, so a connection heading right turns just below its card and runs down the
    // target's column; one heading left (a branch rejoining) runs down its own column and turns just above the target.
    // Either way the long run is down a column the layout keeps clear.
    const turnY = across > 0 ? sourceBottom + FLOW_JOG : target.y - FLOW_JOG;
    return {
      xs: [sourceCenterX, sourceCenterX, targetCenterX, targetCenterX],
      ys: [sourceBottom, turnY, turnY, target.y],
    };
  }

  if (target.y + targetHeight <= source.y - FLOW_MIN_GAP) {
    const channelX = Math.max(source.x, target.x) + NODE_WIDTH + LOOP_GAP;
    const entryX = targetIsDecision ? target.x + (NODE_WIDTH * 3) / 4 : target.x + NODE_WIDTH;
    const entryY = targetIsDecision ? target.y + targetHeight / 4 : targetMiddleY;
    return {
      xs: [source.x + NODE_WIDTH, channelX, channelX, entryX],
      ys: [sourceMiddleY, sourceMiddleY, entryY, entryY],
    };
  }

  const rightward = targetCenterX >= sourceCenterX;
  const startX = rightward ? source.x + NODE_WIDTH : source.x;
  const endX = rightward ? target.x : target.x + NODE_WIDTH;
  const middleX = (startX + endX) / 2;
  return { xs: [startX, middleX, middleX, endX], ys: [sourceMiddleY, sourceMiddleY, targetMiddleY, targetMiddleY] };
}

/**
 * Where a Flowchart connection's label goes, in world space: the top-left corner of a label labelHeight tall. It sits
 * beside the line right where the line leaves its card, so a Decision's "Yes" and "No" read as answers to it: right of
 * a line heading down, and above a line heading sideways, starting just clear of the card (or, heading left, of the
 * corner where it turns), so the text never runs into the diamond.
 */
export function flowchartLabelPoint(
  source: Point,
  sourceHeight: number,
  sourceIsDecision: boolean,
  target: Point,
  targetHeight: number,
  targetIsDecision: boolean,
  labelHeight: number,
): Point {
  "worklet";
  const route = flowchartRoute(source, sourceHeight, sourceIsDecision, target, targetHeight, targetIsDecision);
  const dx = route.xs[1] - route.xs[0];
  const dy = route.ys[1] - route.ys[0];
  if (Math.abs(dy) >= Math.abs(dx)) {
    return { x: route.xs[0] + LABEL_GAP, y: dy >= 0 ? route.ys[0] + LABEL_GAP : route.ys[0] - LABEL_GAP - labelHeight };
  }
  return { x: (dx > 0 ? route.xs[0] : route.xs[1]) + LABEL_GAP, y: route.ys[0] - LABEL_GAP / 2 - labelHeight };
}

/** A Flowchart connection drawn in screen space, stopping endInset (world units) short of the target for its arrow. */
export function flowchartEdgePath(
  source: Point,
  sourceHeight: number,
  sourceIsDecision: boolean,
  target: Point,
  targetHeight: number,
  targetIsDecision: boolean,
  endInset: number,
  tx: number,
  ty: number,
  zoom: number,
): string {
  "worklet";
  const route = flowchartRoute(source, sourceHeight, sourceIsDecision, target, targetHeight, targetIsDecision);
  const xs = route.xs;
  const ys = route.ys;
  // Begin under the source card, so the line leaves its actual edge: a Document's wave, a Database's rounded base.
  const first = Math.hypot(xs[1] - xs[0], ys[1] - ys[0]);
  if (first > 0) {
    xs[0] -= ((xs[1] - xs[0]) / first) * EDGE_TUCK;
    ys[0] -= ((ys[1] - ys[0]) / first) * EDGE_TUCK;
  }
  const last = xs.length - 1;
  const length = Math.hypot(xs[last] - xs[last - 1], ys[last] - ys[last - 1]);
  if (length > endInset) {
    xs[last] -= ((xs[last] - xs[last - 1]) / length) * endInset;
    ys[last] -= ((ys[last] - ys[last - 1]) / length) * endInset;
  }
  return polylinePath(xs, ys, tx, ty, zoom);
}

/** An arrowhead with its tip at (x, y), pointing along the unit vector (dx, dy). */
export function directedArrowPath(x: number, y: number, size: number, dx: number, dy: number): string {
  "worklet";
  const baseX = x - dx * size;
  const baseY = y - dy * size;
  const spread = size * 0.62;
  return `M ${x} ${y} L ${baseX - dy * spread} ${baseY + dx * spread} L ${baseX + dy * spread} ${baseY - dx * spread} Z`;
}

/** The arrowhead of a Flowchart connection, in screen space, its tip where the connection touches the target. */
export function flowchartArrowPath(
  source: Point,
  sourceHeight: number,
  sourceIsDecision: boolean,
  target: Point,
  targetHeight: number,
  targetIsDecision: boolean,
  size: number,
  tx: number,
  ty: number,
  zoom: number,
): string {
  "worklet";
  const route = flowchartRoute(source, sourceHeight, sourceIsDecision, target, targetHeight, targetIsDecision);
  const last = route.xs.length - 1;
  const dx = route.xs[last] - route.xs[last - 1];
  const dy = route.ys[last] - route.ys[last - 1];
  const length = Math.hypot(dx, dy) || 1;
  return directedArrowPath(tx + route.xs[last] * zoom, ty + route.ys[last] * zoom, size, dx / length, dy / length);
}

/** A small arrowhead pointing right, its tip at (x, y). Step connectors always arrive at a card's left side. */
export function arrowPath(x: number, y: number, size: number): string {
  "worklet";
  return `M ${x} ${y} L ${x - size} ${y - size * 0.62} L ${x - size} ${y + size * 0.62} Z`;
}

/** A zoom level kept between `min` (MIN_ZOOM, unless a big chart lowers it: see zoomFloor) and MAX_ZOOM. */
export function clampZoom(value: number, min?: number): number {
  "worklet";
  // Not a default parameter: in a worklet, a default is evaluated before the constants it captured are unpacked, so
  // `min = MIN_ZOOM` read an undefined MIN_ZOOM on the UI thread and pinching crashed the app.
  const floor = min === undefined ? MIN_ZOOM : min;
  return Math.min(MAX_ZOOM, Math.max(floor, value));
}
