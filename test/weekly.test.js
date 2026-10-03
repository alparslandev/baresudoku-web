import { test, expect } from "bun:test";
const { Sudoku } = require("../src/engine.js");
const weekly = require("../src/weekly.json");

function nextWeek(id) {
  const year = +id.slice(0, 4), week = +id.slice(6);
  const dec28 = new Date(Date.UTC(year, 11, 28));
  const thursday = new Date(dec28.getTime() + (3 - (dec28.getUTCDay() + 6) % 7) * 86400e3);
  const weeks = Math.floor((thursday - Date.UTC(thursday.getUTCFullYear(), 0, 1)) / 86400e3 / 7) + 1;
  const [y, w] = week < weeks ? [year, week + 1] : [year + 1, 1];
  return y + "-W" + (w < 10 ? "0" : "") + w;
}

test("haftalik bulmacalar: ardisik haftalar, tek cozum, Usta ustu ve zorlama zinciri gerektirmeyen derece", () => {
  const e = new Sudoku();
  const ids = Object.keys(weekly);
  expect(ids[0]).toBe("2026-W40");
  expect(ids.length).toBeGreaterThan(100);
  for (let k = 1; k < ids.length; k++) expect(ids[k]).toBe(nextWeek(ids[k - 1]));
  for (const id of ids) {
    const puzzle = Array.from(weekly[id], Number);
    expect(weekly[id]).toMatch(/^[0-9]{81}$/);
    expect(e.countSolutions(puzzle, 2)).toBe(1);
    const r = e.rate(puzzle);
    expect(r).toBeGreaterThanOrEqual(75);
    expect(r).toBeLessThan(84);
  }
});
