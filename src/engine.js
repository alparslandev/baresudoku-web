'use strict';
const ALL = 0x1ff;
const ROW = new Uint8Array(81);
const COL = new Uint8Array(81);
const BOX = new Uint8Array(81);
const UNITS = [];
const PEERS = [];
for (let i = 0; i < 81; i++) {
  ROW[i] = (i / 9) | 0;
  COL[i] = i % 9;
  BOX[i] = ((i / 27) | 0) * 3 + (((i % 9) / 3) | 0);
}
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
const sees = (a, b) => a !== b && (ROW[a] === ROW[b] || COL[a] === COL[b] || BOX[a] === BOX[b]);
for (let i = 0; i < 81; i++) {
  const p = [];
  for (let j = 0; j < 81; j++) if (sees(i, j)) p.push(j);
  PEERS[i] = p;
}
const POP = new Uint8Array(512);
for (let m = 1; m < 512; m++) POP[m] = POP[m >> 1] + (m & 1);
const bit = d => 1 << (d - 1);
const digit = m => 32 - Math.clz32(m & -m);
const low = m => 31 - Math.clz32(m & -m);
const SEE = new Uint8Array(6561);
for (let i = 0; i < 81; i++) for (let j = 0; j < 81; j++) SEE[i * 81 + j] = sees(i, j) ? 1 : 0;
const TECH_BASE = [10, 26, 30, 32, 42, 38, 44, 40, 41, 44, 45, 50, 54, 52, 46, 50, 56, 46, 47, 55, 46, 48, 47, 47, 48, 48, 56, 65, 66, 68, 70, 73, 70, 75, 78, 80, 82, 84, 85, 86, 90, 95];
const TECH_COUNT = TECH_BASE.length;
const MASTER_RATING = 65;
const LEVELS = 5;
const TECH_ORDER = new Uint8Array(TECH_COUNT);
let EXPERT_LIMIT = 0;
{
  let n = 0;
  for (let id = 0; id < 11; id++) TECH_ORDER[n++] = id;
  for (let r = 0; r < 128; r++) for (let id = 11; id < TECH_COUNT; id++) if (TECH_BASE[id] === r) TECH_ORDER[n++] = id;
  for (let id = 0; id < TECH_COUNT; id++) if (TECH_BASE[id] < MASTER_RATING) EXPERT_LIMIT++;
}
const NODES = 1215;
const STATES = NODES * 2;
const MAX_LINKS = 131072;
const MAX_ALS = 1024;
const MAX_ALS_LINKS = 131072;
const PEER_SET = new Int32Array(243);
for (let c = 0; c < 81; c++) for (const p of PEERS[c]) PEER_SET[c * 3 + ((p / 27) | 0)] |= 1 << (p % 27);
const positionIn = (c, u) => u < 9 ? COL[c] : u < 18 ? ROW[c] : (ROW[c] % 3) * 3 + COL[c] % 3;
const inUnit = (c, u) => u < 9 ? ROW[c] === u : u < 18 ? COL[c] === u - 9 : BOX[c] === u - 18;
const chainBonus = links => links > 4 ? Math.min(10, (links - 4) >> 1) : 0;
const MAX_NEST = 8;
function candidates(values, cell) {
  let used = 0;
  const peers = PEERS[cell];
  for (let k = 0; k < 20; k++) {
    const v = values[peers[k]];
    if (v) used |= bit(v);
  }
  return ALL & ~used;
}

class Sudoku {
  constructor() {
    this.work = new Uint8Array(81);
    this.lv = new Uint8Array(81);
    this.lc = new Uint16Array(81);
    this.positions = new Uint16Array(10);
    this.lineMasks = new Uint16Array(9);
    this.corners = new Uint8Array(4);
    this.count = 0;
    this.limit = 0;
    this.found = null;
    this.stepCell = 0;
    this.stepDigit = 0;
    this.stepUnit = 0;
    this.hintTech = 0;
    this.hintRating = 0;
    this.techLimit = TECH_COUNT;
    this.techOff = new Uint8Array(TECH_COUNT);
    this.stepRating = 0;
    this.stepOrder = 0;
    this.rateOrder = 0;
    this.rateTech = 0;
    this.dist81 = new Int8Array(81);
    this.queue81 = new Uint8Array(81);
    this.cellList = new Uint8Array(81);
    this.quad = new Uint8Array(4);
    this.others = new Uint8Array(9);
    this.unitPos = new Uint16Array(243);
    this.digitCells = new Int32Array(27);
    this.groupCount = 0;
    this.groupFirst = new Int16Array(11);
    this.groupDigit = new Uint8Array(486);
    this.groupCells = new Uint8Array(1458);
    this.groupSize = new Uint8Array(486);
    this.groupBox = new Uint8Array(486);
    this.groupLine = new Uint8Array(486);
    this.groupSeen = new Int32Array(1458);
    this.groupAt = new Int16Array(486);
    this.linkStart = new Int32Array(STATES + 1);
    this.linkTo = new Int32Array(MAX_LINKS);
    this.mark = new Int32Array(STATES);
    this.markValue = 0;
    this.depth = new Int32Array(STATES);
    this.parent = new Int32Array(STATES);
    this.queue = new Int32Array(STATES);
    this.elimTry = new Uint16Array(81);
    this.elimBest = new Uint16Array(81);
    this.inter = new Uint8Array(3);
    this.lineRest = new Uint8Array(6);
    this.boxRest = new Uint8Array(6);
    this.lineUnion = new Uint16Array(64);
    this.boxUnion = new Uint16Array(64);
    this.alsCount = 0;
    this.alsDigits = new Uint16Array(MAX_ALS);
    this.alsCells = new Int32Array(MAX_ALS * 3);
    this.alsDigitCells = new Int32Array(MAX_ALS * 27);
    this.alsSeen = new Int32Array(MAX_ALS * 27);
    this.alsLinkStart = new Int32Array(MAX_ALS + 1);
    this.alsLinkTo = new Int32Array(MAX_ALS_LINKS);
    this.alsLinkMask = new Uint16Array(MAX_ALS_LINKS);
    this.petals = new Int32Array(MAX_ALS * 9);
    this.petalStart = new Int32Array(10);
    this.alsMark = new Int32Array(MAX_ALS * 9);
    this.alsMarkValue = 0;
    this.alsFirst = new Uint16Array(MAX_ALS * 9);
    this.alsDepth = new Int32Array(MAX_ALS * 9);
    this.alsQueue = new Int32Array(MAX_ALS * 9);
    this.offMask = new Uint16Array(81);
    this.onMask = new Uint16Array(81);
    this.union = new Uint16Array(81);
    this.sv = new Uint8Array(81 * (MAX_NEST + 1));
    this.sc = new Uint16Array(81 * (MAX_NEST + 1));
    this.rating = 0;
    this.solution = null;
  }

  countSolutions(puzzle, max) {
    this.work.set(puzzle);
    this.count = 0;
    this.limit = max;
    this.found = null;
    this.search();
    return this.count;
  }

  search() {
    const w = this.work;
    let best = -1, bestMask = 0, bestSize = 10;
    for (let i = 0; i < 81; i++) {
      if (w[i]) continue;
      const m = candidates(w, i);
      const n = POP[m];
      if (n === 0) return;
      if (n < bestSize) {
        bestSize = n;
        best = i;
        bestMask = m;
        if (n === 1) break;
      }
    }
    if (best < 0) {
      this.count++;
      if (!this.found) this.found = Array.from(w);
      return;
    }
    for (let m = bestMask; m && this.count < this.limit; m &= m - 1) {
      w[best] = digit(m & -m);
      this.search();
    }
    w[best] = 0;
  }

  fullGrid() {
    this.work.fill(0);
    this.fillRandom();
    return Array.from(this.work);
  }

  fillRandom() {
    const w = this.work;
    let best = -1, bestMask = 0, bestSize = 10;
    for (let i = 0; i < 81; i++) {
      if (w[i]) continue;
      const m = candidates(w, i);
      const n = POP[m];
      if (n === 0) return false;
      if (n < bestSize) {
        bestSize = n;
        best = i;
        bestMask = m;
        if (n === 1) break;
      }
    }
    if (best < 0) return true;
    const digits = [];
    for (let m = bestMask; m; m &= m - 1) digits.push(digit(m & -m));
    this.shuffle(digits);
    for (const d of digits) {
      w[best] = d;
      if (this.fillRandom()) return true;
    }
    w[best] = 0;
    return false;
  }

  shuffle(a) {
    for (let k = a.length - 1; k > 0; k--) {
      const j = (Math.random() * (k + 1)) | 0;
      const t = a[k];
      a[k] = a[j];
      a[j] = t;
    }
  }

  dig(full, minClues) {
    const puzzle = full.slice();
    const order = [];
    for (let i = 0; i < 41; i++) order.push(i);
    this.shuffle(order);
    let clues = 81;
    for (let k = 0; k < 41 && clues > minClues; k++) {
      const a = order[k], b = 80 - a;
      const va = puzzle[a], vb = puzzle[b];
      puzzle[a] = 0;
      puzzle[b] = 0;
      if (this.keeps(puzzle)) clues -= a === b ? 1 : 2;
      else {
        puzzle[a] = va;
        puzzle[b] = vb;
      }
    }
    return puzzle;
  }

  keeps(puzzle) {
    return this.countSolutions(puzzle, 2) === 1 && (this.techLimit === TECH_COUNT || this.rate(puzzle) >= 0);
  }

  load(values) {
    this.lv.set(values);
    for (let i = 0; i < 81; i++) this.lc[i] = this.lv[i] ? 0 : candidates(this.lv, i);
  }

  complete() {
    for (let i = 0; i < 81; i++) if (!this.lv[i]) return false;
    return true;
  }

  stuck() {
    for (let i = 0; i < 81; i++) if (!this.lv[i] && !this.lc[i]) return true;
    return false;
  }

  place(cell, d, unit) {
    this.lv[cell] = d;
    this.lc[cell] = 0;
    const keep = ~bit(d);
    const peers = PEERS[cell];
    for (let k = 0; k < 20; k++) this.lc[peers[k]] &= keep;
    this.stepCell = cell;
    this.stepDigit = d;
    this.stepUnit = unit;
  }

  singles() {
    const lc = this.lc;
    for (let i = 0; i < 81; i++) {
      if (!this.lv[i] && POP[lc[i]] === 1) {
        this.place(i, digit(lc[i]), 3);
        return true;
      }
    }
    for (let u = 0; u < 27; u++) {
      const cells = UNITS[u];
      for (let d = 1; d <= 9; d++) {
        const b = bit(d);
        let where = -1, n = 0;
        for (let k = 0; k < 9; k++) {
          if (lc[cells[k]] & b) {
            n++;
            where = cells[k];
          }
        }
        if (n === 1) {
          this.place(where, d, (u / 9) | 0);
          return true;
        }
      }
    }
    return false;
  }

