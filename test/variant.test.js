import { test, expect } from "bun:test";
const { Game } = require("../src/engine.js");
const { Variant, KIND_DIAGONAL, KIND_KILLER, KIND_MINI, UNIT_REVEAL, UNIT_DIAGONAL } = require("../src/variant.js");

function unitsOk(v, grid) {
  const s = v.shape;
  for (let u = 0; u < s.unitCount; u++) {
    let m = 0;
    for (let k = 0; k < s.n; k++) m |= 1 << (grid[s.unitCells[u * 9 + k]] - 1);
    if (m !== s.all) return false;
  }
  for (let k = 0; k < s.cageCount; k++) {
    let m = 0, sum = 0;
    for (let i = 0; i < s.cageSize[k]; i++) {
      const d = grid[s.cageCells[k * 9 + i]];
      if (m & (1 << (d - 1))) return false;
      m |= 1 << (d - 1);
      sum += d;
    }
    if (sum !== s.cageSum[k]) return false;
  }
  return true;
}

for (const [name, kind] of [["diagonal", KIND_DIAGONAL], ["killer", KIND_KILLER], ["mini", KIND_MINI]]) {
  test(`varyant ${name}: uc seviye tek cozumlu, cozum tum birimleri ve kafesleri saglar, ayni tohum ayni bulmaca`, () => {
    for (let level = 0; level < 3; level++) {
      const v = new Variant(kind);
      v.seed(1000 + level);
      const puzzle = v.generate(level);
      const solution = Array.from(v.solution.subarray(0, v.shape.size));
      expect(puzzle.length).toBe(v.shape.size);
      expect(v.countSolutions(puzzle, 2)).toBe(1);
      expect(Array.from(v.found.subarray(0, v.shape.size))).toEqual(solution);
      expect(unitsOk(v, solution)).toBe(true);
      for (let c = 0; c < v.shape.size; c++) if (puzzle[c]) expect(puzzle[c]).toBe(solution[c]);
      const w = new Variant(kind);
      w.seed(1000 + level);
      expect(w.generate(level)).toEqual(puzzle);
    }
  });

  test(`varyant ${name}: Game sekille oynanir, cakisma eslere gore, ipucu yolu bulmacayi cozer, kayit geri yuklenir`, () => {
    const v = new Variant(kind);
    v.seed(77);
    const puzzle = v.generate(1);
    const solution = Array.from(v.solution.subarray(0, v.shape.size));
    const g = new Game();
    g.setShape(v.shape);
    g.start(puzzle, solution, 1);
    expect(g.remaining(1)).toBe(v.shape.n - puzzle.filter(d => d === 1).length);
    const cell = puzzle.indexOf(0);
    const peer = g.peers[cell].find(p => puzzle[p]);
    g.select(cell);
    expect(g.enter(puzzle[peer])).toBe(true);
    expect(g.conflict(cell)).toBe(true);
    expect(g.undo()).toBe(true);
    expect(g.fillNotes()).toBe(true);
    for (let c = 0; c < v.shape.size; c++) if (!g.value[c]) expect(g.notes[c] & (1 << (solution[c] - 1))).not.toBe(0);
    let steps = 0;
    while (!g.solved && steps < 200) {
      expect(g.hint(v)).toBe(true);
      expect(g.hint(v)).toBe(true);
      steps++;
    }
    expect(g.solved).toBe(true);
    const saved = JSON.parse(JSON.stringify(g.save(0)));
    expect(saved.given.length).toBe(v.shape.size);
    const h = new Game();
    h.setShape(v.shape);
    expect(h.load(saved)).toBe(true);
    expect(h.value.slice(0, v.shape.size)).toEqual(solution);
    const classic = new Game();
    if (v.shape.size !== 81) expect(classic.load(saved)).toBe(false);
  });
}

test("varyant ipucu: tekli bulunmazsa hucre acilir, kosegen birimi ayri adla doner", () => {
  const v = new Variant(KIND_DIAGONAL);
  v.seed(5);
  const puzzle = v.generate(2);
  expect(v.hint(puzzle, puzzle)).toBe(true);
  expect(v.solution[v.stepCell]).toBe(v.stepDigit);
  const units = new Set();
  for (let seed = 0; seed < 12; seed++) {
    const w = new Variant(KIND_DIAGONAL);
    w.seed(seed);
    const p = w.generate(2);
    const values = p.slice();
    for (let k = 0; k < 60 && values.includes(0); k++) {
      if (!w.hint(values, p)) break;
      units.add(w.stepUnit);
      values[w.stepCell] = w.stepDigit;
    }
  }
  expect(units.has(UNIT_REVEAL) || units.has(UNIT_DIAGONAL)).toBe(true);
});
