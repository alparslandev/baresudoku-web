(() => {
'use strict';
const S_UNDO = 4, S_NEW = 9, S_ERRORS = 10, S_ON = 11, S_OFF = 12, S_CANCEL = 13, S_SOLVED = 14, S_PREPARING = 15;
const S_WRONG = 16, S_NAKED = 17, S_ROW = 18, S_COL = 19, S_BOX = 20, S_AGAIN = 21, S_TECH = 22, S_TITLE = 28;
const S_LANGUAGE = 29, S_ANDROID = 30, S_SOURCE = 31, S_RESTART = 32, S_TECH_EXTRA = 33;
const S_MASTER = S_TECH_EXTRA + TECH_COUNT - 7;
const S_DAILY = S_MASTER + 1, S_SHARE = S_MASTER + 2, S_COPIED = S_MASTER + 3, S_PLAY = S_MASTER + 4;
const S_STATS = S_MASTER + 5, S_PLAYED = S_MASTER + 6, S_BEST = S_MASTER + 7, S_AVERAGE = S_MASTER + 8, S_STREAK = S_MASTER + 9;
const S_EXPLAIN = S_MASTER + 10, S_SHARE_PUZZLE = S_MASTER + 11;
const S_TIMER = S_MASTER + 12, S_SHORTCUTS = S_MASTER + 13, S_ENTER = S_MASTER + 14, S_MOVE = S_MASTER + 15, S_MENU = S_MASTER + 16;
const S_ARCHIVE = S_MASTER + 17, S_SOLVERS = S_MASTER + 18, S_FASTER = S_MASTER + 19, S_WEEKLY = S_MASTER + 20;
const SHORTCUTS = [['1-9', S_ENTER], ['\u2190 \u2191 \u2192 \u2193', S_MOVE], ['Backspace, 0', S_UNDO + 1], ['N', S_UNDO + 2], ['F', S_UNDO + 3], ['U, Ctrl+Z', S_UNDO], ['H', S_UNDO + 4], ['Esc', S_MENU], ['?', S_SHORTCUTS]];
const KEY = 'baresudoku';
const $ = id => document.getElementById(id);
const now = () => Date.now();
const engine = new Sudoku();
const game = new Game();
const cells = [], noteSpans = [], keyButtons = [], toolButtons = [];
const L = JSON.parse($('i18n').textContent);
const DAILY = L.mode === 'daily';
const DAILY_PATH = L.daily || '';
const SOLVER_PATH = L.solver || '';
const WEEKS = L.weekly || null;
const ARCHIVE_FIRST = '2025-01-01';
const QUERY = new URLSearchParams(location.search);
const WEEK = DAILY ? weekParam(QUERY.get('w')) : '';
const ARCHIVE_DATE = DAILY && !WEEK ? archiveParam(QUERY.get('d')) : '';
const STATE_KEY = WEEK ? KEY + '.weekly' : ARCHIVE_DATE ? KEY + '.archive' : DAILY ? KEY + '.daily' : KEY;
const LOG_KEY = KEY + '.dailyLog';
const ARCHIVE_LOG_KEY = KEY + '.archiveLog';
const WEEKLY_LOG_KEY = KEY + '.weeklyLog';
const STATS_KEY = KEY + '.stats';
const TIMER_KEY = KEY + '.timer';
let dailyDate = '';
let dialog = '';
let archiveMonth = '';
let weeklyPuzzle = null;
let compare = null;
let showTimer = fetchStored(TIMER_KEY) !== '0';
const LANGS = Array.from($('lang').options, o => o.value);
let strings = L.s, menuOpen = false, generating = false, timer = 0, downCell = -1;
let meta = { t: 0, d: false };
const IDLE_MS = 60000;
let lastActivity = Date.now(), idle = false;
const ratingFormat = numberFormat(document.documentElement.lang);
const countFormat = formatter(Intl.NumberFormat, document.documentElement.lang, {});
const dateFormat = dateFormatter(document.documentElement.lang);
const monthFormat = formatter(Intl.DateTimeFormat, document.documentElement.lang, { month: 'long', year: 'numeric' });
const weekdayFormat = formatter(Intl.DateTimeFormat, document.documentElement.lang, { weekday: 'short' });

function formatter(Kind, lang, options) {
  try { return new Kind(lang, options); } catch (e) { return new Kind('en', options); }
}

function dateFormatter(lang) {
  return formatter(Intl.DateTimeFormat, lang, { dateStyle: 'long' });
}

function dateKey(d) {
  const pad = n => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function parseDate(text) {
  return new Date(+text.slice(0, 4), +text.slice(5, 7) - 1, +text.slice(8, 10));
}

function localDate() {
  return dateKey(new Date());
}

function isoWeek(date) {
  const thursday = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() + 3 - (date.getDay() + 6) % 7));
  const week = Math.floor((thursday - Date.UTC(thursday.getUTCFullYear(), 0, 1)) / 864e5 / 7) + 1;
  return thursday.getUTCFullYear() + '-W' + (week < 10 ? '0' : '') + week;
}

function weekStart(id) {
  const year = +id.slice(0, 4);
  const jan4 = new Date(year, 0, 4);
  return new Date(year, 0, 4 - (jan4.getDay() + 6) % 7 + (+id.slice(6) - 1) * 7);
}

function weeklyAvailable() {
  const week = isoWeek(new Date());
  return !!WEEKS && week >= WEEKS.first && week <= WEEKS.last;
}

function weekParam(raw) {
  if (!raw || !/^\d{4}-W\d{2}$/.test(raw) || !WEEKS) return '';
  return raw >= WEEKS.first && raw <= WEEKS.last && raw <= isoWeek(new Date()) ? raw : '';
}

function archiveParam(raw) {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || dateKey(parseDate(raw)) !== raw) return '';
  return raw >= ARCHIVE_FIRST && raw < localDate() ? raw : '';
}