  lockedCandidates() {
    const lc = this.lc;
    let changed = false;
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      for (let box = 0; box < 9; box++) {
        let rows = 0, cols = 0;
        const cells = UNITS[18 + box];
        for (let k = 0; k < 9; k++) {
          const c = cells[k];
          if (lc[c] & b) {
            rows |= 1 << ROW[c];
            cols |= 1 << COL[c];
          }
        }
        if (rows && POP[rows] === 1) changed = this.clearLineOutsideBox(UNITS[low(rows)], box, b) || changed;
        if (cols && POP[cols] === 1) changed = this.clearLineOutsideBox(UNITS[9 + low(cols)], box, b) || changed;
      }
      for (let line = 0; line < 18; line++) {
        let boxes = 0;
        const cells = UNITS[line];
        for (let k = 0; k < 9; k++) if (lc[cells[k]] & b) boxes |= 1 << BOX[cells[k]];
        if (boxes && POP[boxes] === 1) {
          const box = low(boxes);
          const bc = UNITS[18 + box];
          for (let k = 0; k < 9; k++) {
            const c = bc[k];
            const inLine = line < 9 ? ROW[c] === line : COL[c] === line - 9;
            if (!inLine && (lc[c] & b)) {
              lc[c] &= ~b;
              changed = this.rated(28);
            }
          }
        }
      }
    }
    return changed;
  }

  clearLineOutsideBox(line, box, b) {
    let changed = false;
    for (let k = 0; k < 9; k++) {
      const c = line[k];
      if (BOX[c] !== box && (this.lc[c] & b)) {
        this.lc[c] &= ~b;
        changed = true;
      }
    }
    return changed;
  }

  subsets() {
    const lc = this.lc, positions = this.positions;
    let changed = false;
    for (let u = 0; u < 27; u++) {
      const cells = UNITS[u];
      for (let a = 0; a < 9; a++) {
        const ma = lc[cells[a]];
        if (!ma || POP[ma] > 3) continue;
        for (let b = a + 1; b < 9; b++) {
          const mb = lc[cells[b]];
          if (!mb || POP[mb] > 3) continue;
          const m2 = ma | mb;
          if (POP[m2] === 2) changed = this.clearOthers(cells, m2, (1 << a) | (1 << b)) || changed;
          else if (POP[m2] === 3) {
            for (let c = b + 1; c < 9; c++) {
              const mc = lc[cells[c]];
              if (mc && (mc | m2) === m2 && this.clearOthers(cells, m2, (1 << a) | (1 << b) | (1 << c))) changed = this.rated(36);
            }
          }
        }
      }
      for (let d = 1; d <= 9; d++) {
        const b = bit(d);
        let m = 0;
        for (let k = 0; k < 9; k++) if (lc[cells[k]] & b) m |= 1 << k;
        positions[d] = m;
      }
      for (let d1 = 1; d1 <= 9; d1++) {
        const p1 = positions[d1];
        if (!p1 || POP[p1] > 3) continue;
        for (let d2 = d1 + 1; d2 <= 9; d2++) {
          const p2 = positions[d2];
          if (!p2 || POP[p2] > 3) continue;
          const u2 = p1 | p2;
          if (POP[u2] === 2) {
            if (this.keepOnly(cells, u2, bit(d1) | bit(d2))) changed = this.rated(34);
          } else if (POP[u2] === 3) {
            for (let d3 = d2 + 1; d3 <= 9; d3++) {
              const p3 = positions[d3];
              if (p3 && (p3 | u2) === u2 && this.keepOnly(cells, u2, bit(d1) | bit(d2) | bit(d3))) changed = this.rated(40);
            }
          }
        }
      }
    }
    return changed;
  }

  clearOthers(cells, digits, members) {
    let changed = false;
    for (let k = 0; k < 9; k++) {
      if (!(members & (1 << k)) && (this.lc[cells[k]] & digits)) {
        this.lc[cells[k]] &= ~digits;
        changed = true;
      }
    }
    return changed;
  }

  keepOnly(cells, members, digits) {
    let changed = false;
    for (let k = 0; k < 9; k++) {
      if ((members & (1 << k)) && (this.lc[cells[k]] & ~digits & ALL)) {
        this.lc[cells[k]] &= digits;
        changed = true;
      }
    }
    return changed;
  }

  unitMask(cells, b) {
    let m = 0;
    for (let k = 0; k < 9; k++) if (this.lc[cells[k]] & b) m |= 1 << k;
    return m;
  }

  fillLineMasks(b, t) {
    for (let line = 0; line < 9; line++) this.lineMasks[line] = this.unitMask(UNITS[t * 9 + line], b);
  }

  fish(size) {
    const masks = this.lineMasks;
    let changed = false;
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      for (let t = 0; t < 2; t++) {
        this.fillLineMasks(b, t);
        for (let l1 = 0; l1 < 9; l1++) {
          const m1 = masks[l1];
          if (!m1 || POP[m1] > size) continue;
          for (let l2 = l1 + 1; l2 < 9; l2++) {
            const m2 = masks[l2];
            if (!m2 || POP[m2] > size) continue;
            const u2 = m1 | m2;
            if (size === 2) {
              if (POP[u2] === 2) changed = this.fishClear(b, t, u2, (1 << l1) | (1 << l2)) || changed;
            } else if (POP[u2] <= 3) {
              for (let l3 = l2 + 1; l3 < 9; l3++) {
                const m3 = masks[l3];
                if (!m3 || POP[m3] > 3) continue;
                const u3 = u2 | m3;
                if (POP[u3] === 3) changed = this.fishClear(b, t, u3, (1 << l1) | (1 << l2) | (1 << l3)) || changed;
              }
            }
          }
        }
      }
    }
    return changed;
  }

  fishClear(b, t, coverMask, baseMask) {
    let changed = false;
    for (let c = 0; c < 81; c++) {
      const base = t === 0 ? ROW[c] : COL[c];
      const cover = t === 0 ? COL[c] : ROW[c];
      if ((coverMask & (1 << cover)) && !(baseMask & (1 << base)) && (this.lc[c] & b)) {
        this.lc[c] &= ~b;
        changed = true;
      }
    }
    return changed;
  }

  yWing() {
    const lc = this.lc;
    for (let p = 0; p < 81; p++) {
      const pm = lc[p];
      if (POP[pm] !== 2) continue;
      const peers = PEERS[p];
      for (let a = 0; a < 20; a++) {
        const am = lc[peers[a]];
        if (POP[am] !== 2 || am === pm || POP[am & pm] !== 1) continue;
        for (let b = a + 1; b < 20; b++) {
          const bm = lc[peers[b]];
          if (POP[bm] !== 2 || bm === pm || POP[bm & pm] !== 1) continue;
          if ((am & pm) === (bm & pm)) continue;
          const z = am & bm & ~pm;
          if (POP[z] !== 1) continue;
          if (this.clearSeeing(z, peers[a], peers[b], -1)) return true;
        }
      }
    }
    return false;
  }

  clearSeeing(z, c1, c2, c3) {
    let changed = false;
    for (let c = 0; c < 81; c++) {
      if (c === c1 || c === c2 || c === c3 || !(this.lc[c] & z)) continue;
      if (!sees(c, c1) || !sees(c, c2) || (c3 >= 0 && !sees(c, c3))) continue;
      this.lc[c] &= ~z;
      changed = true;
    }
    return changed;
  }

  xyzWing() {
    const lc = this.lc;
    for (let p = 0; p < 81; p++) {
      const pm = lc[p];
      if (POP[pm] !== 3) continue;
      const peers = PEERS[p];
      for (let a = 0; a < 20; a++) {
        const am = lc[peers[a]];
        if (POP[am] !== 2 || (am & pm) !== am) continue;
        for (let b = a + 1; b < 20; b++) {
          const bm = lc[peers[b]];
          if (POP[bm] !== 2 || (bm & pm) !== bm || bm === am) continue;
          const z = am & bm;
          if (POP[z] !== 1) continue;
          if (this.clearSeeing(z, peers[a], peers[b], p)) return true;
        }
      }
    }
    return false;
  }

  skyscraper() {
    const masks = this.lineMasks;
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      for (let t = 0; t < 2; t++) {
        this.fillLineMasks(b, t);
        for (let l1 = 0; l1 < 9; l1++) {
          const m1 = masks[l1];
          if (POP[m1] !== 2) continue;
          for (let l2 = l1 + 1; l2 < 9; l2++) {
            const m2 = masks[l2];
            if (POP[m2] !== 2 || POP[m1 & m2] !== 1) continue;
            const top1 = UNITS[t * 9 + l1][low(m1 & ~m2)];
            const top2 = UNITS[t * 9 + l2][low(m2 & ~m1)];
            if (this.clearSeeing(b, top1, top2, -1)) return true;
          }
        }
      }
    }
    return false;
  }

  twoStringKite() {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      for (let r = 0; r < 9; r++) {
        const rm = this.unitMask(UNITS[r], b);
        if (POP[rm] !== 2) continue;
        const r0 = UNITS[r][low(rm)], r1 = UNITS[r][low(rm & (rm - 1))];
        for (let c = 0; c < 9; c++) {
          const cm = this.unitMask(UNITS[9 + c], b);
          if (POP[cm] !== 2) continue;
          const c0 = UNITS[9 + c][low(cm)], c1 = UNITS[9 + c][low(cm & (cm - 1))];
          if (r0 === c0 || r0 === c1 || r1 === c0 || r1 === c1) continue;
          for (let i = 0; i < 2; i++) {
            const inBox = i === 0 ? r0 : r1, rowEnd = i === 0 ? r1 : r0;
            for (let j = 0; j < 2; j++) {
              const boxMate = j === 0 ? c0 : c1, colEnd = j === 0 ? c1 : c0;
              if (BOX[inBox] !== BOX[boxMate]) continue;
              if (this.clearSeeing(b, rowEnd, colEnd, -1)) return true;
            }
          }
        }
      }
    }
    return false;
  }

  wWing() {
    const lc = this.lc;
    for (let p = 0; p < 81; p++) {
      const m = lc[p];
      if (POP[m] !== 2) continue;
      for (let q = p + 1; q < 81; q++) {
        if (lc[q] !== m || sees(p, q)) continue;
        for (let rest = m; rest; rest &= rest - 1) {
          const b = rest & -rest;
          for (let u = 0; u < 27; u++) {
            const um = this.unitMask(UNITS[u], b);
            if (POP[um] !== 2) continue;
            const e1 = UNITS[u][low(um)], e2 = UNITS[u][low(um & (um - 1))];
            if (!(sees(e1, p) && sees(e2, q)) && !(sees(e1, q) && sees(e2, p))) continue;
            if (this.clearSeeing(m & ~b, p, q, -1)) return true;
          }
        }
      }
    }
    return false;
  }

  uniqueRectangle() {
    const lc = this.lc, corners = this.corners;
    for (let r1 = 0; r1 < 9; r1++) {
      for (let r2 = r1 + 1; r2 < 9; r2++) {
        const sameBand = ((r1 / 3) | 0) === ((r2 / 3) | 0);
        for (let c1 = 0; c1 < 9; c1++) {
          for (let c2 = c1 + 1; c2 < 9; c2++) {
            if (sameBand === (((c1 / 3) | 0) === ((c2 / 3) | 0))) continue;
            corners[0] = r1 * 9 + c1;
            corners[1] = r1 * 9 + c2;
            corners[2] = r2 * 9 + c2;
            corners[3] = r2 * 9 + c1;
            for (let k = 0; k < 4; k++) {
              const target = corners[k];
              const m = lc[corners[(k + 1) & 3]];
              if (POP[m] !== 2 || lc[corners[(k + 2) & 3]] !== m || lc[corners[(k + 3) & 3]] !== m) continue;
              if ((lc[target] & m) !== m || lc[target] === m) continue;
              lc[target] &= ~m;
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  rated(r) {
    if (r > this.stepRating) this.stepRating = r;
    return true;
  }

  drop(cell, mask) {
    if (!(this.lc[cell] & mask)) return false;
    this.lc[cell] &= ~mask;
    return true;
  }

  dropOutside(cells, digits, members) {
    let changed = false;
    for (let k = 0; k < 9; k++) if (!(members & (1 << k)) && this.drop(cells[k], digits)) changed = true;
    return changed;
  }

  keepInside(cells, members, digits) {
    let changed = false;
    for (let k = 0; k < 9; k++) if ((members & (1 << k)) && this.drop(cells[k], ALL & ~digits)) changed = true;
    return changed;
  }

  nakedQuad() {
    const lc = this.lc;
    for (let u = 0; u < 27; u++) {
      const cells = UNITS[u];
      for (let a = 0; a < 9; a++) {
        const ma = lc[cells[a]];
        if (!ma || POP[ma] > 4) continue;
        for (let b = a + 1; b < 9; b++) {
          const mb = lc[cells[b]], m2 = ma | mb;
          if (!mb || POP[m2] > 4) continue;
          for (let c = b + 1; c < 9; c++) {
            const mc = lc[cells[c]], m3 = m2 | mc;
            if (!mc || POP[m3] > 4) continue;
            for (let d = c + 1; d < 9; d++) {
              const md = lc[cells[d]], m4 = m3 | md;
              if (!md || POP[m4] !== 4) continue;
              if (this.dropOutside(cells, m4, (1 << a) | (1 << b) | (1 << c) | (1 << d))) return true;
            }
          }
        }
      }
    }
    return false;
  }

  hiddenQuad() {
    const positions = this.positions;
    for (let u = 0; u < 27; u++) {
      const cells = UNITS[u];
      for (let d = 1; d <= 9; d++) positions[d] = this.unitMask(cells, bit(d));
      for (let d1 = 1; d1 <= 9; d1++) {
        const p1 = positions[d1];
        if (!p1 || POP[p1] > 4) continue;
        for (let d2 = d1 + 1; d2 <= 9; d2++) {
          const p2 = positions[d2], u2 = p1 | p2;
          if (!p2 || POP[u2] > 4) continue;
          for (let d3 = d2 + 1; d3 <= 9; d3++) {
            const p3 = positions[d3], u3 = u2 | p3;
            if (!p3 || POP[u3] > 4) continue;
            for (let d4 = d3 + 1; d4 <= 9; d4++) {
              const p4 = positions[d4], u4 = u3 | p4;
              if (!p4 || POP[u4] !== 4) continue;
              if (this.keepInside(cells, u4, bit(d1) | bit(d2) | bit(d3) | bit(d4))) return true;
            }
          }
        }
      }
    }
    return false;
  }

  baseUnion(base) {
    const masks = this.lineMasks;
    let all = 0;
    for (let l = 0; l < 9; l++) {
      if (!(base & (1 << l))) continue;
      if (!masks[l]) return 0;
      all |= masks[l];
    }
    return all;
  }

  fishDrop(b, t, cover, base) {
    let changed = false;
    for (let k = 0; k < 9; k++) {
      if (!(cover & (1 << k))) continue;
      for (let l = 0; l < 9; l++) if (!(base & (1 << l)) && this.drop(UNITS[t * 9 + l][k], b)) changed = true;
    }
    return changed;
  }

  jellyfish() {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      for (let t = 0; t < 2; t++) {
        this.fillLineMasks(b, t);
        for (let base = 0; base < 512; base++) {
          if (POP[base] !== 4) continue;
          const cover = this.baseUnion(base);
          if (POP[cover] === 4 && this.fishDrop(b, t, cover, base)) return true;
        }
      }
    }
    return false;
  }

  finnedFish(n) {
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      for (let t = 0; t < 2; t++) {
        this.fillLineMasks(b, t);
        for (let base = 0; base < 512; base++) {
          if (POP[base] !== n) continue;
          const all = this.baseUnion(base);
          if (POP[all] <= n) continue;
          for (let s = 0; s < 3; s++) {
            const block = 7 << (3 * s);
            const outside = all & ~block;
            if (POP[outside] > n) continue;
            const inside = all & block;
            for (let sub = inside; ; sub = (sub - 1) & inside) {
              const cover = outside | sub;
              if (POP[cover] === n && this.finnedDrop(b, t, base, cover)) return true;
              if (!sub) break;
            }
          }
        }
      }
    }
    return false;
  }

  finnedDrop(b, t, base, cover) {
    const masks = this.lineMasks;
    let finBox = -1;
    for (let l = 0; l < 9; l++) {
      if (!(base & (1 << l))) continue;
      const fins = masks[l] & ~cover;
      if (!fins) continue;
      const box = BOX[UNITS[t * 9 + l][low(fins)]];
      if (finBox >= 0 && box !== finBox) return false;
      finBox = box;
    }
    if (finBox < 0) return false;
    let changed = false;
    for (let k = 0; k < 9; k++) {
      if (!(cover & (1 << k))) continue;
      for (let l = 0; l < 9; l++) {
        if (base & (1 << l)) continue;
        const c = UNITS[t * 9 + l][k];
        if (BOX[c] === finBox && this.drop(c, b)) changed = true;
      }
    }
    return changed;
  }

  emptyRectangle() {
    const lc = this.lc;
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      for (let box = 0; box < 9; box++) {
        const cells = UNITS[18 + box];
        let n = 0;
        for (let k = 0; k < 9; k++) if (lc[cells[k]] & b) n++;
        if (n < 2) continue;
        const band = (box / 3) | 0, stack = box % 3;
        for (let i = 0; i < 3; i++) {
          const row = band * 3 + i;
          for (let j = 0; j < 3; j++) {
            const col = stack * 3 + j;
            let cross = true;
            for (let k = 0; k < 9 && cross; k++) {
              const c = cells[k];
              if ((lc[c] & b) && ROW[c] !== row && COL[c] !== col) cross = false;
            }
            if (!cross) continue;
            for (let line = 0; line < 9; line++) {
              if (((line / 3) | 0) === stack) continue;
              const m = this.unitMask(UNITS[9 + line], b);
              if (POP[m] !== 2 || !(m & (1 << row))) continue;
              const far = low(m & ~(1 << row));
              if (((far / 3) | 0) !== band && this.drop(far * 9 + col, b)) return true;
            }
            for (let line = 0; line < 9; line++) {
              if (((line / 3) | 0) === band) continue;
              const m = this.unitMask(UNITS[line], b);
              if (POP[m] !== 2 || !(m & (1 << col))) continue;
              const far = low(m & ~(1 << col));
              if (((far / 3) | 0) !== stack && this.drop(row * 9 + far, b)) return true;
            }
          }
        }
      }
    }
    return false;
  }

  remotePair() {
    const lc = this.lc, dist = this.dist81, queue = this.queue81;
    for (let p = 0; p < 81; p++) {
      const m = lc[p];
      if (POP[m] !== 2) continue;
      dist.fill(-1);
      dist[p] = 0;
      let head = 0, tail = 0;
      queue[tail++] = p;
      while (head < tail) {
        const x = queue[head++];
        const peers = PEERS[x];
        for (let k = 0; k < 20; k++) {
          const y = peers[k];
          if (lc[y] !== m || dist[y] >= 0) continue;
          dist[y] = dist[x] + 1;
          queue[tail++] = y;
        }
      }
      for (let k = 1; k < tail; k++) {
        const q = queue[k];
        if (dist[q] < 3 || !(dist[q] & 1)) continue;
        let changed = false;
        for (let c = 0; c < 81; c++) if (c !== p && c !== q && SEE[c * 81 + p] && SEE[c * 81 + q] && this.drop(c, m)) changed = true;
        if (changed) return true;
      }
    }
    return false;
  }

  wxyzWing() {
    const lc = this.lc, list = this.cellList;
    let n = 0;
    for (let c = 0; c < 81; c++) if (POP[lc[c]] >= 2 && POP[lc[c]] <= 4) list[n++] = c;
    for (let a = 0; a < n; a++) {
      const ma = lc[list[a]];
      for (let b = a + 1; b < n; b++) {
        const m2 = ma | lc[list[b]];
        if (POP[m2] > 4) continue;
        for (let c = b + 1; c < n; c++) {
          const m3 = m2 | lc[list[c]];
          if (POP[m3] > 4) continue;
          for (let d = c + 1; d < n; d++) {
            const m4 = m3 | lc[list[d]];
            if (POP[m4] !== 4) continue;
            const quad = this.quad;
            quad[0] = list[a];
            quad[1] = list[b];
            quad[2] = list[c];
            quad[3] = list[d];
            if (this.wingDrop(m4)) return true;
          }
        }
      }
    }
    return false;
  }

  inTwo(u, v) {
    const quad = this.quad;
    for (let k = 0; k < 4; k++) if (!inUnit(quad[k], u) && !inUnit(quad[k], v)) return false;
    return true;
  }

  bentQuad() {
    const quad = this.quad;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const a = quad[i], b = quad[j];
        if (this.inTwo(ROW[a], 9 + COL[b])) return true;
        if (((ROW[a] / 3) | 0) === ((BOX[b] / 3) | 0) && this.inTwo(ROW[a], 18 + BOX[b])) return true;
        if (((COL[a] / 3) | 0) === BOX[b] % 3 && this.inTwo(9 + COL[a], 18 + BOX[b])) return true;
      }
    }
    return false;
  }

  wingDrop(union) {
    const lc = this.lc, quad = this.quad;
    let z = 0;
    for (let rest = union; rest; rest &= rest - 1) {
      const x = rest & -rest;
      let restricted = true;
      for (let i = 0; i < 4 && restricted; i++) {
        if (!(lc[quad[i]] & x)) continue;
        for (let j = i + 1; j < 4; j++) if ((lc[quad[j]] & x) && !SEE[quad[i] * 81 + quad[j]]) restricted = false;
      }
      if (restricted) continue;
      if (z) return false;
      z = x;
    }
    if (!z || !this.bentQuad()) return false;
    let changed = false;
    for (let t = 0; t < 81; t++) {
      if (!(lc[t] & z) || t === quad[0] || t === quad[1] || t === quad[2] || t === quad[3]) continue;
      let all = true;
      for (let i = 0; i < 4; i++) if ((lc[quad[i]] & z) && !SEE[t * 81 + quad[i]]) all = false;
      if (all && this.drop(t, z)) changed = true;
    }
    return changed;
  }

  rectangles(kind) {
    const corners = this.corners;
    for (let r1 = 0; r1 < 9; r1++) {
      for (let r2 = r1 + 1; r2 < 9; r2++) {
        const sameBand = ((r1 / 3) | 0) === ((r2 / 3) | 0);
        for (let c1 = 0; c1 < 9; c1++) {
          for (let c2 = c1 + 1; c2 < 9; c2++) {
            if (sameBand === (((c1 / 3) | 0) === ((c2 / 3) | 0))) continue;
            corners[0] = r1 * 9 + c1;
            corners[1] = r1 * 9 + c2;
            corners[2] = r2 * 9 + c2;
            corners[3] = r2 * 9 + c1;
            if (this.rectangle(kind)) return true;
          }
        }
      }
    }
    return false;
  }

  rectangle(kind) {
    switch (kind) {
      case 2: return this.urExtra(false);
      case 3: return this.urType3();
      case 4: return this.urType4();
      case 5: return this.urExtra(true);
      case 6: return this.urType6();
      default: return this.hiddenRectangle();
    }
  }

  dropSeeingCorners(digits, members) {
    const corners = this.corners;
    let changed = false;
    for (let t = 0; t < 81; t++) {
      if (!(this.lc[t] & digits) || t === corners[0] || t === corners[1] || t === corners[2] || t === corners[3]) continue;
      let all = true;
      for (let i = 0; i < 4; i++) if ((members & (1 << i)) && !SEE[t * 81 + corners[i]]) all = false;
      if (all && this.drop(t, digits)) changed = true;
    }
    return changed;
  }

  urExtra(diagonal) {
    const lc = this.lc, corners = this.corners;
    for (let k = 0; k < 4; k++) {
      const m = lc[corners[k]];
      if (POP[m] !== 2) continue;
      let floors = 0, roofs = 0, extra = 0;
      for (let i = 0; i < 4; i++) {
        const v = lc[corners[i]];
        if (v === m) floors |= 1 << i;
        else if ((v & m) === m && POP[v] === 3 && (!extra || (v & ~m) === extra)) {
          extra = v & ~m;
          roofs |= 1 << i;
        }
      }
      if ((floors | roofs) !== 15 || !extra || POP[floors] === 3) continue;
      const adjacent = POP[floors] === 2 && floors !== 5 && floors !== 10;
      if (adjacent !== diagonal && this.dropSeeingCorners(extra, roofs)) return true;
    }
    return false;
  }

  urType3() {
    const lc = this.lc, corners = this.corners;
    for (let k = 0; k < 4; k++) {
      const m = lc[corners[k]];
      if (POP[m] !== 2 || lc[corners[(k + 1) & 3]] !== m) continue;
      const r1 = corners[(k + 2) & 3], r2 = corners[(k + 3) & 3];
      if ((lc[r1] & m) !== m || (lc[r2] & m) !== m || lc[r1] === m || lc[r2] === m) continue;
      const extra = (lc[r1] | lc[r2]) & ~m;
      const line = ROW[r1] === ROW[r2] ? ROW[r1] : 9 + COL[r1];
      if (this.urSubset(UNITS[line], r1, r2, extra)) return true;
      if (BOX[r1] === BOX[r2] && this.urSubset(UNITS[18 + BOX[r1]], r1, r2, extra)) return true;
    }
    return false;
  }

  urSubset(cells, r1, r2, extra) {
    const lc = this.lc, others = this.others;
    let n = 0;
    for (let k = 0; k < 9; k++) {
      const c = cells[k];
      if (c !== r1 && c !== r2 && lc[c]) others[n++] = c;
    }
    for (let s = 1; s < (1 << n); s++) {
      const size = POP[s];
      if (size > 3) continue;
      let m = extra;
      for (let i = 0; i < n; i++) if (s & (1 << i)) m |= lc[others[i]];
      if (POP[m] !== size + 1) continue;
      let changed = false;
      for (let i = 0; i < n; i++) if (!(s & (1 << i)) && this.drop(others[i], m)) changed = true;
      if (changed) return true;
    }
    return false;
  }

  onlyIn(cells, x, a, b) {
    for (let k = 0; k < 9; k++) {
      const c = cells[k];
      if ((this.lc[c] & x) && c !== a && c !== b) return false;
    }
    return true;
  }

  urType4() {
    const lc = this.lc, corners = this.corners;
    for (let k = 0; k < 4; k++) {
      const m = lc[corners[k]];
      if (POP[m] !== 2 || lc[corners[(k + 1) & 3]] !== m) continue;
      const r1 = corners[(k + 2) & 3], r2 = corners[(k + 3) & 3];
      if ((lc[r1] & m) !== m || (lc[r2] & m) !== m || (lc[r1] === m && lc[r2] === m)) continue;
      const line = ROW[r1] === ROW[r2] ? UNITS[ROW[r1]] : UNITS[9 + COL[r1]];
      const box = UNITS[18 + BOX[r1]];
      for (let rest = m; rest; rest &= rest - 1) {
        const x = rest & -rest, y = m & ~x;
        if (!this.onlyIn(line, x, r1, r2) && !(BOX[r1] === BOX[r2] && this.onlyIn(box, x, r1, r2))) continue;
        const a = this.drop(r1, y), b = this.drop(r2, y);
        if (a || b) return true;
      }
    }
    return false;
  }

  urType6() {
    const lc = this.lc, corners = this.corners;
    for (let k = 0; k < 2; k++) {
      const m = lc[corners[k]];
      if (POP[m] !== 2 || lc[corners[k + 2]] !== m) continue;
      const g1 = corners[k + 1], g2 = corners[(k + 3) & 3];
      if ((lc[g1] & m) !== m || (lc[g2] & m) !== m || lc[g1] === m || lc[g2] === m) continue;
      for (let rest = m; rest; rest &= rest - 1) {
        const x = rest & -rest;
        const rows = this.onlyIn(UNITS[ROW[corners[0]]], x, corners[0], corners[1]) && this.onlyIn(UNITS[ROW[corners[2]]], x, corners[2], corners[3]);
        const cols = this.onlyIn(UNITS[9 + COL[corners[0]]], x, corners[0], corners[3]) && this.onlyIn(UNITS[9 + COL[corners[1]]], x, corners[1], corners[2]);
        if (!rows && !cols) continue;
        const a = this.drop(g1, x), b = this.drop(g2, x);
        if (a || b) return true;
      }
    }
    return false;
  }

  hiddenRectangle() {
    const lc = this.lc, corners = this.corners;
    for (let k = 0; k < 4; k++) {
      const a = corners[k];
      const m = lc[a];
      if (POP[m] !== 2) continue;
      if ((lc[corners[0]] & m) !== m || (lc[corners[1]] & m) !== m || (lc[corners[2]] & m) !== m || (lc[corners[3]] & m) !== m) continue;
      const d = corners[(k + 2) & 3];
      for (let rest = m; rest; rest &= rest - 1) {
        const x = rest & -rest, y = m & ~x;
        if (!this.onlyIn(UNITS[ROW[d]], x, d, ROW[d] * 9 + COL[a])) continue;
        if (!this.onlyIn(UNITS[9 + COL[d]], x, d, ROW[a] * 9 + COL[d])) continue;
        if (this.drop(d, y)) return true;
      }
    }
    return false;
  }

  bugPlusOne() {
    const lc = this.lc;
    let tri = -1;
    for (let c = 0; c < 81; c++) {
      const n = POP[lc[c]];
      if (n === 0 || n === 2) continue;
      if (n !== 3 || tri >= 0) return false;
      tri = c;
    }
    if (tri < 0) return false;
    for (let rest = lc[tri]; rest; rest &= rest - 1) {
      const x = rest & -rest;
      let ok = true;
      for (let u = 0; u < 27 && ok; u++) {
        const cells = UNITS[u];
        const home = u === ROW[tri] || u === 9 + COL[tri] || u === 18 + BOX[tri];
        for (let b = 1; b < 512 && ok; b <<= 1) {
          let n = home && b === x ? -1 : 0;
          for (let k = 0; k < 9; k++) if (lc[cells[k]] & b) n++;
          if (n !== 0 && n !== 2) ok = false;
        }
      }
      if (ok) {
        lc[tri] = x;
        return true;
      }
    }
    return false;
  }

  prepareUnits() {
    const lc = this.lc;
    for (let u = 0; u < 27; u++) for (let d = 1; d <= 9; d++) this.unitPos[u * 9 + d - 1] = this.unitMask(UNITS[u], bit(d));
    this.digitCells.fill(0);
    for (let c = 0; c < 81; c++) for (let rest = lc[c]; rest; rest &= rest - 1) this.digitCells[low(rest) * 3 + ((c / 27) | 0)] |= 1 << (c % 27);
  }

  prepareGroups() {
    const lc = this.lc;
    let n = 0;
    this.groupAt.fill(-1);
    for (let d = 1; d <= 9; d++) {
      const b = bit(d);
      this.groupFirst[d] = n;
      for (let box = 0; box < 9; box++) {
        const top = ((box / 3) | 0) * 3, left = (box % 3) * 3;
        for (let seg = 0; seg < 6; seg++) {
          let size = 0;
          for (let k = 0; k < 3; k++) {
            const c = seg < 3 ? (top + seg) * 9 + left + k : (top + k) * 9 + left + seg - 3;
            if (lc[c] & b) this.groupCells[n * 3 + size++] = c;
          }
          if (size < 2) continue;
          this.groupDigit[n] = d;
          this.groupSize[n] = size;
          this.groupBox[n] = box;
          this.groupLine[n] = seg < 3 ? top + seg : 9 + left + seg - 3;
          for (let w = 0; w < 3; w++) {
            let seen = -1;
            for (let k = 0; k < size; k++) seen &= PEER_SET[this.groupCells[n * 3 + k] * 3 + w];
            this.groupSeen[n * 3 + w] = seen;
          }
          this.groupAt[(d - 1) * 54 + box * 6 + seg] = n;
          n++;
        }
      }
    }
    this.groupFirst[10] = n;
    this.groupCount = n;
  }

  restNode(u, d, rest, grouped) {
    if (!rest) return -1;
    const cells = UNITS[u];
    if (POP[rest] === 1) return cells[low(rest)] * 9 + d - 1;
    if (!grouped) return -1;
    const first = cells[low(rest)];
    let sameBox = true, sameRow = true, sameCol = true;
    for (let m = rest & (rest - 1); m; m &= m - 1) {
      const c = cells[low(m)];
      if (BOX[c] !== BOX[first]) sameBox = false;
      if (ROW[c] !== ROW[first]) sameRow = false;
      if (COL[c] !== COL[first]) sameCol = false;
    }
    if (!sameBox || (!sameRow && !sameCol)) return -1;
    const g = this.groupAt[(d - 1) * 54 + BOX[first] * 6 + (sameRow ? ROW[first] % 3 : 3 + COL[first] % 3)];
    return g >= 0 && this.groupSize[g] === POP[rest] ? 729 + g : -1;
  }

  addLink(n, state) {
    if (n >= MAX_LINKS) return n;
    this.linkTo[n] = state;
    return n + 1;
  }

  linked(from, to, state) {
    for (let k = from; k < to; k++) if (this.linkTo[k] === state) return true;
    return false;
  }

  seesGroup(c, g) {
    return (this.groupSeen[g * 3 + ((c / 27) | 0)] & (1 << (c % 27))) !== 0;
  }

  groupWithin(h, g) {
    for (let i = 0; i < this.groupSize[h]; i++) if (!this.seesGroup(this.groupCells[h * 3 + i], g)) return false;
    return true;
  }

  buildLinks(id) {
    const lc = this.lc, start = this.linkStart;
    const grouped = id === 31, units = id !== 28, bivalue = id !== 27, mates = id >= 29;
    let n = 0;
    for (let node = 0; node < NODES; node++) {
      start[node * 2] = n;
      if (node < 729) {
        const c = (node / 9) | 0, d = node % 9 + 1, b = bit(d);
        const alive = (lc[c] & b) !== 0;
        if (alive && units) {
          const first = n;
          for (let k = 0; k < 3; k++) {
            const u = k === 0 ? ROW[c] : k === 1 ? 9 + COL[c] : 18 + BOX[c];
            const target = this.restNode(u, d, this.unitPos[u * 9 + d - 1] & ~(1 << positionIn(c, u)), grouped);
            if (target >= 0 && !this.linked(first, n, target * 2 + 1)) n = this.addLink(n, target * 2 + 1);
          }
        }
        if (alive && bivalue && POP[lc[c]] === 2) n = this.addLink(n, (c * 9 + low(lc[c] & ~b)) * 2 + 1);
        start[node * 2 + 1] = n;
        if (!alive) continue;
        const peers = PEERS[c];
        for (let k = 0; k < 20; k++) if (lc[peers[k]] & b) n = this.addLink(n, (peers[k] * 9 + d - 1) * 2);
        if (mates) for (let rest = lc[c] & ~b; rest; rest &= rest - 1) n = this.addLink(n, (c * 9 + low(rest)) * 2);
        if (grouped) for (let g = this.groupFirst[d]; g < this.groupFirst[d + 1]; g++) if (this.seesGroup(c, g)) n = this.addLink(n, (729 + g) * 2);
      } else {
        const g = node - 729;
        const alive = g < this.groupCount;
        const d = alive ? this.groupDigit[g] : 0;
        if (alive) {
          const first = n;
          for (let k = 0; k < 2; k++) {
            const u = k === 0 ? this.groupLine[g] : 18 + this.groupBox[g];
            let own = 0;
            for (let i = 0; i < this.groupSize[g]; i++) own |= 1 << positionIn(this.groupCells[g * 3 + i], u);
            const target = this.restNode(u, d, this.unitPos[u * 9 + d - 1] & ~own, true);
            if (target >= 0 && !this.linked(first, n, target * 2 + 1)) n = this.addLink(n, target * 2 + 1);
          }
        }
        start[node * 2 + 1] = n;
        if (!alive) continue;
        for (let p = 0; p < 81; p++) if ((lc[p] & bit(d)) && this.seesGroup(p, g)) n = this.addLink(n, (p * 9 + d - 1) * 2);
        for (let h = this.groupFirst[d]; h < this.groupFirst[d + 1]; h++) if (h !== g && this.groupWithin(h, g)) n = this.addLink(n, (729 + h) * 2);
      }
    }
    start[STATES] = n;
  }

  nodeDigit(node) {
    return node < 729 ? node % 9 + 1 : this.groupDigit[node - 729];
  }

  seenWord(node, w) {
    return node < 729 ? PEER_SET[((node / 9) | 0) * 3 + w] : this.groupSeen[(node - 729) * 3 + w];
  }

  targets(s, n, write) {
    const lc = this.lc, elim = this.elimTry;
    const ds = this.nodeDigit(s), dn = this.nodeDigit(n);
    let any = false;
    if (write) elim.fill(0);
    if (ds === dn) {
      for (let w = 0; w < 3; w++) {
        let m = this.seenWord(s, w) & this.seenWord(n, w) & this.digitCells[(ds - 1) * 3 + w];
        if (!m) continue;
        if (!write) return true;
        any = true;
        for (; m; m &= m - 1) elim[w * 27 + low(m)] |= bit(ds);
      }
    }
    if (s < 729 && n < 729) {
      const sc = (s / 9) | 0, nc = (n / 9) | 0;
      if (sc === nc) {
        const rest = lc[sc] & ~bit(ds) & ~bit(dn);
        if (rest) {
          if (!write) return true;
          any = true;
          elim[sc] |= rest;
        }
      } else if (ds !== dn && SEE[sc * 81 + nc]) {
        if (lc[sc] & bit(dn)) {
          if (!write) return true;
          any = true;
          elim[sc] |= bit(dn);
        }
        if (lc[nc] & bit(ds)) {
          if (!write) return true;
          any = true;
          elim[nc] |= bit(ds);
        }
      }
    } else if (ds !== dn && (s < 729 || n < 729)) {
      const single = s < 729 ? s : n, group = s < 729 ? n - 729 : s - 729;
      const c = (single / 9) | 0, dg = this.groupDigit[group];
      if ((lc[c] & bit(dg)) && this.seesGroup(c, group)) {
        if (!write) return true;
        any = true;
        elim[c] |= bit(dg);
      }
    }
    return any;
  }

  weakElims(x, y) {
    const xc = (x / 9) | 0, yc = (y / 9) | 0, xd = x % 9, yd = y % 9;
    if (xc === yc) {
      this.elimTry[xc] |= this.lc[xc] & ~(1 << xd) & ~(1 << yd);
      return;
    }
    for (let w = 0; w < 3; w++) {
      for (let m = PEER_SET[xc * 3 + w] & PEER_SET[yc * 3 + w] & this.digitCells[xd * 3 + w]; m; m &= m - 1) this.elimTry[w * 27 + low(m)] |= 1 << xd;
    }
  }

  loopTargets(s, end) {
    const n = end >> 1;
    if (n === s) return false;
    const sc = (s / 9) | 0, nc = (n / 9) | 0, sd = s % 9, nd = n % 9;
    if (sc === nc ? sd === nd : sd !== nd || !SEE[sc * 81 + nc]) return false;
    this.elimTry.fill(0);
    this.weakElims(n, s);
    for (let st = end; this.parent[st] >= 0; st = this.parent[st]) {
      const pa = this.parent[st];
      if ((pa & 1) && !(st & 1)) this.weakElims(pa >> 1, st >> 1);
    }
    for (let c = 0; c < 81; c++) if (this.elimTry[c]) return true;
    return false;
  }

  chainFrom(s, loop, limit) {
    const mark = this.mark, depth = this.depth, parent = this.parent, queue = this.queue, start = this.linkStart, to = this.linkTo;
    if (++this.markValue >= 0x7fffffff) {
      mark.fill(0);
      this.markValue = 1;
    }
    const stamp = this.markValue;
    const origin = s * 2;
    mark[origin] = stamp;
    depth[origin] = 0;
    parent[origin] = -1;
    let head = 0, tail = 0;
    queue[tail++] = origin;
    while (head < tail) {
      const st = queue[head++];
      const d = depth[st] + 1;
      if (d >= limit) break;
      for (let k = start[st]; k < start[st + 1]; k++) {
        const ch = to[k];
        if (mark[ch] === stamp) continue;
        mark[ch] = stamp;
        depth[ch] = d;
        parent[ch] = st;
        queue[tail++] = ch;
        if (!(ch & 1)) continue;
        if (loop ? this.loopTargets(s, ch) : this.targets(s, ch >> 1, false) && this.targets(s, ch >> 1, true)) {
          this.elimBest.set(this.elimTry);
          return d;
        }
      }
    }
    return 0;
  }

  chains(id) {
    this.prepareUnits();
    if (id === 31) this.prepareGroups();
    else this.groupCount = 0;
    this.buildLinks(id);
    const loop = id === 29 ? 1 : 0;
    const none = 0x7fffffff;
    let best = none;
    const nodes = 729 + this.groupCount;
    for (let s = 0; s < nodes; s++) {
      if (this.linkStart[s * 2] === this.linkStart[s * 2 + 1]) continue;
      const found = this.chainFrom(s, loop === 1, best - loop);
      if (found) best = found + loop;
    }
    if (best === none) return false;
    for (let c = 0; c < 81; c++) this.lc[c] &= ~this.elimBest[c];
    this.stepRating = TECH_BASE[id] + chainBonus(best);
    return true;
  }

  sueDeCoq() {
    const lc = this.lc, inter = this.inter, lineRest = this.lineRest, boxRest = this.boxRest, lineUnion = this.lineUnion, boxUnion = this.boxUnion;
    for (let box = 0; box < 9; box++) {
      for (let t = 0; t < 2; t++) {
        for (let i = 0; i < 3; i++) {
          const line = t === 0 ? ((box / 3) | 0) * 3 + i : 9 + (box % 3) * 3 + i;
          let ni = 0, nl = 0, nb = 0;
          for (let k = 0; k < 9; k++) {
            const c = UNITS[line][k];
            if (!lc[c]) continue;
            if (BOX[c] === box) inter[ni++] = c;
            else lineRest[nl++] = c;
          }
          if (ni < 2) continue;
          for (let k = 0; k < 9; k++) {
            const c = UNITS[18 + box][k];
            if (lc[c] && (t === 0 ? ROW[c] !== line : COL[c] !== line - 9)) boxRest[nb++] = c;
          }
          lineUnion[0] = 0;
          for (let a = 1; a < (1 << nl); a++) lineUnion[a] = lineUnion[a & (a - 1)] | lc[lineRest[low(a)]];
          boxUnion[0] = 0;
          for (let a = 1; a < (1 << nb); a++) boxUnion[a] = boxUnion[a & (a - 1)] | lc[boxRest[low(a)]];
          for (let cs = 3; cs < (1 << ni); cs++) {
            const size = POP[cs];
            if (size < 2) continue;
            let v = 0;
            for (let j = 0; j < ni; j++) if (cs & (1 << j)) v |= lc[inter[j]];
            if (POP[v] < size + 2) continue;
            for (let a = 1; a < (1 << nl); a++) {
              const va = lineUnion[a];
              if (!(va & v)) continue;
              for (let d = 1; d < (1 << nb); d++) {
                const vd = boxUnion[d];
                if ((va & vd) || !(vd & v)) continue;
                if (POP[v | va | vd] !== size + POP[a] + POP[d]) continue;
                if (this.sueDrop(line, box, cs, ni, a, nl, d, nb, va | (v & ~vd), vd | (v & ~va))) return true;
              }
            }
          }
        }
      }
    }
    return false;
  }

  sueDrop(line, box, cs, ni, a, nl, d, nb, lineDigits, boxDigits) {
    const keep = this.elimTry;
    keep.fill(0);
    for (let j = 0; j < ni; j++) if (cs & (1 << j)) keep[this.inter[j]] = 1;
    for (let j = 0; j < nl; j++) if (a & (1 << j)) keep[this.lineRest[j]] = 2;
    for (let j = 0; j < nb; j++) if (d & (1 << j)) keep[this.boxRest[j]] = 3;
    let changed = false;
    for (let k = 0; k < 9; k++) {
      const c = UNITS[line][k];
      if (keep[c] !== 1 && keep[c] !== 2 && this.drop(c, lineDigits)) changed = true;
    }
    for (let k = 0; k < 9; k++) {
      const c = UNITS[18 + box][k];
      if (keep[c] !== 1 && keep[c] !== 3 && this.drop(c, boxDigits)) changed = true;
    }
    return changed;
  }

  collectAls() {
    const lc = this.lc;
    let n = 0;
    for (let u = 0; u < 27 && n < MAX_ALS; u++) {
      const cells = UNITS[u];
      let free = 0;
      for (let k = 0; k < 9; k++) if (lc[cells[k]]) free |= 1 << k;
      for (let s = 1; s < 512 && n < MAX_ALS; s++) {
        if ((s & free) !== s) continue;
        let m = 0, rows = 0, cols = 0;
        for (let k = 0; k < 9; k++) {
          if (!(s & (1 << k))) continue;
          const c = cells[k];
          m |= lc[c];
          rows |= 1 << ROW[c];
          cols |= 1 << COL[c];
        }
        if (POP[m] !== POP[s] + 1) continue;
        if (u >= 9 && POP[rows] === 1) continue;
        if (u >= 18 && POP[cols] === 1) continue;
        this.alsDigits[n] = m;
        this.alsCells[n * 3] = 0;
        this.alsCells[n * 3 + 1] = 0;
        this.alsCells[n * 3 + 2] = 0;
        for (let k = 0; k < 9; k++) {
          const c = cells[k];
          if (s & (1 << k)) this.alsCells[n * 3 + ((c / 27) | 0)] |= 1 << (c % 27);
        }
        for (let d = 0; d < 9; d++) {
          const at = (n * 9 + d) * 3;
          let w0 = 0, w1 = 0, w2 = 0, s0 = -1, s1 = -1, s2 = -1;
          for (let k = 0; k < 9; k++) {
            const c = cells[k];
            if (!(s & (1 << k)) || !(lc[c] & (1 << d))) continue;
            if (c < 27) w0 |= 1 << c;
            else if (c < 54) w1 |= 1 << (c - 27);
            else w2 |= 1 << (c - 54);
            s0 &= PEER_SET[c * 3];
            s1 &= PEER_SET[c * 3 + 1];
            s2 &= PEER_SET[c * 3 + 2];
          }
          const present = (w0 | w1 | w2) !== 0;
          this.alsDigitCells[at] = w0;
          this.alsDigitCells[at + 1] = w1;
          this.alsDigitCells[at + 2] = w2;
          this.alsSeen[at] = present ? s0 : 0;
          this.alsSeen[at + 1] = present ? s1 : 0;
          this.alsSeen[at + 2] = present ? s2 : 0;
        }
        n++;
      }
    }
    this.alsCount = n;
  }

  alsOverlap(i, j) {
    return ((this.alsCells[i * 3] & this.alsCells[j * 3]) | (this.alsCells[i * 3 + 1] & this.alsCells[j * 3 + 1]) | (this.alsCells[i * 3 + 2] & this.alsCells[j * 3 + 2])) !== 0;
  }

  alsHas(i, c) {
    return (this.alsCells[i * 3 + ((c / 27) | 0)] & (1 << (c % 27))) !== 0;
  }

  restrictedCommon(i, j) {
    let rcc = 0;
    for (let rest = this.alsDigits[i] & this.alsDigits[j]; rest; rest &= rest - 1) {
      const d = low(rest), a = (i * 9 + d) * 3, b = (j * 9 + d) * 3;
      if ((this.alsDigitCells[b] & ~this.alsSeen[a]) | (this.alsDigitCells[b + 1] & ~this.alsSeen[a + 1]) | (this.alsDigitCells[b + 2] & ~this.alsSeen[a + 2])) continue;
      rcc |= 1 << d;
    }
    return rcc;
  }

  linkAls() {
    let n = 0;
    for (let i = 0; i < this.alsCount; i++) {
      this.alsLinkStart[i] = n;
      for (let j = 0; j < this.alsCount; j++) {
        if (i === j || !(this.alsDigits[i] & this.alsDigits[j]) || this.alsOverlap(i, j)) continue;
        const rcc = this.restrictedCommon(i, j);
        if (!rcc || n >= MAX_ALS_LINKS) continue;
        this.alsLinkTo[n] = j;
        this.alsLinkMask[n] = rcc;
        n++;
      }
    }
    this.alsLinkStart[this.alsCount] = n;
  }

  dropSeen(i, j, d) {
    let changed = false;
    for (let w = 0; w < 3; w++) {
      for (let m = this.alsSeen[(i * 9 + d) * 3 + w] & this.alsSeen[(j * 9 + d) * 3 + w] & this.digitCells[d * 3 + w]; m; m &= m - 1) {
        if (this.drop(w * 27 + low(m), 1 << d)) changed = true;
      }
    }
    return changed;
  }

  alsXz() {
    this.prepareUnits();
    this.collectAls();
    for (let i = 0; i < this.alsCount; i++) {
      for (let j = i + 1; j < this.alsCount; j++) {
        const common = this.alsDigits[i] & this.alsDigits[j];
        if (POP[common] < 2 || this.alsOverlap(i, j)) continue;
        const rcc = this.restrictedCommon(i, j);
        if (!rcc) continue;
        let changed = false;
        if (POP[rcc] === 1) {
          for (let rest = common & ~rcc; rest; rest &= rest - 1) if (this.dropSeen(i, j, low(rest))) changed = true;
        } else {
          for (let rest = rcc; rest; rest &= rest - 1) if (this.dropSeen(i, j, low(rest))) changed = true;
          for (let rest = this.alsDigits[i] & ~rcc; rest; rest &= rest - 1) if (this.dropSeen(i, i, low(rest))) changed = true;
          for (let rest = this.alsDigits[j] & ~rcc; rest; rest &= rest - 1) if (this.dropSeen(j, j, low(rest))) changed = true;
        }
        if (changed) return true;
      }
    }
    return false;
  }

  alsXyWing() {
    this.prepareUnits();
    this.collectAls();
    this.linkAls();
    const start = this.alsLinkStart, to = this.alsLinkTo, mask = this.alsLinkMask;
    for (let c = 0; c < this.alsCount; c++) {
      for (let p = start[c]; p < start[c + 1]; p++) {
        const a = to[p];
        for (let q = p + 1; q < start[c + 1]; q++) {
          const b = to[q];
          const common = this.alsDigits[a] & this.alsDigits[b];
          if (!common || this.alsOverlap(a, b)) continue;
          for (let xs = mask[p]; xs; xs &= xs - 1) {
            const x = xs & -xs;
            for (let ys = mask[q] & ~x; ys; ys &= ys - 1) {
              const y = ys & -ys;
              let changed = false;
              for (let zs = common & ~x & ~y; zs; zs &= zs - 1) if (this.dropSeen(a, b, low(zs))) changed = true;
              if (changed) return true;
            }
          }
        }
      }
    }
    return false;
  }

  deathBlossom() {
    this.prepareUnits();
    this.collectAls();
    for (let stem = 0; stem < 81; stem++) {
      const sm = this.lc[stem];
      if (POP[sm] < 2) continue;
      let n = 0, k = 0;
      for (let rest = sm; rest; rest &= rest - 1) {
        const d = low(rest);
        this.petalStart[k++] = n;
        for (let i = 0; i < this.alsCount; i++) {
          if (!(this.alsDigits[i] & (1 << d)) || this.alsHas(i, stem)) continue;
          if (!(this.alsSeen[(i * 9 + d) * 3 + ((stem / 27) | 0)] & (1 << (stem % 27)))) continue;
          this.petals[n++] = i;
        }
      }
      this.petalStart[k] = n;
      for (let z = 0; z < 9; z++) {
        if (sm & (1 << z)) continue;
        if (this.blossom(0, k, z, this.digitCells[z * 3], this.digitCells[z * 3 + 1], this.digitCells[z * 3 + 2], 0, 0, 0)) return true;
      }
    }
    return false;
  }

  blossom(k, count, z, s0, s1, s2, u0, u1, u2) {
    if (k === count) {
      let changed = false;
      for (let m = s0; m; m &= m - 1) if (this.drop(low(m), 1 << z)) changed = true;
      for (let m = s1; m; m &= m - 1) if (this.drop(27 + low(m), 1 << z)) changed = true;
      for (let m = s2; m; m &= m - 1) if (this.drop(54 + low(m), 1 << z)) changed = true;
      return changed;
    }
    for (let p = this.petalStart[k]; p < this.petalStart[k + 1]; p++) {
      const i = this.petals[p];
      if (!(this.alsDigits[i] & (1 << z))) continue;
      const c0 = this.alsCells[i * 3], c1 = this.alsCells[i * 3 + 1], c2 = this.alsCells[i * 3 + 2];
      if ((c0 & u0) | (c1 & u1) | (c2 & u2)) continue;
      const at = (i * 9 + z) * 3;
      const t0 = s0 & this.alsSeen[at], t1 = s1 & this.alsSeen[at + 1], t2 = s2 & this.alsSeen[at + 2];
      if (!(t0 | t1 | t2)) continue;
      if (this.blossom(k + 1, count, z, t0, t1, t2, u0 | c0, u1 | c1, u2 | c2)) return true;
    }
    return false;
  }

  alsChain() {
    this.prepareUnits();
    this.collectAls();
    this.linkAls();
    const none = 0x7fffffff;
    let best = none;
    for (let a = 0; a < this.alsCount; a++) {
      const found = this.alsChainFrom(a, best);
      if (found) best = found;
    }
    if (best === none) return false;
    for (let c = 0; c < 81; c++) this.lc[c] &= ~this.elimBest[c];
    this.stepRating = TECH_BASE[36] + chainBonus(2 * best - 1);
    return true;
  }

  alsChainFrom(a, limit) {
    const mark = this.alsMark, first = this.alsFirst, depth = this.alsDepth, queue = this.alsQueue;
    const start = this.alsLinkStart, to = this.alsLinkTo, mask = this.alsLinkMask;
    if (++this.alsMarkValue >= 0x7fffffff) {
      mark.fill(0);
      this.alsMarkValue = 1;
    }
    const stamp = this.alsMarkValue;
    let head = 0, tail = 0;
    for (let p = start[a]; p < start[a + 1]; p++) {
      if (2 >= limit) break;
      const b = to[p];
      for (let xs = mask[p]; xs; xs &= xs - 1) {
        const x = low(xs), st = b * 9 + x;
        if (mark[st] !== stamp) {
          mark[st] = stamp;
          first[st] = 0;
          depth[st] = 2;
          queue[tail++] = st;
        }
        first[st] |= 1 << x;
      }
    }
    while (head < tail) {
      const st = queue[head++];
      const b = (st / 9) | 0, x = st % 9, k = depth[st];
      if (k >= limit) break;
      if (b !== a && this.alsChainTargets(a, b, x, first[st])) {
        this.elimBest.set(this.elimTry);
        return k;
      }
      if (k + 1 >= limit) continue;
      for (let p = start[b]; p < start[b + 1]; p++) {
        const c = to[p];
        if (c === a) continue;
        for (let ys = mask[p] & ~(1 << x); ys; ys &= ys - 1) {
          const y = low(ys), next = c * 9 + y;
          if (mark[next] !== stamp) {
            mark[next] = stamp;
            first[next] = 0;
            depth[next] = k + 1;
            queue[tail++] = next;
          }
          if (depth[next] === k + 1) first[next] |= first[st];
        }
      }
    }
    return 0;
  }

  alsChainTargets(a, b, x, firsts) {
    const common = this.alsDigits[a] & this.alsDigits[b] & ~(1 << x);
    let any = false;
    for (let zs = common; zs; zs &= zs - 1) {
      const z = low(zs);
      if (!(firsts & ~(1 << z))) continue;
      for (let w = 0; w < 3; w++) {
        if (this.alsSeen[(a * 9 + z) * 3 + w] & this.alsSeen[(b * 9 + z) * 3 + w] & this.digitCells[z * 3 + w]) {
          if (!any) this.elimTry.fill(0);
          any = true;
          for (let m = this.alsSeen[(a * 9 + z) * 3 + w] & this.alsSeen[(b * 9 + z) * 3 + w] & this.digitCells[z * 3 + w]; m; m &= m - 1) this.elimTry[w * 27 + low(m)] |= 1 << z;
        }
      }
    }
    return any;
  }

  reachConsistent(node) {
    const mark = this.mark, queue = this.queue, start = this.linkStart, to = this.linkTo, off = this.offMask, on = this.onMask, lc = this.lc;
    if (++this.markValue >= 0x7fffffff) {
      mark.fill(0);
      this.markValue = 1;
    }
    const stamp = this.markValue;
    const origin = node * 2 + 1;
    mark[origin] = stamp;
    let head = 0, tail = 0;
    queue[tail++] = origin;
    while (head < tail) {
      const st = queue[head++];
      for (let k = start[st]; k < start[st + 1]; k++) {
        const ch = to[k];
        if (mark[ch] === stamp) continue;
        if (mark[ch ^ 1] === stamp) return false;
        mark[ch] = stamp;
        queue[tail++] = ch;
      }
    }
    off.fill(0);
    on.fill(0);
    for (let k = 0; k < tail; k++) {
      const st = queue[k], n = st >> 1, c = (n / 9) | 0, b = 1 << (n % 9);
      if (st & 1) on[c] |= b;
      else off[c] |= b;
    }
    for (let c = 0; c < 81; c++) if (lc[c] && !(lc[c] & ~off[c])) return false;
    for (let u = 0; u < 27; u++) {
      let have = 0, left = 0;
      for (let k = 0; k < 9; k++) {
        const c = UNITS[u][k];
        have |= lc[c];
        left |= lc[c] & ~off[c];
      }
      if (have & ~left) return false;
    }
    return true;
  }

  nishio() {
    this.prepareUnits();
    this.groupCount = 0;
    this.buildLinks(30);
    const elim = this.elimBest;
    elim.fill(0);
    let any = false;
    for (let node = 0; node < 729; node++) {
      const c = (node / 9) | 0, b = 1 << (node % 9);
      if (!(this.lc[c] & b) || this.reachConsistent(node)) continue;
      elim[c] |= b;
      any = true;
    }
    if (!any) return false;
    for (let c = 0; c < 81; c++) this.lc[c] &= ~elim[c];
    return true;
  }

  joinStatic() {
    const lc = this.lc, on = this.onMask, off = this.offMask, union = this.union;
    for (let q = 0; q < 81; q++) union[q] |= on[q] ? on[q] : lc[q] & ~off[q];
  }

  narrow() {
    const lc = this.lc, union = this.union;
    let changed = false;
    for (let q = 0; q < 81; q++) {
      if (!(lc[q] & ~union[q])) continue;
      lc[q] &= union[q];
      changed = true;
    }
    return changed;
  }

  cellForcing() {
    this.prepareUnits();
    this.groupCount = 0;
    this.buildLinks(30);
    for (let c = 0; c < 81; c++) {
      const m = this.lc[c];
      if (POP[m] < 2) continue;
      this.union.fill(0);
      let branches = 0;
      for (let rest = m; rest; rest &= rest - 1) {
        if (!this.reachConsistent(c * 9 + low(rest))) continue;
        branches++;
        this.joinStatic();
      }
      if (branches && this.narrow()) return true;
    }
    return false;
  }

  unitForcing() {
    this.prepareUnits();
    this.groupCount = 0;
    this.buildLinks(30);
    for (let u = 0; u < 27; u++) {
      for (let d = 1; d <= 9; d++) {
        const m = this.unitPos[u * 9 + d - 1];
        if (POP[m] < 2) continue;
        this.union.fill(0);
        let branches = 0;
        for (let rest = m; rest; rest &= rest - 1) {
          if (!this.reachConsistent(UNITS[u][low(rest)] * 9 + d - 1)) continue;
          branches++;
          this.joinStatic();
        }
        if (branches && this.narrow()) return true;
      }
    }
    return false;
  }

  assign(at, c, d) {
    const sc = this.sc, keep = ~bit(d), peers = PEERS[c];
    this.sv[at + c] = d;
    sc[at + c] = 0;
    for (let k = 0; k < 20; k++) sc[at + peers[k]] &= keep;
  }

  settle(level) {
    const at = level * 81, sv = this.sv, sc = this.sc;
    for (;;) {
      let progress = false;
      for (let c = 0; c < 81; c++) {
        if (sv[at + c]) continue;
        const m = sc[at + c];
        if (!m) return false;
        if (POP[m] === 1) {
          this.assign(at, c, digit(m));
          progress = true;
        }
      }
      for (let u = 0; u < 27; u++) {
        const cells = UNITS[u];
        let once = 0, twice = 0, placed = 0;
        for (let k = 0; k < 9; k++) {
          const c = cells[k];
          if (sv[at + c]) {
            const b = bit(sv[at + c]);
            if (placed & b) return false;
            placed |= b;
            continue;
          }
          const m = sc[at + c];
          twice |= once & m;
          once |= m;
        }
        if ((once | placed) !== ALL) return false;
        for (let single = once & ~twice & ~placed; single; single &= single - 1) {
          const b = single & -single;
          for (let k = 0; k < 9; k++) {
            const c = cells[k];
            if (sv[at + c] || !(sc[at + c] & b)) continue;
            this.assign(at, c, digit(b));
            progress = true;
            break;
          }
        }
      }
      if (!progress) return true;
    }
  }

  branch(level, from, cell, d) {
    const at = level * 81, sv = this.sv, sc = this.sc;
    if (from < 0) {
      sv.set(this.lv, at);
      sc.set(this.lc, at);
    } else {
      sv.copyWithin(at, from * 81, from * 81 + 81);
      sc.copyWithin(at, from * 81, from * 81 + 81);
    }
    if (!(sc[at + cell] & bit(d))) return false;
    this.assign(at, cell, d);
    return this.settleNested(level);
  }

  settleNested(level) {
    if (!this.settle(level)) return false;
    if (level === 0) return true;
    const at = level * 81, sc = this.sc;
    let changed = true;
    while (changed) {
      changed = false;
      for (let q = 0; q < 81; q++) {
        for (let rest = sc[at + q]; rest; rest &= rest - 1) {
          const b = rest & -rest;
          if (!(sc[at + q] & b) || this.branch(level - 1, level, q, low(b) + 1)) continue;
          sc[at + q] &= ~b;
          changed = true;
          if (!this.settle(level)) return false;
        }
      }
    }
    return true;
  }

  joinDynamic() {
    const sv = this.sv, sc = this.sc, union = this.union;
    for (let q = 0; q < 81; q++) union[q] |= sv[q] ? bit(sv[q]) : sc[q];
  }

  dynamicNet() {
    const lc = this.lc, elim = this.elimBest;
    elim.fill(0);
    let any = false;
    for (let c = 0; c < 81; c++) {
      for (let rest = lc[c]; rest; rest &= rest - 1) {
        if (this.branch(0, -1, c, low(rest) + 1)) continue;
        elim[c] |= rest & -rest;
        any = true;
      }
    }
    if (any) {
      for (let c = 0; c < 81; c++) lc[c] &= ~elim[c];
      return true;
    }
    for (let c = 0; c < 81; c++) {
      if (POP[lc[c]] < 2) continue;
      this.union.fill(0);
      let branches = 0;
      for (let rest = lc[c]; rest; rest &= rest - 1) {
        if (!this.branch(0, -1, c, low(rest) + 1)) continue;
        branches++;
        this.joinDynamic();
      }
      if (branches && this.narrow()) return true;
    }
    for (let u = 0; u < 27; u++) {
      for (let d = 1; d <= 9; d++) {
        const m = this.unitMask(UNITS[u], bit(d));
        if (POP[m] < 2) continue;
        this.union.fill(0);
        let branches = 0;
        for (let rest = m; rest; rest &= rest - 1) {
          if (!this.branch(0, -1, UNITS[u][low(rest)], d)) continue;
          branches++;
          this.joinDynamic();
        }
        if (branches && this.narrow()) return true;
      }
    }
    return false;
  }

  nestedNet() {
    const lc = this.lc;
    for (let level = 1; level <= MAX_NEST; level++) {
      for (let c = 0; c < 81; c++) {
        for (let rest = lc[c]; rest; rest &= rest - 1) {
          if (this.branch(level, -1, c, low(rest) + 1)) continue;
          lc[c] &= ~(rest & -rest);
          this.stepRating = TECH_BASE[41] + level - 1;
          return true;
        }
      }
    }
    return false;
  }

  apply(id) {
    switch (id) {
      case 0: return this.singles();
      case 1: return this.lockedCandidates();
      case 2: return this.subsets();
      case 3: return this.fish(2);
      case 4: return this.yWing();
      case 5: return this.fish(3);
      case 6: return this.xyzWing();
      case 7: return this.skyscraper();
      case 8: return this.twoStringKite();
      case 9: return this.wWing();
      case 10: return this.uniqueRectangle();
      case 11: return this.nakedQuad();
      case 12: return this.hiddenQuad();
      case 13: return this.jellyfish();
      case 14: return this.finnedFish(2);
      case 15: return this.finnedFish(3);
      case 16: return this.finnedFish(4);
      case 17: return this.emptyRectangle();
      case 18: return this.remotePair();
      case 19: return this.wxyzWing();
      case 20: return this.rectangles(2);
      case 21: return this.rectangles(3);
      case 22: return this.rectangles(4);
      case 23: return this.rectangles(5);
      case 24: return this.rectangles(6);
      case 25: return this.rectangles(7);
      case 26: return this.bugPlusOne();
      case 27:
      case 28:
      case 29:
      case 30:
      case 31: return this.chains(id);
      case 32: return this.sueDeCoq();
      case 33: return this.alsXz();
      case 34: return this.alsXyWing();
      case 35: return this.deathBlossom();
      case 36: return this.alsChain();
      case 37: return this.nishio();
      case 38: return this.cellForcing();
      case 39: return this.unitForcing();
      case 40: return this.dynamicNet();
      case 41: return this.nestedNet();
    }
    return false;
  }

  step() {
    for (let k = 0; k < this.techLimit; k++) {
      const id = TECH_ORDER[k];
      if (this.techOff[id]) continue;
      this.stepRating = TECH_BASE[id];
      if (this.apply(id)) {
        this.stepOrder = k;
        return id;
      }
    }
    return -1;
  }

  rate(puzzle) {
    this.load(puzzle);
    let max = 0;
    this.rateOrder = 0;
    this.rateTech = 0;
    while (!this.complete()) {
      if (this.stuck()) return -1;
      const t = this.step();
      if (t < 0) return -1;
      if (this.stepRating > max) {
        max = this.stepRating;
        this.rateTech = t;
      }
      if (this.stepOrder > this.rateOrder) this.rateOrder = this.stepOrder;
    }
    return max;
  }

  noteHint(t) {
    if (this.stepRating <= this.hintRating) return;
    this.hintRating = this.stepRating;
    this.hintTech = t;
  }

  hint(values, givens) {
    this.load(values);
    this.hintTech = 0;
    this.hintRating = 0;
    while (!this.complete() && !this.stuck()) {
      const t = this.step();
      if (t < 0) break;
      if (t === 0) return true;
      this.noteHint(t);
    }
    this.load(givens);
    this.hintTech = 0;
    this.hintRating = 0;
    while (!this.complete() && !this.stuck()) {
      const t = this.step();
      if (t < 0) return false;
      if (t > 0) this.noteHint(t);
      if (t === 0 && !values[this.stepCell]) return true;
    }
    return false;
  }

  generate(level) {
    const limit = level < 2 ? 1 : level === 2 ? 3 : level === 3 ? EXPERT_LIMIT : TECH_COUNT;
    const minClues = level === 0 ? 38 : 0;
    for (;;) {
      this.techLimit = limit;
      const full = this.fullGrid();
      const puzzle = this.dig(full, minClues);
      const r = this.rate(puzzle);
      this.techLimit = TECH_COUNT;
      const ok = r >= 0 && (level < 2 || (level === 2 ? this.rateOrder >= 1 : level === 3 ? this.rateOrder >= 3 : r >= MASTER_RATING));
      if (ok) {
        this.solution = full;
        this.rating = r;
        return puzzle;
      }
    }
  }
}

