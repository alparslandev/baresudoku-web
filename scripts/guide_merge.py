import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import i18n


def read_batch(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data["languages"] if "languages" in data else data


def main(argv):
    check_only = "--check" in argv
    paths = [a for a in argv if a != "--check"]
    if not paths:
        raise SystemExit("kullanim: guide_merge.py [--check] dosya.json ...")
    keys, languages = i18n.load()
    target = i18n.guide_file()
    guide = {}
    if os.path.exists(target):
        with open(target, encoding="utf-8") as f:
            guide = json.load(f)["languages"]
    incoming = {}
    for path in paths:
        for code, entry in read_batch(path).items():
            if code not in languages:
                raise SystemExit("%s: %s strings.json'da yok" % (path, code))
            incoming[code] = entry
    reference = incoming.get("en") or guide.get("en")
    if not reference:
        raise SystemExit("referans olarak en gerekli")
    for code, entry in incoming.items():
        i18n.check_guide_entry(code, entry, reference)
    if check_only:
        print("gecerli: " + ", ".join(incoming))
        return
    guide.update(incoming)
    ordered = {code: guide[code] for code in languages if code in guide}
    with open(target, "w", encoding="utf-8") as f:
        json.dump({"languages": ordered}, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("guide.json: %d dil (%s eklendi)" % (len(ordered), ", ".join(incoming)))


if __name__ == "__main__":
    main(sys.argv[1:])
