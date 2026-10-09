import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXED = ["X-Wing", "Y-Wing", "Swordfish", "XYZ-Wing"]
FIXED_EXTRA = ["Skyscraper", "2-String Kite", "W-Wing", "Unique Rectangle", "Naked Quad", "Hidden Quad", "Jellyfish", "Finned X-Wing", "Finned Swordfish", "Finned Jellyfish", "Empty Rectangle", "Remote Pair", "WXYZ-Wing", "Unique Rectangle Type 2", "Unique Rectangle Type 3", "Unique Rectangle Type 4", "Unique Rectangle Type 5", "Unique Rectangle Type 6", "Hidden Rectangle", "BUG+1", "X-Chain", "XY-Chain", "Continuous Nice Loop", "AIC", "Grouped AIC", "Sue de Coq", "ALS-XZ", "ALS-XY-Wing", "Death Blossom", "ALS Chain", "Nishio Forcing Chain", "Cell Forcing Chain", "Unit Forcing Chain", "Dynamic Forcing Net", "Nested Forcing Net", "Sashimi X-Wing", "Sashimi Swordfish", "Sashimi Jellyfish"]
TITLE = "Bare Sudoku"
RTL = ("ar", "fa", "he", "ur", "ps", "sd", "ug", "ckb", "yi", "dv", "azb", "ks", "arz", "pnb", "uz-Arab", "kk-Arab", "ky-Arab", "qxq", "kmz", "fa-AF", "haz", "bal", "khw", "scl", "bsk", "bft")


def path(code):
    return "/" if code == "en" else "/" + code.lower() + "/"


PADDED = {}
STRING_PLACEHOLDERS = {"solvers": "n", "faster": "p"}


def load():
    with open(os.path.join(ROOT, "i18n", "strings.json"), encoding="utf-8") as f:
        data = json.load(f)
    keys = data["keys"]
    languages = data["languages"]
    english = languages["en"]
    if len(english) != len(keys) + 1:
        raise SystemExit("en: %d deger bekleniyor, %d var" % (len(keys) + 1, len(english)))
    for code, values in languages.items():
        if len(values) > len(keys) + 1:
            raise SystemExit("%s: %d deger bekleniyor, %d var" % (code, len(keys) + 1, len(values)))
        if len(values) < len(keys) + 1:
            PADDED[code] = keys[len(values) - 1:]
            values.extend(english[len(values):])
        for k, v in zip(keys, values[1:]):
            if not v:
                raise SystemExit("%s: %s bos" % (code, k))
            if k in ("naked", "row", "col", "box") and "#" not in v:
                raise SystemExit("%s: %s icinde # yok" % (code, k))
            if k in STRING_PLACEHOLDERS and re.findall(r"\{([a-z]+)\}", v) != [STRING_PLACEHOLDERS[k]]:
                raise SystemExit("%s: %s icinde {%s} tam bir kez olmali" % (code, k, STRING_PLACEHOLDERS[k]))
    return keys, languages


def index_of(keys, key):
    split = keys.index("language")
    fixed_end = keys.index("restart") + 1
    k = keys.index(key)
    if k < split:
        return k
    if k < fixed_end:
        return k + len(FIXED) + 1
    return k + len(FIXED) + 1 + len(FIXED_EXTRA)


def table(keys, values):
    body = values[1:]
    split = keys.index("language")
    fixed_end = keys.index("restart") + 1
    return body[:split] + FIXED + [TITLE] + body[split:fixed_end] + FIXED_EXTRA + body[fixed_end:]


def web(keys, languages):
    order = ["en"] + [c for c in languages if c != "en"]
    return {code: {"name": languages[code][0], "rtl": code in RTL, "s": table(keys, languages[code])} for code in order}


SITE_KEYS = ["title", "description", "h1", "intro", "featuresHeading", "features", "androidHeading", "android", "androidLink", "privacyHeading", "privacy", "faqHeading", "faq", "madeBy", "source", "androidSource", "updated", "languagesLabel", "ogAlt"]
DAILY_KEYS = ["dailyTitle", "dailyDescription", "dailyH1", "dailyIntro"]


SOLVER_KEYS = ["title", "description", "h1", "intro", "link", "paste", "next", "solve", "clear", "example", "edit", "noSolution", "manySolutions", "tooFew", "stuck", "done", "placed", "removed", "rating", "steps", "faq"]


