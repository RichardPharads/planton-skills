// Measures how a .planton.json file's flowchart will look in the Planton app, sketches it, and lists structure problems.
// Usage: node analyze.mts <file.planton.json> [--layout rows|line]
// --layout previews a step-by-step workflow in a layout other than the one the file would get.
import { readFileSync } from "node:fs";

import { chartBounds, flowchartLayout, nodeHeight, resolvePositions, type FlowEdge, type FlowNode } from "./graph.ts";
import { parseWorkflowFile } from "./workflow-file.ts";
import { addWorkflowTemplate } from "./workflow-templates.ts";
import {
  getChildren,
  getDescendants,
  getFlowLayout,
  type FlowLayout,
  type WorkflowData,
  type WorkflowNode,
} from "./workflows.ts";

// Roughly what a phone shows of the flowchart at the zoom it opens with.
const SCREEN_WIDTH = 430;
const SCREEN_HEIGHT = 700;
const LABEL_LENGTH = 22;
const MAX_SKETCH_LINES = 40;
// Longer titles don't fit in a Flowchart workflow's boxes.
const BOX_TITLE_LENGTH = 40;

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("--"));
const layoutIndex = args.indexOf("--layout");
const layoutOverride = layoutIndex === -1 ? null : (args[layoutIndex + 1] as FlowLayout);
if (!file || (layoutOverride && layoutOverride !== "rows" && layoutOverride !== "line")) {
  console.error("Usage: node analyze.mts <file.planton.json> [--layout rows|line]");
  process.exit(2);
}

const result = parseWorkflowFile(readFileSync(file, "utf8"), { idPrefix: "w", now: Date.now() });
if (!result.ok) {
  console.error(`Invalid: ${result.error}`);
  process.exit(1);
}

const data: WorkflowData = addWorkflowTemplate({ nodes: {}, edges: [] }, result.template);
const rootId = result.template.rootId;
const root = data.nodes[rootId];
const cards = getDescendants(data, rootId);
const nodes = [root, ...cards];
const isSteps = root.mode === "steps";
const isFlowchart = root.mode === "flowchart";
const stepIds = isSteps ? getChildren(data, rootId).map((node) => node.id) : [];
const chosenLayout = getFlowLayout(data, rootId);
const layout = isSteps ? (layoutOverride ?? chosenLayout ?? "line") : "line";

// What the app draws. A Flowchart workflow leaves out the workflow's own card, runs top to bottom along its links, and
// its cards' symbols set their heights; the other types hang from the workflow's card.
const shapeOf = (node: WorkflowNode) => node.nodeType ?? "process";
const chartNodes = (isFlowchart ? cards : nodes).map(
  (node) => ({ id: node.id, isRoot: node.id === rootId, shape: isFlowchart ? shapeOf(node) : null }) as FlowNode,
);
const flowEdges: FlowEdge[] = isFlowchart
  ? data.edges.filter((edge) => edge.source !== rootId && edge.target !== rootId).map((edge) => ({ ...edge, kind: "flow" }))
  : [];
const positions = isFlowchart ? flowchartLayout(chartNodes, flowEdges) : resolvePositions(nodes, rootId, {}, stepIds, layout);

const shorten = (text: string) => (text.length > LABEL_LENGTH ? `${text.slice(0, LABEL_LENGTH - 1)}…` : text);
const heights = new Map(chartNodes.map((node) => [node.id, nodeHeight(node)]));
const heightOf = (id: string) => heights.get(id)!;
const bounds = chartBounds(chartNodes, positions);
const width = bounds ? bounds.maxX - bounds.minX : 0;
const height = bounds ? bounds.maxY - bounds.minY : 0;
const depthOf = (node: WorkflowNode) => {
  let depth = 0;
  let parent = node.parentId;
  while (parent) {
    depth += 1;
    parent = data.nodes[parent]?.parentId ?? null;
  }
  return depth;
};
const maxDepth = Math.max(...nodes.map(depthOf));
// Only the file's own links: in a Flowchart they're the whole flow; elsewhere connections to parents and chains inside
// steps are drawn automatically.
const raw = JSON.parse(
  readFileSync(file, "utf8")
    .replace(/^[^{]*/, "")
    .replace(/[^}]*$/, ""),
);
const links = Array.isArray(raw.workflow?.links) ? raw.workflow.links.length : 0;

