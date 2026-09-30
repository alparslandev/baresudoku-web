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
import guide
from consts import SITE, NAME, AUTHOR, AUTHOR_URL, AUTHOR_LINKS, PERSON_ID, WEBSITE_ID, GAME_ID, WEB_REPO, ANDROID_REPO, OG_IMAGE, SAME_AS, og_locale

TRACKED_LINKS = {"https://yarisradari.com": "https://yarisradari.com/?utm_source=baresudoku"}
ANDROID_ID = SITE + "/#android"
APK_URL = ANDROID_REPO + "/releases/latest/download/baresudoku.apk"
SCREENSHOT = "https://raw.githubusercontent.com/alparslandev/baresudoku/main/screenshot.png"
LICENSE_URL = WEB_REPO + "/blob/main/LICENSE"
ANDROID_LICENSE_URL = ANDROID_REPO + "/blob/main/LICENSE"
APK_FALLBACK = ("1.2", 24972)
APP_STORE_URL = ""
BOTS = [
    "Googlebot", "Bingbot", "Applebot", "DuckDuckBot", "YandexBot", "Google-Extended", "GoogleOther", "GPTBot", "OAI-SearchBot",
    "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "anthropic-ai", "PerplexityBot", "Perplexity-User",
    "Applebot-Extended", "DuckAssistBot", "Amazonbot", "meta-externalagent", "meta-externalfetcher", "CCBot", "cohere-ai",
    "MistralAI-User", "YouBot", "Bytespider", "PetalBot",
]
CONTENT_SIGNAL = "Content-Signal: search=yes, ai-input=yes, ai-train=yes"
ROBOTS_DISALLOW = ["Disallow: /api/", "Disallow: /stats/"]
CSP = "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; img-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
DISCOVERY_CACHE = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
PAGE_CACHE = "public, max-age=600, s-maxage=86400, stale-while-revalidate=604800"
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


def content(code, entry, languages, version, size, lastmod, web, learn):
    def f(text):
        return esc(fill(text, version, size))
    parts = ['<section id="about">', "<h1>%s</h1>" % f(entry["h1"]), "<p>%s</p>" % f(entry["intro"])]
    parts.append("<h2>%s</h2>" % f(entry["featuresHeading"]))
    parts.append("<ul>%s</ul>" % "".join("<li>%s</li>" % f(item) for item in entry["features"]))
    if learn:
        parts.append(guide.learn_block(code, learn))
    parts.append("<h2>%s</h2>" % f(entry["androidHeading"]))
    parts.append('<p>%s <a href="%s">%s</a></p>' % (f(entry["android"]), APK_URL, f(entry["androidLink"])))
    parts.append("<h2>%s</h2>" % f(entry["privacyHeading"]))
    parts.append("<p>%s</p>" % f(entry["privacy"]))
    parts.append("<h2>%s</h2>" % f(entry["faqHeading"]))
    for question, answer in entry["faq"]:
        parts.append("<details><summary>%s</summary><p>%s</p></details>" % (f(question), f(answer)))
    author_links = "".join(' · <a href="%s" rel="me">%s</a>' % (TRACKED_LINKS.get(url, url), esc(label)) for label, url in AUTHOR_LINKS)
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


def page(template, css, table, code, entry, languages, version, size, lastmod, web, learn):
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
        "{{CONTENT}}": content(code, entry, languages, version, size, lastmod, web, learn),
        "{{WEB_VERSION}}": web,
        "{{CSS}}": css,
        "{{OPTIONS}}": options,
        "{{L}}": json.dumps(local, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c"),
    }
    out = template
    for key, value in values.items():
        out = out.replace(key, value)
    return out


