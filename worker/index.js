const DAY = 86400e3;
const ISTANBUL = 3 * 3600e3;
const BODY_LIMIT = 300;
const LANG = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;
const HOST = /^[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/;
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|fetch|python|curl|wget/i;
const DESKTOP_CHROME = /Chrome\/\d/;
const DESKTOP_OS = /Windows NT|Macintosh|X11|CrOS/;
const DATACENTER_ASN = new Set([16509, 14618, 15169, 396982, 8075, 14061, 24940, 16276, 31898, 63949, 20473, 45102, 132203]);
const UPSERT = 'INSERT INTO counts (day, dim, name, n) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (day, dim, name) DO UPDATE SET n = n + excluded.n';
const RANGES = { 7: 7, 30: 30, 90: 90, all: 0 };
const RANGE_LABELS = { 7: '7 days', 30: '30 days', 90: '90 days', all: 'All time' };
const LEVELS = ['Easy', 'Medium', 'Hard', 'Expert', 'Master'];
const PUZZLE_DIMS = new Set(['pn', 'ps', 'pt']);
const FIRST_PUZZLE_DAY = '2025-01-01';
const DAILY_ID = /^d(\d{4})-(\d{2})-(\d{2})$/;
const WEEK_ID = /^w(\d{4})-W(\d{2})$/;
const PUZZLE_SQL = "SELECT dim, name, n FROM counts WHERE day = ?1 AND dim IN ('pn', 'ps', 'pt')";
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=15', 'X-Robots-Tag': 'noindex', 'X-Content-Type-Options': 'nosniff' };
const STATS_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'public, max-age=60',
  'X-Robots-Tag': 'noindex',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'"
};
const CSS = 'body{font:15px/1.4 system-ui,sans-serif;margin:24px auto;max-width:720px;padding:0 16px;color:#222;background:#fff}a{color:#1a56c4}' +
  '@media(prefers-color-scheme:dark){body{color:#ddd;background:#121212}a{color:#8ab4f8}}' +
  'h1{font-size:1.5em}h2{margin-top:28px;font-size:1.1em}table{border-collapse:collapse;margin:8px 0 16px;width:100%}' +
  'th,td{text-align:right;padding:4px 8px;border-bottom:1px solid #8884;font-weight:normal}th:first-child,td:first-child{text-align:left}thead th{opacity:.7}' +
  '.big{display:flex;flex-wrap:wrap;gap:12px 24px;margin:16px 0}.big div{min-width:110px}.big b{display:block;font-size:1.6em}.foot{opacity:.7;margin-top:32px}';

export function dayOf(ms) {
  return new Date(ms + ISTANBUL).toISOString().slice(0, 10);
}

function row(day, dim, name, n) {
  return { day, dim, name, n };
}

export function timeBucket(s) {
  return s < 600 ? s - s % 15 : s < 3600 ? s - s % 60 : s - s % 300;
}

function utcDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function weekMonday(year, week) {
  const jan4 = Date.UTC(year, 0, 4);
  const offset = (new Date(jan4).getUTCDay() + 6) % 7;
  return utcDay(jan4 + ((week - 1) * 7 - offset) * DAY);
}

export function puzzleKey(id, nowMs) {
  if (typeof id !== 'string') return null;
  let day, kind;
  const d = DAILY_ID.exec(id);
  if (d) {
    day = d[1] + '-' + d[2] + '-' + d[3];
    if (utcDay(Date.UTC(+d[1], +d[2] - 1, +d[3])) !== day) return null;
    kind = 'd';
  } else {
    const w = WEEK_ID.exec(id);
    if (!w || +w[2] < 1 || +w[2] > 53) return null;
    day = weekMonday(+w[1], +w[2]);
    kind = 'w';
  }
  if (day < FIRST_PUZZLE_DAY || day > dayOf(nowMs + DAY)) return null;
  return { day, kind };
}

export function puzzleSummary(rows, kind) {
  const levels = {};
  for (const r of rows) {
    if (!PUZZLE_DIMS.has(r.dim) || typeof r.name !== 'string' || r.name[0] !== kind) continue;
    const [name, bucket] = r.name.split(':');
    const l = levels[name] || (levels[name] = { n: 0, s: 0, h: {} });
    const n = +r.n || 0;
    if (r.dim === 'pn') l.n += n;
    else if (r.dim === 'ps') l.s += n;
    else if (bucket !== undefined) l.h[bucket] = (l.h[bucket] || 0) + n;
  }
  return { levels };
}

