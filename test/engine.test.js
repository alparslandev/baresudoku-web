import { test, expect } from "bun:test";
const { Sudoku, Game, candidates, bit, PEERS, ROW, COL, BOX, HINT_WRONG, HINT_PLACE, NONE, TECH_BASE, TECH_COUNT, TECH_ORDER, MASTER_RATING, EXPERT_LIMIT, LEVELS } = require("../src/engine.js");

const LEVEL_NAMES = ["Kolay", "Orta", "Zor", "Uzman", "Usta"];
const count = values => values.filter(v => v !== 0).length;

function verifiedRate(e, puzzle, solution) {
  e.load(puzzle);
  let max = 0;
  while (!e.complete()) {
    expect(e.stuck()).toBe(false);
    const t = e.step();
    expect(t).toBeGreaterThanOrEqual(0);
    expect(e.stepRating).toBeGreaterThanOrEqual(TECH_BASE[t]);
    if (e.stepRating > max) max = e.stepRating;
    for (let i = 0; i < 81; i++) {
      if (e.lv[i]) expect(e.lv[i]).toBe(solution[i]);
      else expect(e.lc[i] & bit(solution[i])).not.toBe(0);
    }
  }
  return max;
}

test("teknik kaydi: kimlik sirasi, derece sirasi, uzman siniri", () => {
  expect(TECH_ORDER.length).toBe(TECH_COUNT);
  expect(new Set(TECH_ORDER).size).toBe(TECH_COUNT);
  for (let k = 0; k < 3; k++) expect(TECH_ORDER[k]).toBe(k);
  for (let k = 4; k < TECH_COUNT; k++) {
    const a = TECH_ORDER[k - 1], b = TECH_ORDER[k];
    expect(TECH_BASE[a] < TECH_BASE[b] || (TECH_BASE[a] === TECH_BASE[b] && a < b)).toBe(true);
  }
  for (let k = 0; k < TECH_COUNT; k++) expect(TECH_BASE[TECH_ORDER[k]] < MASTER_RATING).toBe(k < EXPERT_LIMIT);
  expect(LEVEL_NAMES.length).toBeGreaterThanOrEqual(LEVELS);
  const i18n = require("fs").readFileSync(require("path").join(__dirname, "..", "scripts", "i18n.py"), "utf8");
  const extra = JSON.parse(i18n.match(/^FIXED_EXTRA = (\[.*\])$/m)[1]);
  expect(extra.length).toBe(TECH_COUNT - 7);
  const app = require("fs").readFileSync(require("path").join(__dirname, "..", "src", "app.js"), "utf8");
  const constant = name => +app.match(new RegExp("\\b" + name + " = (\\d+)"))[1];
  expect(app).toContain("S_MASTER = S_TECH_EXTRA + TECH_COUNT - 7");
  const run = Bun.spawnSync(["python3", "scripts/i18n.py", "table", "en"], { cwd: require("path").join(__dirname, "..") });
  expect(run.exitCode).toBe(0);
  const table = JSON.parse(run.stdout.toString());
  expect(table[constant("S_TECH")]).toBe("Locked candidates");
  expect(table[constant("S_TECH") + 2]).toBe("X-Wing");
  expect(table[constant("S_TITLE")]).toBe("Bare Sudoku");
  expect(table[constant("S_RESTART")]).toBe("Restart");
  expect(table.slice(constant("S_TECH_EXTRA"), constant("S_TECH_EXTRA") + extra.length)).toEqual(extra);
  const master = constant("S_TECH_EXTRA") + TECH_COUNT - 7;
  expect(table[master]).toBe("Master");
  expect(app).toContain("S_DAILY = S_MASTER + 1, S_SHARE = S_MASTER + 2, S_COPIED = S_MASTER + 3, S_PLAY = S_MASTER + 4");
  expect(table.slice(master + 1, master + 5)).toEqual(["Daily Sudoku", "Share", "Copied!", "Play Sudoku"]);
});

