const KIND_DIAGONAL = 0, KIND_KILLER = 1, KIND_MINI = 2;
const VARIANT_LEVELS = 3;
const UNIT_ROW = 0, UNIT_COL = 1, UNIT_BOX = 2, UNIT_NAKED = 3, UNIT_DIAGONAL = 4, UNIT_REVEAL = 5;
const MAX_CELLS = 81, MAX_UNITS = 29, MAX_CAGES = 81;

class Shape {
  constructor(kind) {
    this.kind = kind;
    this.n = kind === KIND_MINI ? 6 : 9;
    this.boxH = kind === KIND_MINI ? 2 : 3;
    this.boxW = 3;
    this.size = this.n * this.n;
    this.all = (1 << this.n) - 1;
    this.unitCount = 0;
    this.unitCells = new Int32Array(MAX_UNITS * 9);
    this.unitType = new Int32Array(MAX_UNITS);
    this.cageOf = new Int32Array(MAX_CELLS).fill(-1);
    this.cageCount = 0;
    this.cageSize = new Int32Array(MAX_CAGES);
    this.cageSum = new Int32Array(MAX_CAGES);
    this.cageCells = new Int32Array(MAX_CAGES * 9);
    this.peerCount = new Int32Array(MAX_CELLS);
    this.peerCells = new Int32Array(MAX_CELLS * 32);
    const n = this.n;
    for (let r = 0; r < n; r++) this.addUnit(UNIT_ROW, k => r * n + k);
    for (let c = 0; c < n; c++) this.addUnit(UNIT_COL, k => k * n + c);
    const across = n / this.boxW;
    for (let b = 0; b < n; b++) {
      const top = ((b / across) | 0) * this.boxH, left = (b % across) * this.boxW;
      this.addUnit(UNIT_BOX, k => (top + ((k / this.boxW) | 0)) * n + left + (k % this.boxW));
    }
    if (kind === KIND_DIAGONAL) {
      this.addUnit(UNIT_DIAGONAL, k => k * n + k);
      this.addUnit(UNIT_DIAGONAL, k => k * n + n - 1 - k);
    }
    this.buildPeers();
  }

  addUnit(type, cellAt) {
    const u = this.unitCount++;
    this.unitType[u] = type;
    for (let k = 0; k < this.n; k++) this.unitCells[u * 9 + k] = cellAt(k);
  }

  setCages(cells, sums) {
    this.cageOf.fill(-1);
    this.cageCount = 0;
    for (let k = 0; k < sums.length; k++) {
      this.cageSize[k] = 0;
      this.cageSum[k] = sums[k];
    }
    for (let c = 0; c < this.size; c++) {
      const k = cells[c];
      if (k < 0) continue;
      this.cageOf[c] = k;
      this.cageCells[k * 9 + this.cageSize[k]++] = c;
      if (k + 1 > this.cageCount) this.cageCount = k + 1;
    }
    this.buildPeers();
  }

  sharesGroup(a, b) {
    for (let u = 0; u < this.unitCount; u++) {
      let ha = false, hb = false;
      for (let k = 0; k < this.n; k++) {
        const c = this.unitCells[u * 9 + k];
        if (c === a) ha = true;
        if (c === b) hb = true;
      }
      if (ha && hb) return true;
    }
    return this.cageOf[a] >= 0 && this.cageOf[a] === this.cageOf[b];
  }

  buildPeers() {
    for (let a = 0; a < this.size; a++) {
      let m = 0;
      for (let b = 0; b < this.size; b++) if (b !== a && this.sharesGroup(a, b)) this.peerCells[a * 32 + m++] = b;
      this.peerCount[a] = m;
    }
  }

  seen(values, cell) {
    let used = 0;
    for (let k = 0; k < this.peerCount[cell]; k++) {
      const v = values[this.peerCells[cell * 32 + k]];
      if (v) used |= 1 << (v - 1);
    }
    return this.all & ~used;
  }
}

