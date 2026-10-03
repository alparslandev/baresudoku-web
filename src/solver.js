(() => {
'use strict';
const S_NAKED = 17, S_ROW = 18, S_COL = 19, S_BOX = 20, S_TECH = 22, S_TECH_EXTRA = 33;
const S_MASTER = S_TECH_EXTRA + TECH_COUNT - 7;
const $ = id => document.getElementById(id);
const L = JSON.parse($('i18n').textContent);
const strings = L.s, T = L.solver, GUIDE = L.guide;
const LANG = document.documentElement.lang;
const EXAMPLE = '000074900800001320000002060000030076460000032170020000050700000016800005009250000';
const SLUGS = { 1: 'locked-candidates', 2: 'naked-pairs', 3: 'x-wing', 4: 'y-wing', 5: 'swordfish', 6: 'xyz-wing', 7: 'skyscraper', 8: 'two-string-kite', 9: 'w-wing', 10: 'unique-rectangle', 14: 'finned-x-wing', 15: 'finned-swordfish', 17: 'empty-rectangle', 19: 'wxyz-wing', 22: 'unique-rectangle-type-4', 25: 'hidden-rectangle' };
const MAX_STEPS = 400;
const engine = new Sudoku();
const inputs = [];
let givens = null, stepCount = 0, finished = false;
const ratingFormat = numberFormat(LANG);

function numberFormat(lang) {
  const options = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  try { return new Intl.NumberFormat(lang, options); } catch (e) { return new Intl.NumberFormat('en', options); }
}

function fill(text, values) {
  return text.replace(/\{([a-z]+)\}/g, (m, key) => key in values ? String(values[key]) : m);
}

function ref(c) {
  return 'r' + (ROW[c] + 1) + 'c' + (COL[c] + 1);
}

function digitsOf(mask) {
  const list = [];
  for (let d = 1; d <= 9; d++) if (mask & bit(d)) list.push(d);
  return list;
}

function buildGrid() {
  const grid = $('grid');
  for (let i = 0; i < 81; i++) {
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.maxLength = 1;
    input.autocomplete = 'off';
    input.dataset.i = i;
    input.className = 'c' + COL[i] + ' r' + ROW[i];
    input.setAttribute('aria-label', ref(i));
    grid.appendChild(input);
    inputs.push(input);
  }
  grid.addEventListener('input', e => {
    const input = e.target;
    const d = input.value.replace(/[^1-9]/g, '').slice(-1);
    input.value = d;
    if (d) focusInput(+input.dataset.i + 1);
  });
  grid.addEventListener('keydown', e => {
    const i = +e.target.dataset.i;
    const k = e.key;
    let target = -1;
    if (k === 'ArrowLeft') target = i - 1;
    else if (k === 'ArrowRight') target = i + 1;
    else if (k === 'ArrowUp') target = i - 9;
    else if (k === 'ArrowDown') target = i + 9;
    else if ((k === 'Backspace' || k === 'Delete') && !e.target.value) target = i - 1;
    else if (k === ' ' || k === '0' || k === '.') { e.target.value = ''; target = i + 1; }
    else return;
    e.preventDefault();
    focusInput(target);
  });
  grid.addEventListener('paste', e => {
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (parsePuzzle(text)) e.preventDefault();
  });
}

function focusInput(i) {
  if (i >= 0 && i < 81) inputs[i].focus();
}

function parsePuzzle(text) {
  const chars = String(text || '').replace(/[^0-9.]/g, '');
  if (chars.length < 81) return false;
  for (let i = 0; i < 81; i++) inputs[i].value = chars[i] === '.' || chars[i] === '0' ? '' : chars[i];
  return true;
}

function readGrid() {
  return inputs.map(input => +input.value || 0);
}

function clearGrid() {
  inputs.forEach(input => { input.value = ''; });
  $('paste').value = '';
  leaveResult();
  message('');
  focusInput(0);
}

function message(text, bad) {
  const msg = $('msg');
  msg.textContent = text;
  msg.className = bad ? 'bad' : '';
}

function enterResult() {
  $('entry').hidden = true;
  $('result').hidden = false;
  $('example').hidden = true;
  $('clear').hidden = true;
  $('edit').hidden = false;
}

function leaveResult() {
  givens = null;
  finished = false;
  stepCount = 0;
  $('entry').hidden = false;
  $('result').hidden = true;
  $('example').hidden = false;
  $('clear').hidden = false;
  $('edit').hidden = true;
  $('next').disabled = false;
  $('solve').disabled = false;
  $('steps').textContent = '';
  $('summary').textContent = '';
  $('figure').textContent = '';
}

function conflicting(values) {
  for (let c = 0; c < 81; c++) {
    if (!values[c]) continue;
    for (const p of PEERS[c]) if (values[p] === values[c]) return true;
  }
  return false;
}

function start() {
  if (givens) return true;
  const values = readGrid();
  const clues = values.filter(v => v).length;
  if (clues < 17) { message(T.tooFew, true); return false; }
  if (conflicting(values)) { message(T.noSolution, true); return false; }
  const n = engine.countSolutions(values, 2);
  if (n === 0) { message(T.noSolution, true); return false; }
  if (n > 1) { message(T.manySolutions, true); return false; }
  givens = values;
  engine.load(values);
  enterResult();
  message('');
  return true;
}

function boardHtml(given, values, cands, elim, place) {
  const elimSet = new Set(elim.map(([c, d]) => c * 10 + d));
  const elimCells = new Set(elim.map(([c]) => c));
  const changed = place ? new Set([place[0]]) : elimCells;
  let out = '<table class="board"><thead><tr><td></td>';
  for (let k = 0; k < 9; k++) out += '<th scope="col">c' + (k + 1) + '</th>';
  out += '</tr></thead><tbody>';
  for (let r = 0; r < 9; r++) {
    out += '<tr><th scope="row">r' + (r + 1) + '</th>';
    for (let k = 0; k < 9; k++) {
      const c = r * 9 + k;
      const classes = [];
      if (changed.has(c)) classes.push(place ? 'p' : 'e');
      if (k % 3 === 0) classes.push('bl');
      if (k === 8) classes.push('br');
      if (r % 3 === 0) classes.push('bt');
      if (r === 8) classes.push('bb');
      let inner;
      if (values[c]) inner = given[c] ? '<b>' + values[c] + '</b>' : '<span class="v">' + values[c] + '</span>';
      else {
        let marks = '';
        for (const d of digitsOf(cands[c])) {
          const tag = elimSet.has(c * 10 + d) ? 's' : place && place[0] === c && place[1] === d ? 'mark' : 'i';
          marks += '<' + tag + ' class="d' + d + '">' + d + '</' + tag + '>';
        }
        inner = '<span class="n">' + marks + '</span>';
      }
      out += '<td class="' + classes.join(' ') + '">' + inner + '</td>';
    }
    out += '</tr>';
  }
  return out + '</tbody></table>';
}

function techLabel(t) {
  if (t === 0) {
    const u = engine.stepUnit;
    return strings[u === 0 ? S_ROW : u === 1 ? S_COL : u === 2 ? S_BOX : S_NAKED].replace('#', engine.stepDigit);
  }
  return strings[t < 7 ? S_TECH + t - 1 : S_TECH_EXTRA + t - 7];
}

function guideSlug(t) {
  if (t === 0) return engine.stepUnit === 3 ? 'naked-single' : 'hidden-single';
  return SLUGS[t] || '';
}

function describe(t, elim, place) {
  const lines = [];
  if (place) lines.push(fill(T.placed, { d: place[1], cell: ref(place[0]) }));
  const byDigit = new Map();
  for (const [c, d] of elim) {
    if (!byDigit.has(d)) byDigit.set(d, []);
    byDigit.get(d).push(ref(c));
  }
  for (const [d, cells] of byDigit) lines.push(fill(T.removed, { d, cells: cells.join(', ') }));
  return lines;
}

function advance() {
  if (finished) return false;
  if (engine.complete()) {
    finish();
    return false;
  }
  const valuesBefore = Array.from(engine.lv);
  const candsBefore = Array.from(engine.lc);
  const t = engine.step();
  if (t < 0) {
    message(T.stuck, true);
    finished = true;
    $('next').disabled = true;
    $('solve').disabled = true;
    return false;
  }
  const elim = [];
  let place = null;
  for (let c = 0; c < 81; c++) {
    if (!valuesBefore[c] && engine.lv[c]) place = [c, engine.lv[c]];
    else if (!engine.lv[c]) {
      const gone = candsBefore[c] & ~engine.lc[c];
      for (const d of digitsOf(gone)) elim.push([c, d]);
    }
  }
  stepCount++;
  const rating = ratingFormat.format(engine.stepRating / 10);
  const li = document.createElement('li');
  const strong = document.createElement('strong');
  strong.textContent = techLabel(t) + ' (' + rating + ')';
  const slug = guideSlug(t);
  if (slug && GUIDE[slug]) {
    const a = document.createElement('a');
    a.href = GUIDE[slug];
    a.appendChild(strong);
    li.appendChild(a);
  } else li.appendChild(strong);
  for (const line of describe(t, elim, place)) {
    li.appendChild(document.createElement('br'));
    li.appendChild(document.createTextNode(line));
  }
  $('steps').appendChild(li);
  $('figure').innerHTML = boardHtml(givens, valuesBefore, candsBefore, elim, place);
  if (engine.complete()) finish();
  return true;
}

function levelOf() {
  const clues = givens.filter(v => v).length;
  const r = engine.rate(givens);
  const order = engine.rateOrder;
  const level = r >= MASTER_RATING ? 4 : order >= 3 ? 3 : order >= 1 ? 2 : clues >= 38 ? 0 : 1;
  return { level, r };
}

function finish() {
  finished = true;
  $('next').disabled = true;
  $('solve').disabled = true;
  const solved = Array.from(engine.lv);
  $('figure').innerHTML = boardHtml(givens, solved, new Array(81).fill(0), [], null);
  const { level, r } = levelOf();
  const name = strings[level < 4 ? level : S_MASTER];
  $('summary').textContent = T.done + ': ' + name + ', ' + fill(T.rating, { r: ratingFormat.format(r / 10) }) + ', ' + fill(T.steps, { n: stepCount });
  engine.load(solved);
}

function nextStep() {
  if (!start()) return;
  advance();
  $('figure').scrollIntoView({ block: 'nearest' });
}

function solveAll() {
  if (!start()) return;
  let n = 0;
  while (!finished && n < MAX_STEPS && advance()) n++;
  if (!finished && !engine.complete()) message(T.stuck, true);
}

function bind() {
  $('paste').addEventListener('input', e => { if (parsePuzzle(e.target.value)) focusInput(0); });
  $('next').addEventListener('click', nextStep);
  $('solve').addEventListener('click', solveAll);
  $('play').addEventListener('click', () => {
    if (start()) location.href = L.play + '?p=' + givens.join('');
  });
  $('clear').addEventListener('click', clearGrid);
  $('example').addEventListener('click', () => { leaveResult(); parsePuzzle(EXAMPLE); message(''); });
  $('edit').addEventListener('click', () => { leaveResult(); message(''); focusInput(0); });
}

function init() {
  buildGrid();
  bind();
  const param = new URLSearchParams(location.search).get('p');
  if (param && parsePuzzle(param)) message('');
}

init();
})();
