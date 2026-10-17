function createExplainer(X, lang) {
  'use strict';
  const fill = (text, values) => text.replace(/\{([A-Za-z]+)\}/g, (m, key) => key in values ? String(values[key]) : m);
  const capital = text => text.charAt(0).toLocaleUpperCase(lang) + text.slice(1);
  const cellName = c => 'r' + (ROW[c] + 1) + 'c' + (COL[c] + 1);
  const digitList = digits => digits.join(', ');

  function unitOf(kind, cell) {
    return kind === 0 ? ROW[cell] : kind === 1 ? 9 + COL[cell] : 18 + BOX[cell];
  }

  function unitName(u) {
    return u < 9 ? fill(X.row, { n: u + 1 }) : u < 18 ? fill(X.col, { n: u - 8 }) : X.boxes[u - 18];
  }

  function inUnit(u) {
    return u < 9 ? fill(X.inRow, { n: u + 1 }) : u < 18 ? fill(X.inCol, { n: u - 8 }) : X.inBoxes[u - 18];
  }

  function holder(values, cells, d, skip) {
    for (const c of cells) if (c !== skip && values[c] === d) return c;
    return -1;
  }

  function hiddenSingle(ctx, marks) {
    const { cell, d, values, removedAt } = ctx;
    const u = unitOf(ctx.unit, cell);
    const lines = [capital(fill(X.hiddenIntro, { unit: unitName(u), inUnit: inUnit(u), d }))];
    for (const c of UNITS[u]) marks.unit.add(c);
    for (const c of UNITS[u]) {
      if (c === cell || values[c]) continue;
      const reasons = [[UNITS[ROW[c]], X.blockedRow], [UNITS[9 + COL[c]], X.blockedCol], [UNITS[18 + BOX[c]], X.blockedBox]];
      let line = '';
      for (const [cells, text] of reasons) {
        const by = holder(values, cells, d, c);
        if (by < 0) continue;
        line = fill(text, { cell: cellName(c), d, by: cellName(by) });
        marks.key.add(by);
        break;
      }
      if (!line && removedAt[c * 9 + d - 1]) line = fill(X.blockedStep, { cell: cellName(c), d, n: removedAt[c * 9 + d - 1] });
      if (line) lines.push(line);
    }
    lines.push(capital(fill(X.hiddenOnly, { cell: cellName(cell), d })));
    return lines;
  }

  function nakedSingle(ctx, marks) {
    const { cell, d, values, removedAt } = ctx;
    const lines = [capital(fill(X.nakedIntro, { cell: cellName(cell) }))];
    const units = [[UNITS[ROW[cell]], X.seenRow], [UNITS[9 + COL[cell]], X.seenCol], [UNITS[18 + BOX[cell]], X.seenBox]];
    const done = new Set([d]);
    for (const [cells, text] of units) {
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
      if (seen.length) lines.push(capital(fill(text, { digits: digitList(seen) })));
    }
    const byStep = new Map();
    for (let e = 1; e <= 9; e++) {
      const n = removedAt[cell * 9 + e - 1];
      if (done.has(e) || !n) continue;
      if (!byStep.has(n)) byStep.set(n, []);
      byStep.get(n).push(e);
    }
    for (const [n, digits] of [...byStep].sort((a, b) => a[0] - b[0])) lines.push(capital(fill(X.seenStep, { n, digits: digitList(digits) })));
    lines.push(capital(fill(X.nakedOnly, { cell: cellName(cell), d })));
    return lines;
  }

  function explain(ctx) {
    const marks = { unit: new Set(), key: new Set() };
    let lines = null;
    if (ctx.t === 0) lines = ctx.unit === 3 ? nakedSingle(ctx, marks) : hiddenSingle(ctx, marks);
    return lines ? { lines, marks } : null;
  }

  return { explain };
}

if (typeof module !== 'undefined') module.exports = { createExplainer };
