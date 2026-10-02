import json
import os
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import i18n

KEY = "7f33bd9e0dc8c5e8bb6f0a533e5bf5be"
HOST = "baresudoku.com"
ENDPOINT = "https://api.indexnow.org/indexnow"


def url_list(languages, guide_languages, daily_languages=(), solver_languages=(), print_languages=()):
    base = "https://" + HOST
    pages = [base + i18n.path(code) for code in languages]
    pages += [base + i18n.path(code) + "daily/" for code in daily_languages]
    pages += [base + i18n.path(code) + "solver/" for code in solver_languages]
    pages += [base + i18n.path(code) + "print/" for code in print_languages]
    pages += [base + i18n.path(code) + "privacy/" for code in languages]
    for code in guide_languages:
        pages.append(base + i18n.path(code) + "how-to-play/")
        pages.append(base + i18n.path(code) + "techniques/")
        pages += [base + i18n.path(code) + "techniques/" + slug + "/" for slug in i18n.TECHNIQUES]
    return pages + [base + "/sitemap.xml", base + "/llms.txt", base + "/llms-full.txt"] + removed_pages(base)


def removed_pages(base):
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "i18n", "removed.json")
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return [base + i18n.path(code) for code in json.load(f)["codes"]]


def ping(languages, guide_languages, daily_languages=(), solver_languages=(), print_languages=()):
    body = json.dumps({"host": HOST, "key": KEY, "keyLocation": "https://%s/%s.txt" % (HOST, KEY), "urlList": url_list(languages, guide_languages, daily_languages, solver_languages, print_languages)}).encode("utf-8")
    request = urllib.request.Request(ENDPOINT, data=body, headers={"Content-Type": "application/json; charset=utf-8"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code
    except Exception as error:
        return str(error)


if __name__ == "__main__":
    keys, languages = i18n.load()
    guide_languages = list(i18n.load_guide(languages))
    site = i18n.load_site(languages)
    daily_languages = [code for code in languages if i18n.has_daily(site[code])]
    solver_languages = [code for code in languages if i18n.has_solver(site[code])]
    print_languages = [code for code in languages if i18n.has_print(site[code])]
    print("IndexNow: %s (%d URL)" % (ping(languages, guide_languages, daily_languages, solver_languages, print_languages), len(url_list(languages, guide_languages, daily_languages, solver_languages, print_languages))))
