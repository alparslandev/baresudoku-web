import { test, expect } from "bun:test";
const { Sudoku, TECH_BASE } = require("../src/engine.js");
const practice = require("../src/practice.json");

const SLUGS = ["naked-single", "hidden-single", "locked-candidates", "naked-pairs", "hidden-pairs", "x-wing", "swordfish", "skyscraper", "two-string-kite", "y-wing", "xyz-wing", "w-wing", "unique-rectangle", "finned-x-wing", "empty-rectangle", "unique-rectangle-type-4", "hidden-rectangle", "finned-swordfish", "wxyz-wing"];
const BY_TECH = { "locked-candidates": 1, "x-wing": 3, "y-wing": 4, "swordfish": 5, "xyz-wing": 6, "skyscraper": 7, "two-string-kite": 8, "w-wing": 9, "unique-rectangle": 10, "finned-x-wing": 14, "finned-swordfish": 15, "empty-rectangle": 17, "wxyz-wing": 19, "unique-rectangle-type-4": 22, "hidden-rectangle": 25 };
const NAKED_PAIR = TECH_BASE[2], HIDDEN_PAIR = 34, NAKED_TRIPLE = 36, HIDDEN_TRIPLE = 40;
const LEVEL_OF = slug => slug === "naked-single" ? 0 : slug === "hidden-single" ? 1 : ["locked-candidates", "naked-pairs", "hidden-pairs"].includes(slug) ? 2 : 3;

function solvePath(e, puzzle) {
  e.load(puzzle);
  const steps = [];
  while (!e.complete()) {
    expect(e.stuck()).toBe(false);
    const t = e.step();
    expect(t).toBeGreaterThanOrEqual(0);
    steps.push({ t, r: e.stepRating, u: t === 0 ? e.stepUnit : -1 });
  }
  return steps;
}

function fits(slug, steps) {
  const max = Math.max(...steps.map(s => s.r));
  const hardest = steps.filter(s => s.r === max);
  if (slug === "naked-single") return max === TECH_BASE[0] && steps.every(s => s.u === 3);
  if (slug === "hidden-single") return max === TECH_BASE[0] && steps.some(s => s.u !== 3);
  if (slug === "naked-pairs") return hardest.every(s => s.t === 2) && (max === NAKED_PAIR || max === NAKED_TRIPLE);
  if (slug === "hidden-pairs") return hardest.every(s => s.t === 2) && (max === HIDDEN_PAIR || max === HIDDEN_TRIPLE);
  return hardest.some(s => s.t === BY_TECH[slug]);
}

test("alistirma havuzu: her teknik sayfasina 10 tek cozumlu bulmaca, en zor adim sayfanin teknigi", () => {
  const e = new Sudoku();
  expect(Object.keys(practice)).toEqual(SLUGS);
  for (const slug of SLUGS) {
    const items = practice[slug];
    expect(items.length).toBe(10);
    expect(new Set(items.map(item => item.p)).size).toBe(10);
    for (const item of items) {
      expect(item.p).toMatch(/^[0-9]{81}$/);
      expect(item.l).toBe(LEVEL_OF(slug));
      const puzzle = item.p.split("").map(Number);
      expect(e.countSolutions(puzzle, 2)).toBe(1);
      const steps = solvePath(e, puzzle);
      expect(Math.max(...steps.map(s => s.r))).toBe(item.r);
      expect(fits(slug, steps)).toBe(true);
      if (slug === "naked-single") expect(puzzle.filter(v => v).length).toBeGreaterThanOrEqual(38);
    }
  }
});