const NONE = -1;
const HINT_NONE = 0, HINT_WRONG = 1, HINT_PLACE = 2;

class Game {
  constructor() {
    this.given = new Array(81).fill(0);
    this.solution = new Array(81).fill(0);
    this.value = new Array(81).fill(0);
    this.notes = new Array(81).fill(0);
    this.history = [];
    this.record = [];
    this.active = false;
    this.solved = false;
    this.noteMode = false;
    this.showErrors = true;
    this.level = 0;
    this.rating = 0;
    this.selected = NONE;
    this.sticky = 0;
    this.elapsed = 0;
    this.running = false;
    this.runningSince = 0;
    this.hintKind = HINT_NONE;
    this.hintCell = NONE;
    this.hintDigit = 0;
    this.hintTech = 0;
    this.hintUnit = 0;
    this.hintMoves = 0;
  }

  start(puzzle, full, level) {
    for (let i = 0; i < 81; i++) {
      this.given[i] = puzzle[i];
      this.solution[i] = full[i];
    }
    this.level = level;
    this.rating = 0;
    this.active = true;
    this.restart();
  }

  restart() {
    if (!this.active) return false;
    for (let i = 0; i < 81; i++) {
      this.value[i] = this.given[i];
      this.notes[i] = 0;
    }
    this.history = [];
    this.record = [];
    this.solved = false;
    this.noteMode = false;
    this.selected = NONE;
    this.sticky = 0;
    this.elapsed = 0;
    this.running = false;
    this.hintKind = HINT_NONE;
    return true;
  }

