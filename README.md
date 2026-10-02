# Bare Sudoku Web

The browser version of [Bare Sudoku](https://baresudoku.com): ad-free Sudoku with five levels (Easy to Master, with the puzzle's difficulty rating next to the level name), notes, undo, hints that explain the logic, digit-first entry (tap a digit, then the cells), every language on its own page, dark mode, keyboard support and offline play. One HTML file, no libraries, no tracking.

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

## Guides

Every language also gets `/how-to-play/`, `/techniques/` and one page per technique (`/techniques/x-wing/` and so on, under the language path for other languages). A technique page appears in a language once it has been translated; English and Turkish always have every page, and the index, the previous and next links, the hreflang links and the sitemaps of a language only count the pages it has. The technique list mirrors the hint engine in `src/engine.js` and follows the order in which the solver tries them (`TECHNIQUES` in `scripts/i18n.py`): singles, locked candidates, pairs and triples, then fish, wings, single-digit patterns such as the Skyscraper and the Empty Rectangle, finned fish, uniqueness patterns such as the Unique Rectangle, its Type 4 and the Hidden Rectangle, and the WXYZ-Wing. Each page shows a real example: `bun scripts/examples.js` generates puzzles, follows the solver until the technique fires and stores the board, candidates and eliminations in `src/examples.json` (existing examples are kept and only missing techniques are searched; `--all` regenerates every one); `test/examples.test.js` checks that the engine still makes the same step. The board is a static HTML table, so the pages contain no script. Each page has its own JSON-LD (WebPage, Article, BreadcrumbList, FAQPage), hreflang links, breadcrumbs, previous and next links and a per-language `dateModified` taken from the git history of `guide.json`.

The build also writes `robots.txt` (AI crawlers allowed, Content-Signal), `sitemap.xml` (an index of one sitemap per page type, each with hreflang links), `llms.txt` (with a Guides section), `llms-full.txt` (the game page text plus the guides in English), `humans.txt`, `.well-known/security.txt`, the IndexNow key file, `_headers` (security headers and the CSP) and `404.html`. `art/render.sh` renders `static/og.png` from `art/og.svg` with rsvg-convert. `bun run deploy` ends with an IndexNow ping.

Cloudflare dashboard settings the site expects: a redirect rule from www to the root domain, AI crawlers allowed in AI Crawl Control, managed robots.txt and Content Signals off, Email Address Obfuscation and Rocket Loader off (they inject scripts the CSP blocks), Crawler Hints on, Web Analytics off.

## Analytics

The site keeps its own anonymous counters. The page sends three events to `POST /api/e` with `navigator.sendBeacon`: `open` (language, touch or pointer device, referring site, first open of the day in that browser), `start` (level) and `done` (level, solve time). No cookies, no IP addresses, no identifiers; automated browsers and bot user agents are ignored, and so are requests without an Accept-Language header, desktop Chrome without client hints and cloud data center networks (`automated` in `worker/index.js`). `worker/index.js` validates the events, adds them to daily counters in a D1 table (`migrations/`) and renders the totals at [baresudoku.com/stats](https://baresudoku.com/stats/), which is public. Only `/api/e`, `/stats/` and unknown paths reach the Worker; everything else is served as a static asset.

To run your own copy: `wrangler d1 create baresudoku`, put the id in `wrangler.jsonc`, then `bun run deploy` applies the migrations and publishes. Locally: `wrangler d1 migrations apply baresudoku --local` and `bun run dev`.

## License

MIT