function weekText() {
  const monday = weekStart(WEEK);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return dateFormat.format(monday) + ' - ' + dateFormat.format(sunday);
}

function fill(text, values) {
  return String(text).replace(/\{([a-z]+)\}/g, (m, key) => (key in values ? String(values[key]) : m));
}

function dailySeed(date, level) {
  return ((+date.slice(0, 4) * 10000 + +date.slice(5, 7) * 100 + +date.slice(8, 10)) * 8 + level + 1) | 0;
}

function dateText() {
  return dateFormat.format(parseDate(dailyDate));
}

function numberFormat(lang) {
  const options = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  try { return new Intl.NumberFormat(lang, options); } catch (e) { return new Intl.NumberFormat('en', options); }
}

function levelName(level) {
  return strings[level < 4 ? level : S_MASTER];
}

function levelText() {
  const name = levelName(game.level);
  return game.rating > 0 ? name + ' ' + ratingFormat.format(game.rating / 10) : name;
}

function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function fetchStored(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
const today = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);

function beacon(ev) {
  try { return !navigator.webdriver && !!navigator.sendBeacon && navigator.sendBeacon('/api/e', JSON.stringify(ev)); } catch (e) { return false; }
}

function refHost(raw) {
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
    return host && host !== location.hostname.replace(/^www\./, '') && host.length <= 60 ? host : '';
  } catch (e) { return ''; }
}

function openEvent(lang) {
  let ref = '';
  try { ref = sessionStorage.getItem(KEY + '.ref') || ''; sessionStorage.removeItem(KEY + '.ref'); } catch (e) {}
  const ev = { e: 'open', l: lang, d: matchMedia('(pointer: coarse)').matches ? 'm' : 'd' };
  const r = refHost(ref || document.referrer);
  if (r) ev.r = r;
  const day = today();
  if (fetchStored(KEY + '.day') !== day) ev.v = 1;
  if (beacon(ev) && ev.v) store(KEY + '.day', day);
}

function matchLang(tag) {
  tag = String(tag || '').replace('_', '-');
  if (LANGS.includes(tag)) return tag;
  const lower = tag.toLowerCase();
  for (const code of LANGS) if (lower === code.toLowerCase() || lower.startsWith(code.toLowerCase() + '-')) return code;
  let base = lower.split('-')[0];
  if (base === 'zh') return /tw|hk|mo|hant/.test(lower) ? 'zh-Hant' : 'zh-Hans';
  if (base === 'no' || base === 'nn') base = 'nb';
  if (base === 'iw') base = 'he';
  if (base === 'in') base = 'id';
  if (base === 'fil') base = 'tl';
  for (const code of LANGS) if (code.split('-')[0].toLowerCase() === base) return code;
  return null;
}

function pickLang() {
  const saved = fetchStored(KEY + '.lang');
  if (saved && LANGS.includes(saved)) return saved;
  for (const tag of navigator.languages || [navigator.language]) {
    const code = matchLang(tag);
    if (code) return code;
  }
  return 'en';
}

function pathOf(code) {
  return code === 'en' ? '/' : '/' + code.toLowerCase() + '/';
}

function applyLang(code) {
  $('lang').value = code;
  renderLabels();
}

function switchLang(code) {
  store(KEY + '.lang', code);
  location.href = pathOf(code);
}

function renderLabels() {
  toolButtons.forEach((b, i) => { b.querySelector('span').textContent = strings[S_UNDO + i]; });
  document.querySelectorAll('#panel [data-level]').forEach(b => {
    const name = levelName(+b.dataset.level);
    b.hidden = name === undefined || (!!WEEK && +b.dataset.level !== 4);
    b.textContent = name || '';
  });
  $('cancel-btn').textContent = strings[S_CANCEL];
  $('restart-btn').textContent = strings[S_RESTART];
  $('lang-label').textContent = strings[S_LANGUAGE];
  $('android').textContent = strings[S_ANDROID];
  $('source').textContent = strings[S_SOURCE];
  $('menu-btn').setAttribute('aria-label', strings[S_NEW]);
  const daily = $('daily-btn');
  daily.textContent = strings[S_DAILY];
  daily.href = DAILY_PATH;
  daily.hidden = !DAILY_PATH || (DAILY && !ARCHIVE_DATE && !WEEK);
  const play = $('play-btn');
  play.textContent = strings[S_PLAY];
  play.href = pathOf($('lang').value);
  play.hidden = !DAILY;
  $('share-btn').textContent = strings[S_SHARE];
  $('share-puzzle-btn').textContent = strings[S_SHARE_PUZZLE];
  $('stats-btn').textContent = strings[S_STATS];
  $('archive-btn').textContent = strings[S_ARCHIVE];
  $('archive-btn').hidden = !DAILY;
  const weekly = $('weekly-btn');
  weekly.textContent = strings[S_WEEKLY];
  weekly.href = DAILY_PATH + '?w=' + isoWeek(new Date());
  weekly.hidden = !DAILY || !!WEEK || !weeklyAvailable();
  $('keys-btn').textContent = strings[S_SHORTCUTS];
  $('keys-btn').hidden = matchMedia('(pointer: coarse)').matches;
}

