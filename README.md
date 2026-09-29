# Bare Sudoku Web

The browser version of [Bare Sudoku](https://baresudoku.com): ad-free Sudoku with four levels, notes, undo, hints that explain the logic, digit-first entry (tap a digit, then the cells), every language on its own page, dark mode, keyboard support and offline play. One HTML file, no libraries, no tracking.

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

Game strings for all languages are in `i18n/strings.json`; page texts (title, description, features, FAQ) are in `i18n/site.json`. Adding a language is one line in the first file and one block in the second; the build stops if either is incomplete.

## Pages and SEO

`scripts/build.py` writes one page per language (`/`, `/tr/`, `/de/` and so on) from `src/index.html`: localized title and description, hreflang links for every language, Open Graph and Twitter tags, JSON-LD (WebSite, Person, WebApplication and VideoGame, MobileApplication, SoftwareSourceCode, WebPage and FAQPage) and a text section under the game with features, the Android app, privacy and FAQ. The language of a page comes from its URL; `/` sends browsers with another language to their page once, and the language menu switches pages.

The build also writes `robots.txt` (AI crawlers allowed, Content-Signal), `sitemap.xml` with hreflang, `llms.txt`, `llms-full.txt`, `humans.txt`, `.well-known/security.txt`, the IndexNow key file, `_headers` (security headers and the CSP; the game script is the external `/app.js`, and `connect-src 'self'` is what lets the beacons and the service worker work) and `404.html`. `art/render.sh` renders `static/og.png` from `art/og.svg` with rsvg-convert. `bun run deploy` ends with an IndexNow ping.

Cloudflare dashboard settings the site expects: a redirect rule from www to the root domain, AI crawlers allowed in AI Crawl Control, managed robots.txt and Content Signals off, Email Address Obfuscation and Rocket Loader off (they inject scripts the CSP blocks), Crawler Hints on, Web Analytics off (its injected beacon is blocked by the CSP; the site has its own counters).

## Analytics

The site counts anonymously on its own Worker. The page sends three events with `navigator.sendBeacon` to `POST /api/e`: `open` (language, touch or pointer device, referring host, and whether it is the first open of the day in that browser), `start` (level) and `done` (level, seconds, the day the game started). No cookies, no IP addresses, no identifiers; browsers with `navigator.webdriver` and bot user agents are ignored. `worker/index.js` validates each event and upserts daily counters into the D1 table `counts(day, dim, name, n)` (schema in `migrations/`), with days in Europe/Istanbul. `/stats/` renders the totals for 7, 30 or 90 days or all time; it is public and `noindex`. Static files never reach the Worker; only `/api/e`, `/stats/` and missing paths do, and `_headers` does not apply to Worker responses, so `/stats/` sets its own.

Setup once: `wrangler d1 create baresudoku` and put the id in `wrangler.jsonc`. `bun run deploy` applies pending migrations before publishing. Locally: `wrangler d1 migrations apply baresudoku --local`, then `bun run dev`.

## License

MIT
