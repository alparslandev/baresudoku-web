(() => {
'use strict';
const S_TECH_EXTRA = 33;
const S_MASTER = S_TECH_EXTRA + TECH_COUNT - 7;
const COUNTS = [1, 2, 4, 6];
const $ = id => document.getElementById(id);
const L = JSON.parse($('i18n').textContent);
const strings = L.s, T = L.print;
const LANG = document.documentElement.lang;
const engine = new Sudoku();
const ratingFormat = numberFormat(LANG);
const sheet = { level: 3, count: 4, seed: 0, solutions: false, puzzle: null };
let puzzles = [];

function numberFormat(lang) {
  const options = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  try { return new Intl.NumberFormat(lang, options); } catch (e) { return new Intl.NumberFormat('en', options); }
}

function esc(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function levelName(level) {
  return strings[level < 4 ? level : S_MASTER];
}

function randomSeed() {
  return Math.floor(Math.random() * 900000) + 100000;
}

function levelOf(values) {
  const clues = values.filter(v => v).length;
  const r = engine.rate(values);
  if (r < 0) return -1;
  const order = engine.rateOrder;
  return r >= MASTER_RATING ? 4 : order >= 3 ? 3 : order >= 1 ? 2 : clues >= 38 ? 0 : 1;
}

function sharedPuzzle(param) {
  const chars = String(param).replace(/[^0-9.]/g, '');
  if (chars.length !== 81) return null;
  const values = Array.from(chars, ch => ch === '.' ? 0 : +ch);
  for (let c = 0; c < 81; c++) if (values[c]) for (const p of PEERS[c]) if (values[p] === values[c]) return null;
  if (engine.countSolutions(values, 2) !== 1) return null;
  const level = levelOf(values);
  if (level < 0) return null;
  return { values, solution: Array.from(engine.found), level, rating: engine.rate(values) };
}

function readParams() {
  const q = new URLSearchParams(location.search);
  sheet.solutions = q.get('k') === '1';
  if (q.has('p')) {
    sheet.puzzle = sharedPuzzle(q.get('p'));
    if (sheet.puzzle) return;
  }
  const level = q.has('l') ? +q.get('l') : NaN;
  if (Number.isInteger(level) && level >= 0 && level < LEVELS) sheet.level = level;
  const count = q.has('n') ? +q.get('n') : NaN;
  if (COUNTS.includes(count)) sheet.count = count;
  const seed = q.has('s') ? +q.get('s') : NaN;
  sheet.seed = Number.isInteger(seed) && seed > 0 && seed < 2147483648 ? seed : randomSeed();
}

function generate() {
  if (sheet.puzzle) {
    puzzles = [sheet.puzzle];
    return;
  }
  engine.seed(sheet.seed);
  puzzles = [];
  for (let k = 0; k < sheet.count; k++) {
    const values = engine.generate(sheet.level);
    puzzles.push({ values, solution: Array.from(engine.solution), level: sheet.level, rating: engine.rating });
  }
}

function query(withSolutions) {
  const q = sheet.puzzle ? 'p=' + sheet.puzzle.values.join('') : 'l=' + sheet.level + '&n=' + sheet.count + '&s=' + sheet.seed;
  return '?' + q + (withSolutions ? '&k=1' : '');
}

function gridHtml(values, solution) {
  let out = '<table class="pgrid"><tbody>';
  for (let r = 0; r < 9; r++) {
    out += '<tr>';
    for (let k = 0; k < 9; k++) {
      const c = r * 9 + k;
      const classes = [];
      if (k % 3 === 0) classes.push('bl');
      if (k === 8) classes.push('br');
      if (r % 3 === 0) classes.push('bt');
      if (r === 8) classes.push('bb');
      const v = solution ? solution[c] : values[c];
      const inner = !v ? '<span></span>' : values[c] ? '<b>' + v + '</b>' : '<span class="v">' + v + '</span>';
      out += '<td class="' + classes.join(' ') + '">' + inner + '</td>';
    }
    out += '</tr>';
  }
  return out + '</tbody></table>';
}

function label(p, k) {
  const name = levelName(p.level) + ' ' + ratingFormat.format(p.rating / 10);
  return puzzles.length > 1 ? (k + 1) + '. ' + name : name;
}

function sheetsHtml(withSolution) {
  return puzzles.map((p, k) => '<section class="sheet"><h2>' + esc(label(p, k)) + '</h2>' + gridHtml(p.values, withSolution ? p.solution : null) + '</section>').join('');
}

function render() {
  const sheets = $('sheets');
  sheets.className = 'sheets n' + puzzles.length;
  sheets.innerHTML = sheetsHtml(false);
  $('solutions').hidden = !sheet.solutions;
  $('solution-sheets').innerHTML = sheet.solutions ? sheetsHtml(true) : '';
  const url = location.host + location.pathname + query(true);
  $('sheet-url').innerHTML = esc(T.sheet).replace('{url}', '<a href="' + esc(query(true)) + '">' + esc(url) + '</a>');
  $('with-solutions').checked = sheet.solutions;
  history.replaceState(null, '', location.pathname + query(sheet.solutions));
}

function refresh() {
  generate();
  render();
}

function fillSelects() {
  const level = $('level');
  for (let k = 0; k < LEVELS; k++) level.appendChild(new Option(levelName(k), k));
  const count = $('count');
  for (const n of COUNTS) count.appendChild(new Option(String(n), n));
  level.value = sheet.level;
  count.value = sheet.count;
  if (sheet.puzzle) for (const el of document.querySelectorAll('.gen')) el.hidden = true;
}

function bind() {
  $('level').addEventListener('change', e => { sheet.level = +e.target.value; refresh(); });
  $('count').addEventListener('change', e => { sheet.count = +e.target.value; refresh(); });
  $('with-solutions').addEventListener('change', e => { sheet.solutions = e.target.checked; render(); });
  $('refresh').addEventListener('click', () => { sheet.seed = randomSeed(); refresh(); });
  $('print').addEventListener('click', () => window.print());
}

function init() {
  readParams();
  fillSelects();
  bind();
  refresh();
}

init();
})();
