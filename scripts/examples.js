'use strict';
const fs = require('fs');
const path = require('path');
const { Sudoku, candidates, bit, PEERS, ROW, COL, BOX } = require('../src/engine.js');

const OUT = path.join(__dirname, '..', 'src', 'examples.json');
const BUDGET_MS = 90000;
const UNITS = [];
for (let u = 0; u < 9; u++) {
  const r = [], c = [], b = [];
  for (let k = 0; k < 9; k++) {
    r.push(u * 9 + k);
    c.push(k * 9 + u);
    b.push(((u / 3) | 0) * 27 + (u % 3) * 3 + ((k / 3) | 0) * 9 + (k % 3));
  }
  UNITS[u] = r;
  UNITS[9 + u] = c;
  UNITS[18 + u] = b;
}
const pop = m => { let n = 0; while (m) { n++; m &= m - 1; } return n; };
const low = m => 31 - Math.clz32(m & -m);
const digitsOf = m => { const a = []; for (let d = 1; d <= 9; d++) if (m & bit(d)) a.push(d); return a; };
const bitsOf = m => { const a = []; for (let k = 0; k < 9; k++) if (m & (1 << k)) a.push(k); return a; };
const unitIndex = cells => UNITS.findIndex(u => u.every((c, k) => c === cells[k]));

let rec = null;
let running = null;
let lineType = -1;

function diff(before, after) {
  const elim = [];
  for (let c = 0; c < 81; c++) {
    const gone = before[c] & ~after[c];
    if (gone) for (const d of digitsOf(gone)) elim.push([c, d]);
  }
  return elim;
}

function hook(name, describe) {
  const orig = Sudoku.prototype[name];
  Sudoku.prototype[name] = function (...args) {
    const before = rec === null ? this.lc.slice() : null;
    const changed = orig.apply(this, args);
    if (changed && rec === null) rec = Object.assign({ elim: diff(before, this.lc) }, describe(args, before, this));
    return changed;
  };
}

function track(name) {
  const orig = Sudoku.prototype[name];
  Sudoku.prototype[name] = function (...args) {
    running = name;
    try {
      return orig.apply(this, args);
    } finally {
      running = null;
    }
  };
}

function recordLineType() {
  const orig = Sudoku.prototype.fillLineMasks;
  Sudoku.prototype.fillLineMasks = function (b, t) {
    lineType = t;
    return orig.call(this, b, t);
  };
}

hook('clearOthers', ([cells, digits, members]) => ({
  tech: 'naked-pairs', kind: pop(digits) === 2 ? 'pair' : 'triple', unit: unitIndex(cells), cells: bitsOf(members).map(k => cells[k]), digits: digitsOf(digits)
}));
hook('keepOnly', ([cells, members, digits]) => ({
  tech: 'hidden-pairs', kind: pop(digits) === 2 ? 'pair' : 'triple', unit: unitIndex(cells), cells: bitsOf(members).map(k => cells[k]), digits: digitsOf(digits)
}));
hook('fishClear', ([b, t, coverMask, baseMask], before) => {
  const d = digitsOf(b)[0];
  const base = bitsOf(baseMask), cover = bitsOf(coverMask);
  const cells = [];
  for (let c = 0; c < 81; c++) {
    const line = t === 0 ? ROW[c] : COL[c];
    if (base.includes(line) && (before[c] & b)) cells.push(c);
  }
  return { tech: base.length === 2 ? 'x-wing' : 'swordfish', kind: t === 0 ? 'rows' : 'cols', t, base, cover, cells, digits: [d] };
});
function yWingPattern([z, c1, c2], before) {
  const zd = digitsOf(z)[0];
  const am = before[c1], bm = before[c2];
  const pm = (am | bm) & ~z;
  let pivot = -1;
  for (let p = 0; p < 81 && pivot < 0; p++) if (before[p] === pm && PEERS[p].includes(c1) && PEERS[p].includes(c2)) pivot = p;
  const x = digitsOf(am & pm)[0], y = digitsOf(bm & pm)[0];
  return { tech: 'y-wing', kind: 'y', pivot, wings: [c1, c2], x, y, z: zd, cells: [pivot, c1, c2], digits: digitsOf(pm) };
}

function xyzWingPattern([z, c1, c2, c3], before) {
  const zd = digitsOf(z)[0];
  const x = digitsOf(before[c1] & ~z)[0], y = digitsOf(before[c2] & ~z)[0];
  return { tech: 'xyz-wing', kind: 'xyz', pivot: c3, wings: [c1, c2], x, y, z: zd, cells: [c3, c1, c2], digits: digitsOf(before[c3]) };
}

function otherCandidate(unit, cell, b, before) {
  return UNITS[unit].find(c => c !== cell && (before[c] & b));
}

function skyscraperPattern([b, top1, top2], before) {
  const t = lineType;
  const lines = t === 0 ? [ROW[top1], ROW[top2]] : [COL[top1], COL[top2]];
  const bases = [otherCandidate(t * 9 + lines[0], top1, b, before), otherCandidate(t * 9 + lines[1], top2, b, before)];
  const baseLine = t === 0 ? COL[bases[0]] : ROW[bases[0]];
  return { tech: 'skyscraper', kind: t === 0 ? 'rows' : 'cols', t, lines, baseLine, bases, tops: [top1, top2], cells: [bases[0], top1, bases[1], top2], unit: -1, digits: digitsOf(b) };
}

