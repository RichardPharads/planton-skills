// What /planton-workspace runs. `workspace.mts [folder]` starts the Planton bridge if it isn't running, adds the project
// folder (the current one by default) to its workspaces, and opens the project's page in the browser: its plans, live,
// to arrange and build by hand. `workspace.mts list` prints the projects; `workspace.mts remove [folder]` forgets one.
// --no-open (or PLANTON_NO_OPEN=1) only prints the address. Stopping the bridge is `connect.mts stop`.
import { resolve } from "node:path";

import { isFolder, openInBrowser, startBridge, status } from "./launch.mts";
import { callBridge, changeWorkspaces, loadOrCreateSettings, logPath, readSettings, writeSettings } from "./settings.mts";

const args = process.argv.slice(2);
const words = args.filter((arg) => !arg.startsWith("--"));
const openBrowser = !args.includes("--no-open") && process.env.PLANTON_NO_OPEN !== "1";
const command = words[0] === "list" || words[0] === "remove" ? words[0] : "open";
const folder = resolve((command === "open" ? words[0] : words[1]) ?? process.cwd());

if (command === "list") {
  const running = await status();
  const workspaces = running?.workspaces ?? (readSettings()?.workspaces ?? []).map(({ name, path }) => ({ name, path, url: "" }));
  console.log(
    workspaces.length
      ? `Workspaces:\n${workspaces.map((entry) => `- ${entry.name} (${entry.path})${entry.url ? ` ${entry.url}` : ""}`).join("\n")}`
      : "No workspaces yet. Run workspace.mts in a project folder to add one.",
  );
  if (!running && workspaces.length) console.log("The bridge isn't running: workspace.mts in a project starts it again.");
} else if (command === "remove") {
  const reply = await callBridge("/api/workspaces", { method: "POST", body: { path: folder, remove: true } });
  if (!reply) {
    // Not running: the settings file is ours to change.
    const settings = loadOrCreateSettings();
    settings.workspaces = changeWorkspaces(settings.workspaces, folder, true);
    writeSettings(settings);
  } else if (reply.status !== 200) {
    console.error(`The bridge didn't remove the workspace. Its log is at ${logPath()}.`);
    process.exit(1);
  }
  console.log(`Removed the workspace for ${folder}.`);
} else {
  if (!isFolder(folder)) {
    console.error(`${folder} isn't a folder.`);
    process.exit(1);
  }
  const running = (await status()) ?? (await startBridge());
  if (!running) {
    console.error(`The Planton bridge didn't start. Its log is at ${logPath()}.`);
    process.exit(1);
  }
  const reply = await callBridge("/api/workspaces", { method: "POST", body: { path: folder } });
  if (reply?.status !== 200 || typeof reply.body?.url !== "string") {
    console.error(`The bridge didn't add the workspace. Its log is at ${logPath()}.`);
    process.exit(1);
  }
  console.log(`Workspace: ${reply.body.url}`);
  console.log("Only this PC can open it. It shows the plans in this project's planton/ folder and updates as they change.");
  if (openBrowser) openInBrowser(reply.body.url);
}
