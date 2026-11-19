# DHBlocker 2.0

Own your web: fast native network blocking, safe annoyance filters, focus presets, and a persistent point-and-zap element remover. Zero build step, vanilla JS, Manifest V3.

## Load It
1. Go to `chrome://extensions` → enable **Developer mode** → click **Load unpacked** → select this folder.
2. Open `test/fixture.html` (or any site) to test it out.

## Features
- **Shield** – `declarativeNetRequest` rulesets (`rules/*.json`) for ads, trackers, and annoyance SDKs. The blocked count displays on the toolbar badge.
- **Filters** – Cosmetic packs for ads, cookie banners, newsletter/sign-in nags, and chat widgets. Injected at `document_start`; never deletes iframes or generic `.modal` UI.
- **Zapper** (toggle from the popup or `Alt+Shift+Z`) – Click every element you want gone (click again to unselect), then click **Done** to hide them all at once and remember them for that site.
  - `↑` / `↓` or `Alt+Wheel` – Select parent/child element
  - `S` – Add similar elements
  - `Enter` – Done
  - `Backspace` / `Ctrl+Z` – Undo last pick
  - `Esc` – Cancel
- **Unfreeze Page** (`Alt+Shift+U`) – Removes scroll locks, blocking overlays, and paywall blur.
- **Focus Presets** – Hides distractions on YouTube (Shorts/recommendations), Reddit, X, LinkedIn, and Facebook (off by default).
- **Studio** (Options page) – Manage zaps, paused sites, and presets, or import/export settings via JSON.
- **Quick Pause** – Per-site pause and global pause directly from the popup.

## Development
- `node scripts/build-rules.js` – Regenerate `rules/*.json` from the domain lists in the script.
- `node scripts/check.js` – Run static sanity checks (manifest references, rules, syntax, helpers).
- `powershell -File scripts/package.ps1` – Build `dist/DHBlocker_v<version>.zip` (manifest at zip root).

## Project Layout
```text
manifest.json
rules/            Static DNR rulesets (generated)
src/background/   Service worker: rulesets, allowlist, commands, injection
src/content/      data.js (selector packs/defaults), cosmetic.js, selector.js, zapper.js, unfreeze.js
src/popup/        Toolbar popup
src/options/      Studio dashboard
test/fixture.html Manual breakage test page
