# GitHub Universe '26 Highlights

A static, unofficial recap of GitHub Universe 2026 (Oct 28–29, San Francisco): top sessions by topic, every announcement with docs-verified status, and third-party takes. Plain HTML, CSS and a small `app.js` for progressive enhancements (theme toggle, filter tabs, scroll effects). There is no build step, and the content works without JavaScript.

## Pages

| Page | What it is |
| --- | --- |
| `index.html` | Home: key numbers, the big picture, and a way into each page |
| `sessions.html` | Sessions worth your time, ranked, filterable by topic |
| `announcements.html` | Every announcement by topic, with status badges and docs links |
| `voices.html` | What people outside GitHub said, plus a list of more coverage |
| `404.html` | Not-found page (GitHub Pages serves it automatically; self-contained) |

Shared files: `assets/style.css` (theme, dark by default, light via the toggle), `assets/app.js` (theme switch, filter tabs, saved sessions, copy links, deep links, expand/collapse, scroll effects), `assets/octocat.js` (the binary Octocat), `assets/fx.js` (boot screen, headline decode, tilt, cursor glow, matrix mode, toasts), `assets/palette.js` + `assets/search-index.js` (command palette and its generated index), `assets/favicon.svg`.

Every page repeats the same header, nav and footer, so a nav change means editing all four pages.

## Publish on GitHub Pages

1. Push this folder to a repo.
2. Settings → Pages → Source: **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. The site goes live at `https://<user>.github.io/<repo>/`.

## Updating content

The pages are plain static HTML (generated once from verified source blocks, then committed). Announcement status badges follow each feature's docs: `ga`, `preview`, `live` (available), `prog` (in progress), or the default "Announced" when no status is given. Check the linked docs before upgrading a badge, and keep the counts on the home page's Explore cards in step with the lists.

## The binary Octocat

`assets/octocat.js` draws a field of 0s and 1s on a `<canvas class="octo">` and lights an Octocat-style silhouette in it. It is a stylised drawing made for this site, not GitHub's official artwork or logo. Read left to right, top to bottom, the digits inside the silhouette spell `GitHub Universe 2026 ` in 8-bit ASCII.

It is alive: it assembles itself out of scrambling digits, its eyes follow your cursor (and wander when you are idle), it blinks, its tentacles sway, and clicking it sends a shockwave through the digits. It also has a light sweep, shimmer, flicker, a neon outline and a cursor flashlight. It pauses off-screen and in hidden tabs, shows a single static frame when the OS asks for reduced motion, and has an on/off toggle in every page footer (remembered in `localStorage`).

## Playful extras (all optional, all skipped for reduced motion)

- **Boot screen:** a short terminal intro on the home page, once per browser session. Skip with any key or a click. `?boot=1` replays it, `?boot=0` skips it, or use "Replay intro" in the footer.
- **Command palette:** `Ctrl/⌘ K` or `/` searches every page, session, announcement and article, and runs actions (theme, animation, matrix, copy link). `↑ ↓ ↵ Esc` to drive it.
- **Matrix mode:** the Konami code (`↑ ↑ ↓ ↓ ← → ← → B A`), the footer button or the palette. `Esc` leaves.
- **Smaller touches:** headline decode, 3D tilt cards with a cursor glow, a facts ticker, a circular-reveal theme switch, smooth page transitions (Chromium), star-to-save sessions, copy-link buttons on every item (deep links such as `announcements.html#a3` scroll to and highlight the item), and a toast when you poke the Octocat.

## Notes

- Append `?theme=light` or `?theme=dark` to any page URL to force a theme.
- The old single-page anchors `index.html#sessions` and `#voices` redirect to the new pages.
- Statuses on the announcements page come from each feature's docs as of Nov 9, 2026. Many features were public preview at launch.
