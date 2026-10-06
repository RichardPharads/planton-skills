// The page connect.mts opens in the browser: the QR code to scan, the PC's other addresses (in case the phone can't
// reach the first), the paired phones with Remove, the folders the phone's chat may use, and the Windows Firewall hint.
// Served only to this PC.
import { qrSvg } from "./qr.mts";

export type PageModel = {
  pcName: string;
  /** Null once the code has been used or has expired. */
  link: string | null;
  expiresAt: number;
  /** The address in the QR code. */
  host: string;
  addresses: string[];
  phones: { id: string; name: string; connected: boolean }[];
  /** The folders the phone can chat with Claude Code about (connect.mts allow). */
  folders: { name: string; path: string }[];
  /** This page's own path, /pair/<view token>. */
  viewPath: string;
};

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);

export function pairingPage(model: PageModel): string {
  const until = new Date(model.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const code = model.link
    ? `<div class="qr">${qrSvg(model.link)}</div><p class="muted">Works once, until ${escape(until)}.</p>`
    : `<p class="notice">This code has expired or been used. Run <code>/planton-connect</code> again for a new one.</p>`;
  const others = model.addresses.filter((address) => address !== model.host);
  const switcher = others.length
    ? `<p class="muted">Phone can't connect? Try another address of this PC: ${others
        .map((address) => `<a href="${escape(model.viewPath)}?host=${escape(address)}">${escape(address)}</a>`)
        .join(" · ")}</p>`
    : "";
  const phones = model.phones.length
    ? `<h2>Paired phones</h2><ul>${model.phones
        .map(
          (phone) =>
            `<li><span>${escape(phone.name)}${phone.connected ? " · connected" : ""}</span>` +
            `<form method="post" action="${escape(model.viewPath)}/remove">` +
            `<input type="hidden" name="phone" value="${escape(phone.id)}"><button>Remove</button></form></li>`,
        )
        .join("")}</ul>`
    : "";
  const folders = model.folders.length
    ? `<h2>Chat folders</h2><p class="muted">Your phone can ask Claude Code about these, read-only. Remove one with <code>connect.mts allow --remove</code> in that folder.</p><ul>${model.folders
        .map((folder) => `<li><span>${escape(folder.name)}</span><span class="muted link">${escape(folder.path)}</span></li>`)
        .join("")}</ul>`
    : `<p class="muted">To ask Claude Code about a project from your phone, run <code>connect.mts allow</code> in its folder.</p>`;
  const developer = model.link
    ? `<p class="muted">Developing Planton? Paste this into the scanner's link box: <span class="link">${escape(model.link)}</span></p>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect Planton</title>
<style>
  :root { color-scheme: light dark; --text: #14161b; --muted: #5d6270; --bg: #f4f5f7; --card: #ffffff; --line: #d9dce2; }
  @media (prefers-color-scheme: dark) { :root { --text: #f4f4f5; --muted: #a1a5af; --bg: #0b0c0f; --card: #17191e; --line: #2a2d35; } }
  body { margin: 0; font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--text); background: var(--bg); }
  main { max-width: 520px; margin: 0 auto; padding: 32px 16px 48px; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  h2 { font-size: 18px; margin: 28px 0 8px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 20px; margin-top: 16px; }
  .qr { background: #ffffff; border-radius: 12px; padding: 12px; width: min(320px, 100%); margin: 0 auto; box-sizing: border-box; }
  .qr svg { display: block; width: 100%; height: auto; }
  .muted { color: var(--muted); font-size: 14px; }
  .notice { font-weight: 600; }
  ol { padding-left: 20px; }
  ul { list-style: none; padding: 0; margin: 0; }
  ul li { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 0; border-top: 1px solid var(--line); }
  button { font: inherit; border: 1px solid var(--line); background: transparent; color: var(--text); border-radius: 8px; padding: 4px 12px; cursor: pointer; }
  code, .link { font-family: ui-monospace, Consolas, monospace; font-size: 13px; word-break: break-all; }
  a { color: inherit; }
</style>
</head>
<body><main>
<h1>Connect Planton to ${escape(model.pcName)}</h1>
<p class="muted">Plans Claude Code writes on this PC will show up on your phone.</p>
<div class="card">
<ol>
<li>On your phone, open Planton → Integrations → <strong>Connect to your PC</strong>.</li>
<li>Point it at this code. Your phone and this PC need to be on the same Wi-Fi.</li>
</ol>
${code}
${switcher}
</div>
<p class="muted">Windows asks once whether Node.js may use the network. Allow it, on Public networks too if your Wi-Fi is set to Public.</p>
${developer}
${phones}
${folders}
</main></body>
</html>`;
}