  canEdit() {
    return this.active && !this.solved && this.selected >= 0 && this.given[this.selected] === 0;
  }

  select(cell) {
    if (!this.sticky) this.selected = cell;
  }

  enter(d) {
    if (!this.canEdit()) return false;
    const c = this.selected;
    if (this.noteMode) {
      if (this.value[c]) return false;
      this.touch(c);
      this.notes[c] ^= bit(d);
      return this.commit();
    }
    this.touch(c);
    if (this.value[c] === d) {
      this.value[c] = 0;
      return this.commit();
    }
    this.value[c] = d;
    this.notes[c] = 0;
    const b = bit(d);
    for (const p of PEERS[c]) {
      if (this.notes[p] & b) {
        this.touch(p);
        this.notes[p] &= ~b;
      }
    }
    this.commit();
    this.checkSolved();
    if (this.sticky && (this.solved || this.remaining(this.sticky) <= 0)) this.sticky = 0;
    return true;
  }

  key(d) {
    if (!this.sticky && this.canEdit() && (this.noteMode ? !this.value[this.selected] : this.value[this.selected] !== d)) return this.enter(d);
    this.sticky = this.sticky === d || this.remaining(d) <= 0 ? 0 : d;
    if (this.sticky) this.selected = NONE;
    return false;
  }