def has_solver(entry):
    solver = entry.get("solver")
    if not solver:
        return False
    missing = [k for k in SOLVER_KEYS if not solver.get(k)]
    if missing:
        raise SystemExit("site.json: solver metinleri eksik: %s" % ", ".join(missing))
    for key, needed in (("placed", {"d", "cell"}), ("removed", {"d", "cells"}), ("rating", {"r"}), ("steps", {"n"})):
        if placeholders(solver[key]) != needed:
            raise SystemExit("site.json: solver.%s yer tutuculari %s olmali" % (key, sorted(needed)))
    check_faq("site", "solver", solver["faq"], 2, 6)
    return True


PRINT_KEYS = ["title", "description", "h1", "intro", "link", "level", "count", "solutions", "print", "refresh", "solutionsHeading", "sheet", "faq"]


def has_print(entry):
    texts = entry.get("print")
    if not texts:
        return False
    missing = [k for k in PRINT_KEYS if not texts.get(k)]
    if missing:
        raise SystemExit("site.json: print metinleri eksik: %s" % ", ".join(missing))
    if placeholders(texts["sheet"]) != {"url"}:
        raise SystemExit("site.json: print.sheet yer tutucusu {url} olmali")
    check_faq("site", "print", texts["faq"], 2, 6)
    return True


def has_daily(entry):
    present = [k for k in DAILY_KEYS if entry.get(k)]
    if present and len(present) != len(DAILY_KEYS):
        raise SystemExit("site.json: gunluk sayfa metinleri eksik: %s" % ", ".join(k for k in DAILY_KEYS if k not in present))
    return len(present) == len(DAILY_KEYS)
MIN_FEATURES = 6
MIN_FAQ = 11


ANDROID_TEST_KEYS = ["text", "join", "install", "close"]


def android_test(entry):
    texts = entry.get("androidTest")
    if not texts:
        return None
    missing = [k for k in ANDROID_TEST_KEYS if not texts.get(k)]
    if missing:
        raise SystemExit("site.json: androidTest metinleri eksik: %s" % ", ".join(missing))
    return texts


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


GUIDE_KEYS = ["learnHeading", "learnText", "howToLink", "techniquesLink", "labels", "howTo", "index", "tech"]
GUIDE_LABELS = ["howTo", "techniques", "play", "prev", "next", "all", "example", "steps", "when", "spot", "mistakes", "inGame", "level", "hint", "legend", "notation", "row", "column", "box", "elimItem", "regions", "firstMove", "breadcrumb"]
LABEL_PLACEHOLDERS = {"level": {"level"}, "hint": {"text"}, "row": {"n"}, "column": {"n"}, "box": {"n"}, "elimItem": {"d", "cell"}, "firstMove": {"cell", "d"}, "practiceIntro": {"technique"}}
OPTIONAL_LABELS = ["playExample", "practice", "practiceIntro"]
DECIMAL_COMMA = {"tr", "az", "de", "fr", "es", "pt", "it", "nl", "pl", "cs", "sk", "hu", "ro", "el", "sv", "da", "nb", "fi", "ru", "uk", "bg", "sr", "hr", "id", "vi", "ca", "sl", "lt", "lv", "ky", "kk", "uz", "tk", "tt", "sah", "et"}
TECHNIQUES = ["naked-single", "hidden-single", "locked-candidates", "naked-pairs", "hidden-pairs", "x-wing", "swordfish", "skyscraper", "two-string-kite", "y-wing", "xyz-wing", "w-wing", "unique-rectangle", "finned-x-wing", "empty-rectangle", "unique-rectangle-type-4", "hidden-rectangle", "finned-swordfish", "jellyfish", "wxyz-wing", "bug-plus-1", "x-chain", "xy-chain", "aic", "als-xz"]
TECH_LEVEL = {"naked-single": 0, "hidden-single": 0, "locked-candidates": 2, "naked-pairs": 2, "hidden-pairs": 2, "x-wing": 3, "y-wing": 3, "swordfish": 3, "xyz-wing": 3, "skyscraper": 3, "two-string-kite": 3, "w-wing": 3, "unique-rectangle": 3, "finned-x-wing": 3, "empty-rectangle": 3, "unique-rectangle-type-4": 3, "hidden-rectangle": 3, "finned-swordfish": 3, "wxyz-wing": 3, "jellyfish": 3, "bug-plus-1": 3, "x-chain": 4, "xy-chain": 4, "aic": 4, "als-xz": 4}
OPTIONAL_TECHNIQUES = {"finned-x-wing", "empty-rectangle", "unique-rectangle-type-4", "hidden-rectangle", "finned-swordfish", "wxyz-wing", "jellyfish", "bug-plus-1", "x-chain", "xy-chain", "aic", "als-xz"}
COMPLETE_LANGUAGES = ("en", "tr")
HOWTO_KEYS = ["title", "description", "h1", "summary", "sections", "faq"]
INDEX_KEYS = ["title", "description", "h1", "intro", "faq"]
TECH_KEYS = ["name", "title", "description", "h1", "summary", "when", "spot", "examples", "mistakes", "faq"]
LINK_KEYS = {"play", "how-to-play", "techniques"} | set(TECHNIQUES)
FIGURES = {"regions", "firstMove"}
DASHES = "\u2014\u2013"
DENSE = ("ja", "zh-Hans", "zh-Hant", "ko", "yue", "th", "my", "km", "lo", "bo", "dz")
TITLE_MAX = 65
DESCRIPTION_MIN = 120
DESCRIPTION_MIN_DENSE = 50
DESCRIPTION_MAX = 160
REQUIRE_ALL_GUIDE = True
PLACEHOLDER = re.compile(r"\{([A-Za-z0-9]+)\}")
LINK = re.compile(r"\[([^\]]+)\]\(([a-z0-9-]+)\)")