function buildBoard() {
  const board = $('board');
  let row = null;
  for (let i = 0; i < 81; i++) {
    if (i % 9 === 0) {
      row = document.createElement('div');
      row.className = 'row';
      row.setAttribute('role', 'row');
      board.appendChild(row);
    }
    const cell = document.createElement('div');
    cell.dataset.i = i;
    cell.setAttribute('role', 'gridcell');
    cell.tabIndex = -1;
    const v = document.createElement('span');
    v.className = 'v';
    const n = document.createElement('div');
    n.className = 'n';
    const spans = [];
    for (let d = 1; d <= 9; d++) {
      const s = document.createElement('span');
      n.appendChild(s);
      spans.push(s);
    }
    cell.append(v, n);
    row.appendChild(cell);
    cells.push(cell);
    noteSpans.push(spans);
  }
  const keys = $('keys');
  for (let d = 1; d <= 9; d++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.digit = d;
    b.innerHTML = d + '<small></small>';
    b.setAttribute('aria-label', d);
    keys.appendChild(b);
    keyButtons.push(b);
  }
  document.querySelectorAll('#tools button').forEach(b => toolButtons.push(b));
}

function clock(ms) {
  let s = Math.floor(ms / 1000);
  let m = Math.floor(s / 60);
  s %= 60;
  const h = Math.floor(m / 60);
  m %= 60;
  return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

function noteList(notes) {
  const list = [];
  for (let d = 1; d <= 9; d++) if (notes & bit(d)) list.push(d);
  return list.join(' ');
}

function focusCell() {
  const i = game.selected >= 0 ? game.selected : 40;
  cells[i].focus({ preventScroll: true });
}

function focusPanel() {
  const first = $('panel').querySelector('button:not([hidden])');
  if (first) first.focus();
}

function hintMessage() {
  if (game.hintKind === HINT_WRONG) return strings[S_WRONG];
  const u = game.hintUnit;
  let s = strings[u === 0 ? S_ROW : u === 1 ? S_COL : u === 2 ? S_BOX : S_NAKED].replace('#', game.hintDigit);
  const t = game.hintTech;
  if (t > 0) s += ' (' + strings[t < 7 ? S_TECH + t - 1 : S_TECH_EXTRA + t - 7] + ')';
  return s;
}

function pausedGame() {
  return game.active && !game.solved && !game.running;
}

function renderTime() {
  $('time').textContent = game.active && !generating && showTimer ? clock(game.time(now())) : '';
  $('time').classList.toggle('paused', pausedGame() && !menuOpen && !generating);
}

function tick() {
  if (game.running && now() - lastActivity >= IDLE_MS) {
    idle = true;
    game.pause(now());
    stopTimer();
    save();
  }
  renderTime();
}

function activity() {
  lastActivity = now();
  if (!idle && (!pausedGame() || menuOpen || generating)) return;
  idle = false;
  resumeIfAllowed();
}

function resumeIfAllowed() {
  if (pausedGame() && !menuOpen && !generating && !idle && !document.hidden && document.hasFocus()) {
    game.resume(now());
    startTimer();
  }
  renderTime();
}

function render() {
  $('level').textContent = generating ? levelName(pendingLevel) : game.active ? levelText() : '';
  renderTime();
  const sel = game.selected;
  const selValue = (sel >= 0 && game.active ? game.value[sel] : 0) || game.sticky;
  const selBit = selValue ? bit(selValue) : 0;
  const hintOn = game.active && game.hintActive();
  for (let i = 0; i < 81; i++) {
    const cell = cells[i];
    const v = game.active && !generating ? game.value[i] : 0;
    const notes = game.active && !generating ? game.notes[i] : 0;
    let cls = 'c c' + COL[i] + ' r' + ROW[i];
    if (game.active && !generating) {
      if (i === sel) cls += ' sel';
      else if (selValue && (v === selValue || (!v && (notes & selBit)))) cls += ' same';
      else if (sel >= 0 && (ROW[i] === ROW[sel] || COL[i] === COL[sel] || BOX[i] === BOX[sel])) cls += ' unit';
      if (game.given[i]) cls += ' given';
      if (v && (game.conflict(i) || game.wrong(i))) cls += ' wrong';
    }
    cell.className = cls;
    cell.setAttribute('aria-selected', i === sel ? 'true' : 'false');
    cell.tabIndex = i === (sel >= 0 ? sel : 40) ? 0 : -1;
    if (v && cls.includes(' wrong')) cell.setAttribute('aria-label', v + ', ' + strings[S_WRONG]);
    else if (!v && notes) cell.setAttribute('aria-label', strings[S_UNDO + 2] + ' ' + noteList(notes));
    else cell.removeAttribute('aria-label');
    cell.firstChild.textContent = v ? v : '';
    const spans = noteSpans[i];
    for (let d = 1; d <= 9; d++) {
      const on = !v && (notes & bit(d));
      spans[d - 1].textContent = on ? d : '';
      spans[d - 1].className = on && d === selValue ? 'same' : '';
    }
  }
  const msg = $('msg');
  msg.className = '';
  if (generating) msg.textContent = strings[S_PREPARING];
  else if (hintOn) {
    if (game.hintKind === HINT_WRONG) {
      msg.className = 'bad';
      msg.textContent = hintMessage();
    } else {
      msg.textContent = '';
      msg.append(hintMessage());
      if (SOLVER_PATH) {
        const a = document.createElement('a');
        a.href = SOLVER_PATH + '?p=' + game.value.join('');
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = strings[S_EXPLAIN];
        msg.appendChild(a);
      }
      msg.appendChild(document.createElement('br'));
      const small = document.createElement('small');
      small.textContent = strings[S_AGAIN];
      msg.appendChild(small);
    }
  } else msg.textContent = '';
  const playable = game.active && !game.solved && !generating;
  toolButtons.forEach((b, i) => {
    b.disabled = !playable || (i === 0 && !game.history.length);
    b.classList.toggle('on', playable && ((i === 2 && game.noteMode) || (i === 4 && hintOn && game.hintKind === HINT_PLACE)));
    if (i === 2) b.setAttribute('aria-pressed', playable && game.noteMode ? 'true' : 'false');
  });
  keyButtons.forEach((b, i) => {
    const left = game.active && !generating ? Math.max(0, game.remaining(i + 1)) : 9;
    b.disabled = !playable || left === 0;
    b.classList.toggle('on', i + 1 === game.sticky);
    b.setAttribute('aria-pressed', i + 1 === game.sticky ? 'true' : 'false');
    b.lastChild.textContent = left > 0 ? left : '';
  });
  const overlay = menuOpen || (game.active && game.solved);
  $('overlay').hidden = !overlay;
  $('panel').hidden = !!dialog;
  $('stats').hidden = dialog !== 'stats';
  $('keys-help').hidden = dialog !== 'keys';
  $('archive').hidden = dialog !== 'archive';
  if (overlay) {
    const solved = game.active && game.solved;
    $('panel-title').textContent = solved ? strings[S_SOLVED] : WEEK ? strings[S_WEEKLY] : DAILY ? strings[S_DAILY] : strings[S_TITLE];
    const lines = [];
    if (solved) lines.push(levelText() + '  ' + clock(game.time(now())));
    if (WEEK) lines.push(weekText());
    else if (DAILY) lines.push(dateText());
    if (solved) lines.push(...compareLines());
    if (!solved || !DAILY) lines.push(strings[S_NEW]);
    $('panel-sub').textContent = lines.join('\n');
    $('share-btn').hidden = !solved;
    $('errors-btn').textContent = strings[S_ERRORS] + ': ' + strings[game.showErrors ? S_ON : S_OFF];
    $('timer-btn').textContent = strings[S_TIMER] + ': ' + strings[showTimer ? S_ON : S_OFF];
    if (WEEK) $('panel').querySelector('[data-level="4"]').disabled = !weeklyPuzzle;
    $('cancel-btn').hidden = !cancellable();
    $('restart-btn').hidden = !game.active;
    $('share-puzzle-btn').hidden = !game.active || DAILY || solved;
  }
}

let pendingLevel = 0;

function save() {
  store(STATE_KEY, JSON.stringify(Object.assign(game.save(now()), { a: meta, d: dailyDate, w: WEEK })));
}

function readJson(key) {
  try { return JSON.parse(fetchStored(key)); } catch (e) { return null; }
}

function loadStats() {
  const stats = readJson(STATS_KEY);
  const levels = stats && Array.isArray(stats.levels) ? stats.levels : [];
  while (levels.length < LEVELS) levels.push({ p: 0, s: 0, t: 0, b: 0 });
  return { levels: levels.map(l => ({ p: l.p | 0, s: l.s | 0, t: l.t | 0, b: l.b | 0 })) };
}

function recordStart(level) {
  const stats = loadStats();
  stats.levels[level].p++;
  store(STATS_KEY, JSON.stringify(stats));
}

function recordSolved(level, seconds) {
  const stats = loadStats();
  const l = stats.levels[level];
  l.s++;
  l.t += seconds;
  if (!l.b || seconds < l.b) l.b = seconds;
  store(STATS_KEY, JSON.stringify(stats));
}

function dayShift(date, days) {
  const d = parseDate(date);
  return dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

function readLog(key) {
  const log = readJson(key);
  return log && typeof log === 'object' && !Array.isArray(log) ? log : {};
}

function dailyStreak() {
  const log = readLog(LOG_KEY);
  let day = localDate();
  if (!log[day]) day = dayShift(day, -1);
  let n = 0;
  while (log[day]) {
    n++;
    day = dayShift(day, -1);
  }
  return n;
}

function renderStats() {
  $('stats-title').textContent = strings[S_STATS];
  $('stats-solved').textContent = strings[S_PLAYED];
  $('stats-best').textContent = strings[S_BEST];
  $('stats-average').textContent = strings[S_AVERAGE];
  $('stats-back').textContent = strings[S_CANCEL];
  const body = $('stats-table').querySelector('tbody');
  body.textContent = '';
  const stats = loadStats();
  for (let level = 0; level < LEVELS; level++) {
    const l = stats.levels[level];
    const name = levelName(level);
    if (name === undefined || (!l.p && !l.s)) continue;
    const tr = document.createElement('tr');
    for (const text of [name, l.s + ' / ' + l.p, l.b ? clock(l.b * 1000) : '-', l.s ? clock(Math.round(l.t / l.s) * 1000) : '-']) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
  $('streak').textContent = strings[S_STREAK] + ': ' + dailyStreak();
}

function renderKeys() {
  $('keys-title').textContent = strings[S_SHORTCUTS];
  $('keys-back').textContent = strings[S_CANCEL];
  const body = $('keys-table').querySelector('tbody');
  body.textContent = '';
  for (const [keys, label] of SHORTCUTS) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    keys.split(', ').forEach((part, k) => {
      if (k) th.append(' ');
      const kbd = document.createElement('kbd');
      kbd.textContent = part;
      th.appendChild(kbd);
    });
    const td = document.createElement('td');
    td.textContent = strings[label];
    tr.append(th, td);
    body.appendChild(tr);
  }
}

function firstWeekday() {
  try {
    const locale = new Intl.Locale(document.documentElement.lang);
    const info = locale.getWeekInfo ? locale.getWeekInfo() : locale.weekInfo;
    if (info && info.firstDay) return info.firstDay % 7;
  } catch (e) {}
  return 1;
}

function solvedLevels(date, daily, later) {
  const levels = [];
  const onDay = daily[date] || {}, afterwards = later[date] || {};
  for (let level = 0; level < LEVELS; level++) {
    const seconds = level in onDay ? onDay[level] : afterwards[level];
    if (Number.isFinite(seconds) && levelName(level) !== undefined) levels.push(levelName(level) + ' ' + clock(seconds * 1000));
  }
  return levels;
}

function renderArchive() {
  $('archive-title').textContent = strings[S_ARCHIVE];
  $('archive-back').textContent = strings[S_CANCEL];
  const year = +archiveMonth.slice(0, 4), month = +archiveMonth.slice(5, 7) - 1;
  const first = new Date(year, month, 1);
  const today = localDate();
  $('month-name').textContent = monthFormat.format(first);
  const prev = $('month-prev'), next = $('month-next');
  prev.disabled = archiveMonth <= ARCHIVE_FIRST.slice(0, 7);
  next.disabled = archiveMonth >= today.slice(0, 7);
  prev.setAttribute('aria-label', monthFormat.format(new Date(year, month - 1, 1)));
  next.setAttribute('aria-label', monthFormat.format(new Date(year, month + 1, 1)));
  const grid = $('calendar');
  grid.textContent = '';
  const start = firstWeekday();
  for (let k = 0; k < 7; k++) {
    const head = document.createElement('span');
    head.className = 'wd';
    head.textContent = weekdayFormat.format(new Date(2024, 0, 7 + (start + k) % 7));
    grid.appendChild(head);
  }
  for (let k = (first.getDay() - start + 7) % 7; k > 0; k--) grid.appendChild(document.createElement('span'));
  const daily = readLog(LOG_KEY), later = readLog(ARCHIVE_LOG_KEY);
  const current = WEEK ? '' : dailyDate;
  const days = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= days; day++) {
    const date = dateKey(new Date(year, month, day));
    const open = date >= ARCHIVE_FIRST && date <= today;
    const solved = solvedLevels(date, daily, later);
    const el = document.createElement(open ? 'a' : 'span');
    el.className = 'day' + (solved.length ? ' done' : '') + (date === today ? ' today' : '') + (date === current ? ' cur' : '') + (open ? '' : ' off');
    el.textContent = day;
    if (open) {
      el.href = DAILY_PATH + (date === today ? '' : '?d=' + date);
      el.setAttribute('aria-label', dateFormat.format(parseDate(date)) + (solved.length ? ': ' + solved.join(', ') : ''));
      if (solved.length) el.title = solved.join(', ');
      if (date === current) el.setAttribute('aria-current', 'date');
    }
    if (solved.length) {
      const dots = document.createElement('small');
      dots.textContent = '\u2022'.repeat(solved.length);
      el.appendChild(dots);
    }
    grid.appendChild(el);
  }
}

function shiftMonth(delta) {
  const d = new Date(+archiveMonth.slice(0, 4), +archiveMonth.slice(5, 7) - 1 + delta, 1);
  archiveMonth = dateKey(d).slice(0, 7);
  renderArchive();
}

function openDialog(name) {
  dialog = name;
  if (name === 'stats') renderStats();
  else if (name === 'keys') renderKeys();
  else {
    archiveMonth = (dailyDate || localDate()).slice(0, 7);
    renderArchive();
  }
  render();
  $(name === 'stats' ? 'stats-back' : name === 'keys' ? 'keys-back' : 'archive-back').focus();
}

function closeDialog() {
  dialog = '';
  render();
  focusPanel();
}

function logResult(seconds) {
  const key = WEEK ? WEEKLY_LOG_KEY : ARCHIVE_DATE ? ARCHIVE_LOG_KEY : LOG_KEY;
  const log = readLog(key);
  if (WEEK) {
    if (!(WEEK in log)) log[WEEK] = seconds;
  } else {
    const day = log[dailyDate] || (log[dailyDate] = {});
    if (!(game.level in day)) day[game.level] = seconds;
  }
  const keys = Object.keys(log).sort();
  while (keys.length > 800) delete log[keys.shift()];
  store(key, JSON.stringify(log));
}

function puzzleId() {
  return WEEK ? 'w' + WEEK : DAILY ? 'd' + dailyDate : '';
}

function timeBucket(s) {
  return s < 600 ? s - s % 15 : s < 3600 ? s - s % 60 : s - s % 300;
}

function compareLines() {
  if (!compare || compare.id !== puzzleId() || compare.level !== game.level) return [];
  const lines = [fill(strings[S_SOLVERS], { n: countFormat.format(compare.n) }), strings[S_AVERAGE] + ': ' + clock(compare.avg * 1000)];
  if (compare.p >= 0) lines.push(fill(strings[S_FASTER], { p: countFormat.format(compare.p) }));
  return lines;
}

function fetchCompare(delay) {
  const id = puzzleId();
  if (!id || !game.active || !game.solved || typeof fetch !== 'function') return;
  const level = game.level;
  const mine = Math.floor(game.time(now()) / 1000);
  setTimeout(() => {
    fetch('/api/p?id=' + id).then(r => (r.ok ? r.json() : null)).then(data => {
      const l = data && data.levels && data.levels[(WEEK ? 'w' : 'd') + level];
      if (!l || !(l.n > 0)) return;
      const bucket = timeBucket(mine);
      let slower = 0, same = 0;
      for (const [b, n] of Object.entries(l.h || {})) {
        if (+b > bucket) slower += n;
        else if (+b === bucket) same += n;
      }
      const others = l.n - 1;
      const p = others > 0 ? Math.min(100, Math.round(100 * (slower + Math.max(0, same - 1) / 2) / others)) : -1;
      compare = { id, level, n: l.n, avg: Math.round(l.s / l.n), p };
      render();
    }).catch(() => {});
  }, delay);
}

function loadWeekly() {
  return fetch('/weekly.json').then(r => (r.ok ? r.json() : null)).then(data => {
    const text = data && data[WEEK];
    if (typeof text !== 'string' || !/^[0-9]{81}$/.test(text)) return null;
    weeklyPuzzle = Array.from(text, Number);
    return weeklyPuzzle;
  }).catch(() => null);
}

function puzzleLink() {
  return location.origin + pathOf($('lang').value) + '?p=' + game.given.join('');
}

function copyOrShare(text, btn) {
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
    return;
  }
  const label = btn.textContent;
  const done = () => {
    btn.textContent = strings[S_COPIED];
    setTimeout(() => { btn.textContent = label; }, 2000);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => {});
}

