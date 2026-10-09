// Checks a .planton.json file with the same rules as the Planton app's importer.
// Usage: node validate.mts <file.planton.json>
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { unknownTechIds } from "./tech-catalog.ts";
import { parseWorkflowFile } from "./workflow-file.ts";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node validate.mts <file.planton.json>");
  process.exit(2);
}

const text = readFileSync(file, "utf8");
const result = parseWorkflowFile(text, { idPrefix: "check", now: Date.now() });
if (!result.ok) {
  console.error(`Invalid: ${result.error}`);
  process.exit(1);
}

const { title, mode, topLevelCount, cardCount } = result.summary;
const label = { steps: "Step-by-step", freeform: "Free-form", scheduled: "Scheduled", flowchart: "Flowchart" }[mode];
const top = mode === "steps" ? "steps" : "top-level cards";
// A Flowchart's cards are all side by side under the workflow, so there's no separate top level to count.
const counts = mode === "flowchart" ? `${cardCount} cards` : `${topLevelCount} ${top} · ${cardCount} cards`;
console.log(`OK: "${title}" · ${label} · ${counts}`);

const unknown = unknownTechIds(result.template.nodes);
if (unknown.length > 0) {
  console.log(
    `Warning: not in Planton's technology list, so shown as plain cards: ${unknown.join(", ")}. See "Technologies" in format.md.`,
  );
}

// What the importer checks but doesn't keep, read from the file itself: the plans cards open, an overview's columns, and
// a request flow's lanes.
type RawCard = { key?: unknown; title?: unknown; opens?: unknown; lane?: unknown; cards?: RawCard[] };
type RawLink = { from?: unknown; to?: unknown; label?: unknown };
const workflow = JSON.parse(text).workflow as RawCard & { layout?: unknown; links?: RawLink[] };
const opened = new Set<string>();
const walk = (cards: RawCard[] | undefined) => {
  for (const card of cards ?? []) {
    if (typeof card.opens === "string") opened.add(card.opens);
    walk(card.cards);
  }
};
walk(workflow.cards);
const missing = [...opened].filter((name) => !existsSync(join(dirname(file), `${name}.planton.json`)));
if (missing.length > 0) {
  console.log(
    `Note: cards open plans not written yet (their Open buttons show dashed): ${missing.map((name) => `${name}.planton.json`).join(", ")}.`,
  );
}
const MAX_COLUMNS = 6;
if (workflow.layout === "columns" && (workflow.cards?.length ?? 0) > MAX_COLUMNS) {
  console.log(
    `Warning: ${workflow.cards!.length} columns is too wide to read; merge some into ${MAX_COLUMNS} or fewer (see "Overviews and flows" in format.md).`,
  );
}

// A request flow's lanes are the overview's parts, by name, and a link from one lane to another names its call.
if (workflow.layout === "lanes") {
  const cards = workflow.cards ?? [];
  const laneOf = new Map(
    cards.flatMap((card) => (typeof card.key === "string" && typeof card.lane === "string" ? [[card.key, card.lane]] : [])),
  );
  const overviewFile = join(dirname(file), "system-map.planton.json");
  if (existsSync(overviewFile) && !file.endsWith("system-map.planton.json")) {
    try {
      const overview = JSON.parse(readFileSync(overviewFile, "utf8")).workflow as RawCard & { layout?: unknown };
      if (overview.layout === "columns") {
        const parts = new Set((overview.cards ?? []).flatMap((column) => (column.cards ?? []).map((part) => part.title)));
        const unknownLanes = [...new Set(laneOf.values())].filter((lane) => !parts.has(lane));
        if (unknownLanes.length > 0) {
          console.log(
            `Note: lanes named differently from any part on the overview (system-map.planton.json): ${unknownLanes.join(", ")}.`,
          );
        }
      }
    } catch {
      // An overview that doesn't read is the overview's own problem; the validator says so when it's checked.
    }
  }
  const unnamed = (workflow.links ?? []).filter((link) => {
    const from = laneOf.get(String(link.from));
    const to = laneOf.get(String(link.to));
    return from && to && from !== to && !(typeof link.label === "string" && link.label.trim());
  });
  if (unnamed.length > 0) {
    console.log(
      `Note: links between lanes with no label (name the call or what comes back): ${unnamed.map((link) => `${link.from} → ${link.to}`).join(", ")}.`,
    );
  }
}
