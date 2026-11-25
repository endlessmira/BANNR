# BANNR: Dev note

Browser-based HTML5 banner builder: drag-and-drop editor, animation, 26 interactive rich media components, and export of ad-server-ready zips for **Adform, CM360, DV360 and The Trade Desk**. Everything runs client-side.

Status: **Phases 1–7 done**, plus beta-test fixes. **All verified:** 245 Vitest unit tests (43 files) and 63 Playwright browser tests passing. Latest work: one-decimal timeline times and the "Animation" label (Timeline and Preview), the Space key rule (types only in text fields, everywhere else switches mode), and the remaining "loop" wording in Properties, warnings and the export checklist renamed to "animation". Everything is committed and pushed.

Repository: **https://github.com/endlessmira/BANNR** (branch `main`, remote `origin`).

---

## 1. Setup and commands

- Node 20+. On Windows, use **Git Bash** (not PowerShell).
- Project folder: `~/Desktop/BANNR_rich-media-builder/bannr`
- `npm run dev`: app at http://localhost:5173
- `npm run check`: type check + unit tests
- `npm run test:e2e`: Playwright browser tests (one-time: `npx playwright install chromium`)
- After every tested change: `git add -A`, `git commit -m "..."`, `git push` (each on its own line, without `bash` in front).

## 2. Product decisions (the user's choices; some differ from the original brief)

| Topic | Decision |
|---|---|
| Master size | **Fixed 480×480**, always first, can't be deleted or replaced |
| Standard sizes | 300×250, 300×300, 300×600, 480×300 ("Landscape"), 320×480, 970×250. Anything else via Custom |
| New projects | **Empty 480×480 master** (no starter layout, no templates) |
| Templates | **Dropped entirely** (no gallery, no rich media templates; 7f = multi-size only) |
| Platform | Always chosen in the New project dialog (no default); can be changed in Export |
| Border | Optional per size ("Add border"), off by default, never checked |
| Landing URL | **Optional, empty by default.** Exported as an empty click tag; the ad server / DSP sets it. Warning only |
| Size target | **300 KB** target (warning), configurable per project |
| Over the platform zip limit | **Red error but NOT blocking** (`blocks: false`). Other errors still block |
| WebP | Converted to **PNG** at export |
| Fonts on TTD | Warning only |
| Animation limits | Max 30 s total, max 3 plays (errors, adjustable in Export) |
| Banner animation repeat | **Plays once by default**; "Repeat animation" checkbox shows Plays |
| Wording | The user sees **"Animation"**, never "Loop", for the banner's timing (Timeline, Preview, Properties, warnings, checklist). Code names keep "loop" (see section 6) |
| Space key | **Types a space only in text fields** (text, number, search, email, url, tel, password inputs, text areas, contenteditable). **Everywhere else it switches Edit / Preview** and never ticks, opens or presses the focused control |
| Carousel loop | **On by default** (wrap around) |
| Components | **Fill the banner** when added (any size); "Fit to banner" button |
| Interact mode | The Preview toggle is named **"Preview / Interact"** |

## 3. Tech stack

React 18 + TypeScript (strict) + Vite, Zustand + Immer (snapshot undo/redo with coalesce keys), idb-keyval (IndexedDB), JSZip, nanoid, Vitest, Playwright. No react-moveable: drag/resize/rotate/snapping are custom-built (pure, unit-tested geometry). Animations are plain CSS @keyframes (pluggable engine).

