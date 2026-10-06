---
name: planton-connect
description: Connect the user's phone to Claude Code so Planton plans appear on it live over the Wi-Fi, and so they can chat with Claude Code from the phone about a project folder (read-only). Starts the Planton bridge on this PC, shows a QR code to scan in the Planton app (Integrations → Connect to your PC), allows folders for the phone's chat, and reports which phones are paired. Use when the user asks to connect, pair or link their phone or the Planton app to Claude Code, wants plans sent to their phone directly, wants to ask Claude Code about a project from their phone, asks whether their phone is connected, or wants to stop the bridge.
---

# Connect Planton to this PC

The Planton bridge is a small server on this PC. Once a phone has paired with it, the plans the Planton skills write
go straight to the phone (see "Show progress on the phone" in [handoff.md](../planton/reference/handoff.md)).

The bridge ships with the `planton` skill, in `<skills folder>/planton/bridge/`, where `<skills folder>` is the folder
that contains this skill's folder. Like the validator, it needs Node 22.6 or later.

## Connect a phone

1. Run:

   ```bash
   node "<skills folder>/planton/bridge/connect.mts"
   ```

   It starts the bridge if it isn't running, makes a pairing code, prints it as a QR code, and opens a page with the
   same code in the browser.
2. Tell the user: in Planton, open **Integrations → Connect to your PC** and point the phone at the code on the page
   (the one in the terminal works too, on a dark terminal). The phone and the PC must be on the same Wi-Fi. The code
   works once, for 10 minutes; running the command again makes a new one.
3. If the phone can't connect, suggest, in order: the same Wi-Fi network on both; on Windows, allowing Node.js through
   Windows Firewall (on Public networks too, if the Wi-Fi is set to Public); another of the PC's addresses from the
   list on the page.

Never repeat the pairing link anywhere but the user's own terminal or browser: it's what lets a phone pair.

## Chat from the phone

Once paired, the Planton app's chat can talk to Claude Code on this PC: the person picks "Claude Code on <PC>" as the
chat's source and asks about a project. It runs here, with their own Claude Code sign-in, and can only read and search
the folders they allow, never change anything or run commands.

After connecting, if the current folder is a project (it has a README, a package file or a .git folder) and isn't
allowed yet (`status` lists the allowed folders), offer once to allow it:

```bash
node "<skills folder>/planton/bridge/connect.mts" allow
```

`allow <folder>` allows another folder, and `allow --remove` (in that folder, or with its path) takes one out. The
phone sees only a folder's name, never its path.

## Check or stop

- `node "<skills folder>/planton/bridge/connect.mts" status`: whether it's running, each paired phone, and the folders
  the phone's chat may use.
- `node "<skills folder>/planton/bridge/connect.mts" stop`: stops it. Paired phones stay paired and reconnect the
  next time it starts.

A paired phone can be removed on the page (Paired phones → Remove) or in the app (Integrations → the PC → Forget this
PC).