function sharePuzzle() {
  if (!game.active) return;
  copyOrShare(puzzleLink(), $('share-puzzle-btn'));
}

function levelOf(values) {
  const clues = values.filter(v => v).length;
  const r = engine.rate(values);
  if (r < 0) return -1;
  const order = engine.rateOrder;
  return r >= MASTER_RATING ? 4 : order >= 3 ? 3 : order >= 1 ? 2 : clues >= 38 ? 0 : 1;
}

function sharedPuzzle() {
  const param = new URLSearchParams(location.search).get('p');
  if (!param) return null;
  const chars = param.replace(/[^0-9.]/g, '');
  if (chars.length !== 81) return null;
  const values = Array.from(chars, ch => ch === '.' ? 0 : +ch);
  for (let c = 0; c < 81; c++) if (values[c]) for (const p of PEERS[c]) if (values[p] === values[c]) return null;
  if (engine.countSolutions(values, 2) !== 1) return null;
  const level = levelOf(values);
  if (level < 0) return null;
  return { values, solution: Array.from(engine.found), level, rating: engine.rate(values) };
}

function startShared(shared) {
  game.start(shared.values, shared.solution, shared.level);
  game.rating = shared.rating;
  meta = { t: now(), d: false };
  beacon({ e: 'start', k: shared.level });
  recordStart(shared.level);
  save();
}

