# Bare Sudoku Web

The browser version of [Bare Sudoku](https://baresudoku.com): ad-free Sudoku with four levels, notes, undo, hints that explain the logic, 36 languages, dark mode, keyboard support and offline play. One HTML file, no libraries, no tracking.

The Android app lives in [alparslandev/baresudoku](https://github.com/alparslandev/baresudoku).

## Develop

```sh
bun install          # once, for wrangler
bun test             # generator, solver and game state tests
bun run build        # assembles dist/ (single index.html, service worker, icons)
python3 -m http.server -d dist 3021
bun run deploy       # test, build and publish to Cloudflare
```

Strings for all languages are in `i18n/strings.json`; adding a language is one line.

## License

MIT
