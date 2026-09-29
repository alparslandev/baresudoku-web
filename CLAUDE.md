# Bare Sudoku Web

- baresudoku.com: tarayıcıda oynanan sudoku, tek HTML dosyası, kütüphane yok, çevrimdışı çalışır. Android uygulaması ayrı depo (`~/Projects/baresudoku`), APK'ya buradan hiçbir şey girmez.
- Kaynak `src/` (engine.js, app.js, style.css, index.html şablonu, sw.js), diller `i18n/strings.json` (oyun metinleri) ve `i18n/site.json` (sayfa metinleri: başlık, açıklama, özellikler, SSS). Yeni dil = strings.json'a bir satır + site.json'a bir blok; eksikse derleme durur. `scripts/build.py` dil başına bir sayfa üretir (`/`, `/tr/`, `/de/`), her sayfa tek HTML dosyası.
- Test `bun test`, derleme `bun run build`, yayın `bun run deploy` (test + derleme + wrangler). Yerel deneme: `python3 -m http.server -d dist 3021`.
- Metin sırası Android ile aynı: 0-3 seviye, 4 geri al ... 28 başlık, 29 dil, 30 Android, 31 kaynak. Yeni metin eklerken iki depoyu birlikte düşün.
- Giriş kuralı Android ile aynı (Game.key/Game.tap): tuş seçili boş hücreye yazar; yazacak yer yoksa ya da aynı tuşa ikinci basışta rakam kilitlenir ve dokunulan hücrelere yazılır, tekrar basınca çözülür. Android deposundaki Game.java ile birlikte değiştir.
- SEO: her sayfada hreflang (tüm diller + x-default), OG, JSON-LD, oyunun altında `#about` metin bölümü; ayrıca robots.txt, sitemap.xml, llms.txt, llms-full.txt, humans.txt, security.txt, IndexNow anahtar dosyası, `_headers`, 404.html üretilir. Dil URL'den gelir; `/` tarayıcı diline JS ile bir kez yönlendirir; dil menüsü sayfaya gider.
- `_headers`: CSP tek hash, `/*` altında. Script gövdesi dile bağlı olamaz (`I18N` her sayfada aynı). `/*` altına Cache-Control veya Content-Type yazma; aynı başlık iki kuralda olursa virgülle birleşir.
- OG görseli `art/render.sh` ile üretilir ve `static/og.png` commit edilir. Worker `baresudoku` yalnızca bu depodan yayınlanır.
- Kod yorumu yok, em-dash yok, Türkçe konuş, kısa yaz. Her adım ayrı küçük commit, tek satır Türkçe mesaj, amend yok, her commit sonrası push.