function shareText() {
  const result = levelText() + ' · ' + clock(game.time(now()));
  if (WEEK) return strings[S_WEEKLY] + ' ' + weekText() + ' · ' + result + '\n' + location.origin + DAILY_PATH + '?w=' + WEEK;
  if (DAILY) return strings[S_DAILY] + ' ' + dateText() + ' · ' + result + '\n' + location.origin + DAILY_PATH + (ARCHIVE_DATE ? '?d=' + dailyDate : '');
  return strings[S_TITLE] + ' · ' + result + '\n' + puzzleLink();
}

function share() {
  copyOrShare(shareText(), $('share-btn'));
}

function startTimer() {
  stopTimer();
  if (game.running) timer = setInterval(tick, 1000);
}

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = 0;
}

function cancellable() {
  return game.active && !game.solved;
}

function openMenu() {
  if (generating) return;
  menuOpen = true;
  game.pause(now());
  stopTimer();
  render();
  focusPanel();
}

function closeMenu() {
  if (dialog) {
    closeDialog();
    return;
  }
  if (!cancellable()) return;
  menuOpen = false;
  game.resume(now());
  startTimer();
  render();
  focusCell();
}

function startGame(level) {
  if (generating || (WEEK && !weeklyPuzzle)) return;
  menuOpen = false;
  generating = true;
  pendingLevel = level;
  game.pause(now());
  stopTimer();
  render();
  setTimeout(() => {
    if (WEEK) {
      const puzzle = weeklyPuzzle.slice();
      engine.countSolutions(puzzle, 2);
      game.start(puzzle, Array.from(engine.found), 4);
      game.rating = engine.rate(puzzle);
    } else {
      if (DAILY) {
        if (!ARCHIVE_DATE) dailyDate = localDate();
        engine.seed(dailySeed(dailyDate, level));
      }
      const puzzle = engine.generate(level);
      game.start(puzzle, engine.solution, level);
      game.rating = engine.rating;
    }
    meta = { t: now(), d: false };
    beacon({ e: 'start', k: level });
    recordStart(level);
    generating = false;
    game.resume(now());
    save();
    render();
    startTimer();
    focusCell();
  }, 30);
}