  tap(cell) {
    if (!this.active || this.solved) return false;
    if (!this.sticky) {
      this.selected = cell === this.selected ? NONE : cell;
      return false;
    }
    this.selected = cell;
    const changed = this.enter(this.sticky);
    this.selected = NONE;
    return changed;
  }

  erase() {
    if (!this.canEdit() || (!this.value[this.selected] && !this.notes[this.selected])) return false;
    this.touch(this.selected);
    this.value[this.selected] = 0;
    this.notes[this.selected] = 0;
    return this.commit();
  }

  touch(cell) {
    for (let i = 0; i < this.record.length; i += 3) if (this.record[i] === cell) return;
    this.record.push(cell, this.value[cell], this.notes[cell]);
  }

  commit() {
    if (!this.record.length) return false;
    this.history.push(this.record);
    this.record = [];
    return true;
  }

  checkSolved() {
    for (let i = 0; i < 81; i++) if (this.value[i] !== this.solution[i]) return;
    this.solved = true;
    this.selected = NONE;
  }

  conflict(cell) {
    const v = this.value[cell];
    if (!v) return false;
    for (const p of PEERS[cell]) if (this.value[p] === v) return true;
    return false;
  }

  wrong(cell) {
    return this.showErrors && !this.given[cell] && this.value[cell] !== 0 && this.value[cell] !== this.solution[cell];
  }

