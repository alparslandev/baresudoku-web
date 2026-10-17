import { test, expect } from "bun:test";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = name => fs.readFileSync(path.join(__dirname, "..", "src", name), "utf8");
const texts = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "i18n", "explain.json"), "utf8")).languages;
const context = vm.createContext({});
vm.runInContext(src("engine.js") + "\n" + src("explain.js") + "\nthis.Sudoku = Sudoku; this.createExplainer = createExplainer; this.bit = bit;", context);
const { Sudoku, createExplainer, bit } = context;

function walk(puzzle, lang, until, off) {
  const explainer = createExplainer(texts[lang], lang);
  const engine = new Sudoku();
  engine.tracing = true;
  for (const id of off || []) engine.techOff[id] = 1;
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
    const out = explainer.explain({ t, engine, unit: engine.stepUnit, cell: place ? place[0] : -1, d: place ? place[1] : 0, values, cands, elim, removedAt, rating: engine.stepRating });
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
      const list = line.replace(/^\d+\. adımda buradan silinen(ler)?: /, "").replace(/^Aynı (satırda|sütunda|kutuda) /, "").replace(/ var, bu.*$/, "").replace(/\.$/, "");
      for (const d of list.split(", ")) named.add(+d);
    }
    expect(named.size).toBe(8);
    expect(named.has(step.place[1])).toBe(false);
    checked++;
  }
  expect(checked).toBeGreaterThan(0);
});

function removedIn(out, lang) {
  const prefix = texts[lang].remove.split("{")[0];
  const listed = new Map();
  for (const line of out.lines) {
    if (!line.startsWith(prefix)) continue;
    for (const m of line.matchAll(/r(\d)c(\d) \(([\d, ]+)\)/g)) {
      const c = (m[1] - 1) * 9 + (m[2] - 1);
      let mask = 0;
      for (const d of m[3].split(", ")) mask |= bit(+d);
      listed.set(c, (listed.get(c) || 0) | mask);
    }
  }
  return listed;
}

test("her eleme adımı açıklanır, silinen adaylar tam listelenir, kapalı tekniklerle de", () => {
  const gen = new Sudoku();
  const chains = [27, 28, 29, 30, 31];
  const sets = [[], [37], chains, chains.concat([32, 33, 34]), [3, 4, 5, 6, 7, 8, 9, 14, 15, 17, 18, 19, 22, 24, 25, 42, 43]];
  const seen = new Set();
  for (let i = 0; i < 25; i++) {
    gen.seed(500 + i);
    const puzzle = gen.generate(i % 5);
    for (const off of sets) {
      for (const lang of ["en", "tr"]) {
        for (const step of walk(puzzle, lang, 400, off)) {
          expect(step.out).not.toBe(null);
          const text = step.out.lines.join("\n");
          expect(text).not.toMatch(/\{[a-zA-Z]+\}|undefined|NaN|null/);
          seen.add(step.t);
          if (step.place) continue;
          const want = new Map();
          for (const [c, d] of step.elim) want.set(c, (want.get(c) || 0) | bit(d));
          expect([...removedIn(step.out, lang)].sort()).toEqual([...want].sort());
        }
      }
    }
  }
  for (const t of [1, 2, 3, 4, 7, 9, 28, 30, 33, 37]) expect(seen.has(t)).toBe(true);
});

test("XY-Wing açıklaması iki durumu da somut karelerle anlatır", () => {
  const gen = new Sudoku();
  for (let i = 0; i < 200; i++) {
    gen.seed(9000 + i);
    const steps = walk(gen.generate(3), "tr", 400).filter(s => s.t === 4);
    if (!steps.length) continue;
    const lines = steps[0].out.lines;
    expect(lines[0]).toMatch(/^Şu üç kareye bak: r\dc\d, r\dc\d, r\dc\d\.$/);
    expect(lines.filter(l => /= \d olursa /.test(l)).length).toBe(2);
    return;
  }
  throw new Error("XY-Wing bulunamadı");
});
