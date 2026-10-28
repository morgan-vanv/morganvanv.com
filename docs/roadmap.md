# Roadmap

What's being built next, in order, with the decisions already made. This is the "we agreed on this" doc; `ideas-later.md` is the parking lot. When a feature ships, delete its section here and add a line to `decisions.md`.

Agreed 2026-10-25, after PR #74 landed. Theme: **make the site visibly alive** — three features that change on their own.

---

## 1. Last listened — shipped

PR #80. `RecentStreamService` (`src/shared/services/recent-stream.service.ts`) is the shared source for §2's **Listening** row.

## 2. `/now` page — shipped

`src/app/now-page/`. The note lives in `now.content.ts`; it and its "updated" date stay hidden until Morgan adds paragraphs. Its Watched row (most recent, not live) reads the Letterboxd diary (2026-10-27).

## 3. Tonight's sky — shipped

PR #84 (sky, lighting modes, ☾ menu), then PR #85: hover labels, the painting soft-matted and relit for each light, a smooth sky, eased changes of light with a travelling Sun, fog, fireflies, the farmhouse light and a campfire. How it works: `.github/copilot-instructions.md` (Architecture → Tonight's sky). Then look up (hide the page from the ☾ menu) and name a star (visitors suggest names for unnamed stars; Morgan approves with one click from Discord, which opens a PR adding a file to `content/stars/`). What's left is in `ideas-later.md` §4 (Alive).

## 4. Face-lift — shipped

PR #87. The Music/OSRS treatment applied site-wide, plus the layout and mobile pass: compact headers, bands and panel grids, a roomier card, a one-line navbar with a phone pager, Interests tiles with centred live previews, one Music list at a time on phones (toggle buttons), a bigger OSRS character with a 99s bar, the sharp Ada collage, wall thumbnails, the greeting's "come on in" pill, and Lighthouse on mobile. Mockups were approved on the "morganvanv.com face-lift" design canvas; the conventions are in `.github/copilot-instructions.md` (Page layout, breakpoints, Navbar and ☾).

## 5. Visitors take part — shipped

2026-10-26/27, from the interactivity brainstorm (Morgan picked six): Hotline Webring and a real IRC channel (#99), the three-job Contact form and guest subtitles (#100), look up and name a star (#102), free look (#108), visitor content in `content/` with the mailbag on `/social` and one-click "Publish as PR" from Discord (#109, backend #4), Up tonight always on (#113), `/social` conversation first + the webring line under every page + the avatar that speaks (#114), and the campfire: a live shoutbox and the visitor counter on a Cloudflare Worker (#101, backend #2). How it all works: `.github/copilot-instructions.md`; what's left: `ideas-later.md` §4 (Visitors take part) and §3 (Copy pass).

## 6. Projects — shipped

2026-10-28: `/projects` as a showcase (design A, "Marquee", from the face-lift canvas): Valkenburg Castle, VideoJoker and this site as posters, each with live "updated N ago" from GitHub; the first **colophon** at `/colophon` (a side route, off the navbar); `/now` keeps Valkenburg pinned under Building and names whichever repo was pushed to last. What's next for it: `ideas-later.md` §4 (Projects page).

Nothing new is agreed yet; pick the next thing from `ideas-later.md`.

---

## Order and sizing

1 → 2 → 3. §1 is an evening and §2 reuses its service; §3 is the weekend project and the one people will notice. Each ships as its own PR.
