import datetime
import hashlib
import html
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import i18n
import icons
import indexnow

SITE = "https://baresudoku.com"
NAME = "Bare Sudoku"
AUTHOR = "Alparslan Selçuk Develioğlu"
AUTHOR_URL = "https://devdiscipline.com/about"
AUTHOR_LINKS = [
    ("LinkedIn", "https://www.linkedin.com/in/alparslandev/"),
    ("Instagram", "https://www.instagram.com/alparslandev"),
    ("DevDiscipline", "https://devdiscipline.com"),
    ("Yarış Radarı", "https://yarisradari.com"),
]
PERSON_ID = SITE + "/#person"
WEBSITE_ID = SITE + "/#website"
GAME_ID = SITE + "/#game"
ANDROID_ID = SITE + "/#android"
WEB_REPO = "https://github.com/alparslandev/baresudoku-web"
ANDROID_REPO = "https://github.com/alparslandev/baresudoku"
APK_URL = ANDROID_REPO + "/releases/latest/download/baresudoku.apk"
SCREENSHOT = "https://raw.githubusercontent.com/alparslandev/baresudoku/main/screenshot.png"
OG_IMAGE = SITE + "/og.png"
LICENSE_URL = WEB_REPO + "/blob/main/LICENSE"
ANDROID_LICENSE_URL = ANDROID_REPO + "/blob/main/LICENSE"
APK_FALLBACK = ("1.2", 24972)
APP_STORE_URL = ""
SAME_AS = ["https://github.com/alparslandev"] + [url for _, url in AUTHOR_LINKS] + ["https://www.youtube.com/@alparslandev"]
OG_LOCALES = {
    "en": "en_US", "tr": "tr_TR", "az": "az_AZ", "de": "de_DE", "fr": "fr_FR", "es": "es_ES", "pt": "pt_PT", "it": "it_IT",
    "nl": "nl_NL", "pl": "pl_PL", "cs": "cs_CZ", "sk": "sk_SK", "hu": "hu_HU", "ro": "ro_RO", "el": "el_GR", "sv": "sv_SE",
    "da": "da_DK", "nb": "nb_NO", "fi": "fi_FI", "ru": "ru_RU", "uk": "uk_UA", "bg": "bg_BG", "sr": "sr_RS", "hr": "hr_HR",
    "ar": "ar_AR", "fa": "fa_IR", "he": "he_IL", "hi": "hi_IN", "bn": "bn_BD", "id": "id_ID", "ms": "ms_MY", "vi": "vi_VN",
    "th": "th_TH", "ja": "ja_JP", "ko": "ko_KR", "zh-Hans": "zh_CN", "zh-Hant": "zh_TW",
    "ur": "ur_PK", "pa": "pa_IN", "ta": "ta_IN", "te": "te_IN", "mr": "mr_IN", "gu": "gu_IN", "kn": "kn_IN", "ml": "ml_IN",
    "tl": "tl_PH", "jv": "jv_ID", "sw": "sw_KE", "my": "my_MM", "ca": "ca_ES", "sl": "sl_SI", "lt": "lt_LT", "lv": "lv_LV",
    "et": "et_EE", "sq": "sq_AL", "mk": "mk_MK", "bs": "bs_BA", "ka": "ka_GE", "hy": "hy_AM", "kk": "kk_KZ", "uz": "uz_UZ",
    "ky": "ky_KG", "tg": "tg_TJ", "mn": "mn_MN", "ne": "ne_NP", "si": "si_LK", "km": "km_KH", "lo": "lo_LA", "am": "am_ET",
    "ha": "ha_NG", "yo": "yo_NG", "ig": "ig_NG", "zu": "zu_ZA", "af": "af_ZA", "is": "is_IS", "ga": "ga_IE", "cy": "cy_GB",
    "eu": "eu_ES", "gl": "gl_ES", "mt": "mt_MT", "lb": "lb_LU", "be": "be_BY", "so": "so_SO", "xh": "xh_ZA", "ht": "ht_HT",
    "eo": "eo_EO", "la": "la_VA", "yi": "yi_DE", "ps": "ps_AF", "ku": "ku_TR", "ckb": "ckb_IQ", "ug": "ug_CN", "sd": "sd_PK",
    "tk": "tk_TM", "tt": "tt_RU", "ba": "ba_RU", "mi": "mi_NZ", "sm": "sm_WS", "to": "to_TO", "haw": "haw_US", "fj": "fj_FJ",
    "or": "or_IN", "as": "as_IN", "dv": "dv_MV", "ceb": "ceb_PH", "su": "su_ID", "st": "st_ZA", "sn": "sn_ZW", "rw": "rw_RW",
    "mg": "mg_MG", "ny": "ny_MW", "ti": "ti_ET", "om": "om_ET", "wo": "wo_SN", "ln": "ln_CD", "tn": "tn_BW", "ts": "ts_ZA",
    "lg": "lg_UG", "ak": "ak_GH", "ee": "ee_GH", "fo": "fo_FO", "gd": "gd_GB", "br": "br_FR", "oc": "oc_FR", "fy": "fy_NL",
    "qu": "qu_PE", "gn": "gn_PY", "ay": "ay_BO", "hmn": "hmn_US", "cv": "cv_RU", "os": "os_RU", "ce": "ce_RU",
}
BOTS = [
    "Googlebot", "Bingbot", "Applebot", "DuckDuckBot", "YandexBot", "Google-Extended", "GoogleOther", "GPTBot", "OAI-SearchBot",
    "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "anthropic-ai", "PerplexityBot", "Perplexity-User",
    "Applebot-Extended", "DuckAssistBot", "Amazonbot", "meta-externalagent", "meta-externalfetcher", "CCBot", "cohere-ai",
    "MistralAI-User", "YouBot", "Bytespider", "PetalBot",
]
CONTENT_SIGNAL = "Content-Signal: search=yes, ai-input=yes, ai-train=yes"
CSP = "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
DISCOVERY_CACHE = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
TEXT_TYPES = (".html", ".txt", ".xml", ".webmanifest")