  remaining(d) {
    let n = 9;
    for (const v of this.value) if (v === d) n--;
    return n;
  }

  resume(now) {
    if (this.active && !this.solved && !this.running) {
      this.running = true;
      this.runningSince = now;
    }
  }

  pause(now) {
    if (this.running) {
      this.elapsed += now - this.runningSince;
      this.running = false;
    }
  }

  time(now) {
    return this.elapsed + (this.running ? now - this.runningSince : 0);
  }

  undo() {
    if (!this.active || this.solved || !this.history.length) return false;
    const r = this.history.pop();
    for (let i = 0; i < r.length; i += 3) {
      this.value[r[i]] = r[i + 1];
      this.notes[r[i]] = r[i + 2];
    }
    if (!this.sticky) this.selected = r[0];
    return true;
  }

  fillNotes() {
    if (!this.active || this.solved) return false;
    for (let i = 0; i < 81; i++) {
      if (this.value[i]) continue;
      const m = candidates(this.value, i);
      if (this.notes[i] !== m) {
        this.touch(i);
        this.notes[i] = m;
      }
    }
    if (this.record.length) return this.commit();
    for (let i = 0; i < 81; i++) {
      if (this.notes[i]) {
        this.touch(i);
        this.notes[i] = 0;
      }
    }
    return this.commit();
  }