for (let level = 0; level < LEVELS; level++) {
  test(`${LEVEL_NAMES[level]}: teklik, derece, eleme dogrulugu, ipucu yuruyusu`, () => {
    const e = new Sudoku();
    const n = 25;
    const start = performance.now();
    const clues = [];
    for (let i = 0; i < n; i++) {
      const puzzle = e.generate(level);
      const solution = e.solution;
      expect(e.countSolutions(puzzle, 2)).toBe(1);
      expect(e.found).toEqual(solution);
      const r = verifiedRate(e, puzzle, solution);
      expect(e.rate(puzzle)).toBe(r);
      const order = e.rateOrder;
      if (level < 2) expect(r).toBe(TECH_BASE[0]);
      else if (level === 2) expect(order >= 1 && order <= 2).toBe(true);
      else if (level === 3) expect(order >= 3 && r < MASTER_RATING).toBe(true);
      else expect(r).toBeGreaterThanOrEqual(MASTER_RATING);
      clues.push(count(puzzle));
      const values = puzzle.slice();
      let steps = 0;
      while (count(values) < 81) {
        expect(e.hint(values, puzzle)).toBe(true);
        expect(e.hintTech >= 0 && e.hintTech < TECH_COUNT).toBe(true);
        expect(values[e.stepCell]).toBe(0);
        expect(solution[e.stepCell]).toBe(e.stepDigit);
        values[e.stepCell] = e.stepDigit;
        expect(++steps).toBeLessThanOrEqual(81);
      }
    }
    const ms = (performance.now() - start) / n;
    console.log(`${LEVEL_NAMES[level]}: ${n} bulmaca, ort ipucu ${(clues.reduce((a, b) => a + b, 0) / n).toFixed(1)}, ${ms.toFixed(1)} ms/bulmaca`);
  });
}

test("tohumlu uretim: ayni tohum ayni bulmaca, uc motorda ayni sabit", () => {
  const a = new Sudoku(), b = new Sudoku();
  a.seed(162088025);
  b.seed(162088025);
  const p = a.generate(1).join("");
  expect(p).toBe("000020006000004700680100009004070068003000900250040100300002087007400000100030000");
  expect(a.rating).toBe(10);
  expect(b.generate(1).join("")).toBe(p);
  const c = new Sudoku();
  c.seed(162088027);
  expect(c.generate(3).join("")).toBe("300600480000320600091000002000060007009705800500040000900000310003096000018004006");
  expect(c.rating).toBe(40);
  const d = new Sudoku();
  d.seed(1);
  expect(d.generate(1).join("")).not.toBe(p);
});

test("zorlama sirasi: Nishio once denenir, Cell ve Unit Forcing varsayilan sirada tetiklenmez", () => {
  expect(TECH_BASE[37] < TECH_BASE[38] && TECH_BASE[38] < TECH_BASE[39]).toBe(true);
  const e = new Sudoku();
  const puzzle = "030040008000000600000009170000190800026000790004027000019200000005000000600050030".split("").map(Number);
  e.load(puzzle);
  const used = new Set();
  let r1c4Lost5By = -1;
  while (!e.complete()) {
    expect(e.stuck()).toBe(false);
    const had = e.lc[3] & bit(5);
    const t = e.step();
    expect(t).toBeGreaterThanOrEqual(0);
    used.add(t);
    if (had && !e.lv[3] && !(e.lc[3] & bit(5))) r1c4Lost5By = t;
  }
  expect(r1c4Lost5By).toBe(37);
  expect(used.has(38) || used.has(39)).toBe(false);
});

test("WXYZ-Wing: dortlu kesisen iki birime sigar", () => {
  const inUnit = (c, u) => u < 9 ? ROW[c] === u : u < 18 ? COL[c] === u - 9 : BOX[c] === u - 18;
  const crossing = (u, v) => u < 9 ? (v < 18 ? v >= 9 : Math.floor(u / 3) === Math.floor((v - 18) / 3)) : u < 18 && v >= 18 && Math.floor((u - 9) / 3) === (v - 18) % 3;
  const bent = quad => {
    for (let u = 0; u < 27; u++) for (let v = u + 1; v < 27; v++) if (crossing(u, v) && quad.every(c => inUnit(c, u) || inUnit(c, v))) return true;
    return false;
  };
  const e = new Sudoku();
  let wings = 0;
  for (let level = 3; level < LEVELS; level++) {
    for (let i = 0; i < 20; i++) {
      e.load(e.generate(level));
      while (!e.complete() && !e.stuck()) {
        const t = e.step();
        if (t < 0) break;
        if (t !== 19) continue;
        wings++;
        expect(bent(Array.from(e.quad))).toBe(true);
      }
    }
  }
  expect(wings).toBeGreaterThan(0);
});

