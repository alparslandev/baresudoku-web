import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import i18n

KEY = "master"
MAX_LENGTH = 18


def dump(keys, languages):
    lines = ["{", '  "keys": %s,' % json.dumps(keys, ensure_ascii=False), '  "languages": {']
    codes = list(languages)
    for i, code in enumerate(codes):
        lines.append("    %s: %s%s" % (json.dumps(code, ensure_ascii=False), json.dumps(languages[code], ensure_ascii=False), "," if i < len(codes) - 1 else ""))
    lines += ["  }", "}", ""]
    return "\n".join(lines)


def check(code, name, values, keys):
    hard = values[keys.index("hard") + 1]
    expert = values[keys.index("expert") + 1]
    if not isinstance(name, str) or not name.strip() or name != name.strip():
        raise SystemExit("%s: ad bos ya da bosluklu" % code)
    if len(name) > MAX_LENGTH:
        raise SystemExit("%s: ad %d karakterden uzun" % (code, MAX_LENGTH))
    if any(ch in name for ch in i18n.DASHES) or name[-1] in ".!?:;,":
        raise SystemExit("%s: uzun cizgi ya da sondaki noktalama" % code)
    if name in (hard, expert):
        raise SystemExit("%s: ad Hard ya da Expert ile ayni" % code)


def main(argv):
    replace = "--replace" in argv
    paths = [a for a in argv if a != "--replace"]
    if len(paths) != 1:
        raise SystemExit("kullanim: master_merge.py [--replace] master.json")
    with open(paths[0], encoding="utf-8") as f:
        master = json.load(f)
    keys, languages = i18n.load()
    if KEY in keys and not replace:
        raise SystemExit("%s anahtari zaten var, yenilemek icin --replace" % KEY)
    if KEY not in keys and replace:
        raise SystemExit("%s anahtari yok, --replace kullanilmaz" % KEY)
    missing = [code for code in languages if code not in master]
    if missing:
        raise SystemExit("eksik dil: " + " ".join(missing))
    unknown = [code for code in master if code not in languages]
    if unknown:
        raise SystemExit("strings.json'da olmayan dil: " + " ".join(unknown))
    for code, values in languages.items():
        check(code, master[code], values, keys)
    if replace:
        at = keys.index(KEY) + 1
        for code, values in languages.items():
            values[at] = master[code]
    else:
        keys.append(KEY)
        for code, values in languages.items():
            values.append(master[code])
    with open(os.path.join(ROOT, "i18n", "strings.json"), "w", encoding="utf-8") as f:
        f.write(dump(keys, languages))
    print("strings.json: %s anahtari %d dilde %s" % (KEY, len(languages), "yenilendi" if replace else "eklendi"))


if __name__ == "__main__":
    main(sys.argv[1:])
