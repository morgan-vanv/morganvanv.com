# Roadmap

What's being built next, in order, with the decisions already made. This is the "we agreed on this" doc; `ideas-later.md` is the parking lot. When a feature ships, delete its section here and add a line to `decisions.md`.

Agreed 2026-10-25, after PR #74 landed. Theme: **make the site visibly alive** — three features that change on their own.

---

## 1. Last listened — shipped

PR #80. `RecentStreamService` (`src/shared/services/recent-stream.service.ts`) is the shared source for §2's **Listening** row.

## 2. `/now` page — shipped

`src/app/now-page/`. The note lives in `now.content.ts`; it and its "updated" date stay hidden until Morgan adds paragraphs. The Watching row slots in once the Letterboxd feed exists (`ideas-later.md` §3).

## 3. Tonight's sky — built, in review

Branch `feature/tonights-sky`. Code in `src/shared/sky/`; how it works is in `.github/copilot-instructions.md` (Architecture → Tonight's sky). Where it differs from the plan agreed on 2026-10-25:

- **No `sky-fallback.webp`.** `background.webp` is untouched and stays the first paint and the fallback; the live sky fades in over it. `foreground.webp` is cut from it by `scripts/cut-foreground.py` (a fully automatic cut; no hand-fixed edge was needed).
- **Field of view:** east-to-west across the screen width on landscape screens (180°, not ~120°), horizon-to-zenith on portrait ones. Stereographic, so constellations keep their shapes; Orion read better at this size.
- **Toggle on the greeting page only**, small print under the arrow button, where it can't collide with page cards. It holds its space but stays invisible until the sky has drawn.
- **Daylight readability:** a bright sky made card text hard to read, so page cards (`base-page`) darken as the Sun rises, driven by a `--daylight` custom property (0–1) that `app-sky` sets on `<html>`.
- **The Sun is drawn too** when it's up, and the trees brighten a little in daylight. Easy to remove.
- **`?sky-at=<ISO time>`** pins the sky to a moment, for checking noon, dusk or winter.
- **Moon test:** instead of a published Moon alt/az, the test checks the Moon covers the Sun at totality in Dayton on 2024-04-08 (against the app's own Sun formula, which shares no code with astronomy-engine).

**Nice-to-haves after v1:** moved to `ideas-later.md` §4 (Alive).

---

## Order and sizing

1 → 2 → 3. §1 is an evening and §2 reuses its service; §3 is the weekend project and the one people will notice. Each ships as its own PR.