export function parseEvent(raw, nowMs) {
  let ev;
  try { ev = JSON.parse(raw); } catch (e) { return null; }
  if (!ev || typeof ev !== 'object') return null;
  const today = dayOf(nowMs);
  if (ev.e === 'open') {
    if (typeof ev.l !== 'string' || ev.l.length > 8 || !LANG.test(ev.l)) return null;
    const rows = [row(today, 'open', ev.l, 1), row(today, 'dev', ev.d === 'm' ? 'm' : 'd', 1)];
    if (typeof ev.r === 'string' && ev.r.length <= 60 && HOST.test(ev.r)) rows.push(row(today, 'ref', ev.r, 1));
    if (ev.v === 1) rows.push(row(today, 'visit', '-', 1));
    return rows;
  }
  if (ev.e !== 'start' && ev.e !== 'done') return null;
  if (!Number.isInteger(ev.k) || ev.k < 0 || ev.k >= LEVELS.length) return null;
  const level = String(ev.k);
  if (ev.e === 'start') return [row(today, 'start', level, 1)];
  const t = +ev.t;
  const day = t >= nowMs - 60 * DAY && t <= nowMs + 300e3 ? dayOf(t) : today;
  const rows = [row(day, 'done', level, 1)];
  if (Number.isInteger(ev.s) && ev.s >= 1 && ev.s <= 10800) {
    rows.push(row(day, 'time', level, ev.s), row(day, 'timed', level, 1));
    const key = puzzleKey(ev.p, nowMs);
    if (key && (key.kind === 'd' || level === '4')) {
      const name = key.kind + level;
      rows.push(row(key.day, 'pn', name, 1), row(key.day, 'ps', name, ev.s), row(key.day, 'pt', name + ':' + timeBucket(ev.s), 1));
    }
  }
  return rows;
}

export function automated(headers, cf) {
  const ua = headers.get('User-Agent') || '';
  if (BOT.test(ua)) return true;
  if (!headers.get('Accept-Language')) return true;
  if (DESKTOP_CHROME.test(ua) && DESKTOP_OS.test(ua) && !headers.get('Sec-CH-UA')) return true;
  return DATACENTER_ASN.has(+(cf && cf.asn));
}

async function collect(request, env, ctx) {
  const site = request.headers.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin') return;
  if (automated(request.headers, request.cf)) return;
  if (+(request.headers.get('Content-Length') || 0) > BODY_LIMIT) return;
  const raw = await request.text();
  if (raw.length > BODY_LIMIT) return;
  const rows = parseEvent(raw, Date.now());
  if (!rows) return;
  ctx.waitUntil(env.DB.batch(rows.map(r => env.DB.prepare(UPSERT).bind(r.day, r.dim, r.name, r.n))).catch(() => {}));
}

function bump(map, name, n) {
  map.set(name, (map.get(name) || 0) + n);
}

function top(map, count) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, count);
}

export function summarize(rows) {
  const total = { visit: 0, open: 0, start: 0, done: 0 };
  const levels = LEVELS.map(() => ({ start: 0, done: 0, time: 0, timed: 0 }));
  const byDay = new Map();
  const langs = new Map(), refs = new Map(), devs = new Map();
  for (const r of rows) {
    if (PUZZLE_DIMS.has(r.dim)) continue;
    const n = +r.n || 0;
    let day = byDay.get(r.day);
    if (!day) byDay.set(r.day, day = { visit: 0, open: 0, start: 0, done: 0 });
    if (r.dim === 'visit' || r.dim === 'open') {
      total[r.dim] += n;
      day[r.dim] += n;
      if (r.dim === 'open') bump(langs, r.name, n);
    } else if (r.dim === 'dev') bump(devs, r.name, n);
    else if (r.dim === 'ref') bump(refs, r.name, n);
    else if (r.dim in levels[0] && LEVELS[+r.name]) {
      levels[+r.name][r.dim] += n;
      if (r.dim === 'start' || r.dim === 'done') {
        total[r.dim] += n;
        day[r.dim] += n;
      }
    }
  }
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([day, d]) => ({ day, ...d }));
  return { total, levels, days, langs: top(langs, 10), refs: top(refs, 10), devs: [devs.get('m') || 0, devs.get('d') || 0] };
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => n.toLocaleString('en-US');
const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '-';

