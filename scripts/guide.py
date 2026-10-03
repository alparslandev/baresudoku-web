import datetime
import html
import json
import os
import re
import subprocess

import i18n
from consts import SITE, NAME, AUTHOR, AUTHOR_URL, PERSON_ID, WEBSITE_ID, GAME_ID, OG_IMAGE, SAME_AS, og_locale

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOWTO = "how-to-play"
TECH = "techniques"
GUIDE_SOURCES = ["i18n/guide.json", "src/guide.html", "src/examples.json", "src/practice.json"]
LINK = re.compile(r"\[([^\]]+)\]\(([a-z0-9-]+)\)")
PLACEHOLDER = re.compile(r"\{([A-Za-z0-9]+)\}")
TAG = re.compile(r"<[^>]+>")
S_NAKED, S_BOX, S_LOCKED, S_SUBSET, S_FIXED, S_TECH_EXTRA = 17, 20, 22, 23, 24, 33
HINT_INDEX = {
    "naked-single": S_NAKED, "hidden-single": S_BOX, "locked-candidates": S_LOCKED, "naked-pairs": S_SUBSET, "hidden-pairs": S_SUBSET, "x-wing": S_FIXED, "y-wing": S_FIXED + 1, "swordfish": S_FIXED + 2, "xyz-wing": S_FIXED + 3,
    "skyscraper": S_TECH_EXTRA, "two-string-kite": S_TECH_EXTRA + 1, "w-wing": S_TECH_EXTRA + 2, "unique-rectangle": S_TECH_EXTRA + 3,
    "finned-x-wing": S_TECH_EXTRA + 7, "finned-swordfish": S_TECH_EXTRA + 8, "empty-rectangle": S_TECH_EXTRA + 10, "wxyz-wing": S_TECH_EXTRA + 12, "unique-rectangle-type-4": S_TECH_EXTRA + 15, "hidden-rectangle": S_TECH_EXTRA + 18,
}
UNITS = []
for u in range(9):
    UNITS.append([u * 9 + k for k in range(9)])
for u in range(9):
    UNITS.append([k * 9 + u for k in range(9)])