  hintActive() {
    return this.hintKind !== HINT_NONE && this.active && !this.solved && this.history.length === this.hintMoves && this.selected === this.hintCell;
  }

  hint(engine) {
    if (!this.active || this.solved) return false;
    this.sticky = 0;
    if (this.hintActive() && this.hintKind === HINT_PLACE && !this.value[this.hintCell]) {
      this.noteMode = false;
      this.hintKind = HINT_NONE;
      return this.enter(this.hintDigit);
    }
    this.hintKind = HINT_NONE;
    for (let i = 0; i < 81; i++) {
      if (!this.given[i] && this.value[i] && this.value[i] !== this.solution[i]) {
        this.hintKind = HINT_WRONG;
        this.hintCell = i;
        this.selected = i;
        this.hintMoves = this.history.length;
        return true;
      }
    }
    if (!engine.hint(this.value, this.given)) return false;
    this.hintKind = HINT_PLACE;
    this.hintCell = engine.stepCell;
    this.hintDigit = engine.stepDigit;
    this.hintTech = engine.hintTech;
    this.hintUnit = engine.stepUnit;
    this.selected = this.hintCell;
    this.hintMoves = this.history.length;
    return true;
  }

  save(now) {
    return {
      v: 1,
      active: this.active,
      level: this.level,
      solved: this.solved,
      showErrors: this.showErrors,
      noteMode: this.noteMode,
      selected: this.selected,
      elapsed: this.time(now),
      given: this.given.join(''),
      solution: this.solution.join(''),
      value: this.value.join(''),
      notes: this.notes,
      history: this.history
    };
  }