test("oyun durumu: hamle, not, geri al, not doldurma, ipucu, sure, kayit", () => {
  const e = new Sudoku();
  const puzzle = e.generate(1);
  const g = new Game();
  g.start(puzzle, e.solution, 1);
  const cell = puzzle.indexOf(0);
  const right = e.solution[cell];
  const wrong = right === 9 ? 1 : right + 1;
  g.select(cell);
  expect(g.enter(wrong)).toBe(true);
  expect(g.value[cell]).toBe(wrong);
  expect(g.wrong(cell)).toBe(true);
  expect(g.hint(e)).toBe(true);
  expect(g.hintKind).toBe(HINT_WRONG);
  expect(g.hintCell).toBe(cell);
  expect(g.undo()).toBe(true);
  expect(g.value[cell]).toBe(0);
  expect(g.selected).toBe(cell);
  g.noteMode = true;
  expect(g.enter(right)).toBe(true);
  expect(g.notes[cell]).toBe(bit(right));
  expect(g.enter(right)).toBe(true);
  expect(g.notes[cell]).toBe(0);
  g.noteMode = false;
  expect(g.fillNotes()).toBe(true);
  for (let i = 0; i < 81; i++) if (!g.value[i]) expect(g.notes[i]).toBe(candidates(g.value, i));
  expect(g.fillNotes()).toBe(true);
  for (let i = 0; i < 81; i++) expect(g.notes[i]).toBe(0);
  expect(g.undo()).toBe(true);
  for (let i = 0; i < 81; i++) if (!g.value[i]) expect(g.notes[i]).toBe(candidates(g.value, i));
  expect(g.fillNotes()).toBe(true);
  expect(g.fillNotes()).toBe(true);
  const restartHistory = g.history.length;
  expect(restartHistory).toBeGreaterThan(0);
  expect(g.restart()).toBe(true);
  for (let i = 0; i < 81; i++) {
    expect(g.value[i]).toBe(g.given[i]);
    expect(g.notes[i]).toBe(0);
  }
  expect(g.history.length).toBe(0);
  expect(g.time(9999)).toBe(0);
  expect(g.solved).toBe(false);
  expect(g.fillNotes()).toBe(true);
  expect(g.hint(e)).toBe(true);
  expect(g.hintActive()).toBe(true);
  expect(g.hintKind).toBe(HINT_PLACE);
  const hc = g.hintCell, hd = g.hintDigit;
  expect(hd).toBe(e.solution[hc]);
  expect(g.hint(e)).toBe(true);
  expect(g.value[hc]).toBe(hd);
  for (const p of PEERS[hc]) expect(g.notes[p] & bit(hd)).toBe(0);
  expect(g.undo()).toBe(true);
  expect(g.value[hc]).toBe(0);
  g.resume(0);
  g.pause(500);
  expect(g.time(9999)).toBe(500);
  const saved = JSON.parse(JSON.stringify(g.save(1000)));
  const h = new Game();
  expect(h.load(saved)).toBe(true);
  expect(JSON.stringify(h.save(0))).toBe(JSON.stringify(saved));
  expect(h.history.length).toBe(g.history.length);
  expect(h.undo()).toBe(true);
  expect(new Game().load({ v: 1, active: true, given: "bozuk" })).toBe(false);
  expect(new Game().load(null)).toBe(false);
  const empty = new Game();
  expect(empty.load({ v: 1, active: false, showErrors: false })).toBe(true);
  expect(empty.active).toBe(false);
  expect(empty.showErrors).toBe(false);
  for (let i = 0; i < 81; i++) {
    if (g.value[i]) continue;
    g.select(i);
    expect(g.enter(e.solution[i])).toBe(true);
  }
  expect(g.solved).toBe(true);
  expect(g.selected).toBe(NONE);
  expect(g.enter(1)).toBe(false);
  expect(g.undo()).toBe(false);
});

