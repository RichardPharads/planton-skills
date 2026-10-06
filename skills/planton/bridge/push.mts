// What the Planton skills run to show progress and finished plans on a paired phone:
//   push.mts status "Writing the plan"
//   push.mts plan "<file>"
// If the bridge isn't running it says so and exits normally, so a skill carries on exactly as before.
import { readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";

import { PLAN_MAX_BYTES, STATUS_MAX } from "./bridge-protocol.ts";
import { callBridge } from "./settings.mts";

const [kind, value] = process.argv.slice(2);

function usage(): never {
  console.log('Usage: push.mts status "<text>" | push.mts plan "<file>"');
  process.exit(2);
}

let body: Record<string, string>;
if (kind === "status" && value?.trim()) {
  body = { kind: "status", text: value.trim().slice(0, STATUS_MAX) };
} else if (kind === "plan" && value) {
  const path = resolve(value);
  let size = 0;
  try {
    size = statSync(path).size;
  } catch {
    console.log(`There's no file at ${path}.`);
    process.exit(1);
  }
  if (size > PLAN_MAX_BYTES) {
    console.log("That plan is over 2 MB, too large to send to the phone.");
    process.exit(1);
  }
  body = { kind: "plan", path, fileName: basename(path), text: readFileSync(path, "utf8") };
} else {
  usage();
}

const reply = await callBridge("/api/push", { method: "POST", body });
if (!reply) {
  console.log("The Planton bridge isn't running, so nothing was sent to a phone.");
} else if (reply.status !== 200) {
  console.log(`The bridge didn't take it (${reply.body?.error ?? reply.status}).`);
  process.exit(1);
} else if (kind === "plan") {
  console.log(
    reply.body.delivered > 0 ? "Sent to your phone." : "No phone is connected right now: the plan waits on this PC for 24 hours.",
  );
} else {
  console.log(reply.body.delivered > 0 ? "Shown on your phone." : "No phone is connected right now.");
}