const modeLabel = { steps: "Step-by-step", freeform: "Free-form", scheduled: "Scheduled", flowchart: "Flowchart" }[root.mode];
const counts = isFlowchart ? `${cards.length} cards` : `${getChildren(data, rootId).length} top-level · ${cards.length} cards`;
console.log(`"${root.title}" · ${modeLabel} · ${counts}`);
if (isSteps) {
  const how = layoutOverride ? "preview" : root.layout ? "set in file" : "automatic";
  console.log(`Layout: ${layout} (${how})`);
} else {
  console.log(`Layout: ${isFlowchart ? "top to bottom" : "tree"}`);
}
const structure = isFlowchart ? `${links} links` : `depth ${maxDepth} · ${links} extra links`;
console.log(
  `Flowchart: ${Math.round(width)} × ${Math.round(height)} ≈ ${(width / SCREEN_WIDTH).toFixed(1)} × ${(height / SCREEN_HEIGHT).toFixed(1)} phone screens · ${structure}`,
);

// Sketch
const lines: string[] = [];
const branches: string[] = [];
// A Flowchart card as the sketch draws it: (Start) and (End), <Decision?>, [Process], and [Title]:shape for the rest.
const mark = (node: WorkflowNode) => {
  const shape = shapeOf(node);
  const title = shorten(node.title);
  if (shape === "start" || shape === "end") return `(${title})`;
  if (shape === "decision") return `<${title}>`;
  return shape === "process" ? `[${title}]` : `[${title}]:${shape}`;
};
const centerOf = (id: string) => Math.round(positions[id].y + heightOf(id) / 2);
if (isSteps) {
  const rowTops = [...new Set([rootId, ...stepIds].map(centerOf))].sort((a, b) => a - b);
  rowTops.forEach((center, rowIndex) => {
    const row = [rootId, ...stepIds]
      .filter((id) => centerOf(id) === center)
      .sort((a, b) => positions[a].x - positions[b].x)
      .map((id) => {
        if (id === rootId) return `[${shorten(root.title)}]`;
        const stack = getDescendants(data, id).length;
        return `${stepIds.indexOf(id) + 1} ${shorten(data.nodes[id].title)}${stack > 0 ? ` (+${stack})` : ""}`;
      });
    lines.push(`${rowIndex === 0 ? "" : "↳ "}${row.join(" → ")}`);
  });
} else if (isFlowchart) {
  // Row by row, top to bottom, each card in its column.
  const columnXs = [...new Set(cards.map((node) => positions[node.id].x))].sort((a, b) => a - b);
  const columnOf = (node: WorkflowNode) => columnXs.indexOf(positions[node.id].x);
  const columnWidths = columnXs.map((_, column) =>
    Math.max(...cards.filter((node) => columnOf(node) === column).map((node) => mark(node).length)),
  );
  const rowCenters = [...new Set(cards.map((node) => centerOf(node.id)))].sort((a, b) => a - b);
  rowCenters.forEach((center, rowIndex) => {
    const row = columnXs.map((_, column) =>
      cards
        .filter((node) => centerOf(node.id) === center && columnOf(node) === column)
        .map(mark)
        .join(" ")
        .padEnd(columnWidths[column]),
    );
    lines.push(`${rowIndex === 0 ? "  " : "↓ "}${row.join("  ").trimEnd()}`);
  });
  // Where the flow splits, loops back up, or carries a label, which the rows don't show.
  for (const node of cards) {
    const out = flowEdges.filter((edge) => edge.source === node.id);
    for (const edge of out) {
      const loop = centerOf(edge.target) <= centerOf(edge.source);
      if (out.length < 2 && !loop && !edge.label) continue;
      const arrow = edge.label ? `—${edge.label}→` : "→";
      branches.push(`${mark(node)} ${arrow} ${mark(data.nodes[edge.target])}${loop ? " (loops back up)" : ""}`);
    }
  }
} else {
  const visit = (id: string, depth: number) => {
    for (const child of getChildren(data, id)) {
      const time = child.schedule ? (child.schedule.kind === "repeat" ? ` @ ${child.schedule.time}` : " @ once") : "";
      lines.push(`${"  ".repeat(depth)}• ${shorten(child.title)}${time}`);
      visit(child.id, depth + 1);
    }
  };
  lines.push(`[${shorten(root.title)}]`);
  visit(rootId, 1);
}
console.log("Sketch:");
for (const line of lines.slice(0, MAX_SKETCH_LINES)) console.log(`  ${line}`);
if (lines.length > MAX_SKETCH_LINES) console.log(`  … ${lines.length - MAX_SKETCH_LINES} more lines`);
if (branches.length > 0) {
  console.log("Branches and loops:");
  for (const line of branches.slice(0, MAX_SKETCH_LINES)) console.log(`  ${line}`);
  if (branches.length > MAX_SKETCH_LINES) console.log(`  … ${branches.length - MAX_SKETCH_LINES} more`);
}

// Findings
const findings: string[] = [];
const topLevel = getChildren(data, rootId);
const flatSteps = isSteps && stepIds.every((id) => getChildren(data, id).length === 0);
const ways = (count: number) => (count === 1 ? "1 way" : `${count} ways`);

