# Bare Sudoku Web

The browser version of [Bare Sudoku](https://baresudoku.com): ad-free Sudoku with five levels (Easy to Master, with the puzzle's difficulty rating next to the level name), notes, undo, hints that explain the logic, digit-first entry (tap a digit, then the cells), every language on its own page, a daily puzzle (`/daily/`, the same puzzle for everyone, generated on the device from the date, with a shareable result), local statistics per level with a daily streak, a clock that pauses after a minute without input, dark mode, keyboard support and offline play. One HTML file, no libraries, no tracking.

The Android app lives in [alparslandev/baresudoku](https://github.com/alparslandev/baresudoku).

## Develop

```sh
bun install          # once, for wrangler
bun test             # generator, solver and game state tests
bun run build        # assembles dist/ (single index.html, service worker, icons)
python3 -m http.server -d dist 3021   # pages only
bun run dev          # wrangler dev: pages, Worker and a local D1 on :8787
bun run deploy       # test, build and publish to Cloudflare
```

Game strings for all languages are in `i18n/strings.json`; page texts (title, description, features, FAQ) are in `i18n/site.json`; the guide texts (how to play, the technique index and one page per technique) are in `i18n/guide.json`. Adding a language is one line in the first file and one block in each of the other two; the build stops if any is incomplete. Translation batches go into separate JSON files and are merged with `python3 scripts/guide_merge.py batch.json`.

## Pages and SEO

`scripts/build.py` writes one page per language (`/`, `/tr/`, `/de/` and so on) from `src/index.html`: localized title and description, hreflang links for every language, Open Graph and Twitter tags, JSON-LD (WebSite, Person, WebApplication and VideoGame, MobileApplication, SoftwareSourceCode, WebPage and FAQPage) and a text section under the game with features, the Android app, privacy and FAQ. The language of a page comes from its URL; `/` sends browsers with another language to their page once, and the language menu switches pages.

## Solver

The daily page also has an archive (`/daily/?d=2026-09-15` plays any past day from 2025 on, with a calendar of what you solved) and a puzzle of the week (`/daily/?w=2026-W41`, a hard Master puzzle taken from `src/weekly.json`, which `bun scripts/weekly.js` generates with a fixed seed). After a daily or weekly puzzle the game shows how many players solved it, their average time and the share of them you beat; the Worker keeps only anonymous counters per puzzle (count, total time and a coarse time histogram) and serves them at `/api/p`. The menu can hide the timer, and on desktop it lists the keyboard shortcuts (`?` opens the list).

`/solver/` (and `/tr/solver/`, for languages with solver texts in `site.json`) is a step-by-step solver built on the same engine: type or paste a puzzle, then step through it or solve it at once. Every step names the technique with its rating and links to its guide page where one exists, the board shows the placement or the eliminated candidates, and the summary gives the level and rating. It runs in the browser only; `?p=` with 81 digits prefills the grid. The script is `dist/solver.js` (engine plus `src/solver.js`).

`/print/` (and `/tr/print/`, for languages with print texts in `site.json`) prints puzzles: pick a level and one, two, four or six puzzles per sheet; the solutions go on a separate page and can be left out. The puzzles come from the same generator, seeded from the `s` parameter, so the link printed at the bottom of the sheet (`?l=3&n=4&s=123456&k=1`) brings back the same puzzles with their solutions, and `?p=` with 81 digits prints that one puzzle. The script is `dist/print.js` (engine plus `src/print.js`).

## Guides

Every language also gets `/how-to-play/`, `/techniques/` and one page per technique (`/techniques/x-wing/` and so on, under the language path for other languages). A technique page appears in a language once it has been translated; English and Turkish always have every page, and the index, the previous and next links, the hreflang links and the sitemaps of a language only count the pages it has. The technique list mirrors the hint engine in `src/engine.js` and follows the order in which the solver tries them (`TECHNIQUES` in `scripts/i18n.py`): singles, locked candidates, pairs and triples, then fish, wings, single-digit patterns such as the Skyscraper and the Empty Rectangle, finned fish, uniqueness patterns such as the Unique Rectangle, its Type 4 and the Hidden Rectangle, and the WXYZ-Wing. Each page shows a real example: `bun scripts/examples.js` generates puzzles, follows the solver until the technique fires and stores the board, candidates and eliminations in `src/examples.json` (existing examples are kept and only missing techniques are searched; `--all` regenerates every one); `test/examples.test.js` checks that the engine still makes the same step. The board is a static HTML table, so the pages contain no script. Each page ends with ten practice puzzles in which that technique is the hardest step needed (`src/practice.json`, generated with a fixed seed by `bun scripts/practice.js` and checked by `test/practice.test.js`); every puzzle links into the game with `?p=` and into the solver. Each page has its own JSON-LD (WebPage, Article, BreadcrumbList, FAQPage), hreflang links, breadcrumbs, previous and next links and a per-language `dateModified` taken from the git history of `guide.json`.

The build also writes `robots.txt` (AI crawlers allowed, Content-Signal), `sitemap.xml` (an index of one sitemap per page type, each with hreflang links), `llms.txt` (with a Guides section), `llms-full.txt` (the game page text plus the guides in English), `humans.txt`, `.well-known/security.txt`, the IndexNow key file, `_headers` (security headers and the CSP) and `404.html`. `art/render.sh` renders `static/og.png` from `art/og.svg` with rsvg-convert. `bun run deploy` ends with an IndexNow ping.

Cloudflare dashboard settings the site expects: a redirect rule from www to the root domain, AI crawlers allowed in AI Crawl Control, managed robots.txt and Content Signals off, Email Address Obfuscation and Rocket Loader off (they inject scripts the CSP blocks), Crawler Hints on, Web Analytics off.

## Analytics

The site keeps its own anonymous counters. The page sends three events to `POST /api/e` with `navigator.sendBeacon`: `open` (language, touch or pointer device, referring site, first open of the day in that browser), `start` (level) and `done` (level, solve time). No cookies, no IP addresses, no identifiers; automated browsers and bot user agents are ignored, and so are requests without an Accept-Language header, desktop Chrome without client hints and cloud data center networks (`automated` in `worker/index.js`). `worker/index.js` validates the events, adds them to daily counters in a D1 table (`migrations/`) and renders the totals at [baresudoku.com/stats](https://baresudoku.com/stats/), which is public. Only `/api/e`, `/stats/` and unknown paths reach the Worker; everything else is served as a static asset.

To run your own copy: `wrangler d1 create baresudoku`, put the id in `wrangler.jsonc`, then `bun run deploy` applies the migrations and publishes. Locally: `wrangler d1 migrations apply baresudoku --local` and `bun run dev`.

## License

MIT
