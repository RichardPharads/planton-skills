import { BUILT_IN_AUTHOR, type ContentBlock, type WorkflowData, type WorkflowEdge, type WorkflowNode } from "./workflows.ts";

export type WorkflowTemplate = {
  rootId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

export function card(
  id: string,
  title: string,
  parentId: string | null,
  blocks: ContentBlock[],
  description = "",
  now: number,
): WorkflowNode {
  return {
    id,
    title,
    description,
    parentId,
    status: "pending",
    blocks,
    position: null,
    deadline: null,
    timeLimitMs: null,
    timerMs: null,
    countdown: false,
    resumeStatus: null,
    pausedAt: null,
    readOnly: false,
    readAt: null,
    createdBy: BUILT_IN_AUTHOR,
    createdAt: now,
    updatedAt: now,
    favorite: false,
    archivedAt: null,
    deletedAt: null,
    mode: "freeform",
    schedule: null,
    scheduleCycle: null,
    scheduledSince: null,
    completions: [],
    skips: [],
    doneAt: null,
    appearance: null,
    layout: null,
    nodeType: null,
  };
}

/**
 * The card a new Flowchart workflow begins with: just Start. Every other card, End included, is added from the shape
 * picker when the chart needs it.
 */
export function createFlowchartStarterCards(rootId: string, now: number): WorkflowNode[] {
  return [
    { ...card(`${rootId}-start`, "Start", rootId, [], "", now), createdBy: null, nodeType: "start", position: { x: 0, y: 0 } },
  ];
}

/** Adds a template's workflow at the top of the list, unless a workflow with the same id already exists. */
export function addWorkflowTemplate(data: WorkflowData, template: WorkflowTemplate): WorkflowData {
  if (data.nodes[template.rootId]) return data;
  return {
    nodes: { ...Object.fromEntries(template.nodes.map((node) => [node.id, node])), ...data.nodes },
    edges: [...template.edges, ...data.edges],
  };
}
