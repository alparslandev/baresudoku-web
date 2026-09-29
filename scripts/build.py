import hashlib
import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import i18n
import icons


def read(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as f:
        return f.read()


def main():
    keys, languages = i18n.load()
    strings = json.dumps(i18n.web(keys, languages), ensure_ascii=False, separators=(",", ":"))
    html = read("src", "index.html")
    html = html.replace("{{CSS}}", read("src", "style.css").strip())
    html = html.replace("{{I18N}}", strings)
    html = html.replace("{{ENGINE}}", read("src", "engine.js").strip())
    html = html.replace("{{APP}}", read("src", "app.js").strip())
    digest = hashlib.sha1(html.encode("utf-8")).hexdigest()[:10]
    dist = os.path.join(ROOT, "dist")
    shutil.rmtree(dist, ignore_errors=True)
    os.makedirs(dist)
    with open(os.path.join(dist, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)
    with open(os.path.join(dist, "sw.js"), "w", encoding="utf-8") as f:
        f.write(read("src", "sw.js").replace("{{HASH}}", digest))
    for name in os.listdir(os.path.join(ROOT, "static")):
        shutil.copy(os.path.join(ROOT, "static", name), dist)
    icons.write(dist)
    total = sum(os.path.getsize(os.path.join(dist, n)) for n in os.listdir(dist))
    print("dist hazir: index.html %d bayt, toplam %d bayt, %d dil" % (len(html.encode("utf-8")), total, len(languages)))


if __name__ == "__main__":
    main()
