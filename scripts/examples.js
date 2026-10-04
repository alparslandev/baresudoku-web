'use strict';
const fs = require('fs');
const path = require('path');
const { Sudoku, candidates, bit, PEERS, ROW, COL, BOX } = require('../src/engine.js');

const OUT = path.join(__dirname, '..', 'src', 'examples.json');
const BUDGET_MS = Number(process.env.EXAMPLES_BUDGET_MS) || 90000;
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
const sees = (a, b) => PEERS[a].includes(b);

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

const subsetKind = digits => pop(digits) === 2 ? 'pair' : pop(digits) === 3 ? 'triple' : 'quad';
hook('dropOutside', ([cells, digits, members]) => ({
  tech: 'naked-pairs', kind: subsetKind(digits), unit: unitIndex(cells), cells: bitsOf(members).map(k => cells[k]), digits: digitsOf(digits)
}));
hook('keepInside', ([cells, members, digits]) => ({
  tech: 'hidden-pairs', kind: subsetKind(digits), unit: unitIndex(cells), cells: bitsOf(members).map(k => cells[k]), digits: digitsOf(digits)
}));
hook('fishDrop', ([b, t, coverMask, baseMask], before) => {
  const d = digitsOf(b)[0];
  const base = bitsOf(baseMask), cover = bitsOf(coverMask);
  const cells = [];
  for (let c = 0; c < 81; c++) {
    const line = t === 0 ? ROW[c] : COL[c];
    if (base.includes(line) && (before[c] & b)) cells.push(c);
  }
  return { tech: base.length === 2 ? 'x-wing' : base.length === 3 ? 'swordfish' : 'jellyfish', kind: t === 0 ? 'rows' : 'cols', t, base, cover, cells, digits: [d] };
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

function finnedPattern([b, t, baseMask, coverMask], before) {
  const d = digitsOf(b)[0];
  const base = bitsOf(baseMask), cover = bitsOf(coverMask);
  const lineOf = c => t === 0 ? ROW[c] : COL[c];
  const acrossOf = c => t === 0 ? COL[c] : ROW[c];
  const cells = [], fins = [];
  for (let c = 0; c < 81; c++) {
    if (!(before[c] & b) || !base.includes(lineOf(c))) continue;
    cells.push(c);
    if (!cover.includes(acrossOf(c))) fins.push(c);
  }
  const finBox = BOX[fins[0]];
  const proper = base.every(l => cells.filter(c => lineOf(c) === l && !fins.includes(c)).length >= 2);
  const tech = base.length === 2 ? 'finned-x-wing' : base.length === 3 ? 'finned-swordfish' : 'finned-jellyfish';
  return { tech, kind: t === 0 ? 'rows' : 'cols', t, base, cover, fins, finBox, proper, cells, unit: 18 + finBox, digits: [d] };
}

function emptyRectanglePattern(args, before, engine) {
  const [[cell, d]] = diff(before, engine.lc);
  const b = bit(d);
  const holders = cells => cells.filter(c => before[c] & b);
  for (let box = 0; box < 9; box++) {
    const held = holders(UNITS[18 + box]);
    if (held.length < 2) continue;
    const band = (box / 3) | 0, stack = box % 3;
    for (let i = 0; i < 3; i++) {
      const row = band * 3 + i;
      for (let j = 0; j < 3; j++) {
        const col = stack * 3 + j;
        if (!held.every(c => ROW[c] === row || COL[c] === col)) continue;
        const shape = (linkA, linkB, erA, erB, linkUnit) => ({ tech: 'empty-rectangle', kind: 'er', box, row, col, linkUnit, linkA, linkB, erA, erB, cells: held.concat([linkA, linkB]), unit: 18 + box, digits: [d] });
        for (let line = 0; line < 9; line++) {
          if (((line / 3) | 0) === stack) continue;
          const pair = holders(UNITS[9 + line]);
          if (pair.length !== 2 || !pair.some(c => ROW[c] === row)) continue;
          const far = pair.find(c => ROW[c] !== row);
          if (((ROW[far] / 3) | 0) !== band && ROW[far] * 9 + col === cell) return shape(row * 9 + line, far, row, 9 + col, 9 + line);
        }
        for (let line = 0; line < 9; line++) {
          if (((line / 3) | 0) === band) continue;
          const pair = holders(UNITS[line]);
          if (pair.length !== 2 || !pair.some(c => COL[c] === col)) continue;
          const far = pair.find(c => COL[c] !== col);
          if (((COL[far] / 3) | 0) !== stack && row * 9 + COL[far] === cell) return shape(line * 9 + col, far, 9 + col, row, line);
        }
      }
    }
  }
  throw new Error('Empty Rectangle deseni bulunamadi');
}

function wxyzPattern([union], before, engine) {
  const quad = Array.from(engine.quad);
  const digits = digitsOf(union);
  const confined = d => {
    const held = quad.filter(c => before[c] & bit(d));
    return held.every(c => held.every(o => o === c || sees(c, o)));
  };
  const z = digits.find(d => !confined(d));
  return { tech: 'wxyz-wing', kind: 'wxyz', z, others: digits.filter(d => d !== z), zCells: quad.filter(c => before[c] & bit(z)), cells: quad, unit: -1, digits };
}

function boxesOf(corners) {
  return [...new Set(corners.map(c => BOX[c]))];
}

function urType4Pattern(args, before, engine) {
  const corners = Array.from(engine.corners);
  const elim = diff(before, engine.lc);
  const b = elim[0][1];
  const roof = corners.filter(c => elim.some(([e]) => e === c));
  const floor = corners.filter(c => !roof.includes(c));
  const a = digitsOf(before[floor[0]] & ~bit(b))[0];
  const line = ROW[roof[0]] === ROW[roof[1]] ? ROW[roof[0]] : 9 + COL[roof[0]];
  const confined = u => UNITS[u].every(c => roof.includes(c) || !(before[c] & bit(a)));
  const unit = confined(line) ? line : 18 + BOX[roof[0]];
  return { tech: 'unique-rectangle-type-4', kind: 'type4', corners, floor, roof, a, b, unit, boxes: boxesOf(corners), cells: corners, digits: [a, b] };
}

function hiddenRectanglePattern(args, before, engine) {
  const corners = Array.from(engine.corners);
  const [[target, b]] = diff(before, engine.lc);
  const pivot = corners[(corners.indexOf(target) + 2) & 3];
  const pair = before[pivot];
  const a = digitsOf(pair & ~bit(b))[0];
  return { tech: 'hidden-rectangle', kind: 'hidden', corners, pivot, target, sideA: ROW[target] * 9 + COL[pivot], sideB: ROW[pivot] * 9 + COL[target], a, b, extra: digitsOf(before[target] & ~pair), boxes: boxesOf(corners), cells: corners, unit: -1, digits: [a, b] };
}

function bugPattern(args, before, engine) {
  const [[tri]] = diff(before, engine.lc);
  const d = digitsOf(engine.lc[tri])[0];
  return { tech: 'bug-plus-1', kind: 'bug', cell: tri, d, others: digitsOf(before[tri] & ~bit(d)), cells: [tri], unit: -1, digits: [d] };
}

function chainSearch(engine, s, limit) {
  const start = engine.linkStart, to = engine.linkTo;
  const parent = new Map([[s * 2, -1]]);
  const depth = new Map([[s * 2, 0]]);
  const queue = [s * 2];
  for (let head = 0; head < queue.length; head++) {
    const st = queue[head];
    const d = depth.get(st) + 1;
    if (d >= limit) break;
    for (let k = start[st]; k < start[st + 1]; k++) {
      const ch = to[k];
      if (parent.has(ch)) continue;
      parent.set(ch, st);
      depth.set(ch, d);
      queue.push(ch);
      if (!(ch & 1)) continue;
      if (engine.targets(s, ch >> 1, false) && engine.targets(s, ch >> 1, true)) {
        const path = [];
        for (let x = ch; x !== -1; x = parent.get(x)) path.unshift(x);
        return { depth: d, path };
      }
    }
  }
  return null;
}

const CHAIN_TECH = { 27: 'x-chain', 28: 'xy-chain', 30: 'aic' };

function chainPattern([id], before, engine) {
  const tech = CHAIN_TECH[id];
  if (!tech) return { tech: 'other-chain', kind: 'none' };
  const after = engine.lc.slice();
  engine.lc.set(before);
  let best = 0x7fffffff, path = null;
  try {
    for (let s = 0; s < 729 + engine.groupCount; s++) {
      if (engine.linkStart[s * 2] === engine.linkStart[s * 2 + 1]) continue;
      const found = chainSearch(engine, s, best);
      if (found) {
        best = found.depth;
        path = found.path;
      }
    }
  } finally {
    engine.lc.set(after);
  }
  if (!path) throw new Error('zincir yolu bulunamadi: ' + id);
  const nodes = path.map(st => [((st >> 1) / 9) | 0, (st >> 1) % 9 + 1, st & 1]);
  const cells = [];
  for (const [c] of nodes) if (!cells.includes(c)) cells.push(c);
  const digits = [...new Set(nodes.map(n => n[1]))].sort((a, b) => a - b);
  return { tech, kind: 'chain', nodes, cells, digits, unit: -1, start: nodes[0].slice(0, 2), end: nodes[nodes.length - 1].slice(0, 2) };
}

let alsArgs = null;
const plainDropSeen = Sudoku.prototype.dropSeen;
Sudoku.prototype.dropSeen = function (i, j, d) {
  const changed = plainDropSeen.call(this, i, j, d);
  if (changed && running === 'alsXz' && alsArgs === null) alsArgs = [i, j, d];
  return changed;
};

function alsCellsOf(engine, i) {
  const cells = [];
  for (let c = 0; c < 81; c++) if (engine.alsHas(i, c)) cells.push(c);
  return cells;
}

function alsXzPattern(args, before, engine) {
  const [i, j, d] = alsArgs;
  if (i === j) return { tech: 'als-xz', kind: 'double' };
  const alsA = alsCellsOf(engine, i), alsB = alsCellsOf(engine, j);
  const x = digitsOf(engine.restrictedCommon(i, j));
  return { tech: 'als-xz', kind: x.length === 1 ? 'single' : 'double', alsA, alsB, digitsA: digitsOf(engine.alsDigits[i]), digitsB: digitsOf(engine.alsDigits[j]), x: x[0], z: d + 1, cells: alsA.concat(alsB), unit: -1, digits: [x[0], d + 1] };
}

track('alsXz');
hook('finnedDrop', finnedPattern);
hook('bugPlusOne', bugPattern);
hook('chains', chainPattern);
hook('alsXz', alsXzPattern);
hook('emptyRectangle', emptyRectanglePattern);
hook('wingDrop', wxyzPattern);
hook('urType4', urType4Pattern);
hook('hiddenRectangle', hiddenRectanglePattern);

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
  'unique-rectangle': { level: 3, slots: ['type1'] },
  'finned-x-wing': { level: 3, slots: ['rows'] },
  'empty-rectangle': { level: 3, slots: ['er'] },
  'unique-rectangle-type-4': { level: 3, slots: ['type4'] },
  'hidden-rectangle': { level: 3, slots: ['hidden'] },
  'finned-swordfish': { level: 3, slots: ['rows'] },
  'wxyz-wing': { level: 3, slots: ['wxyz'] },
  'jellyfish': { level: 3, slots: ['rows'] },
  'bug-plus-1': { level: 3, slots: ['bug'] },
  'x-chain': { level: 4, slots: ['chain'] },
  'xy-chain': { level: 4, slots: ['chain'] },
  'aic': { level: 4, slots: ['chain'] },
  'als-xz': { level: 4, slots: ['single'] }
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
  if (!WANT[tech] || KEPT[tech]) return;
  const slots = WANT[tech].slots;
  if (!slots.includes(kind)) return;
  const filled = example.values.split('').filter(ch => ch !== '0').length;
  const size = example.nodes ? 4 * example.nodes.length : example.alsA ? 6 * (example.alsA.length + example.alsB.length) : 0;
  const values = Array.from(example.values, Number);
  let prior = 0;
  for (let c = 0; c < 81; c++) if (!values[c]) prior += pop(candidates(values, c) & ~example.cands[c]);
  const score = (example.fresh ? 100 : 0) + (example.values === example.given ? 100 : 0) + 30 - Math.abs(filled - 45) - 3 * Math.max(0, example.elim.length - 4) - size - 3 * prior;
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
    alsArgs = null;
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
      if (rec.tech === 'x-wing' || rec.tech === 'swordfish' || rec.tech === 'jellyfish' || rec.tech === 'skyscraper') {
        if (rec.t === 0) offer(rec.tech, rec.kind, Object.assign(rec, { unit: -1, place: null }, base));
      } else if (rec.tech === 'y-wing' || rec.tech === 'xyz-wing') {
        if (rec.pivot >= 0) offer(rec.tech, rec.kind, Object.assign(rec, { unit: -1, place: null }, base));
      } else if (rec.tech === 'finned-x-wing' || rec.tech === 'finned-swordfish') {
        if (rec.t === 0 && rec.fins.length === 1 && rec.proper) offer(rec.tech, rec.kind, Object.assign(rec, { place: null }, base));
      } else if (rec.tech === 'unique-rectangle-type-4') {
        if (rec.roof.every(c => pop(cands[c]) > 2)) offer(rec.tech, rec.kind, Object.assign(rec, { place: null }, base));
      } else if (rec.tech === 'hidden-rectangle') {
        if (rec.extra.length) offer(rec.tech, rec.kind, Object.assign(rec, { place: null }, base));
      } else if (rec.tech === 'x-chain' || rec.tech === 'xy-chain' || rec.tech === 'aic') {
        const sameDigitEnds = rec.start[1] === rec.end[1] && rec.start[0] !== rec.end[0];
        if (rec.nodes.length <= 10 && sameDigitEnds) offer(rec.tech, rec.kind, Object.assign(rec, { place: null }, base));
      } else if (rec.tech === 'als-xz') {
        if (rec.kind === 'single' && rec.elim.every(([, d]) => d === rec.z) && rec.alsA.length + rec.alsB.length <= 6) offer(rec.tech, rec.kind, Object.assign(rec, { place: null }, base));
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
  if (n % 2000 === 0) console.log(n, Math.round((Date.now() - start) / 1000) + ' s', SEARCH.map(tech => tech + ':' + WANT[tech].slots.map(kind => found[tech][kind] ? (ideal(tech, found[tech][kind]) ? 'ok' : 'x') : '-').join('')).join(' '));
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
