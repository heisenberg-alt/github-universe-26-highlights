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

Shared files: `assets/style.css` (theme, dark by default, light via the toggle), `assets/app.js` (theme toggle, filter tabs, expand/collapse, back-to-top, animation toggle, scroll effects), `assets/octocat.js` (the binary Octocat background), `assets/favicon.svg`.

Every page repeats the same header, nav and footer, so a nav change means editing all four pages.

## Publish on GitHub Pages

1. Push this folder to a repo.
2. Settings → Pages → Source: **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. The site goes live at `https://<user>.github.io/<repo>/`.

## Updating content

Everything is hand-written HTML. Announcement status badges follow each feature's docs: `ga`, `preview`, `live` (available), `prog` (in progress), or the default "Announced" when no status is given. Check the linked docs before upgrading a badge, and keep the counts on the home page's Explore cards in step with the lists.

## The binary Octocat

`assets/octocat.js` draws a field of 0s and 1s on a `<canvas class="octo">` and lights an Octocat-style silhouette in it. It is a stylised drawing made for this site, not GitHub's official artwork or logo. Read left to right, top to bottom, the digits inside the silhouette spell `GitHub Universe 2026 ` in 8-bit ASCII. Effects: shimmer, a light sweep, flicker, a neon outline and a cursor flashlight. It pauses off-screen and in hidden tabs, shows a single static frame when the OS asks for reduced motion, and has an on/off toggle in every page footer (remembered in `localStorage`).

## Notes

- Append `?theme=light` or `?theme=dark` to any page URL to force a theme.
- The old single-page anchors `index.html#sessions` and `#voices` redirect to the new pages.
- Statuses on the announcements page come from each feature's docs as of Nov 9, 2026. Many features were public preview at launch.