for u in range(9):
    UNITS.append([(u // 3) * 27 + (u % 3) * 3 + (k // 3) * 9 + (k % 3) for k in range(9)])


def esc(text):
    return html.escape(text, quote=True)


def row(c):
    return c // 9


def col(c):
    return c % 9


def box(c):
    return (c // 27) * 3 + (c % 9) // 3


def ref(c):
    return "r%dc%d" % (row(c) + 1, col(c) + 1)


def digits_of(mask):
    return [d for d in range(1, 10) if mask & (1 << (d - 1))]


def joined(items):
    return ", ".join(str(i) for i in items)


def howto_path(code):
    return i18n.path(code) + HOWTO + "/"


def index_path(code):
    return i18n.path(code) + TECH + "/"


def tech_path(code, slug):
    return index_path(code) + slug + "/"


def page_paths(code):
    return [howto_path(code), index_path(code)] + [tech_path(code, slug) for slug in i18n.TECHNIQUES]


def link_target(code, key):
    if key == "play":
        return i18n.path(code)
    if key == "how-to-play":
        return howto_path(code)
    if key == "techniques":
        return index_path(code)
    return tech_path(code, key)


def rich(text, code):
    return LINK.sub(lambda m: '<a href="%s">%s</a>' % (link_target(code, m.group(2)), m.group(1)), esc(text))


def fill(text, values):
    def sub(m):
        key = m.group(1)
        if key not in values:
            raise SystemExit("bilinmeyen yer tutucu {%s} icinde: %s" % (key, text[:60]))
        return esc(str(values[key]))
    return PLACEHOLDER.sub(sub, esc(text))


def load_examples():
    with open(os.path.join(ROOT, "src", "examples.json"), encoding="utf-8") as f:
        return json.load(f)


def load_practice():
    with open(os.path.join(ROOT, "src", "practice.json"), encoding="utf-8") as f:
        return json.load(f)


def rating_text(code, rating):
    text = "%d.%d" % (rating // 10, rating % 10)
    return text.replace(".", ",") if code in i18n.DECIMAL_COMMA else text


def practice_html(code, entry, site_entry, strings, slug, practice, fallback):
    items = practice.get(slug) or []
    if not items:
        return ""
    labels = entry["labels"]
    heading = labels.get("practice") or fallback["practice"]
    intro = labels.get("practiceIntro") or fallback["practiceIntro"]
    rows = []
    for item in items:
        links = ['<a href="%s?p=%s">%s %s</a>' % (i18n.path(code), item["p"], esc(strings[item["l"]]), rating_text(code, item["r"]))]
        if site_entry.get("solver"):
            links.append('<a href="%ssolver/?p=%s">%s</a>' % (i18n.path(code), item["p"], esc(site_entry["solver"]["link"])))
        rows.append("<li>%s</li>" % " · ".join(links))
    return '<h2>%s</h2><p>%s</p><ol class="practice">%s</ol>' % (esc(heading), fill(intro, {"technique": entry["tech"][slug]["name"]}), "".join(rows))


def unit_label(labels, u):
    if u < 9:
        return labels["row"].replace("{n}", str(u + 1))
    if u < 18:
        return labels["column"].replace("{n}", str(u - 9 + 1))
    return labels["box"].replace("{n}", str(u - 18 + 1))


def params(ex, labels):
    tech, kind = ex["tech"], ex["kind"]
    values = [int(ch) for ch in ex["values"]]
    cells, digits, elim, cands = ex["cells"], ex["digits"], ex["elim"], ex["cands"]
    elim_cells = joined(ref(c) for c, _ in elim)
    elim_items = joined(labels["elimItem"].replace("{d}", str(d)).replace("{cell}", ref(c)) for c, d in elim)
    if tech == "naked-single":
        c = cells[0]

        def placed(unit):
            return joined(sorted(values[k] for k in unit if k != c and values[k]))
        return {"cell": ref(c), "d": digits[0], "row": row(c) + 1, "col": col(c) + 1, "box": box(c) + 1, "rowDigits": placed(UNITS[row(c)]), "colDigits": placed(UNITS[9 + col(c)]), "boxDigits": placed(UNITS[18 + box(c)])}
    if tech == "hidden-single":
        return {"d": digits[0], "box": ex["box"] + 1, "cell": ref(cells[0]), "empties": joined(ref(c) for c in ex["empties"])}
    if tech == "locked-candidates":
        return {"d": digits[0], "box": ex["box"] + 1, "row": ex["line"] + 1, "cells": joined(ref(c) for c in cells), "elim": elim_cells}
    if tech == "naked-pairs" and kind == "pair":
        return {"unit": unit_label(labels, ex["unit"]), "cellA": ref(cells[0]), "cellB": ref(cells[1]), "d1": digits[0], "d2": digits[1], "elim": elim_items}
    if tech == "naked-pairs":
        return {"unit": unit_label(labels, ex["unit"]), "digits": joined(digits), "cells": joined("%s (%s)" % (ref(c), " ".join(str(d) for d in digits_of(cands[c]))) for c in cells), "elim": elim_items}
    if tech == "hidden-pairs":
        return {"unit": unit_label(labels, ex["unit"]), "d1": digits[0], "d2": digits[1], "cells": joined(ref(c) for c in cells), "elim": elim_items}
    if tech == "x-wing":
        return {"d": digits[0], "r1": ex["base"][0] + 1, "r2": ex["base"][1] + 1, "c1": ex["cover"][0] + 1, "c2": ex["cover"][1] + 1, "cells": joined(ref(c) for c in cells), "elim": elim_cells}
    if tech == "swordfish":
        return {"d": digits[0], "rows": joined(r + 1 for r in ex["base"]), "cols": joined(c + 1 for c in ex["cover"]), "cells": joined(ref(c) for c in cells), "elim": elim_cells}
    if tech in ("y-wing", "xyz-wing"):
        return {"pivot": ref(ex["pivot"]), "x": ex["x"], "y": ex["y"], "z": ex["z"], "wingA": ref(ex["wings"][0]), "wingB": ref(ex["wings"][1]), "elim": elim_cells}
    if tech == "skyscraper":
        return {"d": digits[0], "r1": ex["lines"][0] + 1, "r2": ex["lines"][1] + 1, "col": ex["baseLine"] + 1, "baseA": ref(ex["bases"][0]), "baseB": ref(ex["bases"][1]), "topA": ref(ex["tops"][0]), "topB": ref(ex["tops"][1]), "elim": elim_cells}
    if tech == "two-string-kite":
        return {"d": digits[0], "row": ex["row"] + 1, "col": ex["col"] + 1, "box": ex["box"] + 1, "rowEnd": ref(ex["rowEnd"]), "rowInBox": ref(ex["rowInBox"]), "colInBox": ref(ex["colInBox"]), "colEnd": ref(ex["colEnd"]), "elim": elim_cells}
    if tech == "w-wing":
        return {"x": ex["x"], "z": ex["z"], "wingA": ref(ex["wings"][0]), "wingB": ref(ex["wings"][1]), "unit": unit_label(labels, ex["unit"]), "linkA": ref(ex["links"][0]), "linkB": ref(ex["links"][1]), "elim": elim_cells}
    if tech == "unique-rectangle":
        return {"a": digits[0], "b": digits[1], "corners": joined(ref(c) for c in sorted(ex["corners"])), "boxA": ex["boxes"][0] + 1, "boxB": ex["boxes"][1] + 1, "pairCells": joined(ref(c) for c in sorted(ex["floor"])), "target": ref(ex["target"]), "extra": joined(ex["extra"])}
    if tech in ("finned-x-wing", "finned-swordfish"):
        p = {"d": digits[0], "fin": ref(ex["fins"][0]), "finBox": ex["finBox"] + 1, "elim": elim_cells}
        if tech == "finned-x-wing":
            p.update({"r1": ex["base"][0] + 1, "r2": ex["base"][1] + 1, "c1": ex["cover"][0] + 1, "c2": ex["cover"][1] + 1})
        else:
            p.update({"rows": joined(r + 1 for r in ex["base"]), "cols": joined(c + 1 for c in ex["cover"])})
        return p
    if tech == "empty-rectangle":
        return {"d": digits[0], "box": ex["box"] + 1, "row": ex["row"] + 1, "col": ex["col"] + 1, "erA": unit_label(labels, ex["erA"]), "erB": unit_label(labels, ex["erB"]), "linkUnit": unit_label(labels, ex["linkUnit"]), "linkA": ref(ex["linkA"]), "linkB": ref(ex["linkB"]), "elim": elim_cells}
    if tech == "wxyz-wing":
        return {"cells": joined("%s (%s)" % (ref(c), " ".join(str(d) for d in digits_of(cands[c]))) for c in cells), "digits": joined(digits), "z": ex["z"], "others": joined(ex["others"]), "zCells": joined(ref(c) for c in ex["zCells"]), "elim": elim_cells}
    if tech == "unique-rectangle-type-4":
        return {"corners": joined(ref(c) for c in sorted(ex["corners"])), "boxA": sorted(ex["boxes"])[0] + 1, "boxB": sorted(ex["boxes"])[1] + 1, "floor": joined(ref(c) for c in sorted(ex["floor"])), "roof": joined(ref(c) for c in sorted(ex["roof"])), "a": ex["a"], "b": ex["b"], "unit": unit_label(labels, ex["unit"]), "elim": elim_cells}
    if tech == "hidden-rectangle":
        return {"corners": joined(ref(c) for c in sorted(ex["corners"])), "boxA": sorted(ex["boxes"])[0] + 1, "boxB": sorted(ex["boxes"])[1] + 1, "a": ex["a"], "b": ex["b"], "pivot": ref(ex["pivot"]), "target": ref(ex["target"]), "sideA": ref(ex["sideA"]), "sideB": ref(ex["sideB"]), "rowT": row(ex["target"]) + 1, "colT": col(ex["target"]) + 1, "extra": joined(ex["extra"])}
    raise SystemExit("bilinmeyen teknik ornegi: %s" % tech)


def board_html(ex, caption, mode):
    given = [int(ch) for ch in ex["given"]]
    values = [int(ch) for ch in ex["values"]]
    cands = ex["cands"]
    if mode == "regions":
        pattern = set(UNITS[18 + 4])
        unit = set(UNITS[4]) | set(UNITS[9 + 4])
        elim, place = set(), None
    else:
        pattern = set(ex["cells"])
        unit = set(UNITS[ex["unit"]]) if ex.get("unit", -1) >= 0 else set()
        elim = {(c, d) for c, d in ex["elim"]}
        place = tuple(ex["place"]) if ex.get("place") else None
    elim_cells = {c for c, _ in elim}
    out = ['<figure><table class="board"><caption>%s</caption><thead><tr><td></td>%s</tr></thead><tbody>' % (esc(caption), "".join('<th scope="col">c%d</th>' % (k + 1) for k in range(9)))]
    for r in range(9):
        cells = ['<th scope="row">r%d</th>' % (r + 1)]
        for k in range(9):
            c = r * 9 + k
            classes = []
            if c in pattern:
                classes.append("p")
            elif c in unit:
                classes.append("u")
            if c in elim_cells:
                classes.append("e")
            if k % 3 == 0:
                classes.append("bl")
            if k == 8:
                classes.append("br")
            if r % 3 == 0:
                classes.append("bt")
            if r == 8:
                classes.append("bb")
            if values[c]:
                inner = "<b>%d</b>" % values[c] if given[c] else '<span class="v">%d</span>' % values[c]
            elif mode == "regions":
                inner = '<span class="n"></span>'
            else:
                marks = []
                for d in digits_of(cands[c]):
                    tag = "s" if (c, d) in elim else "mark" if place == (c, d) else "i"
                    marks.append('<%s class="d%d">%d</%s>' % (tag, d, d, tag))
                inner = '<span class="n">%s</span>' % "".join(marks)
            cells.append('<td class="%s">%s</td>' % (" ".join(classes), inner))
        out.append("<tr>%s</tr>" % "".join(cells))
    out.append("</tbody></table></figure>")
    return "".join(out)


def hint_text(slug, strings, ex):
    text = strings[HINT_INDEX[slug]]
    return text.replace("#", str(ex["digits"][0])) if "#" in text else text


def faq_html(heading, faq):
    parts = ["<h2>%s</h2>" % esc(heading)]
    for question, answer in faq:
        parts.append("<details><summary>%s</summary><p>%s</p></details>" % (esc(question), esc(answer)))
    return parts


def meta_html(site_entry, modified):
    return '<p class="meta"><a href="%s" rel="author">%s</a> · %s <time datetime="%s">%s</time></p>' % (AUTHOR_URL, esc(site_entry["madeBy"]), esc(site_entry["updated"]), modified, modified)


def howto_body(code, entry, site_entry, examples, modified):
    labels = entry["labels"]
    how = entry["howTo"]
    single = examples["naked-single"][0]
    parts = ["<h1>%s</h1>" % esc(how["h1"]), "<p>%s</p>" % rich(how["summary"], code)]
    for section in how["sections"]:
        parts.append("<h2>%s</h2>" % esc(section["h"]))
        parts += ["<p>%s</p>" % rich(p, code) for p in section["p"]]
        if section.get("list"):
            parts.append("<ol>%s</ol>" % "".join("<li>%s</li>" % rich(item, code) for item in section["list"]))
        if section.get("figure") == "regions":
            parts.append(board_html(single, labels["regions"], "regions"))
        elif section.get("figure") == "firstMove":
            p = params(single, labels)
            parts.append(board_html(single, fill(labels["firstMove"], p), "full"))
            parts.append('<p class="legend">%s</p>' % esc(labels["legend"]))
    parts += faq_html(site_entry["faqHeading"], how["faq"])
    parts.append('<p class="pager"><a href="%s">%s</a><a href="%s">%s</a></p>' % (index_path(code), esc(labels["techniques"]), i18n.path(code), esc(labels["play"])))
    parts.append(meta_html(site_entry, modified))
    return "\n".join(parts)


def index_body(code, entry, site_entry, strings, modified):
    labels = entry["labels"]
    index = entry["index"]
    parts = ["<h1>%s</h1>" % esc(index["h1"])]
    parts += ["<p>%s</p>" % rich(p, code) for p in index["intro"]]
    parts.append("<p>%s</p>" % esc(labels["notation"]))
    items = []
    for slug in i18n.techniques_of(entry):
        t = entry["tech"][slug]
        items.append('<li><a href="%s">%s</a><small>%s</small><br>%s</li>' % (tech_path(code, slug), esc(t["name"]), esc(strings[i18n.TECH_LEVEL[slug]]), esc(t["description"])))
    parts.append('<ol class="techs">%s</ol>' % "".join(items))
    parts += faq_html(site_entry["faqHeading"], index["faq"])
    parts.append('<p class="pager"><a href="%s">%s</a><a href="%s">%s</a></p>' % (howto_path(code), esc(labels["howTo"]), i18n.path(code), esc(labels["play"])))
    parts.append(meta_html(site_entry, modified))
    return "\n".join(parts)


def tech_body(code, entry, site_entry, strings, slug, examples, modified, practice, fallback):
    labels = entry["labels"]
    t = entry["tech"][slug]
    shown = examples[slug]
    parts = ["<h1>%s</h1>" % esc(t["h1"]), "<p>%s</p>" % rich(t["summary"], code)]
    parts.append("<h2>%s</h2>" % esc(labels["when"]))
    parts += ["<p>%s</p>" % rich(p, code) for p in t["when"]]
    parts.append("<h2>%s</h2>" % esc(labels["spot"]))
    parts += ["<p>%s</p>" % rich(p, code) for p in t["spot"]]
    parts.append("<h2>%s</h2>" % esc(labels["example"]))
    for k, (ex, text) in enumerate(zip(shown, t["examples"])):
        if len(shown) > 1:
            parts.append("<h3>%s</h3>" % esc(text["h"]))
        parts.append(board_html(ex, text["h"] if len(shown) > 1 else t["name"], "full"))
        if k == 0:
            parts.append('<p class="legend">%s</p>' % esc(labels["legend"]))
        p = params(ex, labels)
        parts.append('<ol class="steps" aria-label="%s">%s</ol>' % (esc(labels["steps"]), "".join("<li>%s</li>" % fill(step, p) for step in text["steps"])))
    parts.append("<h2>%s</h2><ul>%s</ul>" % (esc(labels["mistakes"]), "".join("<li>%s</li>" % esc(m) for m in t["mistakes"])))
    parts.append("<h2>%s</h2>" % esc(labels["inGame"]))
    parts.append('<p class="facts">%s<br>%s</p>' % (fill(labels["level"], {"level": strings[i18n.TECH_LEVEL[slug]]}), fill(labels["hint"], {"text": hint_text(slug, strings, shown[0])})))
    parts.append('<p class="try">%s</p>' % " · ".join(try_links(code, labels, site_entry, shown[0]["given"])))
    parts.append(practice_html(code, entry, site_entry, strings, slug, practice, fallback))
    parts += faq_html(site_entry["faqHeading"], t["faq"])
    order = i18n.techniques_of(entry)
    k = order.index(slug)
    pager = []
    if k > 0:
        pager.append('<a href="%s" rel="prev">%s: %s</a>' % (tech_path(code, order[k - 1]), esc(labels["prev"]), esc(entry["tech"][order[k - 1]]["name"])))
    pager.append('<a href="%s">%s</a>' % (index_path(code), esc(labels["all"])))
    if k + 1 < len(order):
        pager.append('<a href="%s" rel="next">%s: %s</a>' % (tech_path(code, order[k + 1]), esc(labels["next"]), esc(entry["tech"][order[k + 1]]["name"])))
    parts.append('<p class="pager">%s</p>' % "".join(pager))
    parts.append(meta_html(site_entry, modified))
    return "\n".join(parts)


def try_links(code, labels, site_entry, given):
    links = [(i18n.path(code) + "?p=" + given, labels.get("playExample") or labels["play"])]
    if labels.get("playExample"):
        links.append((i18n.path(code), labels["play"]))
    if site_entry.get("solver"):
        links.append((i18n.path(code) + "solver/?p=" + given, site_entry["solver"]["link"]))
    return ['<a href="%s">%s</a>' % (href, esc(label)) for href, label in links]


def crumbs_html(code, entry, trail):
    parts = ['<a href="%s">%s</a>' % (i18n.path(code), NAME)]
    for label, href in trail[:-1]:
        parts.append('<a href="%s">%s</a>' % (href, esc(label)))
    parts.append('<span aria-current="page">%s</span>' % esc(trail[-1][0]))
    return "<span>›</span>".join(parts)


def word_count(body):
    return len(TAG.sub(" ", body).split())


def jsonld(code, url, title, description, headline, faq, trail, published, modified, body):
    questions = [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]
    crumbs = [{"@type": "ListItem", "position": 1, "name": NAME, "item": SITE + i18n.path(code)}]
    for k, (label, href) in enumerate(trail):
        crumbs.append({"@type": "ListItem", "position": k + 2, "name": label, "item": SITE + href})
    image = {"@type": "ImageObject", "contentUrl": OG_IMAGE, "width": 1200, "height": 630}
    graph = [
        {"@type": "WebSite", "@id": WEBSITE_ID, "url": SITE + "/", "name": NAME, "publisher": {"@id": PERSON_ID}},
        {"@type": "Person", "@id": PERSON_ID, "name": AUTHOR, "alternateName": "alparslandev", "url": AUTHOR_URL, "sameAs": SAME_AS},
        {"@type": ["WebApplication", "VideoGame"], "@id": GAME_ID, "name": NAME, "url": SITE + "/", "applicationCategory": "GameApplication", "genre": "Puzzle", "author": {"@id": PERSON_ID}},
        {
            "@type": ["WebPage", "FAQPage"], "@id": url + "#webpage", "url": url, "name": title, "description": description, "inLanguage": code,
            "datePublished": published, "dateModified": modified, "isPartOf": {"@id": WEBSITE_ID}, "breadcrumb": {"@id": url + "#breadcrumb"},
            "primaryImageOfPage": image, "mainEntity": questions,
        },
        {
            "@type": "Article", "@id": url + "#article", "headline": headline, "description": description, "inLanguage": code,
            "datePublished": published, "dateModified": modified, "author": {"@id": PERSON_ID}, "publisher": {"@id": PERSON_ID},
            "mainEntityOfPage": {"@id": url + "#webpage"}, "image": OG_IMAGE, "isPartOf": {"@id": WEBSITE_ID}, "about": {"@id": GAME_ID},
            "wordCount": word_count(body),
        },
        {"@type": "BreadcrumbList", "@id": url + "#breadcrumb", "itemListElement": crumbs},
    ]
    return json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def run(args, timeout):
    return subprocess.check_output(args, cwd=ROOT, stderr=subprocess.DEVNULL, timeout=timeout).decode("utf-8").strip()


def guide_dates(guide):
    today = datetime.date.today().isoformat()
    first, last, previous = {}, {}, {}
    try:
        history = run(["git", "log", "--format=%H %cs", "--", "i18n/guide.json"], 30).splitlines()
    except Exception:
        history = []
    for line in reversed(history):
        sha, date = line.split()
        try:
            data = json.loads(run(["git", "show", sha + ":i18n/guide.json"], 60))["languages"]
        except Exception:
            continue
        for code, entry in data.items():
            first.setdefault(code, date)
            if previous.get(code) != entry:
                last[code] = date
            previous[code] = entry
    for code, entry in guide.items():
        first.setdefault(code, today)
        if previous.get(code) != entry:
            last[code] = today
    try:
        template_date = run(["git", "log", "-1", "--format=%cs", "--", "src/guide.html", "src/examples.json", "src/practice.json"], 30) or today
        if run(["git", "status", "--porcelain", "--", "src/guide.html", "src/examples.json", "src/practice.json"], 30):
            template_date = today
    except Exception:
        template_date = today
    return {code: (first[code], max(last.get(code, today), template_date)) for code in guide}


def render(template, css, code, url, path, title, description, entry, site_entry, guide, body, jsonld_text, trail, dates, resolve):
    alternates = ['<link rel="alternate" hreflang="%s" href="%s">' % (c, SITE + resolve(c)) for c in guide]
    alternates.append('<link rel="alternate" hreflang="x-default" href="%s">' % (SITE + resolve("en")))
    values = {
        "{{LANG}}": code,
        "{{DIR}}": "rtl" if code in i18n.RTL else "ltr",
        "{{TITLE}}": esc(title),
        "{{DESCRIPTION}}": esc(description),
        "{{URL}}": url,
        "{{ALTERNATES}}": "\n".join(alternates),
        "{{OG_LOCALE}}": og_locale(code),
        "{{OG_ALT}}": esc(site_entry["ogAlt"]),
        "{{PUBLISHED}}": dates[0],
        "{{MODIFIED}}": dates[1],
        "{{JSONLD}}": jsonld_text,
        "{{CSS}}": css,
        "{{CRUMBS_LABEL}}": esc(entry["labels"]["breadcrumb"]),
        "{{CRUMBS}}": crumbs_html(code, entry, trail),
        "{{BODY}}": body,
        "{{LANGUAGES_LABEL}}": esc(site_entry["languagesLabel"]),
        "{{LANGUAGE_LINKS}}": "".join('<a href="%s" hreflang="%s" lang="%s">%s</a>' % (resolve(c), c, c, esc(guide[c]["name"])) for c in guide),
    }
    out = template
    for key, value in values.items():
        out = out.replace(key, value)
    return out


def languages_with(guide, slug):
    return [code for code in guide if slug in guide[code]["tech"]]


def pages(code, entry, site_entry, strings, examples, dates, guide, practice, fallback):
    labels = entry["labels"]
    how = entry["howTo"]
    modified = dates[1]
    yield howto_path(code), how, howto_body(code, entry, site_entry, examples, modified), [(labels["howTo"], howto_path(code))], howto_path, how["faq"], list(guide)
    index = entry["index"]
    yield index_path(code), index, index_body(code, entry, site_entry, strings, modified), [(labels["techniques"], index_path(code))], index_path, index["faq"], list(guide)
    for slug in i18n.techniques_of(entry):
        t = entry["tech"][slug]
        trail = [(labels["techniques"], index_path(code)), (t["name"], tech_path(code, slug))]
        yield tech_path(code, slug), t, tech_body(code, entry, site_entry, strings, slug, examples, modified, practice, fallback), trail, (lambda c, s=slug: tech_path(c, s)), t["faq"], languages_with(guide, slug)


def write_all(write, dist, template, css, guide, site, tables, examples, names):
    dates = guide_dates(guide)
    languages = {code: {"name": names[code]} for code in guide}
    practice = load_practice()
    fallback = guide["en"]["labels"]
    count = 0
    for code, entry in guide.items():
        site_entry = site[code]
        for path, page, body, trail, resolve, faq, codes in pages(code, entry, site_entry, tables[code], examples, dates[code], guide, practice, fallback):
            url = SITE + path
            ld = jsonld(code, url, page["title"], page["description"], page["h1"], faq, trail, dates[code][0], dates[code][1], body)
            out = render(template, css, code, url, path, page["title"], page["description"], entry, site_entry, {c: languages[c] for c in codes}, body, ld, trail, dates[code], resolve)
            write(dist, os.path.join(path.strip("/"), "index.html"), out)
            count += 1
    return count, dates


def learn_block(code, entry, extras=()):
    links = [(howto_path(code), entry["howToLink"]), (index_path(code), entry["techniquesLink"])] + list(extras)
    return "<h2>%s</h2>\n<p>%s %s</p>" % (esc(entry["learnHeading"]), esc(entry["learnText"]), " · ".join('<a href="%s">%s</a>' % (href, esc(label)) for href, label in links))


def sitemap_groups(guide):
    groups = [(HOWTO, howto_path, list(guide)), (TECH, index_path, list(guide))]
    for slug in i18n.TECHNIQUES:
        groups.append((slug, lambda c, s=slug: tech_path(c, s), languages_with(guide, slug)))
    return groups


def header_paths():
    paths = ["/" + HOWTO + "/", "/:lang/" + HOWTO + "/", "/" + TECH + "/", "/:lang/" + TECH + "/", "/solver/", "/:lang/solver/", "/print/", "/:lang/print/"]
    for slug in i18n.TECHNIQUES:
        paths += ["/" + TECH + "/" + slug + "/", "/:lang/" + TECH + "/" + slug + "/"]
    return paths


def plain(text):
    return LINK.sub(lambda m: m.group(1), text)


def llms_lines(entry):
    lines = ["", "## Guides"]
    lines.append("- [%s](%s): %s" % (entry["howTo"]["h1"], SITE + howto_path("en"), plain(entry["howTo"]["description"])))
    lines.append("- [%s](%s): %s" % (entry["index"]["h1"], SITE + index_path("en"), plain(entry["index"]["description"])))
    for slug in i18n.techniques_of(entry):
        t = entry["tech"][slug]
        lines.append("- [%s](%s): %s" % (t["name"], SITE + tech_path("en", slug), plain(t["description"])))
    lines.append("- Guide pages live under the same path as the game page of each language; a page appears in a language once it is translated, and English and Turkish always have every page")
    return lines


def full_text_lines(entry, site_entry, strings, examples):
    labels = entry["labels"]
    how = entry["howTo"]
    lines = ["# " + how["h1"], "", plain(how["summary"])]
    for section in how["sections"]:
        lines += ["", "## " + section["h"]] + [plain(p) for p in section["p"]]
        if section.get("list"):
            lines += ["%d. %s" % (k + 1, plain(item)) for k, item in enumerate(section["list"])]
    lines += ["", "## " + site_entry["faqHeading"]]
    for q, a in how["faq"]:
        lines += ["", "### " + q, a]
    lines += ["", "---", "", "# " + entry["index"]["h1"], ""] + [plain(p) for p in entry["index"]["intro"]] + [labels["notation"], ""]
    for slug in i18n.techniques_of(entry):
        t = entry["tech"][slug]
        lines.append("- %s (%s): %s" % (t["name"], strings[i18n.TECH_LEVEL[slug]], t["description"]))
    lines += ["", "## " + site_entry["faqHeading"]]
    for q, a in entry["index"]["faq"]:
        lines += ["", "### " + q, a]
    for slug in i18n.techniques_of(entry):
        t = entry["tech"][slug]
        lines += ["", "---", "", "# " + t["h1"], "", plain(t["summary"]), "", "## " + labels["when"]] + [plain(p) for p in t["when"]]
        lines += ["", "## " + labels["spot"]] + [plain(p) for p in t["spot"]]
        for ex, text in zip(examples[slug], t["examples"]):
            p = params(ex, labels)
            lines += ["", "## %s: %s" % (labels["example"], text["h"]), "Board (0 = empty): " + ex["values"]]
            lines += ["%d. %s" % (k + 1, html.unescape(fill(step, p))) for k, step in enumerate(text["steps"])]
        lines += ["", "## " + labels["mistakes"]] + ["- " + m for m in t["mistakes"]]
        lines += ["", labels["level"].replace("{level}", strings[i18n.TECH_LEVEL[slug]]), labels["hint"].replace("{text}", hint_text(slug, strings, examples[slug][0]))]
        lines += ["", "## " + site_entry["faqHeading"]]
        for q, a in t["faq"]:
            lines += ["", "### " + q, a]
    return lines
