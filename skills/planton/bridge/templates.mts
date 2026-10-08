// Plan templates for the workspace: plans with their progress stripped (the page does that), kept in the bridge's own
// settings folder so every project on this PC can start from them. The same file names, safe writes and importer check as
// a project's plan files (plan-files.mts), only in a different folder.
import { join } from "node:path";

import { checkPlan, listPlansIn, newPlanFileIn, readPlanFileIn, writePlanFileIn, type PlanListing } from "./plan-files.mts";
import { settingsDir } from "./settings.mts";

const templatesFolder = () => join(settingsDir(), "templates");

export function listTemplates(): PlanListing[] {
  return listPlansIn(templatesFolder());
}

/** The template's text, or null for a name that isn't a template's. */
export function readTemplate(file: string): { text: string } | null {
  const template = readPlanFileIn(templatesFolder(), file);
  return template ? { text: template.text } : null;
}

/** Saves a plan as a new template, named from its title; the importer's message when it isn't a plan the app would open. */
export function saveTemplate(text: string): { ok: true; file: string } | { ok: false; error: string } {
  const checked = checkPlan(text);
  if (!checked.ok) return checked;
  const file = newPlanFileIn(templatesFolder(), checked.title);
  writePlanFileIn(templatesFolder(), file, text);
  return { ok: true, file };
}