function restartGame() {
  if (generating || !game.active) return;
  menuOpen = false;
  if (game.solved) {
    meta = { t: now(), d: false };
    beacon({ e: 'start', k: game.level });
    recordStart(game.level);
  }
  game.restart();
  game.resume(now());
  save();
  render();
  startTimer();
  focusCell();
}

function act(kind, d) {
  if (!game.active || generating || menuOpen) return;
  let changed = false;
  if (kind === 'digit') changed = game.key(d);
  else if (kind === 'undo') changed = game.undo();
  else if (kind === 'erase') changed = game.erase();
  else if (kind === 'notes') { game.noteMode = !game.noteMode; changed = true; }
  else if (kind === 'fill') changed = game.fillNotes();
  else if (kind === 'hint') changed = game.hint(engine);
  finish(changed);
}

function finish(changed) {
  if (game.solved) {
    game.pause(now());
    stopTimer();
    if (!meta.d) {
      meta.d = true;
      const seconds = Math.floor(game.time(now()) / 1000);
      const ev = { e: 'done', k: game.level, t: meta.t, s: seconds };
      if (DAILY) ev.p = puzzleId();
      beacon(ev);
      recordSolved(game.level, seconds);
      if (DAILY) {
        logResult(seconds);
        fetchCompare(1500);
      }
      changed = true;
    }
  }
  if (changed) save();
  render();
}

