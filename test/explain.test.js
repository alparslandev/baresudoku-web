import { test, expect } from "bun:test";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = name => fs.readFileSync(path.join(__dirname, "..", "src", name), "utf8");
const texts = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "i18n", "explain.json"), "utf8")).languages;
const context = vm.createContext({});
vm.runInContext(src("engine.js") + "\n" + src("explain.js") + "\nthis.Sudoku = Sudoku; this.createExplainer = createExplainer; this.bit = bit;", context);
const { Sudoku, createExplainer, bit } = context;

function walk(puzzle, lang, until) {
  const explainer = createExplainer(texts[lang], lang);
  const engine = new Sudoku();
  engine.load(puzzle);
  const removedAt = new Uint16Array(729);
  const steps = [];
  while (!engine.complete() && steps.length < until) {
    const values = Array.from(engine.lv), cands = Array.from(engine.lc);
    const t = engine.step();
    if (t < 0) break;
    let place = null, elim = [];
    for (let c = 0; c < 81; c++) {
      if (!values[c] && engine.lv[c]) place = [c, engine.lv[c]];
      else if (!engine.lv[c]) for (let d = 1; d <= 9; d++) if (cands[c] & ~engine.lc[c] & bit(d)) elim.push([c, d]);
    }
    if (place) elim = [];
    const n = steps.length + 1;
    const out = place ? explainer.explain({ t, unit: engine.stepUnit, cell: place[0], d: place[1], values, cands, elim, removedAt }) : null;
    for (const [c, d] of elim) if (!removedAt[c * 9 + d - 1]) removedAt[c * 9 + d - 1] = n;
    steps.push({ t, place, elim, out });
  }
  return steps;
}

const SCREENSHOT = "942000605560924031301060429753240016829070354416000002230490160690812043104000290".split("").map(Number);

test("gizli tek: her boş karenin neden olamayacağı söylenir", () => {
  const [first] = walk(SCREENSHOT, "tr", 1);
  expect(first.place).toEqual([7 * 9 + 6, 5]);
  expect(first.out.lines).toEqual([
    "7. sütunda henüz 5 yok, boş karelerinden biri 5 olmak zorunda. Tek tek bakalım:",
    "r2c7: olamaz, aynı satırda zaten 5 var (r2c1).",
    "r4c7: olamaz, aynı satırda zaten 5 var (r4c2).",
    "r6c7: olamaz, aynı kutuda zaten 5 var (r5c8).",
    "Geriye yalnız r8c7 kalıyor, 5 oraya yazılır.",
  ]);
  expect([...first.out.marks.key].sort((a, b) => a - b)).toEqual([9, 28, 43]);
});

test("ingilizce gizli tek", () => {
  const [first] = walk(SCREENSHOT, "en", 1);
  expect(first.out.lines[0]).toBe("Column 7 has no 5 yet, so one of its empty cells must be 5. Let's check them one by one:");
  expect(first.out.lines[1]).toBe("r2c7: no, its row already has a 5 (r2c1).");
});

test("her yerleştirme adımı açıklanır ve son cümle doğru kareyi söyler", () => {
  const puzzle = "000074900800001320000002060000030076460000032170020000050700000016800005009250000".split("").map(Number);
  for (const lang of ["en", "tr"]) {
    for (const step of walk(puzzle, lang, 400)) {
      if (!step.place) continue;
      expect(step.out).not.toBe(null);
      const last = step.out.lines[step.out.lines.length - 1];
      expect(last).toContain("r" + (Math.floor(step.place[0] / 9) + 1) + "c" + (step.place[0] % 9 + 1));
      expect(last).toContain(String(step.place[1]));
      for (const line of step.out.lines) expect(line).not.toMatch(/\{[a-zA-Z]+\}/);
    }
  }
});

test("çıplak tek: diğer sekiz rakamın her biri bir gerekçeyle elenir", () => {
  const puzzle = "000074900800001320000002060000030076460000032170020000050700000016800005009250000".split("").map(Number);
  let checked = 0;
  for (const step of walk(puzzle, "tr", 400)) {
    if (!step.place || step.out.lines[0].indexOf("hangi rakam") < 0) continue;
    const named = new Set();
    for (const line of step.out.lines.slice(1, -1)) {
      const list = line.replace(/^\d+\. adımda buradan silinenler: /, "").replace(/^Aynı (satırda|sütunda|kutuda) /, "").replace(/ var, bunlar.*$/, "").replace(/\.$/, "");
      for (const d of list.split(", ")) named.add(+d);
    }
    expect(named.size).toBe(8);
    expect(named.has(step.place[1])).toBe(false);
    checked++;
  }
  expect(checked).toBeGreaterThan(0);
});