  load(s) {
    this.active = false;
    try {
      if (!s || s.v !== 1) return false;
      this.showErrors = !!s.showErrors;
      if (!s.active) return true;
      const digits = str => {
        if (typeof str !== 'string' || str.length !== 81) throw new Error('bad');
        return Array.from(str, ch => {
          const v = ch.charCodeAt(0) - 48;
          if (v < 0 || v > 9) throw new Error('bad');
          return v;
        });
      };
      const given = digits(s.given), solution = digits(s.solution), value = digits(s.value);
      if (!Array.isArray(s.notes) || s.notes.length !== 81 || !Array.isArray(s.history)) return false;
      const level = s.level | 0, selected = s.selected | 0, elapsed = +s.elapsed;
      if (level < 0 || level >= LEVELS || selected < NONE || selected > 80 || !(elapsed >= 0)) return false;
      for (const r of s.history) if (!Array.isArray(r) || r.length % 3 !== 0) return false;
      this.given = given;
      this.solution = solution;
      this.value = value;
      this.notes = s.notes.map(n => (n | 0) & ALL);
      this.history = s.history.map(r => r.map(x => x | 0));
      this.record = [];
      this.level = level;
      this.rating = 0;
      this.solved = !!s.solved;
      this.noteMode = !!s.noteMode;
      this.selected = selected;
      this.elapsed = elapsed;
      this.running = false;
      this.hintKind = HINT_NONE;
      this.active = true;
      return true;
    } catch (e) {
      this.active = false;
      return false;
    }
  }
}

if (typeof module !== 'undefined') module.exports = { Sudoku, Game, candidates, bit, PEERS, ROW, COL, BOX, HINT_WRONG, HINT_PLACE, NONE, TECH_BASE, TECH_COUNT, TECH_ORDER, MASTER_RATING, EXPERT_LIMIT, LEVELS };
