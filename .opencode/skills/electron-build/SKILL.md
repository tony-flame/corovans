---
name: Electron build
description: Build, run and package the Corovans desktop app (Electron) — npm install, npm run electron, npm run dist, icon regeneration. Use when asked to build an exe, run the desktop version, or fix Electron packaging. Skips unit tests on purpose.
---

# Corovans — Electron build

Goal: produce a working `Corovans.exe` with the least ceremony. **Do not run
`npm test` or `npm run verify`** unless the user explicitly asks — they verify
the game by playing it.

## Fast path (nothing to prepare)

If `node_modules/electron/dist/electron.exe` already exists, skip straight to
build:

```bash
npm run dist
```

Result: `dist/Corovans-win32-x64/Corovans.exe` (~169 MB file, ~252 MB folder).
Launch it by double click. No installer, no admin rights.

## Cold path (first time on a machine)

```bash
npm install
```

**Expect a trap here.** npm may block Electron's postinstall script
(`npm warn install-scripts ... electron@... (postinstall: node install.js)`) and
then `node_modules/electron/dist/electron.exe` will not exist. Fix it directly:

```bash
node node_modules/electron/install.js
Test-Path node_modules\electron\dist\electron.exe   # must be True
```

Do not fight the allowScripts policy, do not reinstall — running `install.js`
by hand is the reliable move.

## Run without packaging

```bash
npm run electron
```

Useful flags for debugging: `--remote-debugging-port=9801` exposes devtools over
HTTP for scripted checks (see `references/verifying.md`).

## Icon

```bash
npm run icon
```

Regenerates `electron/icon.png` and `electron/icon.ico` from
`scripts/make-icon.mjs`. PNG and ICO are written byte by byte — no sharp, no
imagemagick. If the icon looks wrong, edit the drawing section of that script,
not the binary files.

## Two things that break every single time

1. **`win.loadFile('index.html')` gives a blank window.** Chromium blocks ES
   modules on `file://` by CORS. The app serves itself over a custom `app://`
   protocol in `electron/main.cjs`. Never "simplify" that to `loadFile`.
2. **`sandbox: true` kills the renderer** with
   `Renderer process launch-failed` and no window appears. It is `false` on
   purpose; `contextIsolation: true` + `nodeIntegration: false` carry the
   security.

## Packaging hygiene

`npm run dist` ignores tests, scripts, docs, logs and the Electron dev
dependencies. After changing the ignore list, verify the archive actually
contains only what it should:

```bash
node references/inspect-asar.mjs
```

Expect ~44 files, `logs: 0`, no `.md`, no `node_modules/electron`.

## What to report back

- Path to the exe and whether it launched.
- Anything you had to fix (postinstall, sandbox, CSP).
- Do **not** claim "performance is fixed" — the user checks that by playing.
