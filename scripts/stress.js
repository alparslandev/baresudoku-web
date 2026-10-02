'use strict';
const { Sudoku, bit, TECH_BASE, TECH_COUNT, MASTER_RATING, LEVELS } = require('../src/engine.js');

const NAMES = ['Single', 'Locked Candidates', 'Pair/Triple', 'X-Wing', 'Y-Wing', 'Swordfish', 'XYZ-Wing', 'Skyscraper', '2-String Kite', 'W-Wing', 'Unique Rectangle',
  'Naked Quad', 'Hidden Quad', 'Jellyfish', 'Finned X-Wing', 'Finned Swordfish', 'Finned Jellyfish', 'Empty Rectangle', 'Remote Pair', 'WXYZ-Wing',
  'Unique Rectangle Type 2', 'Unique Rectangle Type 3', 'Unique Rectangle Type 4', 'Unique Rectangle Type 5', 'Unique Rectangle Type 6', 'Hidden Rectangle', 'BUG+1',
  'X-Chain', 'XY-Chain', 'Continuous Nice Loop', 'AIC', 'Grouped AIC', 'Sue de Coq', 'ALS-XZ', 'ALS-XY-Wing', 'Death Blossom', 'ALS Chain',
  'Nishio Forcing Chain', 'Cell Forcing Chain', 'Unit Forcing Chain', 'Dynamic Forcing Net', 'Nested Forcing Net',
  'Sashimi X-Wing', 'Sashimi Swordfish', 'Sashimi Jellyfish'];
const LEVEL_NAMES = ['Easy', 'Medium', 'Hard', 'Expert', 'Master'];
const FORCING_RATING = 84;

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? +args[i + 1] : fallback;
};
const MINIMAL = option('minimal', 5000);
const TIMED = option('timed', 500);
const GENERATED = option('generated', 2000);
const WALKS = option('walks', 300);

const skipped = args.includes('--skip') ? args[args.indexOf('--skip') + 1].split(',').map(Number) : [];
const e = new Sudoku();
for (const id of skipped) e.techOff[id] = 1;
if (skipped.length) console.log('kapali teknikler:', skipped.join(','));
const usage = new Array(TECH_COUNT).fill(0);
const failures = [];
const now = () => performance.now();

function fail(what, puzzle) {
  failures.push(what + ' ' + puzzle.join(''));
  if (failures.length <= 10) console.log('HATA:', what, puzzle.join(''));
}

function minimalPuzzle() {
  const full = e.fullGrid();
  const puzzle = full.slice();
  const order = [];
  for (let c = 0; c < 81; c++) order.push(c);
  e.shuffle(order);
  for (const c of order) {
    const v = puzzle[c];
    puzzle[c] = 0;
    if (e.countSolutions(puzzle, 2) !== 1) puzzle[c] = v;
  }
  return { puzzle, solution: full };
}

let hardestBase = 0;

