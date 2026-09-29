(() => {
'use strict';
const S_UNDO = 4, S_NEW = 9, S_ERRORS = 10, S_ON = 11, S_OFF = 12, S_CANCEL = 13, S_SOLVED = 14, S_PREPARING = 15;
const S_WRONG = 16, S_NAKED = 17, S_ROW = 18, S_COL = 19, S_BOX = 20, S_AGAIN = 21, S_TECH = 22, S_TITLE = 28;
const S_LANGUAGE = 29, S_ANDROID = 30, S_SOURCE = 31;
const KEY = 'baresudoku';
const $ = id => document.getElementById(id);
const now = () => Date.now();
const engine = new Sudoku();
const game = new Game();
const cells = [], noteSpans = [], keyButtons = [], toolButtons = [];
let strings = I18N.en.s, menuOpen = false, generating = false, timer = 0, downCell = -1;

function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function fetchStored(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

function matchLang(tag) {
  tag = String(tag || '').replace('_', '-');
  if (I18N[tag]) return tag;
  const lower = tag.toLowerCase();
  for (const code in I18N) if (lower.startsWith(code.toLowerCase() + '-')) return code;
  let base = lower.split('-')[0];
  if (base === 'zh') return /tw|hk|mo|hant/.test(lower) ? 'zh-Hant' : 'zh-Hans';
  if (base === 'no' || base === 'nn') base = 'nb';
  if (base === 'iw') base = 'he';
  if (base === 'in') base = 'id';
  for (const code in I18N) if (code.split('-')[0] === base) return code;
  return null;
}

function pickLang() {
  const saved = fetchStored(KEY + '.lang');
  if (saved && I18N[saved]) return saved;
  for (const tag of navigator.languages || [navigator.language]) {
    const code = matchLang(tag);
    if (code) return code;
  }
  return 'en';
}

function applyLang(code, remember) {
  const L = I18N[code];
  strings = L.s;
  document.documentElement.lang = code;
  document.documentElement.dir = L.rtl ? 'rtl' : 'ltr';
  $('lang').value = code;
  if (remember) store(KEY + '.lang', code);
  renderLabels();
}

function renderLabels() {
  toolButtons.forEach((b, i) => { b.querySelector('span').textContent = strings[S_UNDO + i]; });
  document.querySelectorAll('#panel [data-level]').forEach(b => { b.textContent = strings[+b.dataset.level]; });
  $('cancel-btn').textContent = strings[S_CANCEL];
  $('lang-label').textContent = strings[S_LANGUAGE];
  $('android').textContent = strings[S_ANDROID];
  $('source').textContent = strings[S_SOURCE];
  $('menu-btn').setAttribute('aria-label', strings[S_NEW]);
}

function buildBoard() {
  const board = $('board');
  for (let i = 0; i < 81; i++) {
    const cell = document.createElement('div');
    cell.dataset.i = i;
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
    board.appendChild(cell);
    cells.push(cell);
    noteSpans.push(spans);
  }
  const keys = $('keys');
  for (let d = 1; d <= 9; d++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.digit = d;
    b.innerHTML = d + '<small></small>';
    keys.appendChild(b);
    keyButtons.push(b);
  }
  document.querySelectorAll('#tools button').forEach(b => toolButtons.push(b));
  const select = $('lang');
  for (const code in I18N) {
    const o = document.createElement('option');
    o.value = code;
    o.textContent = I18N[code].name;
    select.appendChild(o);
  }
}

function clock(ms) {
  let s = Math.floor(ms / 1000);
  let m = Math.floor(s / 60);
  s %= 60;
  const h = Math.floor(m / 60);
  m %= 60;
  return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

function hintMessage() {
  if (game.hintKind === HINT_WRONG) return strings[S_WRONG];
  const u = game.hintUnit;
  let s = strings[u === 0 ? S_ROW : u === 1 ? S_COL : u === 2 ? S_BOX : S_NAKED].replace('#', game.hintDigit);
  if (game.hintTech > 0) s += ' (' + strings[S_TECH + game.hintTech - 1] + ')';
  return s;
}

function renderTime() {
  $('time').textContent = game.active && !generating ? clock(game.time(now())) : '';
}

function render() {
  $('level').textContent = generating ? strings[pendingLevel] : game.active ? strings[game.level] : '';
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
      msg.append(hintMessage(), document.createElement('br'));
      const small = document.createElement('small');
      small.textContent = strings[S_AGAIN];
      msg.appendChild(small);
    }
  } else msg.textContent = '';
  const playable = game.active && !game.solved && !generating;
  toolButtons.forEach((b, i) => {
    b.disabled = !playable || (i === 0 && !game.history.length);
    b.classList.toggle('on', playable && ((i === 2 && game.noteMode) || (i === 4 && hintOn && game.hintKind === HINT_PLACE)));
  });
  keyButtons.forEach((b, i) => {
    const left = game.active && !generating ? Math.max(0, game.remaining(i + 1)) : 9;
    b.disabled = !playable || left === 0;
    b.classList.toggle('on', i + 1 === game.sticky);
    b.lastChild.textContent = left > 0 ? left : '';
  });
  const overlay = menuOpen || (game.active && game.solved);
  $('overlay').hidden = !overlay;
  if (overlay) {
    const solved = game.active && game.solved;
    $('panel-title').textContent = solved ? strings[S_SOLVED] : strings[S_TITLE];
    $('panel-sub').textContent = solved ? strings[game.level] + '  ' + clock(game.time(now())) + '\n' + strings[S_NEW] : strings[S_NEW];
    $('errors-btn').textContent = strings[S_ERRORS] + ': ' + strings[game.showErrors ? S_ON : S_OFF];
    $('cancel-btn').hidden = !cancellable();
  }
}

let pendingLevel = 0;

function save() {
  store(KEY, JSON.stringify(game.save(now())));
}

function startTimer() {
  stopTimer();
  if (game.running) timer = setInterval(renderTime, 1000);
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
}

function closeMenu() {
  if (!cancellable()) return;
  menuOpen = false;
  game.resume(now());
  startTimer();
  render();
}

function startGame(level) {
  if (generating) return;
  menuOpen = false;
  generating = true;
  pendingLevel = level;
  game.pause(now());
  stopTimer();
  render();
  setTimeout(() => {
    const puzzle = engine.generate(level);
    game.start(puzzle, engine.solution, level);
    generating = false;
    game.resume(now());
    save();
    render();
    startTimer();
  }, 30);
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
  }
  if (changed) save();
  render();
}

function tapCell(i) {
  if (!game.active || generating || menuOpen || game.solved) return;
  finish(game.tap(i));
}

function selectCell(i) {
  if (!game.active || generating || menuOpen || game.solved || i === game.selected) return;
  game.select(i);
  render();
}

function cellAt(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const cell = el && el.closest('#board > div');
  return cell ? +cell.dataset.i : -1;
}

function move(key) {
  let i = game.selected < 0 ? 0 : game.selected;
  if (key === 'ArrowLeft') i = ROW[i] * 9 + (COL[i] + 8) % 9;
  else if (key === 'ArrowRight') i = ROW[i] * 9 + (COL[i] + 1) % 9;
  else if (key === 'ArrowUp') i = ((ROW[i] + 8) % 9) * 9 + COL[i];
  else i = ((ROW[i] + 1) % 9) * 9 + COL[i];
  selectCell(i);
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
  $('cancel-btn').addEventListener('click', closeMenu);
  $('lang').addEventListener('change', e => { applyLang(e.target.value, true); render(); });
  document.addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'SELECT') return;
    const k = e.key;
    if (e.metaKey || e.ctrlKey) {
      if (k === 'z' || k === 'Z') { act('undo'); e.preventDefault(); }
      return;
    }
    if (menuOpen || (game.active && game.solved) || generating) {
      if (k === 'Escape') closeMenu();
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
    else return;
    e.preventDefault();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      game.pause(now());
      stopTimer();
      save();
    } else if (!menuOpen && !generating) {
      game.resume(now());
      startTimer();
      renderTime();
    }
  });
  window.addEventListener('pagehide', save);
}

function init() {
  buildBoard();
  bind();
  applyLang(pickLang(), false);
  let saved = null;
  try { saved = JSON.parse(fetchStored(KEY)); } catch (e) {}
  game.load(saved);
  menuOpen = !game.active;
  if (game.active && !game.solved) game.resume(now());
  render();
  startTimer();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js');
}

init();
})();