function clock(seconds) {
  const s = Math.round(seconds);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function table(head, rows) {
  const th = head.map(h => '<th>' + esc(h) + '</th>').join('');
  const body = rows.map(r => '<tr>' + r.map((c, i) => (i ? '<td>' : '<th scope="row">') + esc(c) + (i ? '</td>' : '</th>')).join('') + '</tr>').join('');
  return '<table><thead><tr>' + th + '</tr></thead><tbody>' + (body || '<tr><td colspan="' + head.length + '">No data yet</td></tr>') + '</tbody></table>';
}

export function renderStats(s, days, today) {
  const t = s.total;
  const current = days ? String(days) : 'all';
  const nav = Object.keys(RANGE_LABELS).map(k => k === current ? '<b>' + RANGE_LABELS[k] + '</b>' : '<a href="?days=' + k + '">' + RANGE_LABELS[k] + '</a>').join(' · ');
  const cards = [['Visitors', num(t.visit)], ['Page opens', num(t.open)], ['Games started', num(t.start)], ['Completed', num(t.done)], ['Completion', pct(t.done, t.start)], ['Abandoned', num(Math.max(t.start - t.done, 0))]]
    .map(([k, v]) => '<div><b>' + esc(v) + '</b>' + k + '</div>').join('');
  const levels = table(['Level', 'Started', 'Completed', 'Completion', 'Avg time'], s.levels.map((l, i) => [LEVELS[i], num(l.start), num(l.done), pct(l.done, l.start), l.timed ? clock(l.time / l.timed) : '-']));
  const daily = table(['Day', 'Visitors', 'Opens', 'Started', 'Completed'], s.days.slice(0, 90).map(d => [d.day, num(d.visit), num(d.open), num(d.start), num(d.done)]));
  const langs = table(['Language', 'Opens', 'Share'], s.langs.map(([k, v]) => [k, num(v), pct(v, t.open)]));
  const refs = table(['Referring site', 'Opens'], s.refs.map(([k, v]) => [k, num(v)]));
  const devTotal = s.devs[0] + s.devs[1];
  const devs = table(['Device', 'Opens', 'Share'], [['Touch screen', num(s.devs[0]), pct(s.devs[0], devTotal)], ['Mouse or trackpad', num(s.devs[1]), pct(s.devs[1], devTotal)]]);
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Bare Sudoku stats</title><style>' + CSS + '</style></head><body>' +
    '<h1>Bare Sudoku stats</h1><p>' + nav + '</p><div class="big">' + cards + '</div>' +
    '<h2>Levels</h2>' + levels + '<h2>Days</h2>' + daily + '<h2>Languages</h2>' + langs + '<h2>Referring sites</h2>' + refs + '<h2>Devices</h2>' + devs +
    '<p class="foot">Anonymous counters only: no cookies, no IP addresses, no identifiers. Days follow Europe/Istanbul; today is ' + esc(today) + '. <a href="/">Play</a> · <a href="https://github.com/alparslandev/baresudoku-web">Source</a></p></body></html>';
}

async function puzzleStats(env, id) {
  const key = puzzleKey(id, Date.now());
  if (!key) return new Response('{}', { status: 400, headers: JSON_HEADERS });
  const { results } = await env.DB.prepare(PUZZLE_SQL).bind(key.day).all();
  return new Response(JSON.stringify(puzzleSummary(results, key.kind)), { headers: JSON_HEADERS });
}

async function stats(env, param) {
  const days = Object.hasOwn(RANGES, param) ? RANGES[param] : 30;
  const now = Date.now();
  const sql = 'SELECT day, dim, name, n FROM counts' + (days ? ' WHERE day >= ?1' : '') + ' ORDER BY day';
  const stmt = days ? env.DB.prepare(sql).bind(dayOf(now - (days - 1) * DAY)) : env.DB.prepare(sql);
  const { results } = await stmt.all();
  return new Response(renderStats(summarize(results), days, dayOf(now)), { headers: STATS_HEADERS });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/e') {
      if (request.method === 'POST') await collect(request, env, ctx).catch(() => {});
      return new Response(null, { status: 204 });
    }
    if (url.pathname === '/api/p' && (request.method === 'GET' || request.method === 'HEAD')) {
      try {
        return await puzzleStats(env, url.searchParams.get('id'));
      } catch (e) {
        return new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
      }
    }
    if ((url.pathname === '/stats' || url.pathname === '/stats/') && (request.method === 'GET' || request.method === 'HEAD')) {
      try {
        return await stats(env, url.searchParams.get('days'));
      } catch (e) {
        return new Response('Stats unavailable', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
      }
    }
    return env.ASSETS.fetch(request);
  }
};
