import { test, expect } from "bun:test";
const { Sudoku, candidates, bit, PEERS, ROW, COL, BOX } = require("../src/engine.js");
const examples = require("../src/examples.json");

const CODES = { "naked-single": 0, "hidden-single": 0, "locked-candidates": 1, "naked-pairs": 2, "hidden-pairs": 2, "x-wing": 3, "y-wing": 4, "swordfish": 5, "xyz-wing": 6, "skyscraper": 7, "two-string-kite": 8, "w-wing": 9, "unique-rectangle": 10, "finned-x-wing": 14, "finned-swordfish": 15, "empty-rectangle": 17, "wxyz-wing": 19, "unique-rectangle-type-4": 22, "hidden-rectangle": 25 };
const digits = s => Array.from(s, ch => ch.charCodeAt(0) - 48);
const sees = (a, b) => PEERS[a].includes(b);
const holding = (ex, d, cells) => cells.filter(c => ex.cands[c] & bit(d)).sort((a, b) => a - b);
const rowCells = r => Array.from({ length: 9 }, (_, k) => r * 9 + k);
const colCells = c => Array.from({ length: 9 }, (_, k) => k * 9 + c);
const unitCells = u => u < 9 ? rowCells(u) : u < 18 ? colCells(u - 9) : Array.from({ length: 81 }, (_, c) => c).filter(c => BOX[c] === u - 18);
const sorted = cells => cells.slice().sort((a, b) => a - b);
const PATTERNS = {
  "skyscraper": ex => {
    const d = ex.digits[0];
    ex.lines.forEach((r, k) => {
      expect(holding(ex, d, rowCells(r))).toEqual(sorted([ex.bases[k], ex.tops[k]]));
      expect(COL[ex.bases[k]]).toBe(ex.baseLine);
    });
    expect(COL[ex.tops[0]]).not.toBe(COL[ex.tops[1]]);
    for (const [c, e] of ex.elim) expect([e, sees(c, ex.tops[0]), sees(c, ex.tops[1])]).toEqual([d, true, true]);
  },
  "two-string-kite": ex => {
    const d = ex.digits[0];
    expect(holding(ex, d, rowCells(ex.row))).toEqual(sorted([ex.rowEnd, ex.rowInBox]));
    expect(holding(ex, d, colCells(ex.col))).toEqual(sorted([ex.colEnd, ex.colInBox]));
    expect([BOX[ex.rowInBox], BOX[ex.colInBox]]).toEqual([ex.box, ex.box]);
    for (const [c, e] of ex.elim) expect([e, sees(c, ex.rowEnd), sees(c, ex.colEnd)]).toEqual([d, true, true]);
  },
  "w-wing": ex => {
    const pair = bit(ex.x) | bit(ex.z);
    expect([ex.cands[ex.wings[0]], ex.cands[ex.wings[1]]]).toEqual([pair, pair]);
    expect(sees(ex.wings[0], ex.wings[1])).toBe(false);
    expect(holding(ex, ex.x, unitCells(ex.unit))).toEqual(sorted(ex.links));
    expect([sees(ex.links[0], ex.wings[0]), sees(ex.links[1], ex.wings[1])]).toEqual([true, true]);
    for (const [c, e] of ex.elim) expect([e, sees(c, ex.wings[0]), sees(c, ex.wings[1])]).toEqual([ex.z, true, true]);
  },
  "unique-rectangle": ex => {
    const pair = bit(ex.digits[0]) | bit(ex.digits[1]);
    expect(new Set(ex.corners.map(c => ROW[c])).size).toBe(2);
    expect(new Set(ex.corners.map(c => COL[c])).size).toBe(2);
    expect(sorted(ex.corners.map(c => BOX[c]).filter((b, k, all) => all.indexOf(b) === k))).toEqual(sorted(ex.boxes));
    expect(ex.boxes.length).toBe(2);
    for (const c of ex.floor) expect(ex.cands[c]).toBe(pair);
    expect(ex.cands[ex.target]).toBe(ex.extra.reduce((m, d) => m | bit(d), pair));
    expect(ex.elim).toEqual(ex.digits.map(d => [ex.target, d]));
  },
  "finned-x-wing": ex => finned(ex, 2),
  "finned-swordfish": ex => finned(ex, 3),
  "empty-rectangle": ex => {
    const d = ex.digits[0];
    const boxHeld = holding(ex, d, unitCells(18 + ex.box));
    expect(boxHeld.length).toBeGreaterThan(1);
    for (const c of boxHeld) expect(ROW[c] === ex.row || COL[c] === ex.col).toBe(true);
    expect(holding(ex, d, unitCells(ex.linkUnit))).toEqual(sorted([ex.linkA, ex.linkB]));
    expect(unitCells(ex.erA)).toContain(ex.linkA);
    expect([ex.erA, ex.erB].sort((a, b) => a - b)).toEqual([ex.row, 9 + ex.col]);
    expect(BOX[ex.linkB]).not.toBe(ex.box);
    expect(ex.elim.length).toBe(1);
    const [c, e] = ex.elim[0];
    expect([e, sees(c, ex.linkB), unitCells(ex.erB).includes(c), BOX[c] === ex.box]).toEqual([d, true, true, false]);
  },
  "wxyz-wing": ex => {
    const union = ex.cells.reduce((m, c) => m | ex.cands[c], 0);
    expect(digitsOf(union)).toEqual(ex.digits);
    expect(ex.digits.length).toBe(4);
    const held = d => ex.cells.filter(c => ex.cands[c] & bit(d));
    const confined = d => held(d).every(c => held(d).every(o => o === c || sees(c, o)));
    expect(ex.digits.filter(d => !confined(d))).toEqual([ex.z]);
    expect(ex.others).toEqual(ex.digits.filter(d => d !== ex.z));
    expect(held(ex.z)).toEqual(ex.zCells);
    for (const [c, e] of ex.elim) expect([e, ex.zCells.every(z => sees(c, z))]).toEqual([ex.z, true]);
  },
  "unique-rectangle-type-4": ex => {
    rectangle(ex);
    const pair = bit(ex.a) | bit(ex.b);
    for (const c of ex.floor) expect(ex.cands[c]).toBe(pair);
    for (const c of ex.roof) expect([(ex.cands[c] & pair) === pair, ex.cands[c] !== pair]).toEqual([true, true]);
    expect(holding(ex, ex.a, unitCells(ex.unit))).toEqual(sorted(ex.roof));
    expect(sorted(ex.elim.map(([c]) => c))).toEqual(sorted(ex.roof));
    for (const [, e] of ex.elim) expect(e).toBe(ex.b);
  },
  "hidden-rectangle": ex => {
    rectangle(ex);
    const pair = bit(ex.a) | bit(ex.b);
    for (const c of ex.corners) expect(ex.cands[c] & pair).toBe(pair);
    expect(ex.cands[ex.pivot]).toBe(pair);
    expect(ex.extra.length).toBeGreaterThan(0);
    expect(ex.cands[ex.target]).toBe(ex.extra.reduce((m, d) => m | bit(d), pair));
    expect([ROW[ex.sideA], COL[ex.sideA], ROW[ex.sideB], COL[ex.sideB]]).toEqual([ROW[ex.target], COL[ex.pivot], ROW[ex.pivot], COL[ex.target]]);
    expect(holding(ex, ex.a, rowCells(ROW[ex.target]))).toEqual(sorted([ex.target, ex.sideA]));
    expect(holding(ex, ex.a, colCells(COL[ex.target]))).toEqual(sorted([ex.target, ex.sideB]));
    expect(ex.elim).toEqual([[ex.target, ex.b]]);
  }
};
const digitsOf = m => { const a = []; for (let d = 1; d <= 9; d++) if (m & bit(d)) a.push(d); return a; };
function rectangle(ex) {
  expect(new Set(ex.corners.map(c => ROW[c])).size).toBe(2);
  expect(new Set(ex.corners.map(c => COL[c])).size).toBe(2);
  expect(sorted(ex.corners.map(c => BOX[c]).filter((b, k, all) => all.indexOf(b) === k))).toEqual(sorted(ex.boxes));
  expect(ex.boxes.length).toBe(2);
}
function finned(ex, size) {
  const d = ex.digits[0];
  expect(ex.base.length).toBe(size);
  expect(ex.cover.length).toBe(size);
  expect(ex.fins.length).toBe(1);
  const fin = ex.fins[0];
  expect(BOX[fin]).toBe(ex.finBox);
  expect(ex.base).toContain(ROW[fin]);
  expect(ex.cover).not.toContain(COL[fin]);
  for (const r of ex.base) {
    const held = holding(ex, d, rowCells(r));
    for (const c of held) expect(c === fin || ex.cover.includes(COL[c])).toBe(true);
    expect(held.filter(c => c !== fin).length).toBeGreaterThan(1);
  }
  expect(sorted(ex.cells)).toEqual(sorted(ex.base.flatMap(r => holding(ex, d, rowCells(r)))));
  for (const [c, e] of ex.elim) expect([e, ex.cover.includes(COL[c]), ex.base.includes(ROW[c]), BOX[c]]).toEqual([d, true, false, ex.finBox]);
}

