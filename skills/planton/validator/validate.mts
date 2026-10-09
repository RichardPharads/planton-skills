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

// What the importer checks but doesn't keep, read from the file itself: the plans cards open, and an overview's columns.
type RawCard = { opens?: unknown; cards?: RawCard[] };
const workflow = JSON.parse(text).workflow as RawCard & { layout?: unknown };
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
