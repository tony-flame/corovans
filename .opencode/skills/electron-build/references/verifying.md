# Verifying the Electron build by hand

The user plays the game to judge it. This file is only for the automation
traps, so nobody re-derives them.

## Launch with devtools exposed

```bash
dist\Corovans-win32-x64\Corovans.exe --remote-debugging-port=9804
```

Then `http://127.0.0.1:9804/json/list` gives the page URL
(`app://game/index.html`) and a `webSocketDebuggerUrl`.

## Trap 1 — `Page.navigate` never answers

`Page.navigate` tears down the session before replying, so `await` hangs
forever. Fire it without awaiting and sleep instead:

```js
send("Page.navigate", { url: "app://game/index.html?debug=1" }).catch(() => {});
await sleep(3500);
// then re-attach: Target.getTargets -> Target.attachToTarget
```

Always re-attach after reload/navigate. The old session id is dead.

## Trap 2 — `window.__corovans` only exists with `?debug=1`

Without the flag the debug hook is never installed and every probe throws
`Cannot read properties of undefined`. Navigate with `?debug=1` first.

## Trap 3 — real API names, do not invent them

These caused wasted runs:

| Wrong | Right |
|---|---|
| `ui.showTrade(state)` | `ui.openTrade(state)` |
| `ui.hideTrade()` | `ui.closeTrade()` |
| `c.audio` | not exposed in the debug hook at all |
| `inventory.rollLoot(tier, 3)` | `rollLoot(tier, rngFn, count)` — rng must be a function |

`ui.openTrade` needs a full state object: `{ gold, reputation, inventory:
{ items, capacity }, upgrades: {}, fine, priceModifier }`. Missing `reputation`
or `upgrades` throws before the panel renders.

## What is worth checking (cheap)

- `localStorage` write → `Page.reload` → read back. This is the one thing that
  genuinely breaks under Electron origins.
- `document.getElementById('game').width === 1280` and CSS width `1280px`
  (scale 1, buffer maps 1:1).
- Screenshot after `start-btn` click: HUD, splash, menu render.
- Console errors — should be none; a CSP warning means the HTML response lost
  its `Content-Security-Policy` header in `electron/main.cjs`.

## What is NOT worth checking

Framerate. Headless and scripted checks do not reproduce what the player sees,
and `requestAnimationFrame` is throttled. Do not report FPS numbers.
