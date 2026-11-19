# DHBlocker 2.0

Own your web: fast native network blocking, safe annoyance filters, focus presets and a persistent point-and-zap element remover. Zero build step, vanilla JS, Manifest V3.

## Load it
1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick this folder.
2. Open `test/fixture.html` (or any site) and try it.

## Features
- **Shield** – `declarativeNetRequest` rulesets (`rules/*.json`) for ads, trackers and annoyance SDKs. Blocked count shows on the toolbar badge.
- **Filters** – cosmetic packs for ads, cookie banners, newsletter/sign-in nags, chat widgets. Injected at `document_start`, never deletes iframes or generic `.modal` UI.
- **Zapper** (`Alt+Shift+Z`) – hover + click an element. `↑/↓` or `Alt+wheel` step parent/child, `Enter` hide & remember, `Del` hide once, `S` hide similar, `Ctrl+Z` undo, `Esc` exit. Selectors avoid hashed/utility classes.
- **Unfreeze page** (`Alt+Shift+U`) – removes scroll locks, blocking overlays and paywall blur.
- **Focus presets** – YouTube Shorts/recs, Reddit, X, LinkedIn, Facebook (off by default).
- **Studio** (options page) – manage zaps, paused sites, presets; import/export JSON.
- Per-site pause + global pause from the popup.

## Dev
- `node scripts/build-rules.js` – regenerate `rules/*.json` from the domain lists in the script.
- `node scripts/check.js` – static sanity checks (manifest refs, rules, syntax, helpers).
- `powershell -File scripts/package.ps1` – builds `dist/DHBlocker_v<version>.zip` (manifest at zip root).

## Layout
```
manifest.json
rules/            static DNR rulesets (generated)
src/background/   service worker: rulesets, allowlist, commands, injection
src/content/      data.js (selector packs/defaults), cosmetic.js, selector.js, zapper.js, unfreeze.js
src/popup/        toolbar popup
src/options/      Studio dashboard
test/fixture.html manual breakage test page
```
