'use strict';
const fs = require('fs');
const path = require('path');
const { Sudoku } = require('../src/engine.js');

const OUT = path.join(__dirname, '..', 'src', 'weekly.json');
const FIRST = [2026, 40];
const LAST = [2028, 52];
const LOW = 75, HIGH = 84, TRIES = 600;

function weeksInYear(year) {
  const dec28 = new Date(Date.UTC(year, 11, 28));
  const thursday = new Date(dec28.getTime() + (3 - (dec28.getUTCDay() + 6) % 7) * 86400e3);
  return Math.floor((thursday - Date.UTC(thursday.getUTCFullYear(), 0, 1)) / 86400e3 / 7) + 1;
}

function weekIds() {
  const ids = [];
  for (let [year, week] = FIRST; year < LAST[0] || (year === LAST[0] && week <= LAST[1]);) {
    ids.push(year + '-W' + (week < 10 ? '0' : '') + week);
    if (++week > weeksInYear(year)) { year++; week = 1; }
  }
  return ids;
}

const e = new Sudoku();
const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const out = {};
const t0 = performance.now();
for (const id of weekIds()) {
  if (existing[id]) {
    out[id] = existing[id];
    continue;
  }
  e.seed(+id.slice(0, 4) * 100 + +id.slice(6));
  let best = null, bestRating = 0;
  for (let i = 0; i < TRIES; i++) {
    const puzzle = e.generate(4);
    const r = e.rating;
    if (r >= LOW && r < HIGH) { best = puzzle; bestRating = r; break; }
    if (r < HIGH && r > bestRating) { best = puzzle; bestRating = r; }
  }
  out[id] = best.join('');
  console.log(id, bestRating, ((performance.now() - t0) / 1000).toFixed(0) + ' s');
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log('yazildi', OUT, Object.keys(out).length, 'hafta');
