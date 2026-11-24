# BANNR

A browser-based HTML5 banner builder. Design banners visually, animate them, and export
ad-server-ready `.zip` files for **Adform, Google Campaign Manager 360, Display & Video 360
and The Trade Desk**. Everything runs in the browser: no server, no account.

## Setup

Requirements: **Node.js 20+**. On Windows, use Git Bash or WSL for the shell commands.

```bash
npm install
npm run dev                      # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the app |
| `npm run check` | Type check + unit tests |
| `npm run typecheck` | Strict TypeScript check |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright). First time: `npx playwright install chromium` |
| `npm run build` | Production build in `dist/` |

Projects and uploaded files are stored in the browser (IndexedDB), per browser profile.

## Using BANNR

1. **New project:** pick a name and the ad platform. Every project starts with an empty
   **480×480 master**.
2. **Design** on the canvas: text, shapes, CTA buttons, images (auto-compressed), Google Fonts or
   your own fonts (embedded in the export).
3. **Sizes:** `+ Add` offers 300×250, 300×300, 300×600, 480×300, 320×480 and 970×250, plus any
   custom size. New sizes are auto-adapted from the master and can then be edited on their own.
4. **Animate:** entrance/exit presets per layer, loop length and plays, and a timeline. Play,
   pause, restart and scrub in **Preview**.
5. **Export:** pick the platform, sizes and an (optional) landing URL. The checklist must show no
   errors. You get one zip per size plus separate backup JPGs, or everything in one zip.

The landing URL may stay empty: it is then set in the ad server or DSP.

## Architecture

```
src/
├─ app/            App shell, dashboard, routing, preview iframe
├─ model/          Document schema (types.ts), factories, migrations, sizes, animation, fonts
├─ renderer/       PURE: Project JSON in, HTML/CSS/JS out (+ animation engines)
├─ editor/         Store (undo/redo), canvas, panels, timeline, fonts, assets, shortcuts
├─ export/
│  ├─ adapters/    ONE FILE PER PLATFORM + registry.ts (all platform snippets and limits)
│  ├─ pipeline.ts  Zip building (JSZip), asset paths, file names
│  └─ backup.ts    Backup image
├─ validation/     Pre-export checklist (rules.ts)
├─ persistence/    Repository interfaces + IndexedDB implementation
└─ styles/
tests/e2e/         Playwright tests
```

Planned in Phase 7: `src/components/[type]/` (one folder per component) and `src/runtime/`
(the shared banner runtime).

### Key ideas

- **One renderer for everything.** `renderBanner()` / `renderFragment()` are pure functions. The
  editor canvas (in a Shadow DOM), the Preview iframe, the backup image and the export all use
  them, so what you see is what you export.
- **Undo/redo** stores immutable project snapshots (Immer). Updates with the same `coalesceKey`
  within 800 ms merge into one step, so a drag or typing is one undo step.
- **Schema versions.** `SCHEMA_VERSION` in `model/types.ts` plus `model/migrations.ts`.
  Stored projects are upgraded when they are loaded.
- **Storage is swappable.** The app only uses `ProjectRepository` and `AssetStore`
  (`persistence/repository.ts`). Replace the IndexedDB classes to add a backend.
- **Animation engines are pluggable** (`renderer/animation/engine.ts`). The default is plain CSS
  `@keyframes`, with no scripts in the banner.

### Clicks: `bannr.exit()`

Every click-through goes through **one function, `bannr.exit()`**. Nothing else in a banner may
call `window.open` or change `location`; the checklist blocks the export if it does.

- A transparent **click layer** sits at the **bottom** of the banner. Normal layers use
  `pointer-events: none`, so clicks fall through to it. Interactive components will opt back in
  with the `bannr-interactive` class (Phase 7).
- The click layer calls `bannr.exit()`. The **platform adapter** defines what `exit()` does.
- `bannr.track(name)` reports interaction events. The adapter's optional `trackEvent` maps them
  to platform tracking; by default it does nothing.
- Preview injects the **same adapter code** plus preview-only helpers (an Adform `dhtml` stub,
  a `window.open` that shows the URL instead of opening it).

### Export pipeline (`export/pipeline.ts`)

For each size: render with relative paths → inject the adapter's head and click code → add the
adapter's extra files (e.g. Adform `manifest.json`) → copy **only the images and fonts that size
uses** into `images/` and `fonts/` (WebP is converted to PNG) → zip with `index.html` at the root
→ name it `{{PROJECT_NAME}}_{{PLATFORM}}_{{WIDTH}}x{{HEIGHT}}.zip`. Backup images are separate
files, never inside the zip.

### Validation (`validation/rules.ts`)

Shared checks (zip size vs limit and target, file count, file types, `index.html` at the root,
missing files, landing URL, `bannr.exit()` rules, external requests, animation limits) plus the
adapter's own `validate()`. **Errors block the export; warnings don't.** The same build runs in
the live KB counter.

## How to add a platform adapter

1. Add the id to `PlatformId` in `src/model/types.ts` and a label in `src/model/platforms.ts`.
2. Create `src/export/adapters/myplatform.ts`:

```ts
import { PLATFORM_LABELS } from '@/model/platforms';
import { jsString } from '@/renderer/escape';
import { BASE_EXTENSIONS, adSizeMeta, check, entryText, headOf } from './common';
import type { PlatformAdapter } from './types';

