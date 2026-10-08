// What /planton-connect runs. `connect.mts` starts the Planton bridge if it isn't running, makes a fresh pairing code,
// prints it as a QR code and opens the pairing page in the browser. `connect.mts status` says whether the bridge is
// running, which phones are paired and which folders the phone's chat may use; `connect.mts stop` stops it.
// `connect.mts allow [folder]` lets the phone ask Claude Code about a folder (the current one by default), read-only;
// `--remove` takes it out again. --no-open (or PLANTON_NO_OPEN=1) skips the browser.
import { resolve } from "node:path";

import { qrTerminal } from "./qr.mts";
import { isFolder, openInBrowser, startBridge, status } from "./launch.mts";
import { callBridge, changeFolders, loadOrCreateSettings, logPath, writeSettings } from "./settings.mts";

const args = process.argv.slice(2);
const words = args.filter((arg) => !arg.startsWith("--"));
const command = words[0] ?? "start";
const openBrowser = !args.includes("--no-open") && process.env.PLANTON_NO_OPEN !== "1";

/** Allows a folder for the phone's chat, or removes it: through the bridge when it's running, which owns the settings. */
async function allow(path: string, remove: boolean): Promise<{ name: string; path: string }[] | string> {
  if (!remove && !isFolder(path)) return `${path} isn't a folder.`;
  const reply = await callBridge("/api/folders", { method: "POST", body: { path, remove } });
  if (reply?.status === 200) return reply.body.folders;
  if (reply?.status === 400) return reply.body?.error === "not-a-folder" ? `${path} isn't a folder.` : `Couldn't use ${path}.`;
  if (reply) return `The bridge didn't take the folder. Its log is at ${logPath()}.`;
  // Not running: the settings file is ours to change.
  const settings = loadOrCreateSettings();
  settings.folders = changeFolders(settings.folders, path, remove);
  writeSettings(settings);
  return settings.folders.map(({ name, path: folder }) => ({ name, path: folder }));
}

const folderList = (folders: { name: string; path: string }[]) =>
  folders.length
    ? `Chat folders:\n${folders.map((folder) => `- ${folder.name} (${folder.path})`).join("\n")}`
    : "No chat folders yet. Run connect.mts allow in a project folder to let your phone ask Claude Code about it.";

if (command === "status") {
  const running = await status();
  if (!running) {
    console.log("The Planton bridge isn't running. Start it with /planton-connect.");
  } else {
    console.log(`The Planton bridge is running on ${running.pc.name}, port ${running.port}.`);
    console.log(
      running.phones.length
        ? running.phones.map((phone) => `- ${phone.name}: ${phone.connected ? "connected" : "not connected"}`).join("\n")
        : "No phones paired yet.",
    );
    if (running.waiting) console.log(`${running.waiting} plan(s) waiting for a phone.`);
    if (running.folders) console.log(folderList(running.folders));
    const problem = running.lastChatProblem;
    if (problem) {
      const at = new Date(problem.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      console.log(`Last chat problem (${at}, ${problem.reason}): ${problem.detail || "no details"}`);
    }
  }
} else if (command === "allow") {
  const remove = args.includes("--remove");
  const path = resolve(words[1] ?? process.cwd());
  const result = await allow(path, remove);
  if (typeof result === "string") {
    console.log(result);
    process.exit(1);
  }
  console.log(
    remove
      ? `Your phone can no longer ask Claude Code about ${path}.`
      : `Your phone can now ask Claude Code about ${path}, read-only.`,
  );
  console.log(folderList(result));
} else if (command === "stop") {
  const reply = await callBridge("/api/stop", { method: "POST" });
  console.log(reply?.status === 200 ? "Stopped the Planton bridge." : "The Planton bridge isn't running.");
} else if (command === "start") {
  const running = (await status()) ?? (await startBridge());
  if (!running) {
    console.log(`Couldn't start the Planton bridge. Its log is at ${logPath()}.`);
    process.exit(1);
  }
  const reply = await callBridge("/api/pairing", { method: "POST", body: {} });
  if (reply?.status === 409) {
    console.log("This PC isn't on a Wi-Fi or Ethernet network a phone could reach. Connect it to your Wi-Fi and try again.");
    process.exit(1);
  }
  if (reply?.status !== 200) {
    console.log(`The bridge didn't make a pairing code. Its log is at ${logPath()}.`);
    process.exit(1);
  }
  const { link, viewUrl, expiresAt } = reply.body as { link: string; viewUrl: string; expiresAt: number };
  const until = new Date(expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  console.log(`The Planton bridge is running on ${running.pc.name}, port ${running.port}.\n`);
  console.log(qrTerminal(link));
  console.log("\nOn your phone: Planton → Integrations → Connect to your PC, then scan this code or the one on the page.");
  console.log(`The code works once, until ${until}.`);
  console.log(`Page: ${viewUrl}`);
  console.log(`Link: ${link}`);
  if (openBrowser) openInBrowser(viewUrl);
} else {
  console.log("Usage: connect.mts [start | status | stop | allow [folder] [--remove]] [--no-open]");
  process.exit(2);
}
