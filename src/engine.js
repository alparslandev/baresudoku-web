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
const TECH_BASE = [10, 26, 30, 32, 42, 38, 44, 40, 41, 44, 45, 50, 54, 52, 46, 50, 56, 46, 47, 55, 46, 48, 47, 47, 48, 48, 56];
const TECH_COUNT = TECH_BASE.length;
const MASTER_RATING = 65;
const LEVELS = 4;
const TECH_ORDER = new Uint8Array(TECH_COUNT);
let EXPERT_LIMIT = 0;
{
  let n = 0;
  for (let id = 0; id < 11; id++) TECH_ORDER[n++] = id;
  for (let r = 0; r < 128; r++) for (let id = 11; id < TECH_COUNT; id++) if (TECH_BASE[id] === r) TECH_ORDER[n++] = id;
  for (let id = 0; id < TECH_COUNT; id++) if (TECH_BASE[id] < MASTER_RATING) EXPERT_LIMIT++;
}
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
    this.stepRating = 0;
    this.stepOrder = 0;
    this.rateOrder = 0;
    this.rateTech = 0;
    this.dist81 = new Int8Array(81);
    this.queue81 = new Uint8Array(81);
    this.cellList = new Uint8Array(81);
    this.quad = new Uint8Array(4);
    this.others = new Uint8Array(9);
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
    if (!z) return false;
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
    }
    return false;
  }

  step() {
    for (let k = 0; k < this.techLimit; k++) {
      const id = TECH_ORDER[k];
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
      if (level < 0 || level > 3 || selected < NONE || selected > 80 || !(elapsed >= 0)) return false;
      for (const r of s.history) if (!Array.isArray(r) || r.length % 3 !== 0) return false;
      this.given = given;
      this.solution = solution;
      this.value = value;
      this.notes = s.notes.map(n => (n | 0) & ALL);
      this.history = s.history.map(r => r.map(x => x | 0));
      this.record = [];
      this.level = level;
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
