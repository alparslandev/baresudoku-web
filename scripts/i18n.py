import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXED = ["X-Wing", "Y-Wing", "Swordfish", "XYZ-Wing"]
TITLE = "Bare Sudoku"
RTL = ("ar", "fa", "he")


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


if __name__ == "__main__":
    keys, languages = load()
    print("%d dil, %d metin" % (len(languages), len(table(keys, languages["en"]))))