/** MY PLATFORM. Spec: https://… (link the official HTML5 spec page) */
export const myplatform: PlatformAdapter = {
  id: 'myplatform',
  label: PLATFORM_LABELS.myplatform,
  specUrl: 'https://…',
  injectHead: (size, project) =>
    `${adSizeMeta(size)}\n<script>var clickTag = ${jsString(project.landingUrl)};<\/script>`,
  // Must define bannr.exit(). This is the ONLY place a URL may be opened.
  injectClickScript: () => `<script>bannr.exit = function(){ window.open(window.clickTag, '_blank'); };<\/script>`,
  extraFiles: () => ({}),                       // e.g. { 'manifest.json': '…' }
  validate: (zip) => [
    check('click-tag', /var clickTag = "[^"]*";/.test(headOf(entryText(zip, 'index.html') ?? '')),
      'clickTag is declared', 'clickTag is missing'),
  ],
  constraints: { maxZipKB: 300, maxFiles: 100, allowedExtensions: BASE_EXTENSIONS, allowedExternalHosts: [] },
};
```

3. Register it in `src/export/adapters/registry.ts` (`ADAPTERS`).
4. Add tests to `src/export/adapters/adapters.test.ts`: the exact head and click code, extra
   files, and that a built banner passes `validate()`.
5. Run `npm run check` and `npm run test:e2e`.

Notes: inside a TypeScript string, write closing script tags as `<\/script>` so the source stays
safe to embed in HTML. Use `jsString()` for every value that goes into a script.

## How to add a component (planned: Phase 7a)

Components (cube, carousel, scratch, countdown…) are interactive layers. The framework arrives in
Phase 7a; this section will be finalised then. The document already supports them: element type
`component` with `componentType`, `componentVersion`, `preset`, `props` and `slots`
(see `model/types.ts`). Until 7a, they render as placeholder boxes.

Each component will be one folder, `src/components/[type]/`, exporting a definition:

```ts
export const counter: ComponentDefinition = {
  type: 'counter', version: 1, label: 'Counter', category: 'widget',
  description: 'Animated number, e.g. "-50%"', icon: '123',
  defaultSize: { width: 200, height: 80 }, minSize: { width: 80, height: 30 },
  recommendedSizes: ['300x250', '300x600'],
  settingsSchema: { end: { type: 'number', label: 'End value', default: 50 } },
  slots: [], capturesPointer: false, emits: [], weightBudgetKB: 2,
  render: (props) => ({ html: `<span class="n">${props.end}</span>`, css: '.n{font:700 40px Arial}' }),
  runtime: '/* vanilla JS, no libraries, uses bannr.* helpers */',
  backupState: (props) => ({ html: `<span class="n">${props.end}</span>`, css: '' }),
};
```

Rules: vanilla JS and CSS only, no network requests (except the Lead Form), works with touch
and mouse, stays within `weightBudgetKB`, opens URLs only via `bannr.exit()`, reports events via
`bannr.track()`, and cleans up its listeners and timers.

## Platform details not verified

All limits come from search summaries of each platform's docs, not from the official pages.
They live in the adapter files, ready to update.

- **Spec links** point to each help centre's home page (marked `TODO`), not the exact HTML5 article.
- **Adform:** hard zip limit unknown (300 KB used, plus a warning at the recommended 150 KB); file
  count and file types assumed from CM360; the DHTML event-tracking call is still to be confirmed (Phase 7).
- **DV360:** allowed file types assumed from CM360; the 5 MB figure is the served weight.
- **The Trade Desk:** fonts not on the type list (warning); the 300 KB and 10-file limits are for
  the initial load and are applied to the whole banner.
- **Empty click tags:** not confirmed that CM360 and Adform accept an empty value at upload.
  Check on the first real upload.

## Tests

- **Unit (Vitest):** renderer, model, editor actions, geometry, animation engine, timeline,
  adapters (exact click code, files, meta tags), export pipeline, validation rules.
- **Browser (Playwright):** editor interactions, panels, sizes, fonts, compression, animation,
  timeline, clicks, export, validation, and an end-to-end export for all four platforms.