function tapCell(i) {
  if (!game.active || generating || menuOpen || game.solved) return;
  finish(game.tap(i));
  focusCell();
}

function selectCell(i) {
  if (!game.active || generating || menuOpen || game.solved || i === game.selected) return;
  game.select(i);
  render();
}

function cellAt(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const cell = el && el.closest('[data-i]');
  return cell ? +cell.dataset.i : -1;
}

function move(key) {
  let i = game.selected < 0 ? 0 : game.selected;
  if (key === 'ArrowLeft') i = ROW[i] * 9 + (COL[i] + 8) % 9;
  else if (key === 'ArrowRight') i = ROW[i] * 9 + (COL[i] + 1) % 9;
  else if (key === 'ArrowUp') i = ((ROW[i] + 8) % 9) * 9 + COL[i];
  else i = ((ROW[i] + 1) % 9) * 9 + COL[i];
  selectCell(i);
  focusCell();
}

function bind() {
  const board = $('board');
  board.addEventListener('pointerdown', e => {
    if (e.button) return;
    const i = cellAt(e);
    if (i < 0) return;
    downCell = i;
    tapCell(i);
    e.preventDefault();
  });
  board.addEventListener('pointermove', e => {
    if (downCell < 0) return;
    const i = cellAt(e);
    if (i >= 0 && i !== downCell) {
      downCell = -1;
      selectCell(i);
    }
  });
  const stopDrag = () => { downCell = -1; };
  window.addEventListener('pointerup', stopDrag);
  window.addEventListener('pointercancel', stopDrag);
  $('keys').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) act('digit', +b.dataset.digit);
  });
  $('tools').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) act(b.dataset.act);
  });
  $('menu-btn').addEventListener('click', openMenu);
  $('overlay').addEventListener('click', e => { if (e.target === $('overlay')) closeMenu(); });
  document.querySelectorAll('#panel [data-level]').forEach(b => b.addEventListener('click', () => startGame(+b.dataset.level)));
  $('errors-btn').addEventListener('click', () => { game.showErrors = !game.showErrors; save(); render(); });
  $('timer-btn').addEventListener('click', () => {
    showTimer = !showTimer;
    store(TIMER_KEY, showTimer ? '1' : '0');
    render();
  });
  $('archive-btn').addEventListener('click', () => openDialog('archive'));
  $('keys-btn').addEventListener('click', () => openDialog('keys'));
  $('keys-back').addEventListener('click', closeDialog);
  $('archive-back').addEventListener('click', closeDialog);
  $('month-prev').addEventListener('click', () => shiftMonth(-1));
  $('month-next').addEventListener('click', () => shiftMonth(1));
  $('cancel-btn').addEventListener('click', closeMenu);
  $('restart-btn').addEventListener('click', restartGame);
  $('share-btn').addEventListener('click', share);
  $('share-puzzle-btn').addEventListener('click', sharePuzzle);
  $('stats-btn').addEventListener('click', () => openDialog('stats'));
  $('stats-back').addEventListener('click', closeDialog);
  $('lang').addEventListener('change', e => switchLang(e.target.value));
  document.addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'SELECT') return;
    const k = e.key;
    if (e.metaKey || e.ctrlKey) {
      if (k === 'z' || k === 'Z') { act('undo'); e.preventDefault(); }
      return;
    }
    if (menuOpen || (game.active && game.solved) || generating) {
      if (k === 'Escape') closeMenu();
      else if (k === '?' && !dialog && !generating) openDialog('keys');
      return;
    }
    if (k >= '1' && k <= '9') act('digit', +k);
    else if (k === 'Backspace' || k === 'Delete' || k === '0') act('erase');
    else if (k.startsWith('Arrow')) move(k);
    else if (k === 'n' || k === 'N') act('notes');
    else if (k === 'u' || k === 'U') act('undo');
    else if (k === 'h' || k === 'H') act('hint');
    else if (k === 'f' || k === 'F') act('fill');
    else if (k === 'Escape') {
      if (game.sticky) act('digit', game.sticky);
      else openMenu();
    }
    else if (k === '?') {
      openMenu();
      openDialog('keys');
    }
    else if (k === 'Enter' || k === ' ') {
      const cell = document.activeElement && document.activeElement.closest('[data-i]');
      if (!cell) return;
      tapCell(+cell.dataset.i);
    }
    else return;
    e.preventDefault();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      game.pause(now());
      stopTimer();
      save();
    } else resumeIfAllowed();
  });
  window.addEventListener('blur', () => {
    game.pause(now());
    stopTimer();
    save();
    renderTime();
  });
  window.addEventListener('focus', resumeIfAllowed);
  for (const type of ['pointerdown', 'pointermove', 'keydown', 'wheel']) document.addEventListener(type, activity, { passive: true });
  window.addEventListener('pagehide', save);
}