function solveChecked(puzzle, solution) {
  e.load(puzzle);
  let rating = 0;
  hardestBase = 0;
  while (!e.complete()) {
    if (e.stuck()) {
      fail('cikmaz', puzzle);
      return -2;
    }
    const t = e.step();
    if (t < 0) return -1;
    usage[t]++;
    if (e.stepRating > rating) rating = e.stepRating;
    if (TECH_BASE[t] > hardestBase) hardestBase = TECH_BASE[t];
    for (let c = 0; c < 81; c++) {
      if (e.lv[c] ? e.lv[c] !== solution[c] : !(e.lc[c] & bit(solution[c]))) {
        fail('yanlis adim teknik ' + t + ' hucre ' + c, puzzle);
        return -2;
      }
    }
  }
  return rating;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

const walkMs = [];

function walkHints(puzzle, solution, randomOrder, timed) {
  const values = puzzle.slice();
  const empties = [];
  for (let c = 0; c < 81; c++) if (!values[c]) empties.push(c);
  if (randomOrder) e.shuffle(empties);
  for (let k = 0; k < empties.length; k++) {
    const start = now();
    const found = e.hint(values, puzzle);
    if (timed) walkMs.push(now() - start);
    if (!found) return fail('ipucu yok', puzzle);
    if (values[e.stepCell] || solution[e.stepCell] !== e.stepDigit) return fail('ipucu yanlis', puzzle);
    if (e.hintTech < 0 || e.hintTech >= TECH_COUNT) return fail('ipucu teknigi aralik disi', puzzle);
    const c = randomOrder ? empties[k] : e.stepCell;
    values[c] = solution[c];
  }
}

const phases = { singles: 0, basic: 0, chains: 0, forcing: 0, unsolved: 0 };
const hintMs = [];
let t0 = now();
for (let i = 0; i < MINIMAL; i++) {
  const { puzzle, solution } = minimalPuzzle();
  const start = now();
  if (!e.hint(puzzle, puzzle)) fail('ilk ipucu yok', puzzle);
  hintMs.push(now() - start);
  const r = solveChecked(puzzle, solution);
  if (r === -1) {
    phases.unsolved++;
    if (phases.unsolved <= 20) console.log('COZULEMEDI', puzzle.join(''));
  } else if (r >= 0) {
    if (hardestBase <= TECH_BASE[0]) phases.singles++;
    else if (hardestBase < MASTER_RATING) phases.basic++;
    else if (hardestBase < FORCING_RATING) phases.chains++;
    else phases.forcing++;
    if (i < TIMED) walkHints(puzzle, solution, false, true);
  }
}
console.log(`minimal: ${MINIMAL} bulmaca, ${((now() - t0) / 1000).toFixed(1)} s, ipucu ms p50 ${percentile(hintMs, 0.5).toFixed(1)} p99 ${percentile(hintMs, 0.99).toFixed(1)} max ${percentile(hintMs, 1).toFixed(1)}`);
console.log('fazlar:', JSON.stringify(phases));
console.log(`ipucu yuruyusu (${Math.min(TIMED, MINIMAL)} minimal bulmaca, ${walkMs.length} cagri): ms p50 ${percentile(walkMs, 0.5).toFixed(2)} p99 ${percentile(walkMs, 0.99).toFixed(2)} max ${percentile(walkMs, 1).toFixed(2)}`);

for (let level = 0; level < LEVELS && GENERATED > 0; level++) {
  const ms = [];
  const ratings = {};
  t0 = now();
  for (let i = 0; i < GENERATED; i++) {
    const start = now();
    const puzzle = e.generate(level);
    ms.push(now() - start);
    const solution = e.solution;
    if (e.countSolutions(puzzle, 2) !== 1) fail('tek cozum yok', puzzle);
    const r = solveChecked(puzzle, solution);
    if (r < 0) fail('uretilen bulmaca cozulemedi', puzzle);
    e.rate(puzzle);
    const order = e.rateOrder;
    const ok = level < 2 ? r === TECH_BASE[0] : level === 2 ? order >= 1 && order <= 2 : level === 3 ? order >= 3 && r < MASTER_RATING : r >= MASTER_RATING;
    if (!ok) fail(LEVEL_NAMES[level] + ' derece ' + r + ' sira ' + order, puzzle);
    ratings[r] = (ratings[r] || 0) + 1;
    if (level >= 3 && i < WALKS) {
      walkHints(puzzle, solution, false);
      for (let k = 0; k < 3; k++) walkHints(puzzle, solution, true);
    }
  }
  console.log(`${LEVEL_NAMES[level]}: ${GENERATED} bulmaca, ${((now() - t0) / 1000).toFixed(1)} s, uretim ms p50 ${percentile(ms, 0.5).toFixed(1)} p95 ${percentile(ms, 0.95).toFixed(1)} max ${percentile(ms, 1).toFixed(1)}, dereceler ${JSON.stringify(ratings)}`);
}

console.log('teknik kullanimi:');
for (let id = 0; id < TECH_COUNT; id++) console.log(`  ${id} ${NAMES[id]} (${TECH_BASE[id]}): ${usage[id]}`);
console.log(failures.length ? 'HATA: ' + failures.length : 'TAMAM');
process.exit(failures.length ? 1 : 0);