def headers_file(sitemaps):
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
    for path in guide.header_paths():
        lines += [path, "  Content-Type: text/html; charset=utf-8", "  Cache-Control: " + PAGE_CACHE]
    for path, content_type in (
        ("/robots.txt", "text/plain; charset=utf-8"),
        ("/sitemap.xml", "application/xml; charset=utf-8"),
        ("/llms.txt", "text/plain; charset=utf-8"),
        ("/llms-full.txt", "text/plain; charset=utf-8"),
        ("/humans.txt", "text/plain; charset=utf-8"),
        ("/.well-known/security.txt", "text/plain; charset=utf-8"),
    ):
        lines += [path, "  Content-Type: " + content_type, "  Cache-Control: " + DISCOVERY_CACHE]
    for name in sitemaps:
        lines += ["/" + name, "  Content-Type: application/xml; charset=utf-8", "  Cache-Control: " + DISCOVERY_CACHE]
    lines += ["/manifest.webmanifest", "  Content-Type: application/manifest+json; charset=utf-8", "  Cache-Control: public, max-age=86400"]
    for path in ("/icon.svg", "/favicon.ico", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", "/og.png"):
        lines += [path, "  Cache-Control: public, max-age=2592000"]
    return "\n".join(lines) + "\n"


def robots_file():
    lines = ["User-agent: *", CONTENT_SIGNAL, "Allow: /"] + ROBOTS_DISALLOW + [""]
    lines += ["User-agent: " + bot for bot in BOTS]
    lines += [CONTENT_SIGNAL, "Allow: /"] + ROBOTS_DISALLOW + ["", "Sitemap: %s/sitemap.xml" % SITE]
    return "\n".join(lines) + "\n"


def alternate_links(languages, resolve, tag):
    links = [tag % (c, resolve(c)) for c in languages]
    links.append(tag % ("x-default", resolve("en")))
    return links


def urlset(codes, resolve, lastmod_of):
    urls = []
    for c in codes:
        links = "".join('<xhtml:link rel="alternate" hreflang="%s" href="%s"/>' % (h, SITE + resolve(c2)) for c2, h in [(x, x) for x in codes] + [("en", "x-default")])
        urls.append("<url><loc>%s</loc><lastmod>%s</lastmod>%s</url>\n" % (SITE + resolve(c), lastmod_of(c), links))
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n%s</urlset>\n' % "".join(urls)


def sitemap_files(languages, guide_languages, lastmod, guide_dates):
    files = {"sitemap-play.xml": urlset(languages, i18n.path, lambda c: lastmod), "sitemap-privacy.xml": urlset(languages, privacy_path, lambda c: lastmod)}
    for name, resolve in guide.sitemap_groups(guide_languages):
        files["sitemap-%s.xml" % name] = urlset(list(guide_languages), resolve, lambda c: guide_dates[c][1])
    newest = max([lastmod] + [d[1] for d in guide_dates.values()])
    entries = "".join("<sitemap><loc>%s/%s</loc><lastmod>%s</lastmod></sitemap>\n" % (SITE, name, newest) for name in files)
    files["sitemap.xml"] = '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s</sitemapindex>\n' % entries
    return files


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


def llms_file(site, languages, version, size, lastmod, web, guide_en):
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
    lines += guide.llms_lines(guide_en)
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
        "- [Full text](%s/llms-full.txt): the complete page text in English and Turkish, the guides in English, plus a one-line summary in every language" % SITE,
        "- [Author](%s): %s" % (AUTHOR_URL, AUTHOR),
        "- [Privacy policy](%s): no personal data, no account, no cookies; anonymous play counters" % privacy_url("en"),
        "- [Stats](%s/stats/): the anonymous counters, public" % SITE,
    ]
    return "\n".join(lines) + "\n"


def full_text(entry, version, size):
    lines = ["# " + fill(entry["h1"], version, size), "", fill(entry["intro"], version, size), "", "## " + entry["featuresHeading"]]
    lines += ["- " + fill(item, version, size) for item in entry["features"]]
    lines += ["", "## " + entry["androidHeading"], fill(entry["android"], version, size) + " " + APK_URL, "", "## " + entry["privacyHeading"], entry["privacy"], "", "## " + entry["faqHeading"]]
    for question, answer in entry["faq"]:
        lines += ["", "### " + fill(question, version, size), fill(answer, version, size)]
    return lines


def llms_full_file(site, languages, version, size, lastmod, guide_en, strings_en, examples):
    lines = full_text(site["en"], version, size)
    lines += ["", "Updated: " + lastmod, "", "---", ""]
    lines += full_text(site["tr"], version, size)
    lines += ["", "---", ""]
    lines += guide.full_text_lines(guide_en, site["en"], strings_en, examples)
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
    guides = i18n.load_guide(languages)
    examples = guide.load_examples()
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
        out = page(template, css, table, code, site[code], languages, version, size, lastmod, web, guides.get(code))
        digest.update(out.encode("utf-8"))
        total += len(out.encode("utf-8"))
        write(dist, os.path.join(i18n.path(code).strip("/"), "index.html"), out)
    privacy_template = read("src", "privacy.html")
    for code in languages:
        write(dist, os.path.join(privacy_path(code).strip("/"), "index.html"), privacy_page(privacy_template, css, code, site[code], languages, lastmod))
    names = {code: languages[code][0] for code in languages}
    guide_count, guide_dates = guide.write_all(write, dist, read("src", "guide.html"), css, guides, site, table, examples, names)
    not_found = read("src", "404.html").replace("{{CSS}}", css).replace("{{LANGUAGE_LINKS}}", language_links(languages))
    write(dist, "404.html", not_found)
    write(dist, "sw.js", read("src", "sw.js").replace("{{HASH}}", digest.hexdigest()[:10]))
    shutil.copytree(os.path.join(ROOT, "static"), dist, dirs_exist_ok=True)
    icons.write(dist)
    sitemaps = sitemap_files(languages, guides, lastmod, guide_dates)
    write(dist, "_headers", headers_file([name for name in sitemaps if name != "sitemap.xml"]))
    write(dist, "_redirects", "/security.txt /.well-known/security.txt 301\n")
    write(dist, "robots.txt", robots_file())
    for name, text in sitemaps.items():
        write(dist, name, text)
    write(dist, "llms.txt", llms_file(site, languages, version, size, lastmod, web, guides["en"]))
    write(dist, "llms-full.txt", llms_full_file(site, languages, version, size, lastmod, guides["en"], table["en"], examples))
    write(dist, "humans.txt", humans_file(lastmod, len(languages), web, version))
    write(dist, os.path.join(".well-known", "security.txt"), security_file(expires))
    write(dist, indexnow.KEY + ".txt", indexnow.KEY)
    check_placeholders(dist)
    print("dist hazir: %d dil sayfasi + gizlilik sayfalari + %d rehber sayfasi (%d dil), sayfa basina ~%d bayt, web %s, Android %s (%d KB), guncelleme %s" % (len(languages), guide_count, len(guides), total // len(languages), web, version, size, lastmod))


if __name__ == "__main__":
    main()