function kitePattern([b, rowEnd, colEnd], before) {
  const row = ROW[rowEnd], col = COL[colEnd];
  const rowInBox = otherCandidate(row, rowEnd, b, before);
  const colInBox = otherCandidate(9 + col, colEnd, b, before);
  const box = BOX[rowInBox];
  return { tech: 'two-string-kite', kind: 'kite', row, col, box, rowEnd, rowInBox, colInBox, colEnd, cells: [rowEnd, rowInBox, colInBox, colEnd], unit: 18 + box, digits: digitsOf(b) };
}

function wWingPattern([z, p, q], before) {
  const xb = before[p] & ~z;
  const x = digitsOf(xb)[0], zd = digitsOf(z)[0];
  for (let u = 0; u < 27; u++) {
    const ends = UNITS[u].filter(c => before[c] & xb);
    if (ends.length !== 2) continue;
    const [e1, e2] = ends;
    const links = PEERS[e1].includes(p) && PEERS[e2].includes(q) ? [e1, e2] : PEERS[e1].includes(q) && PEERS[e2].includes(p) ? [e2, e1] : null;
    if (links) return { tech: 'w-wing', kind: 'w', x, z: zd, wings: [p, q], links, cells: [p, links[0], links[1], q], unit: u, digits: [x, zd] };
  }
  throw new Error('W-Wing baglantisi bulunamadi');
}

const SEEING = { yWing: yWingPattern, xyzWing: xyzWingPattern, skyscraper: skyscraperPattern, twoStringKite: kitePattern, wWing: wWingPattern };
for (const name of Object.keys(SEEING)) track(name);
recordLineType();
hook('clearSeeing', (args, before) => {
  const describe = SEEING[running];
  if (!describe) throw new Error('clearSeeing beklenmeyen yerden cagrildi: ' + running);
  return describe(args, before);
});
hook('uniqueRectangle', (args, before, engine) => {
  const corners = Array.from(engine.corners);
  const target = corners.find(c => before[c] !== engine.lc[c]);
  const pair = before[target] & ~engine.lc[target];
  const floor = corners.filter(c => c !== target);
  const boxes = [...new Set(corners.map(c => BOX[c]))];
  return { tech: 'unique-rectangle', kind: 'type1', corners, target, floor, boxes, extra: digitsOf(engine.lc[target]), cells: corners, unit: -1, digits: digitsOf(pair) };
});

function firstLocked(lc) {
  for (let d = 1; d <= 9; d++) {
    const b = bit(d);
    for (let box = 0; box < 9; box++) {
      let rows = 0, cols = 0;
      const cells = [];
      for (const c of UNITS[18 + box]) if (lc[c] & b) { rows |= 1 << ROW[c]; cols |= 1 << COL[c]; cells.push(c); }
      for (const [mask, offset] of [[rows, 0], [cols, 9]]) {
        if (!mask || pop(mask) !== 1) continue;
        const line = offset + low(mask);
        const elim = UNITS[line].filter(c => BOX[c] !== box && (lc[c] & b)).map(c => [c, d]);
        if (elim.length) return { tech: 'locked-candidates', kind: 'pointing', unit: 18 + box, line, box, cells, digits: [d], elim };
      }
    }
    for (let line = 0; line < 18; line++) {
      let boxes = 0;
      const cells = [];
      for (const c of UNITS[line]) if (lc[c] & b) { boxes |= 1 << BOX[c]; cells.push(c); }
      if (!boxes || pop(boxes) !== 1) continue;
      const box = low(boxes);
      const elim = UNITS[18 + box].filter(c => !UNITS[line].includes(c) && (lc[c] & b)).map(c => [c, d]);
      if (elim.length) return { tech: 'locked-candidates', kind: 'claiming', unit: line, line, box, cells, digits: [d], elim };
    }
  }
  return null;
}

function freshState(e) {
  for (let i = 0; i < 81; i++) if (!e.lv[i] && e.lc[i] !== candidates(e.lv, i)) return false;
  return true;
}

function unitsPlaced(values, cell) {
  const counts = [UNITS[ROW[cell]], UNITS[9 + COL[cell]], UNITS[18 + BOX[cell]]].map(unit => unit.filter(c => c !== cell && values[c]).length);
  return Math.min(...counts);
}

function boxEmpties(values, box) {
  return UNITS[18 + box].filter(c => !values[c]);
}

const WANT = {
  'naked-single': { level: 0, slots: ['single'] },
  'hidden-single': { level: 1, slots: ['box'] },
  'locked-candidates': { level: 2, slots: ['pointing', 'claiming'] },
  'naked-pairs': { level: 2, slots: ['pair', 'triple'] },
  'hidden-pairs': { level: 2, slots: ['pair'] },
  'x-wing': { level: 3, slots: ['rows'] },
  'y-wing': { level: 3, slots: ['y'] },
  'swordfish': { level: 3, slots: ['rows'] },
  'xyz-wing': { level: 3, slots: ['xyz'] },
  'skyscraper': { level: 3, slots: ['rows'] },
  'two-string-kite': { level: 3, slots: ['kite'] },
  'w-wing': { level: 3, slots: ['w'] },
  'unique-rectangle': { level: 3, slots: ['type1'] }
};