test("rakam once: tusa basinca kilitlenir, dokunulan hucrelere yazilir, kilitliyken hucre secimi yoktur", () => {
  const e = new Sudoku();
  const puzzle = e.generate(0);
  const g = new Game();
  g.start(puzzle, e.solution, 0);
  const a = puzzle.findIndex((v, i) => !v && g.remaining(e.solution[i]) >= 3);
  const b = puzzle.findIndex((v, i) => !v && i !== a);
  const d = e.solution[a];
  const other = [1, 2, 3, 4, 5, 6, 7, 8, 9].find(x => x !== d && g.remaining(x) >= 2);
  expect(g.key(d)).toBe(false);
  expect(g.sticky).toBe(d);
  expect(g.tap(a)).toBe(true);
  expect(g.value[a]).toBe(d);
  expect(g.selected).toBe(NONE);
  expect(g.tap(a)).toBe(true);
  expect(g.value[a]).toBe(0);
  expect(g.tap(b)).toBe(true);
  expect(g.value[b]).toBe(d);
  g.select(a);
  expect(g.selected).toBe(NONE);
  expect(g.undo()).toBe(true);
  expect(g.value[b]).toBe(0);
  expect(g.sticky).toBe(d);
  expect(g.selected).toBe(NONE);
  expect(g.tap(b)).toBe(true);
  expect(g.key(d)).toBe(false);
  expect(g.sticky).toBe(0);
  expect(g.undo()).toBe(true);
  expect(g.value[b]).toBe(0);
  expect(g.selected).toBe(b);
  g.select(a);
  expect(g.key(d)).toBe(true);
  expect(g.value[a]).toBe(d);
  expect(g.sticky).toBe(0);
  expect(g.key(d)).toBe(false);
  expect(g.sticky).toBe(d);
  expect(g.value[a]).toBe(d);
  expect(g.selected).toBe(NONE);
  expect(g.key(other)).toBe(false);
  expect(g.sticky).toBe(other);
  expect(g.value[a]).toBe(d);
  expect(g.key(other)).toBe(false);
  expect(g.sticky).toBe(0);
  expect(g.tap(a)).toBe(false);
  expect(g.selected).toBe(a);
  expect(g.tap(a)).toBe(false);
  expect(g.selected).toBe(NONE);
  const given = puzzle.findIndex(v => v);
  expect(g.tap(given)).toBe(false);
  expect(g.selected).toBe(given);
  expect(g.key(other)).toBe(false);
  expect(g.sticky).toBe(other);
  expect(g.selected).toBe(NONE);
  expect(g.tap(given)).toBe(false);
  expect(g.value[given]).toBe(puzzle[given]);
  expect(g.selected).toBe(NONE);
  g.noteMode = true;
  expect(g.tap(b)).toBe(true);
  expect(g.notes[b]).toBe(bit(other));
  expect(g.tap(b)).toBe(true);
  expect(g.notes[b]).toBe(0);
  g.noteMode = false;
  expect(g.key(other)).toBe(false);
  expect(g.sticky).toBe(0);
  expect(g.key(d)).toBe(false);
  expect(g.sticky).toBe(d);
  expect(g.hint(e)).toBe(true);
  expect(g.sticky).toBe(0);
  expect(g.selected).toBe(g.hintCell);
  g.select(NONE);
  expect(g.key(d)).toBe(false);
  expect(g.sticky).toBe(d);
  for (let i = 0; i < 81; i++) if (!g.value[i] && e.solution[i] === d) expect(g.tap(i)).toBe(true);
  expect(g.remaining(d)).toBe(0);
  expect(g.sticky).toBe(0);
  expect(g.key(d)).toBe(false);
  expect(g.sticky).toBe(0);
  for (let i = 0; i < 81; i++) if (!g.value[i]) { g.sticky = e.solution[i]; expect(g.tap(i)).toBe(true); }
  expect(g.solved).toBe(true);
  expect(g.sticky).toBe(0);
  expect(g.tap(a)).toBe(false);
  expect(g.key(d)).toBe(false);
  expect(g.sticky).toBe(0);
});
