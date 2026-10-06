// Checks a .planton.json file with the same rules as the Planton app's importer.
// Usage: node validate.mts <file.planton.json>
import { readFileSync } from "node:fs";

import { parseWorkflowFile } from "./workflow-file.ts";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node validate.mts <file.planton.json>");
  process.exit(2);
}

const result = parseWorkflowFile(readFileSync(file, "utf8"), { idPrefix: "check", now: Date.now() });
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
