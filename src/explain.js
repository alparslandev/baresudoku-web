function createExplainer(X, lang) {
  'use strict';
  const FISH_NAMES = ['', '', 'X-Wing', 'Swordfish', 'Jellyfish'];
  const GROUP_NAMES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let scratch = null;

  const fill = (text, values) => text.replace(/\{([A-Za-z]+)\}/g, (m, key) => key in values ? String(values[key]) : m);
  const capital = text => /^r\d/.test(text) ? text : text.charAt(0).toLocaleUpperCase(lang) + text.slice(1);
  const say = (key, values) => capital(fill(X[key], values || {}));
  const cellName = c => 'r' + (ROW[c] + 1) + 'c' + (COL[c] + 1);
  const cellList = cells => cells.map(cellName).join(', ');

  function digitsOf(mask) {
    const list = [];
    for (let d = 1; d <= 9; d++) if (mask & bit(d)) list.push(d);
    return list;
  }

  const digitList = mask => digitsOf(mask).join(', ');
  const only = mask => digitsOf(mask)[0];

  function unitOf(kind, cell) {
    return kind === 0 ? ROW[cell] : kind === 1 ? 9 + COL[cell] : 18 + BOX[cell];
  }

  function unitName(u) {
    return u < 9 ? fill(X.row, { n: u + 1 }) : u < 18 ? fill(X.col, { n: u - 8 }) : X.boxes[u - 18];
  }

  function inUnit(u) {
    return u < 9 ? fill(X.inRow, { n: u + 1 }) : u < 18 ? fill(X.inCol, { n: u - 8 }) : X.inBoxes[u - 18];
  }

  function sharedUnits(cells) {
    const units = [];
    for (const u of [ROW[cells[0]], 9 + COL[cells[0]], 18 + BOX[cells[0]]]) if (cells.every(c => UNITS[u].includes(c))) units.push(u);
    return units;
  }

  function holder(values, cells, d, skip) {
    for (const c of cells) if (c !== skip && values[c] === d) return c;
    return -1;
  }

  function elimText(elims) {
    return elims.map(([c, m]) => cellName(c) + ' (' + digitList(m) + ')').join(', ');
  }

  function figuresOf(engine) {
    const list = [];
    let cell = 0, elim = 0;
    for (let f = 0; f < engine.figCount; f++) {
      const cells = Array.from(engine.figCells.subarray(cell, engine.figCellEnd[f]));
      const elims = [];
      for (let k = elim; k < engine.figElimEnd[f]; k++) elims.push([engine.figElimCell[k], engine.figElimMask[k]]);
      list.push({ kind: engine.figKind[f], digits: engine.figDigits[f], a: engine.figA[f], b: engine.figB[f], cells, elims });
      cell = engine.figCellEnd[f];
      elim = engine.figElimEnd[f];
    }
    return list;
  }

  function stepElims(ctx) {
    const byCell = new Map();
    for (const [c, d] of ctx.elim) byCell.set(c, (byCell.get(c) || 0) | bit(d));
    return [...byCell].sort((a, b) => a[0] - b[0]);
  }

  function keyCells(marks, cells) {
    for (const c of cells) marks.key.add(c);
  }

  function seesAll(c, cells) {
    return cells.every(o => o === c || sees(c, o));
  }

  function hiddenSingle(ctx, marks) {
    const { cell, d, values, removedAt } = ctx;
    const u = unitOf(ctx.unit, cell);
    const lines = [say('hiddenIntro', { unit: unitName(u), inUnit: inUnit(u), d })];
    for (const c of UNITS[u]) marks.unit.add(c);
    for (const c of UNITS[u]) {
      if (c === cell || values[c]) continue;
      const reasons = [[UNITS[ROW[c]], 'blockedRow'], [UNITS[9 + COL[c]], 'blockedCol'], [UNITS[18 + BOX[c]], 'blockedBox']];
      let line = '';
      for (const [cells, key] of reasons) {
        const by = holder(values, cells, d, c);
        if (by < 0) continue;
        line = say(key, { cell: cellName(c), d, by: cellName(by) });
        marks.key.add(by);
        break;
      }
      if (!line && removedAt[c * 9 + d - 1]) line = say('blockedStep', { cell: cellName(c), d, n: removedAt[c * 9 + d - 1] });
      if (line) lines.push(line);
    }
    lines.push(say('hiddenOnly', { cell: cellName(cell), d }));
    return lines;
  }

  function nakedSingle(ctx, marks) {
    const { cell, d, values, removedAt } = ctx;
    const lines = [say('nakedIntro', { cell: cellName(cell) })];
    const units = [[UNITS[ROW[cell]], 'seenRow'], [UNITS[9 + COL[cell]], 'seenCol'], [UNITS[18 + BOX[cell]], 'seenBox']];
    const done = new Set([d]);
    for (const [cells, key] of units) {
      const seen = [];
      for (let e = 1; e <= 9; e++) {
        if (done.has(e)) continue;
        const by = holder(values, cells, e, cell);
        if (by < 0) continue;
        seen.push(e);
        done.add(e);
        marks.key.add(by);
      }
      for (const c of cells) marks.unit.add(c);
      if (seen.length) lines.push(say(seen.length === 1 ? key + 'One' : key, { digits: seen.join(', ') }));
    }
    const byStep = new Map();
    for (let e = 1; e <= 9; e++) {
      const n = removedAt[cell * 9 + e - 1];
      if (done.has(e) || !n) continue;
      if (!byStep.has(n)) byStep.set(n, []);
      byStep.get(n).push(e);
    }
    for (const [n, digits] of [...byStep].sort((a, b) => a[0] - b[0])) lines.push(say(digits.length === 1 ? 'seenStepOne' : 'seenStep', { n, digits: digits.join(', ') }));
    lines.push(say('nakedOnly', { cell: cellName(cell), d }));
    return lines;
  }

  function canGo(u, d, cells) {
    return say('canGo', { inUnit: inUnit(u), unit: unitName(u), d, cells: cellList(cells) });
  }

  function remove(elims) {
    return elims.length ? say('remove', { list: elimText(elims) }) : null;
  }

  function locked(f, marks) {
    const d = only(f.digits);
    keyCells(marks, f.cells);
    for (const c of UNITS[f.a]) marks.unit.add(c);
    if (f.kind === FIG_POINTING) {
      return [canGo(f.a, d, f.cells), say('pointing2', { inLine: inUnit(f.b), line: unitName(f.b), d }), say('pointing3', { inLine: inUnit(f.b), line: unitName(f.b), d }), remove(f.elims)];
    }
    return [canGo(f.a, d, f.cells), say('claiming2', { inBox: inUnit(f.b), box: unitName(f.b), inLine: inUnit(f.a), line: unitName(f.a), d }), say('claiming3', { inBox: inUnit(f.b), box: unitName(f.b), inLine: inUnit(f.a), line: unitName(f.a), d }), remove(f.elims)];
  }

  function subset(f, marks) {
    keyCells(marks, f.cells);
    for (const c of UNITS[f.a]) marks.unit.add(c);
    const values = { inUnit: inUnit(f.a), unit: unitName(f.a), n: f.cells.length, cells: cellList(f.cells), digits: digitList(f.digits) };
    if (f.kind === FIG_NAKED) return [say('naked1', values), say('naked2', values), say('naked3', values), remove(f.elims)];
    return [say('hidden1', values), say('hidden2', values), say('hidden3', values), remove(f.elims)];
  }

  function fish(f, t, marks) {
    const d = only(f.digits), type = f.a, base = f.b & 511, cover = f.b >> 9;
    const n = digitsOf(base << 1).length;
    const lines = [say('onlyDigit', { d })];
    const coverUnits = [], baseUnits = [];
    for (let k = 0; k < 9; k++) if (cover & (1 << k)) coverUnits.push((1 - type) * 9 + k);
    for (let l = 0; l < 9; l++) if (base & (1 << l)) baseUnits.push(type * 9 + l);
    const inCover = c => coverUnits.some(u => UNITS[u].includes(c));
    const fins = f.cells.filter(c => !inCover(c));
    for (const u of baseUnits) lines.push(canGo(u, d, f.cells.filter(c => UNITS[u].includes(c))));
    keyCells(marks, f.cells);
    for (const u of coverUnits) for (const c of UNITS[u]) marks.unit.add(c);
    const covers = coverUnits.map(unitName).join(', ');
    const name = FISH_NAMES[n];
    if (!fins.length) {
      lines.push(say(type === 0 ? 'fishRows' : 'fishCols', { n, d, covers }));
      lines.push(say(type === 0 ? 'fishFillRows' : 'fishFillCols', { n, d }));
      lines.push(say(type === 0 ? 'fishOutRows' : 'fishOutCols', { d }));
    } else {
      lines.push(say('finIntro', { name, fins: cellList(fins) }));
      lines.push(say('finCase1', { name, d, covers }));
      lines.push(say('finCase2', { d }));
      lines.push(say('finBoth', { d }));
    }
    lines.push(remove(f.elims));
    return lines;
  }

  function wing(f, t, marks) {
    const [p, a, b] = f.cells, before = marks.cands;
    const z = only(f.digits);
    keyCells(marks, f.cells);
    const x = only(before[a] & ~f.digits), y = only(before[b] & ~f.digits);
    const values = { a: cellName(p), b: cellName(a), c: cellName(b), x, y, z };
    const lines = [say('wing1', values)];
    if (t === 4) {
      lines.push(say('wing2', values), say('seesNote'), say('wing3', values), say('wing4', values), say('wing5', values), say('wing6', values), say('wing7', values));
    } else {
      lines.push(say('xyz2', values), say('seesNote'), say('wing3', values), say('xyz4', values), say('wing4', values), say('wing5', values), say('xyz6', values));
    }
    lines.push(remove(f.elims));
    return lines;
  }

  function skyscraper(f, marks) {
    const d = only(f.digits);
    const [top1, top2, bottom1, bottom2] = f.cells;
    keyCells(marks, f.cells);
    const shared = sharedUnits([bottom1, bottom2])[0];
    const values = { d, a: cellName(top1), b: cellName(top2), c: cellName(bottom1), e: cellName(bottom2), inUnit: inUnit(shared), unit: unitName(shared) };
    return [say('onlyDigit', { d }), canGo(f.a, d, [bottom1, top1].sort((x, y) => x - y)), canGo(f.b, d, [bottom2, top2].sort((x, y) => x - y)), say('sky4', values), say('sky5', values), say('sky6', values), say('sky7', values), remove(f.elims)];
  }

  function kite(f, marks) {
    const d = only(f.digits);
    const [rowEnd, inBox, boxMate, colEnd] = f.cells;
    keyCells(marks, f.cells);
    const values = { d, a: cellName(rowEnd), b: cellName(colEnd), c: cellName(inBox), e: cellName(boxMate), inUnit: inUnit(18 + BOX[inBox]), unit: unitName(18 + BOX[inBox]) };
    return [say('onlyDigit', { d }), canGo(f.a, d, [rowEnd, inBox].sort((x, y) => x - y)), canGo(f.b, d, [boxMate, colEnd].sort((x, y) => x - y)), say('sky4', values), say('sky5', values), say('sky6', values), say('sky7', values), remove(f.elims)];
  }

  function wWing(f, marks) {
    const [p, q, e1, e2] = f.cells;
    const x = only(f.a), y = only(f.digits & ~f.a);
    keyCells(marks, f.cells);
    const values = { a: cellName(p), b: cellName(q), c: cellName(e1), e: cellName(e2), x, y, inUnit: inUnit(f.b), unit: unitName(f.b) };
    return [say('ww1', values), canGo(f.b, x, [e1, e2].sort((m, n) => m - n)), say('ww3', values), say('ww4', values), say('ww5', values), say('ww6', values), remove(f.elims)];
  }

  function rectangle(figs, t, marks) {
    const f = figs.find(g => g.kind === FIG_RECTANGLE);
    const corners = f.cells, before = marks.cands, m = f.digits;
    const [x, y] = digitsOf(m);
    keyCells(marks, corners);
    const floors = corners.filter(c => before[c] === m);
    const roofs = corners.filter(c => before[c] !== m);
    const lines = [say('ur1', { cells: cellList(corners) }), say('ur2', { cells: cellList(floors), x, y }), say('ur3', { x, y })];
    const elims = [].concat(...figs.map(g => g.elims));
    if (t === 10) {
      lines.push(say('ur4', { cell: cellName(f.a), x, y }));
    } else if (t === 20 || t === 23) {
      const z = only(f.a);
      const tops = corners.filter((c, i) => f.b & (1 << i));
      lines.push(say('urRoofs', { cells: cellList(tops), z }), say('urSeeAll', { z }));
    } else if (t === 21) {
      const sub = figs.find(g => g.kind === FIG_SUBSET);
      const tops = corners.filter((c, i) => f.b & (1 << i));
      keyCells(marks, sub.cells);
      for (const c of UNITS[sub.a]) marks.unit.add(c);
      const n = sub.cells.length + 1;
      lines.push(say('urExtra', { cells: cellList(tops), digits: digitList(f.a) }));
      lines.push(say('urVirtual', { digits: digitList(f.a), inUnit: inUnit(sub.a), unit: unitName(sub.a), n, all: digitList(sub.digits), cells: cellList(sub.cells) }));
      lines.push(say('naked3', { inUnit: inUnit(sub.a), unit: unitName(sub.a), digits: digitList(sub.digits) }));
    } else if (t === 22) {
      const xd = only(f.a), yd = only(m & ~f.a);
      const tops = roofs;
      for (const c of UNITS[f.b]) marks.unit.add(c);
      const values = { inUnit: inUnit(f.b), unit: unitName(f.b), x: xd, y: yd, a: cellName(tops[0]), b: cellName(tops[1]) };
      lines.push(say('ur4a', values), say('ur4b', values), say('ur4c', values));
    } else if (t === 24) {
      const xd = only(f.a), yd = only(m & ~f.a);
      const values = { x: xd, y: yd, a: cellName(floors[0]), b: cellName(floors[1]), c: cellName(roofs[0]), e: cellName(roofs[1]) };
      lines.push(say(f.b === 0 ? 'ur6Rows' : 'ur6Cols', values), say('ur6b', values), say('ur6c', values));
    } else {
      const k = f.b, xd = only(f.a), yd = only(m & ~f.a);
      const a = corners[k], d = corners[(k + 2) & 3];
      const rowMate = corners.find(c => c !== d && ROW[c] === ROW[d]), colMate = corners.find(c => c !== d && COL[c] === COL[d]);
      const values = { a: cellName(a), e: cellName(d), b: cellName(rowMate), c: cellName(colMate), x: xd, y: yd, inRow: inUnit(ROW[d]), row: unitName(ROW[d]), inCol: inUnit(9 + COL[d]), col: unitName(9 + COL[d]) };
      lines.splice(1, 1, say('ur2', { cells: cellName(a), x: xd, y: yd }));
      lines.push(say('hr3', values), say('hr4', values), say('hr5', values));
    }
    lines.push(remove(elims));
    return lines;
  }

  function bug(f, marks) {
    const tri = f.cells[0], x = only(f.digits);
    keyCells(marks, f.cells);
    const values = { cell: cellName(tri), digits: digitList(marks.cands[tri]), x };
    return [say('bug1', values), say('bug2', values), say('bug3', values), say('bug4', values), remove(f.elims)];
  }

  function emptyRectangle(f, marks) {
    const d = only(f.digits), [near, far, target] = f.cells, box = f.a;
    const row = (f.b / 9) | 0, col = f.b % 9;
    const boxCells = UNITS[box].filter(c => marks.cands[c] & bit(d));
    keyCells(marks, boxCells.concat([near, far]));
    const link = sharedUnits([near, far]).find(u => u < 18);
    const nearLine = link < 9 ? 9 + COL[near] : ROW[near];
    const crossOff = nearLine < 9 ? row : 9 + col;
    const crossOn = nearLine < 9 ? 9 + col : row;
    const values = { d, a: cellName(near), b: cellName(far), c: cellName(target), inLine: inUnit(crossOff), line: unitName(crossOff), inCross: inUnit(crossOn), cross: unitName(crossOn), inRow: inUnit(row), row: unitName(row), inCol: inUnit(9 + col), col: unitName(9 + col) };
    return [say('onlyDigit', { d }), canGo(box, d, boxCells), say('er2', values), canGo(link, d, [near, far].sort((m, n) => m - n)), say('er4', values), say('er5', values), say('er6', values), remove(f.elims)];
  }

  function remotePair(f, marks) {
    const [x, y] = digitsOf(f.digits);
    keyCells(marks, f.cells);
    const values = { x, y, cells: cellList(f.cells), a: cellName(f.cells[0]), b: cellName(f.cells[f.cells.length - 1]) };
    return [say('rp1', values), say('rp2', values), say('rp3', values), say('rp4', values), remove(f.elims)];
  }

  function quad(f, marks) {
    const z = only(f.digits);
    keyCells(marks, f.cells);
    const values = { cells: cellList(f.cells), digits: digitList(f.a), others: digitList(f.a & ~f.digits), z };
    return [say('q1', values), say('seesNote'), say('q2', values), say('q3', values), say('q4', values), remove(f.elims)];
  }

  function nodeInfo(engine, node) {
    if (node < 729) return { cells: [(node / 9) | 0], d: node % 9 + 1 };
    const g = node - 729, cells = [];
    for (let i = 0; i < engine.groupSize[g]; i++) cells.push(engine.groupCells[g * 3 + i]);
    return { cells, d: engine.groupDigit[g] };
  }

  const nodeName = info => info.cells.map(cellName).join('/');

  function linkLine(engine, from, to, before) {
    const a = nodeInfo(engine, from >> 1), b = nodeInfo(engine, to >> 1);
    const sameCell = a.cells.length === 1 && b.cells.length === 1 && a.cells[0] === b.cells[0];
    if (to & 1) {
      if (sameCell) return say('factOnCell', { a: nodeName(a), d: a.d, e: b.d });
      const u = sharedUnits(a.cells.concat(b.cells)).find(v => UNITS[v].every(c => !(before[c] & bit(a.d)) || a.cells.includes(c) || b.cells.includes(c)));
      const unit = u === undefined ? sharedUnits(a.cells.concat(b.cells))[0] : u;
      return say('factOnUnit', { a: nodeName(a), b: nodeName(b), d: b.d, inUnit: inUnit(unit), unit: unitName(unit) });
    }
    if (sameCell) return say('factOffCell', { a: nodeName(a), d: a.d, e: b.d });
    const unit = sharedUnits(a.cells.concat(b.cells))[0];
    return say('factOffSees', { a: nodeName(a), b: nodeName(b), d: b.d, inUnit: inUnit(unit), unit: unitName(unit) });
  }

  function chainNodes(engine, states, marks) {
    let grouped = false;
    for (const st of states) {
      const info = nodeInfo(engine, st >> 1);
      if (info.cells.length > 1) grouped = true;
      keyCells(marks, info.cells);
    }
    return grouped;
  }

  function chain(f, t, ctx, marks) {
    const engine = ctx.engine, states = f.cells, before = marks.cands;
    const lines = [];
    if (chainNodes(engine, states, marks)) lines.push(say('groupNote'));
    const first = nodeInfo(engine, states[0] >> 1), last = nodeInfo(engine, states[states.length - 1] >> 1);
    lines.push(say('chain0'), say('chainStart', { a: nodeName(first), d: first.d }));
    for (let i = 1; i < states.length; i++) lines.push('→ ' + linkLine(engine, states[i - 1], states[i], before));
    const values = { a: nodeName(first), d: first.d, b: nodeName(last), e: last.d };
    if (f.a) {
      lines.push(say('loop1', values), say('loop2'));
    } else {
      lines.push(say('chainEnd', values));
      const sameCell = first.cells.length === 1 && last.cells.length === 1 && first.cells[0] === last.cells[0];
      if (first.d === last.d) lines.push(say('chainSame', values));
      else if (sameCell) lines.push(say('chainCell', values));
      else lines.push(say('chainCross', values));
    }
    lines.push(remove(f.elims));
    return lines;
  }

  function alsLine(f, name) {
    return say(f.cells.length === 1 ? 'alsGroupOne' : 'alsGroup', { name, cells: cellList(f.cells), n: f.cells.length, digits: digitList(f.digits) });
  }

  function als(figs, t, marks) {
    const groups = figs.filter(g => g.kind === FIG_ALS);
    const elims = [].concat(...figs.map(g => g.elims));
    for (const g of groups) keyCells(marks, g.cells);
    const lines = [];
    if (t === 33) {
      const link = figs.find(g => g.kind === FIG_LINKS);
      const [A, B] = groups;
      lines.push(alsLine(A, 'A'), alsLine(B, 'B'), say('alsKey'));
      if (digitsOf(link.digits).length === 1) {
        const x = only(link.digits);
        const zs = digitsOf(A.digits & B.digits & ~link.digits);
        lines.push(say('xz1', { x, a: 'A', b: 'B' }), say('xz2', { x, z: zs.join(', ') }), say('xz3', { z: zs.join(', ') }));
      } else {
        lines.push(say('xzDouble', { digits: digitList(link.digits) }));
      }
    } else if (t === 34) {
      const link = figs.find(g => g.kind === FIG_LINKS);
      const [C, A, B] = groups;
      const x = only(link.digits), y = only(link.a);
      const z = digitsOf(A.digits & B.digits & ~link.digits & ~link.a).join(', ');
      lines.push(alsLine(C, 'C'), alsLine(A, 'A'), alsLine(B, 'B'), say('alsKey'), say('xy1', { x, y }), say('xy2', { x, y, z }), say('xy3', { z }));
    } else if (t === 35) {
      const stem = figs.find(g => g.kind === FIG_STEM);
      const cell = stem.cells[0], z = only(stem.digits);
      const stemDigits = digitsOf(marks.cands[cell]);
      keyCells(marks, [cell]);
      lines.push(say('db1', { cell: cellName(cell), digits: stemDigits.join(', ') }), say('alsKey'));
      const petals = groups.slice().sort((a, b) => a.a - b.a);
      petals.forEach((g, i) => lines.push(say('db2', { cell: cellName(cell), d: stemDigits[g.a], name: GROUP_NAMES[i], cells: cellList(g.cells), z })));
      lines.push(say('db3', { cell: cellName(cell), z }));
    } else {
      const ordered = groups.slice().sort((a, b) => a.a - b.a);
      ordered.forEach((g, i) => lines.push(alsLine(g, GROUP_NAMES[i])));
      lines.push(say('alsKey'));
      for (let i = 1; i < ordered.length; i++) lines.push(say('acLink', { a: GROUP_NAMES[i - 1], b: GROUP_NAMES[i], x: only(ordered[i].b) }));
      const z = digitList(elims.reduce((m, e) => m | e[1], 0));
      lines.push(say('acEnd', { a: GROUP_NAMES[0], b: GROUP_NAMES[ordered.length - 1], z }));
    }
    lines.push(remove(elims));
    return lines;
  }

  function sueDeCoq(figs, marks) {
    const line = figs.find(g => g.kind === FIG_LINE), box = figs.find(g => g.kind === FIG_BOX);
    const inter = line.cells.slice(0, line.b), lineCells = line.cells.slice(line.b), boxCells = box.cells.slice(box.b);
    keyCells(marks, line.cells.concat(boxCells));
    let interDigits = 0, lineMask = 0, boxMask = 0;
    for (const c of inter) interDigits |= marks.cands[c];
    for (const c of lineCells) lineMask |= marks.cands[c];
    for (const c of boxCells) boxMask |= marks.cands[c];
    const values = { cells: cellList(inter), inLine: inUnit(line.a), line: unitName(line.a), inBox: inUnit(box.a), box: unitName(box.a), digits: digitList(interDigits), lineCells: cellList(lineCells), lineDigits: digitList(lineMask), boxCells: cellList(boxCells), boxDigits: digitList(boxMask), lineKeep: digitList(line.digits), boxKeep: digitList(box.digits) };
    return [say('sdc1', values), say('sdc2', values), say('sdc3', values), say('sdc4', values), remove(line.elims.concat(box.elims))];
  }

  function scratchFor(ctx) {
    if (!scratch) scratch = new Sudoku();
    scratch.lv.set(ctx.values);
    scratch.lc.set(ctx.cands);
    return scratch;
  }

  function reached(s, st) {
    return s.mark[st] === s.markValue;
  }

  function pathTo(s, st) {
    const path = [];
    for (let x = st; x >= 0; x = s.parent[x]) path.push(x);
    return path.reverse();
  }

  function narrate(s, targets, before) {
    const need = new Set();
    for (const st of targets) for (const x of pathTo(s, st)) need.add(x);
    const order = [];
    for (let k = 0; k < STATES && order.length < need.size; k++) {
      const st = s.queue[k];
      if (need.has(st) && !order.includes(st)) order.push(st);
    }
    for (const st of need) if (!order.includes(st)) order.push(st);
    const lines = [];
    for (const st of order) if (s.parent[st] >= 0) lines.push('→ ' + linkLine(s, s.parent[st], st, before));
    return lines;
  }

  function staticConflict(s, node, before) {
    const lines = [];
    if (s.conflictState >= 0) {
      const st = s.conflictState;
      const other = st ^ 1;
      const info = nodeInfo(s, st >> 1);
      lines.push(...narrate(s, [other], before));
      lines.push('→ ' + linkLine(s, s.parent[st], st, before));
      lines.push(say('conflictBoth', { a: nodeName(info), d: info.d }));
    } else if (s.conflictCell >= 0) {
      const q = s.conflictCell, targets = [];
      for (const d of digitsOf(before[q])) targets.push((q * 9 + d - 1) * 2);
      lines.push(...narrate(s, targets.filter(st => reached(s, st)), before));
      lines.push(say('conflictCell', { cell: cellName(q) }));
    } else if (s.conflictUnit >= 0) {
      const u = s.conflictUnit, targets = [];
      for (const d of digitsOf(s.conflictDigits)) for (const c of UNITS[u]) if (before[c] & bit(d)) targets.push((c * 9 + d - 1) * 2);
      lines.push(...narrate(s, targets.filter(st => reached(s, st)), before));
      lines.push(say('conflictUnit', { inUnit: inUnit(u), unit: unitName(u), digits: digitList(s.conflictDigits) }));
    }
    return lines;
  }

  function staticEnd(s, q, e, before) {
    const off = (q * 9 + e - 1) * 2;
    if (reached(s, off)) return narrate(s, [off], before);
    for (const f of digitsOf(before[q])) {
      const on = (q * 9 + f - 1) * 2 + 1;
      if (f !== e && reached(s, on)) return narrate(s, [on], before).concat(['→ ' + say('factOffCell', { a: cellName(q), d: f, e })]);
    }
    return [];
  }

  function forcingStatic(ctx, t, marks) {
    const s = scratchFor(ctx), before = ctx.cands;
    s.prepareUnits();
    s.groupCount = 0;
    s.buildLinks(30);
    const elims = stepElims(ctx), lines = [];
    if (t === 37) {
      for (const [c, m] of elims) {
        for (const d of digitsOf(m)) {
          if (s.reachConsistent(c * 9 + d - 1)) continue;
          keyCells(marks, [c]);
          lines.push(say('tryOn', { cell: cellName(c), d }), ...staticConflict(s, c * 9 + d - 1, before), say('soNot', { cell: cellName(c), d }));
        }
      }
      lines.push(remove(elims));
      return lines;
    }
    const [q, qm] = elims[0], e = only(qm);
    const branches = [];
    if (t === 38) {
      for (let c = 0; c < 81 && !branches.length; c++) {
        if (digitsOf(before[c]).length < 2) continue;
        const list = digitsOf(before[c]).map(d => [c, d]);
        if (list.every(([bc, d]) => !s.reachConsistent(bc * 9 + d - 1) || staticEnd(s, q, e, before).length)) {
          branches.push(...list);
          lines.push(say('branchCell', { cell: cellName(c), digits: digitList(before[c]) }));
        }
      }
    } else {
      for (let u = 0; u < 27 && !branches.length; u++) {
        for (let d = 1; d <= 9 && !branches.length; d++) {
          const cells = UNITS[u].filter(c => before[c] & bit(d));
          if (cells.length < 2) continue;
          if (cells.every(c => !s.reachConsistent(c * 9 + d - 1) || staticEnd(s, q, e, before).length)) {
            branches.push(...cells.map(c => [c, d]));
            lines.push(say('branchUnit', { inUnit: inUnit(u), unit: unitName(u), d, cells: cellList(cells) }));
          }
        }
      }
    }
    for (const [c, d] of branches) {
      keyCells(marks, [c]);
      if (!s.reachConsistent(c * 9 + d - 1)) {
        lines.push(say('branchIf', { cell: cellName(c), d }), ...staticConflict(s, c * 9 + d - 1, before));
        continue;
      }
      lines.push(say('branchIf', { cell: cellName(c), d }), ...staticEnd(s, q, e, before));
    }
    lines.push(say('branchEnd', { cell: cellName(q), e }), remove(elims));
    return lines;
  }

  function logLines(s, from) {
    const lines = [];
    for (let k = from; k < s.logCount; k++) {
      const c = s.logCell[k], d = s.logDigit[k], why = s.logWhy[k];
      if (why === -2) continue;
      if (why === -1) lines.push('→ ' + say('netNaked', { cell: cellName(c), d }));
      else if (why === -3) lines.push('→ ' + say('netNested', { cell: cellName(c), d }));
      else lines.push('→ ' + say('netHidden', { cell: cellName(c), d, inUnit: inUnit(why), unit: unitName(why) }));
    }
    return lines;
  }

  function netConflict(s) {
    if (s.conflictCell >= 0) return say('conflictCell', { cell: cellName(s.conflictCell) });
    if (s.conflictCell === -2) return say('conflictTwice', { inUnit: inUnit(s.conflictUnit), unit: unitName(s.conflictUnit), digits: digitList(s.conflictDigits) });
    if (s.conflictUnit >= 0) return say('conflictUnit', { inUnit: inUnit(s.conflictUnit), unit: unitName(s.conflictUnit), digits: digitList(s.conflictDigits) });
    return say('conflictAny');
  }

  function tryNet(s, level, c, d) {
    s.logging = true;
    s.logLevel = level;
    s.logCount = 0;
    s.conflictCell = -1;
    s.conflictUnit = -1;
    const ok = s.branch(level, -1, c, d);
    s.logging = false;
    return ok;
  }

  function netTarget(s, level, q, e) {
    const at = level * 81;
    return s.sv[at + q] ? s.sv[at + q] !== e : !(s.sc[at + q] & bit(e));
  }

  function forcingNet(ctx, t, marks) {
    const s = scratchFor(ctx), before = ctx.cands;
    const elims = stepElims(ctx), lines = [];
    const level = t === 41 ? Math.max(1, ctx.rating - TECH_BASE[41] + 1) : 0;
    const contradiction = (c, d) => {
      if (tryNet(s, level, c, d)) return false;
      keyCells(marks, [c]);
      lines.push(say('tryOn', { cell: cellName(c), d }), ...logLines(s, 0), '→ ' + netConflict(s), say('soNot', { cell: cellName(c), d }));
      return true;
    };
    let done = false;
    for (const [c, m] of elims) for (const d of digitsOf(m)) if (contradiction(c, d)) done = true;
    if (!done) {
      const [q, qm] = elims[0], e = only(qm);
      const fits = list => list.every(([c, d]) => {
        if (!tryNet(s, 0, c, d)) return true;
        return netTarget(s, 0, q, e);
      });
      let branches = null;
      for (let c = 0; c < 81 && !branches; c++) {
        const list = digitsOf(before[c]).map(d => [c, d]);
        if (list.length >= 2 && fits(list)) {
          branches = list;
          lines.push(say('branchCell', { cell: cellName(c), digits: digitList(before[c]) }));
        }
      }
      for (let u = 0; u < 27 && !branches; u++) {
        for (let d = 1; d <= 9 && !branches; d++) {
          const list = UNITS[u].filter(c => before[c] & bit(d)).map(c => [c, d]);
          if (list.length >= 2 && fits(list)) {
            branches = list;
            lines.push(say('branchUnit', { inUnit: inUnit(u), unit: unitName(u), d, cells: cellList(list.map(([c]) => c)) }));
          }
        }
      }
      for (const [c, d] of branches || []) {
        keyCells(marks, [c]);
        if (!tryNet(s, 0, c, d)) {
          lines.push(say('branchIf', { cell: cellName(c), d }), ...logLines(s, 0), '→ ' + netConflict(s));
          continue;
        }
        lines.push(say('branchIf', { cell: cellName(c), d }), ...logLines(s, 0), '→ ' + say('netOut', { cell: cellName(q), e }));
      }
      lines.push(say('branchEnd', { cell: cellName(q), e }));
    }
    lines.push(remove(elims));
    return lines;
  }

  function eliminationStep(ctx, marks) {
    const t = ctx.t, figs = figuresOf(ctx.engine);
    if (t >= 37 && t <= 39) return forcingStatic(ctx, t, marks);
    if (t === 40 || t === 41) return forcingNet(ctx, t, marks);
    if (!figs.length) return null;
    const lines = [];
    const add = part => {
      if (lines.length) lines.push('');
      for (const line of part) if (line) lines.push(line);
    };
    if (t === 1 || t === 2 || t === 11 || t === 12) {
      for (const f of figs) add(f.kind === FIG_POINTING || f.kind === FIG_CLAIMING ? locked(f, marks) : subset(f, marks));
    } else if (t === 3 || t === 5 || t === 13 || (t >= 14 && t <= 16) || t >= 42) add(fish(figs[0], t, marks));
    else if (t === 4 || t === 6) add(wing(figs[0], t, marks));
    else if (t === 7) add(skyscraper(figs[0], marks));
    else if (t === 8) add(kite(figs[0], marks));
    else if (t === 9) add(wWing(figs[0], marks));
    else if (t === 10 || (t >= 20 && t <= 25)) add(rectangle(figs, t, marks));
    else if (t === 17) add(emptyRectangle(figs[0], marks));
    else if (t === 18) add(remotePair(figs[0], marks));
    else if (t === 19) add(quad(figs[0], marks));
    else if (t === 26) add(bug(figs[0], marks));
    else if (t >= 27 && t <= 31) add(chain(figs[0], t, ctx, marks));
    else if (t === 32) add(sueDeCoq(figs, marks));
    else if (t >= 33 && t <= 36) add(als(figs, t, marks));
    return lines.length ? lines : null;
  }

  function explain(ctx) {
    const marks = { unit: new Set(), key: new Set(), cands: ctx.cands };
    let lines = null;
    if (ctx.t === 0) lines = ctx.unit === 3 ? nakedSingle(ctx, marks) : hiddenSingle(ctx, marks);
    else lines = eliminationStep(ctx, marks);
    delete marks.cands;
    return lines ? { lines: lines.filter(line => line !== null), marks } : null;
  }

  return { explain };
}

if (typeof module !== 'undefined') module.exports = { createExplainer };
