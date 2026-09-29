import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXED = ["X-Wing", "Y-Wing", "Swordfish", "XYZ-Wing"]
TITLE = "Bare Sudoku"
RTL = ("ar", "fa", "he", "ur", "ps", "sd", "ug", "ckb", "yi", "dv", "azb", "ks", "arz", "pnb")


def path(code):
    return "/" if code == "en" else "/" + code.lower() + "/"


def load():
    with open(os.path.join(ROOT, "i18n", "strings.json"), encoding="utf-8") as f:
        data = json.load(f)
    keys = data["keys"]
    languages = data["languages"]
    for code, values in languages.items():
        if len(values) != len(keys) + 1:
            raise SystemExit("%s: %d deger bekleniyor, %d var" % (code, len(keys) + 1, len(values)))
        for k, v in zip(keys, values[1:]):
            if not v:
                raise SystemExit("%s: %s bos" % (code, k))
            if k in ("naked", "row", "col", "box") and "#" not in v:
                raise SystemExit("%s: %s icinde # yok" % (code, k))
    return keys, languages


def table(keys, values):
    body = values[1:]
    split = keys.index("language")
    return body[:split] + FIXED + [TITLE] + body[split:]


def web(keys, languages):
    order = ["en"] + [c for c in languages if c != "en"]
    return {code: {"name": languages[code][0], "rtl": code in RTL, "s": table(keys, languages[code])} for code in order}


SITE_KEYS = ["title", "description", "h1", "intro", "featuresHeading", "features", "androidHeading", "android", "androidLink", "privacyHeading", "privacy", "faqHeading", "faq", "madeBy", "source", "androidSource", "updated", "languagesLabel", "ogAlt"]
MIN_FEATURES = 6
MIN_FAQ = 11


def load_site(languages):
    with open(os.path.join(ROOT, "i18n", "site.json"), encoding="utf-8") as f:
        site = json.load(f)["languages"]
    for code in languages:
        if code not in site:
            raise SystemExit("site.json: %s eksik" % code)
        entry = site[code]
        for k in SITE_KEYS:
            if not entry.get(k):
                raise SystemExit("site.json %s: %s eksik" % (code, k))
        if len(entry["features"]) < MIN_FEATURES:
            raise SystemExit("site.json %s: en az %d ozellik gerekli" % (code, MIN_FEATURES))
        if len(entry["faq"]) < MIN_FAQ or any(len(p) != 2 or not p[0] or not p[1] for p in entry["faq"]):
            raise SystemExit("site.json %s: en az %d soru, her biri soru ve cevap" % (code, MIN_FAQ))
        if "{size}" not in entry["android"]:
            raise SystemExit("site.json %s: android icinde {size} yok" % code)
    for code in site:
        if code not in languages:
            raise SystemExit("site.json: %s strings.json'da yok" % code)
    return site


if __name__ == "__main__":
    keys, languages = load()
    site = load_site(languages)
    print("%d dil, %d metin, %d site metni" % (len(languages), len(table(keys, languages["en"])), len(SITE_KEYS)))