function registerWorker() {
  if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return;
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled) location.reload();
    controlled = true;
  });
  navigator.serviceWorker.register('/sw.js');
}

function init() {
  const pageLang = document.documentElement.lang;
  if (location.pathname === '/') {
    const target = pickLang();
    if (target !== 'en' && LANGS.includes(target)) {
      try { if (document.referrer) sessionStorage.setItem(KEY + '.ref', document.referrer); } catch (e) {}
      location.replace(pathOf(target) + location.search);
      return;
    }
  }
  buildBoard();
  bind();
  const lang = LANGS.includes(pageLang) ? pageLang : 'en';
  applyLang(lang);
  let saved = null;
  try { saved = JSON.parse(fetchStored(STATE_KEY)); } catch (e) {}
  if (WEEK) {
    if (saved && saved.w !== WEEK) saved = null;
  } else if (DAILY) {
    dailyDate = ARCHIVE_DATE || localDate();
    if (saved && saved.d !== dailyDate) saved = null;
  }
  game.load(saved);
  const shared = DAILY ? null : sharedPuzzle();
  if (shared) {
    startShared(shared);
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
  }
  if (game.active) game.rating = engine.rate(game.given);
  meta = saved && saved.a ? { t: +saved.a.t || now(), d: !!saved.a.d } : { t: now(), d: game.solved };
  menuOpen = !game.active;
  if (game.active && !game.solved && !document.hidden && document.hasFocus()) game.resume(now());
  render();
  startTimer();
  if (DAILY && game.active && game.solved) fetchCompare(0);
  if (WEEK) loadWeekly().then(puzzle => {
    if (!puzzle) location.replace(DAILY_PATH);
    else render();
  });
  registerWorker();
  openEvent(lang);
}

init();
})();
