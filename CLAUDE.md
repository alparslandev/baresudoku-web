# Bare Sudoku Web

- baresudoku.com: tarayıcıda oynanan sudoku, tek HTML dosyası, kütüphane yok, çevrimdışı çalışır. Android uygulaması ayrı depo (`~/Projects/baresudoku`), APK'ya buradan hiçbir şey girmez.
- Kaynak `src/` (engine.js, app.js, style.css, index.html şablonu, sw.js), diller `i18n/strings.json` (36 dil, yeni dil = tek satır), `scripts/build.py` hepsini `dist/`e tek dosya olarak birleştirir.
- Test `bun test`, derleme `bun run build`, yayın `bun run deploy` (test + derleme + wrangler). Yerel deneme: `python3 -m http.server -d dist 3021`.
- Metin sırası Android ile aynı: 0-3 seviye, 4 geri al ... 28 başlık, 29 dil, 30 Android, 31 kaynak. Yeni metin eklerken iki depoyu birlikte düşün.
- Kod yorumu yok, em-dash yok, Türkçe konuş, kısa yaz. Her adım ayrı küçük commit, tek satır Türkçe mesaj, amend yok, her commit sonrası push.