if (isFlowchart) {
  const starts = cards.filter((node) => shapeOf(node) === "start");
  const outOf = (id: string) => flowEdges.filter((edge) => edge.source === id);
  const leadInto = new Set(flowEdges.map((edge) => edge.target));
  // Everything the flow reaches from its Start card (a Set visits what's added while it's being walked).
  const reached = new Set(starts.map((node) => node.id));
  for (const id of reached) for (const edge of outOf(id)) reached.add(edge.target);

  if (starts.length === 0) findings.push('No "start" card: begin the flowchart with one.');
  if (starts.length > 1) findings.push(`${starts.length} "start" cards: begin the flowchart in one place.`);
  if (!cards.some((node) => shapeOf(node) === "end")) findings.push('No "end" card: finish the flowchart with one.');
  if (cards.length > 15) {
    findings.push(
      `${cards.length} cards: keep a flowchart to 5–15, or move a part into a flowchart of its own and show it here as a "subprocess" card.`,
    );
  }
  for (const node of cards) {
    const shape = shapeOf(node);
    const out = outOf(node.id);
    if (out.length === 0 && !leadInto.has(node.id)) {
      findings.push(`"${node.title}" isn't connected: link it into the flow.`);
      continue;
    }
    if (starts.length > 0 && !reached.has(node.id)) {
      findings.push(`The flow from Start never reaches "${node.title}": link the card before it to it.`);
    }
    if (shape !== "end" && out.length === 0)
      findings.push(`"${node.title}" leads nowhere: link it on to the next card or to the "end" card.`);
    if (shape === "decision") {
      if (out.length !== 2)
        findings.push(`Decision "${node.title}" has ${ways(out.length)} out: give it two, labelled "Yes" and "No".`);
      else if (out.some((edge) => !edge.label))
        findings.push(`Decision "${node.title}" has a way out with no label: label its links "Yes" and "No".`);
      if (!node.title.trim().endsWith("?"))
        findings.push(`Decision "${node.title}" isn't a question: phrase it as one, e.g. "Tests pass?".`);
    } else if (out.length > 1) {
      findings.push(
        `"${node.title}" has ${ways(out.length)} out but isn't a decision: add a decision that says which way to go.`,
      );
    }
  }
} else {
  if (isSteps && layout === "line" && stepIds.length >= 5) {
    findings.push(`${stepIds.length} steps in one line: use "layout": "rows" to wrap them into compact rows.`);
  }
  if (flatSteps && stepIds.length > 12) {
    findings.push(
      `${stepIds.length} steps with nothing grouped: consider grouping into stages if the order inside a stage is flexible.`,
    );
  }
  if (!isSteps && topLevel.length > 7) {
    findings.push(`${topLevel.length} cards directly under the workflow: group them into 3–7 themes.`);
  }
  for (const node of nodes) {
    const children = getChildren(data, node.id);
    if (node.id !== rootId && children.length > 8) {
      findings.push(`"${node.title}" holds ${children.length} cards: split it into two groups.`);
    }
    if (node.id !== rootId && children.length === 1) {
      findings.push(`"${node.title}" holds a single card ("${children[0].title}"): merge them or add its siblings.`);
    }
  }
  if (maxDepth > 3) findings.push(`Cards are nested ${maxDepth} levels deep: flatten to 3 or fewer.`);
  if (links > Math.max(2, cards.length / 2))
    findings.push(`${links} extra links for ${cards.length} cards: keep only real dependencies.`);
  if (root.mode === "scheduled" && topLevel.filter((node) => node.schedule).length > 8) {
    findings.push("More than 8 scheduled cards directly under the workflow: group them by part of the day or by day.");
  }
}
const titleCounts = new Map<string, number>();
for (const node of cards) titleCounts.set(node.title.toLowerCase(), (titleCounts.get(node.title.toLowerCase()) ?? 0) + 1);
for (const [title, count] of titleCounts) {
  if (count > 1) findings.push(`"${title}" is used ${count} times: make titles unique so progress carries over on re-import.`);
}
for (const node of nodes) {
  if (isFlowchart && node.id !== rootId && node.title.length > BOX_TITLE_LENGTH) {
    findings.push(
      `Long title for a box (${node.title.length} characters, keep it under ${BOX_TITLE_LENGTH}): "${shorten(node.title)}"`,
    );
  } else if (node.title.length > 60) {
    findings.push(`Long title (${node.title.length} characters): "${shorten(node.title)}"`);
  }
  const checklist = node.blocks.filter((block) => block.type === "checklist").length;
  if (checklist > 12)
    findings.push(`"${node.title}" has ${checklist} checklist items: split the card or move items to a prepare step.`);
}

console.log("Findings:");
if (findings.length === 0) console.log("  None — the structure looks clean.");
for (const finding of findings) console.log(`  - ${finding}`);