def fail(code, message):
    raise SystemExit("guide.json %s: %s" % (code, message))


def strings_in(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from strings_in(v)
    elif isinstance(value, list):
        for v in value:
            yield from strings_in(v)


def placeholders(text):
    return set(PLACEHOLDER.findall(text))


def check_page(code, where, entry, keys, dense):
    for k in keys:
        if not entry.get(k):
            fail(code, "%s.%s eksik" % (where, k))
    if len(entry["title"]) > TITLE_MAX:
        fail(code, "%s.title %d karakter, en fazla %d" % (where, len(entry["title"]), TITLE_MAX))
    low = DESCRIPTION_MIN_DENSE if dense else DESCRIPTION_MIN
    n = len(entry["description"])
    if n < low or n > DESCRIPTION_MAX:
        fail(code, "%s.description %d karakter, %d-%d olmali" % (where, n, low, DESCRIPTION_MAX))


def check_faq(code, where, faq, low, high):
    if not isinstance(faq, list) or len(faq) < low or len(faq) > high:
        fail(code, "%s.faq %d-%d soru olmali" % (where, low, high))
    for pair in faq:
        if not isinstance(pair, list) or len(pair) != 2 or not pair[0] or not pair[1]:
            fail(code, "%s.faq her ogesi soru ve cevap olmali" % where)


def check_text_list(code, where, value, low):
    if not isinstance(value, list) or len(value) < low or not all(isinstance(v, str) and v for v in value):
        fail(code, "%s en az %d metin olmali" % (where, low))


def check_guide_entry(code, entry, reference):
    for k in GUIDE_KEYS:
        if not entry.get(k):
            fail(code, "%s eksik" % k)
    for text in strings_in(entry):
        if any(ch in text for ch in DASHES):
            fail(code, "uzun cizgi var: " + text[:60])
        if "{{" in text:
            fail(code, "cift suslu parantez: " + text[:60])
        for label, key in LINK.findall(text):
            if key not in LINK_KEYS:
                fail(code, "bilinmeyen baglanti anahtari %s" % key)
    labels = entry["labels"]
    for k in GUIDE_LABELS:
        if not labels.get(k):
            fail(code, "labels.%s eksik" % k)
    for k in GUIDE_LABELS + [k for k in OPTIONAL_LABELS if labels.get(k)]:
        if placeholders(labels[k]) != LABEL_PLACEHOLDERS.get(k, set()):
            fail(code, "labels.%s yer tutuculari %s olmali" % (k, sorted(LABEL_PLACEHOLDERS.get(k, set()))))
    dense = code in DENSE
    how = entry["howTo"]
    check_page(code, "howTo", how, HOWTO_KEYS, dense)
    ref_sections = reference["howTo"]["sections"]
    if not isinstance(how["sections"], list) or len(how["sections"]) != len(ref_sections):
        fail(code, "howTo.sections %d bolum olmali" % len(ref_sections))
    for i, (section, ref_section) in enumerate(zip(how["sections"], ref_sections)):
        if not section.get("h"):
            fail(code, "howTo.sections[%d].h eksik" % i)
        check_text_list(code, "howTo.sections[%d].p" % i, section.get("p"), 1)
        if "list" in ref_section:
            check_text_list(code, "howTo.sections[%d].list" % i, section.get("list"), len(ref_section["list"]))
        if section.get("figure") != ref_section.get("figure"):
            fail(code, "howTo.sections[%d].figure %s olmali" % (i, ref_section.get("figure")))
    check_faq(code, "howTo", how["faq"], 4, 6)
    index = entry["index"]
    check_page(code, "index", index, INDEX_KEYS, dense)
    check_text_list(code, "index.intro", index["intro"], 2)
    check_faq(code, "index", index["faq"], 3, 5)
    tech = entry["tech"]
    for slug in TECHNIQUES:
        if slug not in tech:
            if slug in OPTIONAL_TECHNIQUES and code not in COMPLETE_LANGUAGES:
                continue
            fail(code, "tech.%s eksik" % slug)
        t = tech[slug]
        r = reference["tech"][slug]
        check_page(code, "tech." + slug, t, TECH_KEYS, dense)
        check_text_list(code, "tech.%s.when" % slug, t["when"], 1)
        check_text_list(code, "tech.%s.spot" % slug, t["spot"], 1)
        check_text_list(code, "tech.%s.mistakes" % slug, t["mistakes"], 2)
        check_faq(code, "tech." + slug, t["faq"], 3, 5)
        if not isinstance(t["examples"], list) or len(t["examples"]) != len(r["examples"]):
            fail(code, "tech.%s.examples %d ornek olmali" % (slug, len(r["examples"])))
        for i, (example, ref_example) in enumerate(zip(t["examples"], r["examples"])):
            if not example.get("h"):
                fail(code, "tech.%s.examples[%d].h eksik" % (slug, i))
            check_text_list(code, "tech.%s.examples[%d].steps" % (slug, i), example.get("steps"), len(ref_example["steps"]))
            if len(example["steps"]) != len(ref_example["steps"]):
                fail(code, "tech.%s.examples[%d].steps %d adim olmali" % (slug, i, len(ref_example["steps"])))
            allowed = set()
            for step in ref_example["steps"]:
                allowed |= placeholders(step)
            used = set()
            for step in example["steps"]:
                extra = placeholders(step) - allowed
                if extra:
                    fail(code, "tech.%s.examples[%d] bilinmeyen yer tutucu %s" % (slug, i, sorted(extra)))
                used |= placeholders(step)
            if used != allowed:
                fail(code, "tech.%s.examples[%d] eksik yer tutucu %s" % (slug, i, sorted(allowed - used)))
    for k in tech:
        if k not in TECHNIQUES:
            fail(code, "tech.%s bilinmiyor" % k)


def techniques_of(entry):
    return [slug for slug in TECHNIQUES if slug in entry["tech"]]


def guide_file():
    return os.path.join(ROOT, "i18n", "guide.json")


def load_guide(languages):
    with open(guide_file(), encoding="utf-8") as f:
        guide = json.load(f)["languages"]
    if "en" not in guide:
        raise SystemExit("guide.json: en eksik")
    for code, entry in guide.items():
        if code not in languages:
            raise SystemExit("guide.json: %s strings.json'da yok" % code)
        check_guide_entry(code, entry, guide["en"])
    if REQUIRE_ALL_GUIDE:
        for code in languages:
            if code not in guide:
                raise SystemExit("guide.json: %s eksik" % code)
    return {code: guide[code] for code in languages if code in guide}


if __name__ == "__main__":
    keys, languages = load()
    if len(sys.argv) == 3 and sys.argv[1] == "table":
        print(json.dumps(table(keys, languages[sys.argv[2]]), ensure_ascii=False))
    else:
        site = load_site(languages)
        guide = load_guide(languages)
        print("%d dil, %d metin, %d site metni, %d rehber dili" % (len(languages), len(table(keys, languages["en"])), len(SITE_KEYS), len(guide)))
