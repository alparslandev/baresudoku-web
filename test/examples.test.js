import { test, expect } from "bun:test";
const { Sudoku, candidates, bit } = require("../src/engine.js");
const examples = require("../src/examples.json");

const CODES = { "naked-single": 0, "hidden-single": 0, "locked-candidates": 1, "naked-pairs": 2, "hidden-pairs": 2, "x-wing": 3, "y-wing": 4, "swordfish": 5, "xyz-wing": 6 };
const digits = s => Array.from(s, ch => ch.charCodeAt(0) - 48);

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
    }
  });
}