for (const tech of Object.keys(CODES)) {
  test(`ornek: ${tech}`, () => {
    expect(examples[tech].length).toBeGreaterThan(0);
    for (const ex of examples[tech]) {
      const values = digits(ex.values), given = digits(ex.given), solution = digits(ex.solution);
      const e = new Sudoku();
      expect(e.countSolutions(given, 2)).toBe(1);
      expect(e.found).toEqual(solution);
      for (let c = 0; c < 81; c++) {
        if (given[c]) expect(values[c]).toBe(given[c]);
        if (values[c]) expect(values[c]).toBe(solution[c]);
        else {
          expect(ex.cands[c] & bit(solution[c])).not.toBe(0);
          expect(ex.cands[c]).toBe(candidates(values, c));
        }
      }
      e.lv.set(values);
      e.lc.set(ex.cands);
      expect(e.step()).toBe(CODES[tech]);
      if (ex.place) {
        expect(e.stepCell).toBe(ex.place[0]);
        expect(e.stepDigit).toBe(ex.place[1]);
        expect(solution[ex.place[0]]).toBe(ex.place[1]);
      } else {
        expect(ex.elim.length).toBeGreaterThan(0);
        for (const [c, d] of ex.elim) {
          expect(ex.cands[c] & bit(d)).not.toBe(0);
          expect(e.lc[c] & bit(d)).toBe(0);
          expect(solution[c]).not.toBe(d);
        }
      }
      for (const c of ex.cells) expect(values[c]).toBe(0);
      if (PATTERNS[tech]) PATTERNS[tech](ex);
    }
  });
}