def read(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as f:
        return f.read()


def write(dist, rel, text):
    target = os.path.join(dist, rel)
    os.makedirs(os.path.dirname(target), exist_ok=True)
    with open(target, "w", encoding="utf-8") as f:
        f.write(text)


def url_of(code):
    return SITE + i18n.path(code)


def privacy_path(code):
    return i18n.path(code) + "privacy/"


def privacy_url(code):
    return SITE + privacy_path(code)


def store_link():
    return ' · <a href="%s">App Store</a>' % APP_STORE_URL if APP_STORE_URL else ""


def og_locale(code):
    if code in OG_LOCALES:
        return OG_LOCALES[code]
    base = code.split("-")[0].lower()
    return base + "_" + code.split("-")[-1].upper()


def esc(text):
    return html.escape(text, quote=True)


def fill(text, version, size):
    return text.replace("{version}", version).replace("{size}", str(size))


def run(args, timeout):
    return subprocess.check_output(args, cwd=ROOT, stderr=subprocess.DEVNULL, timeout=timeout).decode("utf-8").strip()


def lastmod_date():
    try:
        value = run(["git", "log", "-1", "--format=%cs", "--", "src", "i18n", "static"], 10)
    except Exception:
        value = ""
    return value or datetime.date.today().isoformat()


def web_version():
    try:
        return "1." + run(["git", "rev-list", "--count", "HEAD"], 10)
    except Exception:
        return "1.0"


def android_release():
    try:
        value = run(["gh", "api", "repos/alparslandev/baresudoku/releases/latest", "--jq", '.tag_name + " " + ([.assets[] | select(.name == "baresudoku.apk") | .size] | first | tostring)'], 15)
        tag, size = value.split()
        return tag.lstrip("v"), int(size)
    except Exception:
        return APK_FALLBACK


def kilobytes(size_bytes):
    return (size_bytes + 500) // 1000


def language_links(languages):
    return "".join('<a href="%s" hreflang="%s" lang="%s">%s</a>' % (i18n.path(code), code, code, esc(languages[code][0])) for code in languages)


def content(code, entry, languages, version, size, lastmod, web):
    def f(text):
        return esc(fill(text, version, size))
    parts = ['<section id="about">', "<h1>%s</h1>" % f(entry["h1"]), "<p>%s</p>" % f(entry["intro"])]
    parts.append("<h2>%s</h2>" % f(entry["featuresHeading"]))
    parts.append("<ul>%s</ul>" % "".join("<li>%s</li>" % f(item) for item in entry["features"]))
    parts.append("<h2>%s</h2>" % f(entry["androidHeading"]))
    parts.append('<p>%s <a href="%s">%s</a></p>' % (f(entry["android"]), APK_URL, f(entry["androidLink"])))
    parts.append("<h2>%s</h2>" % f(entry["privacyHeading"]))
    parts.append("<p>%s</p>" % f(entry["privacy"]))
    parts.append("<h2>%s</h2>" % f(entry["faqHeading"]))
    for question, answer in entry["faq"]:
        parts.append("<details><summary>%s</summary><p>%s</p></details>" % (f(question), f(answer)))
    author_links = "".join(' · <a href="%s" rel="me">%s</a>' % (url, esc(label)) for label, url in AUTHOR_LINKS)
    parts.append('<p class="meta">%s%s · Web %s · Android %s%s · <a href="%s">%s</a> · <a href="%s">%s</a> · <a href="%s">%s</a> · %s <time datetime="%s">%s</time></p>' % (
        f(entry["madeBy"]), author_links, web, version, store_link(), WEB_REPO, f(entry["source"]), ANDROID_REPO, f(entry["androidSource"]), privacy_path(code), f(entry["privacyHeading"]), f(entry["updated"]), lastmod, lastmod))
    parts.append('<nav aria-label="%s">%s</nav>' % (f(entry["languagesLabel"]), language_links(languages)))
    parts.append("</section>")
    return "\n".join(parts)


def offer():
    return {"@type": "Offer", "price": "0", "priceCurrency": "USD"}


def jsonld(code, entry, languages, version, size, lastmod, web):
    def f(text):
        return fill(text, version, size)
    codes = list(languages)
    faq = [{"@type": "Question", "name": f(q), "acceptedAnswer": {"@type": "Answer", "text": f(a)}} for q, a in entry["faq"]]
    graph = [
        {"@type": "WebSite", "@id": WEBSITE_ID, "url": SITE + "/", "name": NAME, "inLanguage": codes, "publisher": {"@id": PERSON_ID}},
        {"@type": "Person", "@id": PERSON_ID, "name": AUTHOR, "alternateName": "alparslandev", "url": AUTHOR_URL, "sameAs": SAME_AS},
        {
            "@type": ["WebApplication", "VideoGame"], "@id": GAME_ID, "name": NAME, "url": SITE + "/", "description": f(entry["description"]),
            "applicationCategory": "GameApplication", "genre": "Puzzle", "gamePlatform": "Web browser", "playMode": "SinglePlayer",
            "numberOfPlayers": {"@type": "QuantitativeValue", "value": 1}, "operatingSystem": "Any", "browserRequirements": "Requires JavaScript",
            "isAccessibleForFree": True, "isFamilyFriendly": True, "offers": offer(), "inLanguage": codes, "softwareVersion": web,
            "featureList": [f(item) for item in entry["features"]], "image": OG_IMAGE, "dateModified": lastmod, "license": LICENSE_URL,
            "sameAs": WEB_REPO, "author": {"@id": PERSON_ID}, "publisher": {"@id": PERSON_ID},
        },
        {
            "@type": "MobileApplication", "@id": ANDROID_ID, "name": NAME + " for Android", "description": f(entry["android"]), "url": ANDROID_REPO,
            "applicationCategory": "GameApplication", "operatingSystem": "Android 8.0 or later", "softwareVersion": version, "fileSize": "%d KB" % size,
            "downloadUrl": APK_URL, "installUrl": APK_URL, "releaseNotes": ANDROID_REPO + "/releases", "permissions": "none",
            "isAccessibleForFree": True, "offers": offer(), "license": ANDROID_LICENSE_URL, "identifier": "com.baresudoku",
            "screenshot": {"@type": "ImageObject", "contentUrl": SCREENSHOT, "width": 320, "height": 720}, "sameAs": ANDROID_REPO,
            "author": {"@id": PERSON_ID},
        },
        {
            "@type": "SoftwareSourceCode", "@id": SITE + "/#web-source", "name": NAME + " web source code", "codeRepository": WEB_REPO,
            "programmingLanguage": "JavaScript", "runtimePlatform": "Web browser", "license": LICENSE_URL, "targetProduct": {"@id": GAME_ID},
            "author": {"@id": PERSON_ID},
        },
        {
            "@type": "SoftwareSourceCode", "@id": SITE + "/#android-source", "name": NAME + " Android source code", "codeRepository": ANDROID_REPO,
            "programmingLanguage": "Java", "runtimePlatform": "Android", "license": ANDROID_LICENSE_URL, "targetProduct": {"@id": ANDROID_ID},
            "author": {"@id": PERSON_ID},
        },
        {
            "@type": ["WebPage", "FAQPage"], "@id": url_of(code) + "#webpage", "url": url_of(code), "name": f(entry["title"]),
            "description": f(entry["description"]), "inLanguage": code, "dateModified": lastmod, "isPartOf": {"@id": WEBSITE_ID},
            "about": {"@id": GAME_ID}, "primaryImageOfPage": {"@type": "ImageObject", "contentUrl": OG_IMAGE, "width": 1200, "height": 630},
            "mainEntity": faq,
        },
    ]
    return json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def page(template, css, table, code, entry, languages, version, size, lastmod, web):
    def f(text):
        return esc(fill(text, version, size))
    alternates = ['<link rel="alternate" hreflang="%s" href="%s">' % (c, url_of(c)) for c in languages]
    alternates.append('<link rel="alternate" hreflang="x-default" href="%s/">' % SITE)
    options = "".join('<option value="%s">%s</option>' % (c, esc(languages[c][0])) for c in languages)
    local = {"name": languages[code][0], "rtl": code in i18n.RTL, "s": table[code]}
    values = {
        "{{LANG}}": code,
        "{{DIR}}": "rtl" if code in i18n.RTL else "ltr",
        "{{TITLE}}": f(entry["title"]),
        "{{DESCRIPTION}}": f(entry["description"]),
        "{{URL}}": url_of(code),
        "{{ALTERNATES}}": "\n".join(alternates),
        "{{OG_LOCALE}}": og_locale(code),
        "{{OG_ALT}}": f(entry["ogAlt"]),
        "{{JSONLD}}": jsonld(code, entry, languages, version, size, lastmod, web),
        "{{CONTENT}}": content(code, entry, languages, version, size, lastmod, web),
        "{{WEB_VERSION}}": web,
        "{{CSS}}": css,
        "{{OPTIONS}}": options,
        "{{L}}": json.dumps(local, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c"),
    }
    out = template
    for key, value in values.items():
        out = out.replace(key, value)
    return out


def headers_file():
    lines = [
        "/*",
        "  Strict-Transport-Security: max-age=31536000; includeSubDomains",
        "  X-Content-Type-Options: nosniff",
        "  X-Frame-Options: DENY",
        "  Referrer-Policy: strict-origin-when-cross-origin",
        "  Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
        "  Cross-Origin-Opener-Policy: same-origin",
        "  Content-Security-Policy: " + CSP,
        "/404",
        "  X-Robots-Tag: noindex",
    ]
    for path, content_type in (
        ("/robots.txt", "text/plain; charset=utf-8"),
        ("/sitemap.xml", "application/xml; charset=utf-8"),
        ("/llms.txt", "text/plain; charset=utf-8"),
        ("/llms-full.txt", "text/plain; charset=utf-8"),
        ("/humans.txt", "text/plain; charset=utf-8"),
        ("/.well-known/security.txt", "text/plain; charset=utf-8"),
    ):
        lines += [path, "  Content-Type: " + content_type, "  Cache-Control: " + DISCOVERY_CACHE]
    lines += ["/manifest.webmanifest", "  Content-Type: application/manifest+json; charset=utf-8", "  Cache-Control: public, max-age=86400"]
    for path in ("/icon.svg", "/favicon.ico", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", "/og.png"):
        lines += [path, "  Cache-Control: public, max-age=2592000"]
    return "\n".join(lines) + "\n"


def robots_file():
    lines = ["User-agent: *", CONTENT_SIGNAL, "Allow: /", ""]
    lines += ["User-agent: " + bot for bot in BOTS]
    lines += [CONTENT_SIGNAL, "Allow: /", "", "Sitemap: %s/sitemap.xml" % SITE]
    return "\n".join(lines) + "\n"


def alternate_links(languages, resolve, tag):
    links = [tag % (c, resolve(c)) for c in languages]
    links.append(tag % ("x-default", resolve("en")))
    return links


def sitemap_file(languages, lastmod):
    urls = ""
    for resolve in (url_of, privacy_url):
        urls += "".join("<url><loc>%s</loc><lastmod>%s</lastmod></url>\n" % (resolve(c), lastmod) for c in languages)
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s</urlset>\n' % urls


def privacy_page(template, css, code, entry, languages, lastmod):
    def f(text):
        return esc(text)
    body = ["<p>%s</p>" % f(entry["privacy"])]
    if entry.get("privacyExtra"):
        body.append("<p>%s</p>" % f(entry["privacyExtra"]))
    body.append('<p><a href="%s/issues">GitHub</a></p>' % WEB_REPO)
    values = {
        "{{LANG}}": code,
        "{{DIR}}": "rtl" if code in i18n.RTL else "ltr",
        "{{TITLE}}": f(entry["privacyHeading"]) + " · " + NAME,
        "{{DESCRIPTION}}": f(entry["privacy"]),
        "{{URL}}": privacy_url(code),
        "{{ALTERNATES}}": "\n".join(alternate_links(languages, privacy_url, '<link rel="alternate" hreflang="%s" href="%s">')),
        "{{CSS}}": css,
        "{{HEADING}}": f(entry["privacyHeading"]),
        "{{BODY}}": "\n".join(body),
        "{{HOME}}": i18n.path(code),
        "{{LASTMOD}}": lastmod,
        "{{LANGUAGES_LABEL}}": f(entry["languagesLabel"]),
        "{{LANGUAGE_LINKS}}": "".join('<a href="%s" hreflang="%s" lang="%s">%s</a>' % (privacy_path(c), c, c, esc(languages[c][0])) for c in languages),
    }
    out = template
    for key, value in values.items():
        out = out.replace(key, value)
    return out


def llms_file(site, languages, version, size, lastmod, web):
    en = site["en"]
    lines = ["# " + NAME, "", "> " + fill(en["description"], version, size), "", fill(en["intro"], version, size), "", "## Facts"]
    lines += ["- " + fill(item, version, size) for item in en["features"]]
    lines += [
        "- Web version: %s" % web,
        "- Android app: version %s, %d KB APK, no permissions, no internet access, Android 8 or newer" % (version, size),
        "- License: MIT, source on GitHub",
        "- Author: %s (alparslandev)" % AUTHOR,
        "- Updated: " + lastmod,
        "",
        "## Play (%d languages)" % len(languages),
    ]
    lines += ["- [%s (%s)](%s): %s" % (NAME, languages[c][0], url_of(c), fill(site[c]["h1"], version, size)) for c in languages]
    lines += [
        "",
        "## Android app",
        "- [APK download](%s): version %s, %d KB, signed, installs on Android 8 or newer" % (APK_URL, version, size),
        "- [Releases](%s/releases): every version with notes" % ANDROID_REPO,
        "",
        "## Source",
        "- [Web source code](%s): JavaScript, one HTML file, MIT" % WEB_REPO,
        "- [Android source code](%s): plain Java, MIT" % ANDROID_REPO,
        "",
        "## Optional",
        "- [Full text](%s/llms-full.txt): the complete page text in English and Turkish, plus a one-line summary in every language" % SITE,
        "- [Author](%s): %s" % (AUTHOR_URL, AUTHOR),
        "- [Privacy policy](%s): no data collected, no account, no analytics" % privacy_url("en"),
    ]
    return "\n".join(lines) + "\n"


def full_text(entry, version, size):
    lines = ["# " + fill(entry["h1"], version, size), "", fill(entry["intro"], version, size), "", "## " + entry["featuresHeading"]]
    lines += ["- " + fill(item, version, size) for item in entry["features"]]
    lines += ["", "## " + entry["androidHeading"], fill(entry["android"], version, size) + " " + APK_URL, "", "## " + entry["privacyHeading"], entry["privacy"], "", "## " + entry["faqHeading"]]
    for question, answer in entry["faq"]:
        lines += ["", "### " + fill(question, version, size), fill(answer, version, size)]
    return lines


def llms_full_file(site, languages, version, size, lastmod):
    lines = full_text(site["en"], version, size)
    lines += ["", "Updated: " + lastmod, "", "---", ""]
    lines += full_text(site["tr"], version, size)
    lines += ["", "---", "", "## Other languages"]
    for code in languages:
        if code in ("en", "tr"):
            continue
        lines.append("- %s: %s %s" % (languages[code][0], fill(site[code]["intro"], version, size), url_of(code)))
    return "\n".join(lines) + "\n"


def humans_file(lastmod, count, web, version):
    return "\n".join([
        "TEAM",
        "Developer: " + AUTHOR,
        "GitHub: https://github.com/alparslandev",
        "Site: https://devdiscipline.com",
        "",
        "SITE",
        "Last update: " + lastmod,
        "Web version: " + web,
        "Android app version: " + version,
        "Languages: %d" % count,
        "Standards: HTML5, CSS, JSON-LD, sitemap, llms.txt, security.txt",
        "Software: plain JavaScript, no libraries, no tracking; the site is assembled by a Python script",
    ]) + "\n"


def security_file(expires):
    return "\n".join([
        "Contact: %s/issues/new" % WEB_REPO,
        "Expires: " + expires,
        "Preferred-Languages: en, tr",
        "Canonical: %s/.well-known/security.txt" % SITE,
    ]) + "\n"


def check_placeholders(dist):
    for folder, names, files in os.walk(dist):
        for name in files:
            if name.endswith(TEXT_TYPES):
                target = os.path.join(folder, name)
                with open(target, encoding="utf-8") as f:
                    if "{{" in f.read():
                        raise SystemExit("doldurulmamis yer tutucu: " + target)


def main():
    keys, languages = i18n.load()
    site = i18n.load_site(languages)
    lastmod = lastmod_date()
    expires = (datetime.date.today() + datetime.timedelta(days=365)).isoformat() + "T00:00:00.000Z"
    version, apk_bytes = android_release()
    size = kilobytes(apk_bytes)
    web = web_version()
    table = {code: i18n.table(keys, languages[code]) for code in languages}
    script = "%s\n%s\n" % (read("src", "engine.js").strip(), read("src", "app.js").strip())
    css = read("src", "style.css").strip()
    template = read("src", "index.html")
    dist = os.path.join(ROOT, "dist")
    shutil.rmtree(dist, ignore_errors=True)
    os.makedirs(dist)
    digest = hashlib.sha1(script.encode("utf-8"))
    write(dist, "app.js", script)
    total = 0
    for code in languages:
        out = page(template, css, table, code, site[code], languages, version, size, lastmod, web)
        digest.update(out.encode("utf-8"))
        total += len(out.encode("utf-8"))
        write(dist, os.path.join(i18n.path(code).strip("/"), "index.html"), out)
    privacy_template = read("src", "privacy.html")
    for code in languages:
        write(dist, os.path.join(privacy_path(code).strip("/"), "index.html"), privacy_page(privacy_template, css, code, site[code], languages, lastmod))
    not_found = read("src", "404.html").replace("{{CSS}}", css).replace("{{LANGUAGE_LINKS}}", language_links(languages))
    write(dist, "404.html", not_found)
    write(dist, "sw.js", read("src", "sw.js").replace("{{HASH}}", digest.hexdigest()[:10]))
    shutil.copytree(os.path.join(ROOT, "static"), dist, dirs_exist_ok=True)
    icons.write(dist)
    write(dist, "_headers", headers_file())
    write(dist, "_redirects", "/security.txt /.well-known/security.txt 301\n")
    write(dist, "robots.txt", robots_file())
    write(dist, "sitemap.xml", sitemap_file(languages, lastmod))
    write(dist, "llms.txt", llms_file(site, languages, version, size, lastmod, web))
    write(dist, "llms-full.txt", llms_full_file(site, languages, version, size, lastmod))
    write(dist, "humans.txt", humans_file(lastmod, len(languages), web, version))
    write(dist, os.path.join(".well-known", "security.txt"), security_file(expires))
    write(dist, indexnow.KEY + ".txt", indexnow.KEY)
    check_placeholders(dist)
    print("dist hazir: %d dil sayfasi + gizlilik sayfalari, sayfa basina ~%d bayt, web %s, Android %s (%d KB), guncelleme %s" % (len(languages), total // len(languages), web, version, size, lastmod))


if __name__ == "__main__":
    main()