class Variant {
  constructor(kind) {
    this.shape = new Shape(kind);
    this.state = 1;
    this.values = new Int32Array(MAX_CELLS);
    this.found = new Int32Array(MAX_CELLS);
    this.other = new Int32Array(MAX_CELLS);
    this.solution = new Int32Array(MAX_CELLS);
    this.count = 0;
    this.limit = 0;
    this.nodes = 0;
    this.solvedKey = '';
    this.stepCell = -1;
    this.stepDigit = 0;
    this.stepUnit = 0;
    this.hintTech = 0;
    this.combos = new Int32Array(10 * 46 * 128);
    this.comboCount = new Int32Array(10 * 46);
    for (let m = 1; m < 512; m++) {
      let size = 0, sum = 0;
      for (let d = 1; d <= 9; d++) if (m & (1 << (d - 1))) { size++; sum += d; }
      const at = size * 46 + sum;
      this.combos[at * 128 + this.comboCount[at]++] = m;
    }
  }

  seed(s) {
    this.state = s | 0;
  }

  random() {
    this.state = (this.state + 0x6D2B79F5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(bound) {
    return Math.floor(this.random() * bound);
  }

  shuffle(a, length) {
    for (let i = length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
  }

  cageAllowed(values, cell) {
    const s = this.shape, k = s.cageOf[cell];
    if (k < 0) return s.all;
    let used = 0, sum = 0, left = 0;
    for (let i = 0; i < s.cageSize[k]; i++) {
      const v = values[s.cageCells[k * 9 + i]];
      if (v) {
        used |= 1 << (v - 1);
        sum += v;
      } else left++;
    }
    const rest = s.cageSum[k] - sum;
    if (left === 0 || rest < 1 || rest > 45) return 0;
    const at = left * 46 + rest;
    let mask = 0;
    for (let i = 0; i < this.comboCount[at]; i++) {
      const m = this.combos[at * 128 + i];
      if ((m & used) === 0 && (m & ~s.all) === 0) mask |= m;
    }
    return mask;
  }

  candidatesAt(values, cell) {
    return this.shape.seen(values, cell) & this.cageAllowed(values, cell);
  }

  search() {
    const s = this.shape, values = this.values;
    let best = -1, bestMask = 0, bestCount = 10;
    for (let c = 0; c < s.size; c++) {
      if (values[c]) continue;
      const m = this.candidatesAt(values, c);
      let n = 0;
      for (let d = 0; d < s.n; d++) if (m & (1 << d)) n++;
      if (n === 0) return;
      if (n < bestCount) {
        best = c;
        bestMask = m;
        bestCount = n;
        if (n === 1) break;
      }
    }
    this.nodes++;
    if (best < 0) {
      if (this.count === 0) for (let c = 0; c < s.size; c++) this.found[c] = values[c];
      else if (this.count === 1) for (let c = 0; c < s.size; c++) this.other[c] = values[c];
      this.count++;
      return;
    }
    for (let d = 1; d <= s.n && this.count < this.limit && this.nodes < 400000; d++) {
      if (!(bestMask & (1 << (d - 1)))) continue;
      values[best] = d;
      this.search();
      values[best] = 0;
    }
  }

  countSolutions(puzzle, limit) {
    const s = this.shape;
    for (let c = 0; c < s.size; c++) {
      this.values[c] = puzzle[c];
      if (puzzle[c] && !(this.candidatesWithout(c) & (1 << (puzzle[c] - 1)))) return 0;
    }
    this.count = 0;
    this.limit = limit;
    this.nodes = 0;
    this.search();
    return this.nodes >= 400000 ? limit : this.count;
  }

  candidatesWithout(cell) {
    const v = this.values[cell];
    this.values[cell] = 0;
    const m = this.candidatesAt(this.values, cell);
    this.values[cell] = v;
    return m;
  }

  fill(cell) {
    const s = this.shape, values = this.values;
    if (cell === s.size) return true;
    const m = s.seen(values, cell);
    const order = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    this.shuffle(order, s.n);
    for (let i = 0; i < s.n; i++) {
      const d = order[i];
      if (!(m & (1 << (d - 1)))) continue;
      values[cell] = d;
      if (this.fill(cell + 1)) return true;
    }
    values[cell] = 0;
    return false;
  }

  fullGrid() {
    const s = this.shape;
    for (let c = 0; c < s.size; c++) this.values[c] = 0;
    s.setCages(new Int32Array(s.size).fill(-1), []);
    this.fill(0);
    return Array.from(this.values.subarray(0, s.size));
  }

  makeCages(full) {
    const s = this.shape, n = s.n;
    const cageOf = new Int32Array(s.size).fill(-1);
    const sums = [];
    const order = [];
    for (let c = 0; c < s.size; c++) order.push(c);
    this.shuffle(order, s.size);
    const near = [-1, 1, -n, n];
    for (let i = 0; i < s.size; i++) {
      const start = order[i];
      if (cageOf[start] >= 0) continue;
      const k = sums.length;
      const want = 2 + this.nextInt(3);
      const members = [start];
      let used = 1 << (full[start] - 1);
      cageOf[start] = k;
      for (let grow = 0; grow < 12 && members.length < want; grow++) {
        const from = members[this.nextInt(members.length)];
        const dir = near[this.nextInt(4)];
        const to = from + dir;
        if (to < 0 || to >= s.size) continue;
        if ((dir === -1 || dir === 1) && ((to / n) | 0) !== ((from / n) | 0)) continue;
        if (cageOf[to] >= 0 || (used & (1 << (full[to] - 1)))) continue;
        cageOf[to] = k;
        used |= 1 << (full[to] - 1);
        members.push(to);
      }
      let sum = 0;
      for (const c of members) sum += full[c];
      sums.push(sum);
    }
    s.setCages(cageOf, sums);
    return { cageOf, sums };
  }

  singlesSolve(puzzle) {
    const s = this.shape, values = this.values;
    for (let c = 0; c < s.size; c++) values[c] = puzzle[c];
    for (;;) {
      let progress = false, empty = 0;
      for (let c = 0; c < s.size; c++) {
        if (values[c]) continue;
        empty++;
        const m = this.candidatesAt(values, c);
        if (m === 0) return false;
        if ((m & (m - 1)) === 0) {
          values[c] = 31 - Math.clz32(m) + 1;
          progress = true;
        }
      }
      if (empty === 0) return true;
      for (let u = 0; u < s.unitCount && !progress; u++) {
        for (let d = 1; d <= s.n && !progress; d++) {
          let where = -1, places = 0, placed = false;
          for (let k = 0; k < s.n; k++) {
            const c = s.unitCells[u * 9 + k];
            if (values[c] === d) placed = true;
            else if (!values[c] && (this.candidatesAt(values, c) & (1 << (d - 1)))) {
              places++;
              where = c;
            }
          }
          if (!placed && places === 1) {
            values[where] = d;
            progress = true;
          }
        }
      }
      if (!progress) return false;
    }
  }

  dig(full, level) {
    const s = this.shape;
    const puzzle = full.slice();
    const order = [];
    for (let c = 0; c < s.size; c++) order.push(c);
    this.shuffle(order, s.size);
    const keep = level === 0 ? (s.n === 9 ? 36 : 18) : 0;
    let clues = s.size;
    for (let i = 0; i < s.size && clues > keep; i++) {
      const c = order[i], v = puzzle[c];
      puzzle[c] = 0;
      const ok = this.countSolutions(puzzle, 2) === 1 && (level === 2 || this.singlesSolve(puzzle));
      if (ok) clues--;
      else puzzle[c] = v;
    }
    return puzzle;
  }

  killerGivens(full, level) {
    const s = this.shape;
    const puzzle = new Array(s.size).fill(0);
    for (let guard = 0; guard < s.size; guard++) {
      const n = this.countSolutions(puzzle, 2);
      if (n === 1) break;
      let differ = -1;
      if (n === 2 && this.nodes < 400000) for (let c = 0; c < s.size && differ < 0; c++) if (!puzzle[c] && this.found[c] !== this.other[c]) differ = c;
      for (let c = 0; c < s.size && differ < 0; c++) if (!puzzle[c]) differ = c;
      puzzle[differ] = full[differ];
    }
    const extra = level === 0 ? 24 : level === 1 ? 10 : 0;
    const order = [];
    for (let c = 0; c < s.size; c++) order.push(c);
    this.shuffle(order, s.size);
    for (let i = 0, added = 0; i < s.size && added < extra; i++) {
      if (puzzle[order[i]]) continue;
      puzzle[order[i]] = full[order[i]];
      added++;
    }
    return puzzle;
  }

  generate(level) {
    const s = this.shape;
    for (;;) {
      const full = this.fullGrid();
      let puzzle;
      if (s.kind === KIND_KILLER) {
        this.makeCages(full);
        puzzle = this.killerGivens(full, level);
      } else {
        puzzle = this.dig(full, level);
        if (level === 2 && this.singlesSolve(puzzle)) continue;
      }
      if (this.countSolutions(puzzle, 2) !== 1) continue;
      for (let c = 0; c < s.size; c++) this.solution[c] = full[c];
      this.solvedKey = this.puzzleKey(puzzle);
      return puzzle;
    }
  }

  puzzleKey(givens) {
    const s = this.shape;
    let key = '';
    for (let c = 0; c < s.size; c++) key += givens[c] + ',' + s.cageOf[c] + ',';
    for (let k = 0; k < s.cageCount; k++) key += s.cageSum[k] + ',';
    return key;
  }

  hint(values, givens) {
    const s = this.shape;
    const key = this.puzzleKey(givens);
    if (key !== this.solvedKey) {
      if (this.countSolutions(givens, 2) !== 1) return false;
      for (let c = 0; c < s.size; c++) this.solution[c] = this.found[c];
      this.solvedKey = key;
    }
    for (let c = 0; c < s.size; c++) {
      if (values[c]) continue;
      const m = this.candidatesAt(values, c);
      if (m && (m & (m - 1)) === 0) {
        const d = 31 - Math.clz32(m) + 1;
        if (d !== this.solution[c]) continue;
        this.stepCell = c;
        this.stepDigit = d;
        this.stepUnit = UNIT_NAKED;
        this.hintTech = 0;
        return true;
      }
    }
    for (let u = 0; u < s.unitCount; u++) {
      for (let d = 1; d <= s.n; d++) {
        let where = -1, places = 0, placed = false;
        for (let k = 0; k < s.n; k++) {
          const c = s.unitCells[u * 9 + k];
          if (values[c] === d) placed = true;
          else if (!values[c] && (this.candidatesAt(values, c) & (1 << (d - 1)))) {
            places++;
            where = c;
          }
        }
        if (placed || places !== 1 || this.solution[where] !== d) continue;
        this.stepCell = where;
        this.stepDigit = d;
        this.stepUnit = s.unitType[u];
        this.hintTech = 0;
        return true;
      }
    }
    let best = -1, bestCount = 10;
    for (let c = 0; c < s.size; c++) {
      if (values[c]) continue;
      const m = this.candidatesAt(values, c);
      let n = 0;
      for (let d = 0; d < s.n; d++) if (m & (1 << d)) n++;
      if (n < bestCount) {
        best = c;
        bestCount = n;
      }
    }
    if (best < 0) return false;
    this.stepCell = best;
    this.stepDigit = this.solution[best];
    this.stepUnit = UNIT_REVEAL;
    this.hintTech = 0;
    return true;
  }
}

if (typeof module !== 'undefined') module.exports = { Shape, Variant, KIND_DIAGONAL, KIND_KILLER, KIND_MINI, VARIANT_LEVELS, UNIT_ROW, UNIT_COL, UNIT_BOX, UNIT_NAKED, UNIT_DIAGONAL, UNIT_REVEAL };