## 4. Architecture

    src/
      app/            shell, dashboard, routing (#/p/id), BannerPreview (iframe)
      model/          types.ts (schema v2), factories, migrations, sizes, adapt, animation, emphasis, fonts, color
      renderer/       PURE Project JSON to HTML/CSS/JS (renderBanner / renderFragment), sanitisers, preview shim
      renderer/animation/  engine.ts, static.ts, cssKeyframes.ts (entrance, emphasis, exit)
      editor/         EditorView (layout, Space key), store, canvas, panels, timeline, fonts, assets, componentPanel, hooks (shortcuts)
      export/         adapters/ (one file per platform + registry), pipeline.ts, backup.ts, ExportDialog, KbCounter
      validation/     rules.ts (shared checks), components.ts (component checks)
      components/     one folder per component + registry.ts, settings.ts, types.ts; shared: three.ts, nav.ts, game.ts, fit.ts, time.ts
      runtime/        runtime.ts: shared bannr runtime (only included when a size uses components)
      persistence/    repository interfaces + IndexedDB
      styles/         one CSS file per feature (imported in app/main.tsx)
    tests/e2e/        Playwright specs (helpers.ts: newProject, addAt, field)

Key principles:
- **One renderer for everything:** canvas (Shadow DOM), preview iframe, backup image and export use the same render functions. The edit canvas disables all animations and transitions.
- **Click layer at the bottom.** Normal layers have `pointer-events:none`; interactive components opt back in (`bannr-interactive`).
- **All click-throughs go through `bannr.exit()`**, defined by the adapter. `bannr.track(name)` reports events (preview shows an Events pill). Validation blocks `window.open` / location changes outside `bannr.exit()`.
- **Assets** are content-addressed (SHA-256). Images are compressed on upload (canvas; longest side max 2× the largest banner side, min 960; quality 0.82; PNG stays PNG; SVG/GIF untouched).
- **Fonts:** Google Fonts downloaded once (latin + optional latin-ext) and stored; custom uploads validated with FontFace. All embedded; no external requests at runtime.

## 5. Platform adapters (src/export/adapters/)

- **Adform:** DHTML loader in the head, `dhtml.getVar('clickTAG', fallback)`, `manifest.json`. Preview uses a dhtml stub.
- **CM360 / DV360** (separate files): `ad.size` meta + unminified `var clickTag = "..."` in the head.
- **TTD:** `ad.size` + `getClickTag()` reading the query string case-insensitively, falling back to the landing URL.

Limits used (from search summaries, **not verified on the official pages**): Adform 300 KB hard (assumed) + 150 KB recommended warning, 100 files; CM360 10 MB, 100 files; DV360 5 MB served, 100 files; TTD 300 KB, **10 files**, no font types, backup max 150 KB.

**To check on first real uploads:** exact spec URLs (currently help-centre home pages, marked TODO); Adform hard limit and file types; that CM360 and Adform accept an **empty click tag**; TTD fonts and the 10-file limit; the **Adform DHTML event-tracking call** for `bannr.track` (not wired; trackEvent is a no-op everywhere).

Export: one zip per size named `{PROJECT_NAME}_{PLATFORM}_{W}x{H}.zip`, index.html at the root, only used images/fonts in `images/` and `fonts/`. Backup JPG is separate (never inside the zip). "All sizes" = one zip of all size zips + backups. Minification: not implemented yet.

## 6. Editor features

- **Dashboard:** create (name + required platform), open, duplicate, rename, delete; autosave to IndexedDB.
- **Canvas:** select, box-select, drag (Shift constrains, Alt no snap), resize (Shift keeps ratio), rotate (Shift 15°), snapping guides, arrow-key nudge (Shift 10 px), copy/cut/paste/duplicate/select all, group/ungroup, z-order; zoom Fit (2% steps, 40 px margin) / 50 / 100 / 200%.
- **Layers panel:** reorder by dragging, hide, lock, rename, group.
- **Properties panel:** **600 px** wide on wide screens, resizable by its left edge (300–900 px, remembered; double-click resets); two-column grid; collapsible sections (remembered); **Fill, Stroke and Shadow closed by default**; Expand all / Collapse all; **Find a setting** (press `/`). Order: Layout, own settings, **Animation**, Fill, Stroke, Shadow.
- **Colours:** every colour field has an **opacity %** (hex at 100%, rgba() below).
- **Strokes:** always **outside** the layer (CSS outline). The banner border stays inside.
- **Image layers:** Fit, plus **Fill banner**, **Fit inside banner**, **Original proportions**. Background image via Banner settings.
- **Multi-size:** add standard/custom sizes from the master (auto-adapt; full-banner layers and components stretch; components respect minSize) or blank; regenerate from master; delete. **Fit warnings** (⚠ in Sizes, notice with suggestion, Hide on this size, checklist warning).
- **Animation:** entrance and exit (fade, slide, grow, shrink, zoom, spin, blur; delay, length, easing, distance). **Emphasis** between them: pulse, vertical bounce, wiggle, flash; **Length = total time, Repeat = cycles within it**; own easing; amount. Times are from the start of the animation.
- **Animation timing** section (Properties, nothing selected): Length, "Repeat animation" to show Plays, **Fit to animations**, Apply to all sizes, total / end / limits line, warnings ("…past the end of the 10 s animation, so they get cut off"). The export checklist uses the same wording.
  - Code names still say loop: `LoopSettings` (AnimationSection.tsx), `fitLoop`, `loopIssues` (model/animation.ts), `animationSettings.loops`. Renaming them is optional and touches many files.
- **Timeline:** one row per layer (amber entrance, purple emphasis, blue exit, red = past the end of the animation); drag bars; **times shown with one decimal** (stored values stay exact, e.g. 0.25 s shows as 0.3 s); header reads `Animation 5.0 s × 1 play = 5.0 s · animations end at 2.0 s`; bar tooltips like `Entrance: Fade, 0.0 s to 1.0 s`; **SNAP** (on by default, 0.1 s); **Shift = 0.5 s**; Alt flips snap for one drag; **zoom** − / % / + or Ctrl + wheel (100–800%), sideways scroll with pinned names; **resizable** by its top edge, snapping to rows (5–8, remembered); playhead and scrubbing in Preview.
- **Preview / Interact:** play, pause, restart, test click, Events pill; toolbar shows `Animation 5.0 s × 1 = 5.0 s`.
- **Space key** (EditorView.tsx): types a space only in text fields. On checkboxes, dropdowns, buttons, sliders and the canvas it **switches Edit / Preview**, unfocuses the control and never ticks, opens or presses it. Works from inside the preview too. Holding Space switches once (repeats are swallowed). Ignored with Ctrl / Cmd / Alt and while a dialog is open (`.modal-backdrop`). Tests: `tests/e2e/space.spec.ts`.
- **Export dialog:** platform, landing URL (optional), sizes, limits, **checklist** (errors / warnings / passed). **Live KB counter** bottom-left.
- **Scrollbars:** thin, dark, amber on hover.

## 7. Components (src/components/, 26 total)

Contract: `ComponentDefinition` in types.ts: settingsSchema (number, slider, color, toggle, select, text, font, date, image, and **group** = repeatable items with sub-settings, tabs or list layout; `when` conditions; hidden fields), slots, presets (+ `hidePresetCards`), capturesPointer, addAsBackground, notice, validate(props, slots), allowedHosts, emits, weightBudgetKB, styles, render, runtime (vanilla JS string registered with `bannr.define`), backupState.

Shared runtime (`bannr.*`): `gesture` (tap = under 10 px and 300 ms; a drag never exits), `loop` (rAF, pauses while hidden), `hint`, `reducedMotion`, `onVisibility`, `define`, `start`, `destroy`. Included **once per banner, only for the component types that size uses**.

| Category | Components |
|---|---|
| Motion | Cascade, Animated Gradient (bottom layer, CSS only), **Gesture** |
| 3D | Cube (+ Half Cube), Flip Card (+ Flip Parallax), Tilt Card (Depth Card, Rocker), Orbit Carousel |
| Carousel | Carousel (Classic, Double, Double Change, Blur, Card Deck, Cube Flow), **Carousel Set** (2–6 slides × 4 image/text layers, per-layer entrances, slide/fade/cube transitions), Card Swipe, Panorama Scroller |
| Reveal | Scratch (canvas), Peel (always-visible curled corner, repeating peek, hover lift, 3D shading), Before/After Wipe (Wipe, 50:50 Box), Hover Reveal, Zoom |
| Widgets | Counter, Countdown (explicit time zone, default Prague), Clock, Lead Form (HTTPS endpoint + privacy link required, consent can't be removed, warning on every platform; preview simulates sending) |
| Games | Memory, Catch Falling Objects, Slice, Drag and Drop. Shared engine: start/win/lose screens, HUD, always-visible **Skip · Shop now**, Play again |

- **Shared arrows and dots** (nav.ts) for Carousel, Carousel Set and Panorama (arrows only): icon, style, size, position, distance, colours, hover-only; dot style, size, position, colours.
- **Gesture:** cursor (hand, mouse pointer, finger dot, touch ring) with fill and **outside** stroke (paint-order), size, shadow. Gestures: tap, double tap, swipe left/right (starts on the right), swipe up/down, one-way swipes, drag A to B, scratch, circle, **hover** (left and right, no press). Repeats, then a Pause during which it **fades out (0.25 s) and reappears at the start position** (no fade if Pause is 0); easing; appear after; stop after (max 30 s). Movement size = % of the banner's shorter side. Hide when: hover or touch (default), touch or click, never. Ripple (off by default), label, optional in backup. Presets: Tap, Swipe, Swipe up and down, Scratch, Drag, Peel, Rotate, Hover; the Components panel shows **one "Gesture" card** (presets in the settings dropdown). Never captures the pointer.

## 8. Delivery workflow and pitfalls

Full rules: **BANNR-PATCH-GUIDE.md**. In short:

- Larger changes come as **bash update scripts inside an HTML artifact** (script in a textarea, Download/Copy buttons, "✔ Complete" check on the last line `exit $STATUS`). Small fixes come as a `cat > .bannr-fix.cjs` Node patch (or a `node -e` one-liner) pasted into Git Bash.
- **Artifact rules:**
  - The chat splits text at a literal HTML doctype line, so long scripts must go in an artifact, never in a markdown code block.
  - **Never put triple backticks inside an artifact**; they end the outer code block and leave the artifact blank.
  - A raw closing script tag inside a script element breaks the artifact: write it as `<\/script>` in TS strings, and HTML-escape the ampersand and less-than characters inside the textarea.
  - Very large artifacts can come out blank: split into parts and keep the payload in a textarea.
- **Patches** use exact find/replace pairs, are skipped if already applied, and fail loudly if the text isn't found. Read the current file (GitHub `main` or `cat`) first; never guess.
  - **The new text must be unique.** The "already applied" check looks for the new text, so a replacement that is a shorter piece of the old text (e.g. deleting part of a line) is always skipped silently. For deletions, check that the old text is gone instead, or replace with a longer unique line.
  - **Count brackets** when a patch rewrites an expression; one extra `)` broke the type check once. `npm run check` catches it.
- **Renames of visible wording:** grep `src` and `tests` for the old text in the same script (unit tests check message strings, e.g. `emphasis.test.ts`, `animation.test.ts`), and update the tests in the same delivery.
- **Tests:**
  - Count elements by their **own attributes** (`data-*`), not by shared class names.
  - Use made-up names like `not-a-component` for "unknown" cases.
  - Account for Fit zoom when dragging in browser tests.
  - Work out expected pixel values from the settings: e.g. Gesture Movement size 40% on a 300×250 banner = 100 px total = 50 px each way (not 40 px).
  - Tell the user the expected test totals after each change (now 245 unit, 63 browser).
- **Line endings:** Windows CRLF breaks bash. Downloading avoids it; when pasting, set VS Code to LF.

## 9. Open items / backlog

1. **Beta-test components** on phone and desktop; troubleshoot one by one.
2. **Real uploads** to each platform to confirm section 5.
3. **Adform event tracking:** wire `trackEvent` once the DHTML call is confirmed (needs the doc page).
4. **Per-face / multiple click tags** (Cube faces, Adform `clickTAG2`, CM360 multiple exits), across all adapters.
5. **Minification** of exported JS/CSS (the clickTag line must stay readable).
6. **Somplo / Motionblender reference:** the demo link (demo.somplo.com/demo/434232369) couldn't be opened. Match the Gesture and Peel motion from screenshots or a recording if needed.
7. **UX ideas offered, not built:** drag a label to change its number; tabs (Design / Animation / Component); changed-setting markers; multi-layer editing; pinned settings; an "Arrange ▾" menu to shorten the toolbar.
8. **Small open choices:** no on/off for idle motion on Cube, Orbit, Panorama etc.; other components still show separate preset cards; a full-banner Lead Form covers the click layer; internal code names still say "loop" (optional rename).
9. **Known limitations:** no dragging layers inside a Carousel Set (fields only); group contents not individually selectable; px bounce heights and slide distances aren't scaled for other sizes; an outside stroke on a full-banner layer is cut off (use the banner border); reduced motion isn't applied to entrance, emphasis and exit; the backup image is the final frame and 3D is drawn flat there; selecting layers under a full-banner Gesture needs the Gesture locked (or use the Layers panel).