function keptExamples() {
  if (process.argv.includes('--all') || !fs.existsSync(OUT)) return {};
  const old = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const kept = {};
  for (const tech of Object.keys(WANT)) {
    const list = old[tech];
    if (Array.isArray(list) && list.map(ex => ex.kind).join() === WANT[tech].slots.join()) kept[tech] = list;
  }
  return kept;
}

const KEPT = keptExamples();
const SEARCH = Object.keys(WANT).filter(tech => !KEPT[tech]);
const LEVELS = [...new Set(SEARCH.map(tech => WANT[tech].level))];

const found = {};
for (const tech of SEARCH) found[tech] = {};

function offer(tech, kind, example) {
  if (KEPT[tech]) return;
  const slots = WANT[tech].slots;
  if (!slots.includes(kind)) return;
  const filled = example.values.split('').filter(ch => ch !== '0').length;
  const score = (example.fresh ? 100 : 0) + (example.values === example.given ? 100 : 0) + 30 - Math.abs(filled - 45) - 3 * Math.max(0, example.elim.length - 4);
  const current = found[tech][kind];
  if (!current || score > current.score) found[tech][kind] = Object.assign({ score }, example);
}

function walk(e, puzzle, solution) {
  e.load(puzzle);
  const given = puzzle.join('');
  while (!e.complete()) {
    if (e.stuck()) return;
    const values = Array.from(e.lv);
    const cands = Array.from(e.lc);
    const fresh = freshState(e);
    rec = null;
    const t = e.step();
    if (t < 0) return;
    const base = { given, values: values.join(''), solution: solution.join(''), cands, fresh };
    if (t === 0) {
      const cell = e.stepCell, d = e.stepDigit, u = e.stepUnit;
      if (u === 3 && fresh && unitsPlaced(values, cell) >= 2) offer('naked-single', 'single', Object.assign({ tech: 'naked-single', kind: 'single', cells: [cell], unit: -1, digits: [d], elim: [], place: [cell, d] }, base));
      else if (u === 2 && fresh) {
        const box = BOX[cell];
        const empties = boxEmpties(values, box);
        const others = empties.filter(c => c !== cell);
        if (others.length >= 2 && others.every(c => !(candidates(values, c) & bit(d)))) {
          offer('hidden-single', 'box', Object.assign({ tech: 'hidden-single', kind: 'box', cells: [cell], unit: 18 + box, box, empties, digits: [d], elim: [], place: [cell, d] }, base));
        }
      }
    } else if (t === 1) {
      const r = firstLocked(cands);
      if (r) {
        const lineIsRow = r.line < 9;
        if (lineIsRow) offer(r.tech, r.kind, Object.assign(r, { place: null }, base));
      }
    } else if (rec) {
      if (rec.tech === 'x-wing' || rec.tech === 'swordfish' || rec.tech === 'skyscraper') {
        if (rec.t === 0) offer(rec.tech, rec.kind, Object.assign(rec, { unit: -1, place: null }, base));
      } else if (rec.tech === 'y-wing' || rec.tech === 'xyz-wing') {
        if (rec.pivot >= 0) offer(rec.tech, rec.kind, Object.assign(rec, { unit: -1, place: null }, base));
      } else offer(rec.tech, rec.kind, Object.assign(rec, { place: null }, base));
    }
  }
}

function ideal(tech, ex) {
  if (!ex || !ex.fresh) return false;
  return tech.endsWith('-single') ? ex.values === ex.given : true;
}

function done() {
  return SEARCH.every(tech => WANT[tech].slots.every(kind => ideal(tech, found[tech][kind])));
}

const e = new Sudoku();
const start = Date.now();
let n = 0;
while (Date.now() - start < BUDGET_MS && !done()) {
  const puzzle = e.generate(LEVELS[n % LEVELS.length]);
  walk(e, puzzle, e.solution);
  n++;
}

const out = {};
for (const tech of Object.keys(WANT)) {
  if (KEPT[tech]) {
    out[tech] = KEPT[tech];
    console.log(tech, 'korundu');
    continue;
  }
  out[tech] = [];
  for (const kind of WANT[tech].slots) {
    const ex = found[tech][kind];
    if (!ex) throw new Error('ornek bulunamadi: ' + tech + ' ' + kind);
    delete ex.score;
    delete ex.t;
    out[tech].push(ex);
    console.log(tech, kind, 'fresh=' + ex.fresh, 'initial=' + (ex.values === ex.given), 'elim=' + ex.elim.length, 'cells=' + ex.cells.join(','));
  }
}
fs.writeFileSync(OUT, JSON.stringify(out) + '\n');
console.log(n + ' bulmaca, ' + ((Date.now() - start) / 1000).toFixed(1) + ' s, ' + OUT);
