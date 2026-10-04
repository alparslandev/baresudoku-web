import { test, expect } from "bun:test";
import worker, { dayOf, parseEvent, summarize, renderStats, automated, timeBucket, weekMonday, puzzleKey, puzzleSummary } from "../worker/index.js";

const NOW = Date.UTC(2026, 8, 29, 12, 0, 0);
const DAY = 86400e3;

test("days follow Istanbul time", () => {
  expect(dayOf(Date.UTC(2026, 8, 29, 20, 59, 0))).toBe("2026-09-29");
  expect(dayOf(Date.UTC(2026, 8, 29, 21, 0, 0))).toBe("2026-09-30");
});

test("open events become counters", () => {
  const rows = parseEvent(JSON.stringify({ e: "open", l: "tr", d: "m", r: "google.com", v: 1 }), NOW);
  expect(rows.map(r => r.dim + "/" + r.name)).toEqual(["open/tr", "dev/m", "ref/google.com", "visit/-"]);
  expect(rows.every(r => r.day === "2026-09-29" && r.n === 1)).toBe(true);
  expect(parseEvent(JSON.stringify({ e: "open", l: "zh-Hans" }), NOW).map(r => r.dim + "/" + r.name)).toEqual(["open/zh-Hans", "dev/d"]);
  expect(parseEvent(JSON.stringify({ e: "open", l: "tr", r: "Google.com" }), NOW).length).toBe(2);
  expect(parseEvent(JSON.stringify({ e: "open", l: "tr", r: "localhost" }), NOW).length).toBe(2);
  expect(parseEvent(JSON.stringify({ e: "open", l: "tr", v: "1" }), NOW).length).toBe(2);
  expect(parseEvent(JSON.stringify({ e: "open", l: "x" }), NOW)).toBeNull();
  expect(parseEvent(JSON.stringify({ e: "open", l: "tr-Latn-TR" }), NOW)).toBeNull();
  expect(parseEvent(JSON.stringify({ e: "open" }), NOW)).toBeNull();
});

test("start and done events become counters", () => {
  expect(parseEvent('{"e":"start","k":2}', NOW)).toEqual([{ day: "2026-09-29", dim: "start", name: "2", n: 1 }]);
  expect(parseEvent(JSON.stringify({ e: "done", k: 3, t: NOW - 2 * DAY, s: 754 }), NOW)).toEqual([
    { day: "2026-09-27", dim: "done", name: "3", n: 1 },
    { day: "2026-09-27", dim: "time", name: "3", n: 754 },
    { day: "2026-09-27", dim: "timed", name: "3", n: 1 },
  ]);
  expect(parseEvent(JSON.stringify({ e: "done", k: 0, t: NOW - 61 * DAY, s: 99999 }), NOW)).toEqual([{ day: "2026-09-29", dim: "done", name: "0", n: 1 }]);
  expect(parseEvent(JSON.stringify({ e: "done", k: 0, t: NOW + 3600e3, s: 0 }), NOW)).toEqual([{ day: "2026-09-29", dim: "done", name: "0", n: 1 }]);
  expect(parseEvent('{"e":"start","k":4}', NOW)).toEqual([{ day: "2026-09-29", dim: "start", name: "4", n: 1 }]);
  expect(parseEvent('{"e":"start","k":5}', NOW)).toBeNull();
  expect(parseEvent('{"e":"start","k":"1"}', NOW)).toBeNull();
  expect(parseEvent('{"e":"quit","k":1}', NOW)).toBeNull();
  expect(parseEvent("nope", NOW)).toBeNull();
  expect(parseEvent("null", NOW)).toBeNull();
  expect(parseEvent("[1]", NOW)).toBeNull();
});

test("summary and page", () => {
  const rows = [
    { day: "2026-09-28", dim: "visit", name: "-", n: 3 }, { day: "2026-09-28", dim: "open", name: "tr", n: 5 },
    { day: "2026-09-29", dim: "open", name: "en", n: 4 }, { day: "2026-09-29", dim: "dev", name: "m", n: 6 }, { day: "2026-09-29", dim: "dev", name: "d", n: 3 },
    { day: "2026-09-29", dim: "ref", name: "google.com", n: 2 }, { day: "2026-09-29", dim: "ref", name: "<b>x</b>.com", n: 1 },
    { day: "2026-09-29", dim: "start", name: "2", n: 10 }, { day: "2026-09-29", dim: "done", name: "2", n: 4 },
    { day: "2026-09-29", dim: "time", name: "2", n: 1200 }, { day: "2026-09-29", dim: "timed", name: "2", n: 4 },
    { day: "2026-09-29", dim: "start", name: "4", n: 2 }, { day: "2026-09-29", dim: "done", name: "4", n: 1 },
    { day: "2026-09-29", dim: "start", name: "9", n: 1 }, { day: "2026-09-29", dim: "junk", name: "0", n: 1 },
  ];
  const s = summarize(rows);
  expect(s.total).toEqual({ visit: 3, open: 9, start: 12, done: 5 });
  expect(s.levels[2]).toEqual({ start: 10, done: 4, time: 1200, timed: 4 });
  expect(s.levels[4]).toEqual({ start: 2, done: 1, time: 0, timed: 0 });
  expect(s.days.map(d => d.day)).toEqual(["2026-09-29", "2026-09-28"]);
  expect(s.days[1]).toEqual({ day: "2026-09-28", visit: 3, open: 5, start: 0, done: 0 });
  expect(s.langs).toEqual([["tr", 5], ["en", 4]]);
  expect(s.devs).toEqual([6, 3]);
  const html = renderStats(s, 30, "2026-09-29");
  expect(html).toContain("40%");
  expect(html).toContain("Master");
  expect(html).toContain("5:00");
  expect(html).toContain("&lt;b&gt;x&lt;/b&gt;.com");
  expect(html).not.toContain("<b>x</b>");
  expect(html).toContain('name="robots" content="noindex"');
  expect(renderStats(summarize([]), 0, "2026-09-29")).toContain("No data yet");
});

function fakeEnv() {
  const batches = [];
  const waits = [];
  const env = {
    DB: {
      prepare: sql => ({ bind: (...args) => ({ sql, args, all: async () => ({ results: [] }) }), all: async () => ({ results: [] }) }),
      batch: async stmts => { batches.push(stmts); return []; },
    },
    ASSETS: { fetch: async req => new Response("asset " + new URL(req.url).pathname) },
  };
  const ctx = { waitUntil: p => waits.push(p) };
  return { env, ctx, batches, waits };
}

async function post(body, headers = {}) {
  const { env, ctx, batches, waits } = fakeEnv();
  const request = new Request("https://baresudoku.com/api/e", { method: "POST", body, headers: { "Sec-Fetch-Site": "same-origin", "User-Agent": "Mozilla/5.0", "Accept-Language": "tr-TR,tr;q=0.9", ...headers } });
  const res = await worker.fetch(request, env, ctx);
  await Promise.all(waits);
  return { status: res.status, batches };
}

test("collector writes only valid same-origin human events", async () => {
  const ok = await post('{"e":"start","k":1}');
  expect(ok.status).toBe(204);
  expect(ok.batches.length).toBe(1);
  expect(ok.batches[0][0].args).toEqual([expect.any(String), "start", "1", 1]);
  expect((await post('{"e":"start","k":1}', { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" })).batches.length).toBe(0);
  expect((await post('{"e":"start","k":1}', { "Sec-Fetch-Site": "cross-site" })).batches.length).toBe(0);
  expect((await post('{"e":"start","k":1}', { "Accept-Language": "" })).batches.length).toBe(0);
  const chrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";
  expect((await post('{"e":"start","k":1}', { "User-Agent": chrome })).batches.length).toBe(0);
  expect((await post('{"e":"start","k":1}', { "User-Agent": chrome, "Sec-CH-UA": '"Chromium";v="148", "Google Chrome";v="148"' })).batches.length).toBe(1);
  const human = new Headers({ "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 Version/19.0 Mobile/15E148 Safari/604.1", "Accept-Language": "ja,en;q=0.8" });
  expect(automated(human, { asn: 15897 })).toBe(false);
  expect(automated(human, undefined)).toBe(false);
  expect(automated(human, { asn: 16509 })).toBe(true);
  expect((await post('{"e":"start","k":1,"x":"' + "a".repeat(400) + '"}')).batches.length).toBe(0);
  const broken = await post("broken");
  expect(broken.batches.length).toBe(0);
  expect(broken.status).toBe(204);
});

test("routing", async () => {
  const { env, ctx } = fakeEnv();
  const get = path => worker.fetch(new Request("https://baresudoku.com" + path), env, ctx);
  expect(await (await get("/tr/")).text()).toBe("asset /tr/");
  expect(await (await get("/nope")).text()).toBe("asset /nope");
  expect((await get("/api/e")).status).toBe(204);
  const stats = await get("/stats/?days=7");
  expect(stats.status).toBe(200);
  expect(stats.headers.get("X-Robots-Tag")).toBe("noindex");
  expect(stats.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
  expect(await stats.text()).toContain("No data yet");
  expect((await get("/stats?days=constructor")).status).toBe(200);
  expect((await get("/stats/?days=all")).status).toBe(200);
});

test("puzzle ids, weeks and time buckets", () => {
  expect(timeBucket(1)).toBe(0);
  expect(timeBucket(599)).toBe(585);
  expect(timeBucket(600)).toBe(600);
  expect(timeBucket(3599)).toBe(3540);
  expect(timeBucket(3600)).toBe(3600);
  expect(timeBucket(10799)).toBe(10500);
  expect(weekMonday(2026, 40)).toBe("2026-09-28");
  expect(weekMonday(2026, 1)).toBe("2025-12-29");
  expect(weekMonday(2027, 1)).toBe("2027-01-04");
  expect(puzzleKey("d2026-09-29", NOW)).toEqual({ day: "2026-09-29", kind: "d" });
  expect(puzzleKey("d2026-09-30", NOW)).toEqual({ day: "2026-09-30", kind: "d" });
  expect(puzzleKey("d2026-10-01", NOW)).toBeNull();
  expect(puzzleKey("d2026-02-31", NOW)).toBeNull();
  expect(puzzleKey("d2024-12-31", NOW)).toBeNull();
  expect(puzzleKey("w2026-W40", NOW)).toEqual({ day: "2026-09-28", kind: "w" });
  expect(puzzleKey("w2026-W41", NOW)).toBeNull();
  expect(puzzleKey("w2026-W00", NOW)).toBeNull();
  expect(puzzleKey("x2026-09-29", NOW)).toBeNull();
  expect(puzzleKey(5, NOW)).toBeNull();
});

test("daily and weekly solves feed the comparison counters", () => {
  const daily = parseEvent(JSON.stringify({ e: "done", k: 3, t: NOW - 3600e3, s: 754, p: "d2026-09-27" }), NOW);
  expect(daily.slice(3)).toEqual([
    { day: "2026-09-27", dim: "pn", name: "d3", n: 1 },
    { day: "2026-09-27", dim: "ps", name: "d3", n: 754 },
    { day: "2026-09-27", dim: "pt", name: "d3:720", n: 1 },
  ]);
  const weekly = parseEvent(JSON.stringify({ e: "done", k: 4, t: NOW, s: 3700, p: "w2026-W40" }), NOW);
  expect(weekly.slice(3).map(r => r.day + " " + r.dim + " " + r.name + " " + r.n)).toEqual(["2026-09-28 pn w4 1", "2026-09-28 ps w4 3700", "2026-09-28 pt w4:3600 1"]);
  expect(parseEvent(JSON.stringify({ e: "done", k: 2, t: NOW, s: 300, p: "w2026-W40" }), NOW).length).toBe(3);
  expect(parseEvent(JSON.stringify({ e: "done", k: 2, t: NOW, s: 300, p: "d2026-12-01" }), NOW).length).toBe(3);
  expect(parseEvent(JSON.stringify({ e: "done", k: 2, t: NOW, p: "d2026-09-29" }), NOW).length).toBe(1);
  const rows = [
    { day: "2026-09-28", dim: "pn", name: "d3", n: 4 }, { day: "2026-09-28", dim: "ps", name: "d3", n: 2000 },
    { day: "2026-09-28", dim: "pt", name: "d3:450", n: 3 }, { day: "2026-09-28", dim: "pt", name: "d3:600", n: 1 },
    { day: "2026-09-28", dim: "pn", name: "w4", n: 1 }, { day: "2026-09-28", dim: "ps", name: "w4", n: 4000 }, { day: "2026-09-28", dim: "pt", name: "w4:3900", n: 1 },
  ];
  expect(puzzleSummary(rows, "d")).toEqual({ levels: { d3: { n: 4, s: 2000, h: { 450: 3, 600: 1 } } } });
  expect(puzzleSummary(rows, "w")).toEqual({ levels: { w4: { n: 1, s: 4000, h: { 3900: 1 } } } });
  const s = summarize(rows.concat([{ day: "2026-09-29", dim: "open", name: "en", n: 2 }]));
  expect(s.days.map(d => d.day)).toEqual(["2026-09-29"]);
  expect(s.total.open).toBe(2);
});

test("puzzle comparison endpoint", async () => {
  const { env, ctx } = fakeEnv();
  const get = path => worker.fetch(new Request("https://baresudoku.com" + path), env, ctx);
  const ok = await get("/api/p?id=d2026-09-29");
  expect(ok.status).toBe(200);
  expect(ok.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
  expect(await ok.json()).toEqual({ levels: {} });
  expect((await get("/api/p?id=nope")).status).toBe(400);
  expect((await get("/api/p")).status).toBe(400);
});

test("variant games count separately and show in their own table", () => {
  expect(parseEvent(JSON.stringify({ e: "start", k: 2, v: "killer" }), NOW)).toEqual([{ day: "2026-09-29", dim: "vstart", name: "killer2", n: 1 }]);
  expect(parseEvent(JSON.stringify({ e: "done", k: 0, v: "mini", t: NOW, s: 90 }), NOW)).toEqual([{ day: "2026-09-29", dim: "vdone", name: "mini0", n: 1 }]);
  expect(parseEvent(JSON.stringify({ e: "start", k: 3, v: "killer" }), NOW)).toBeNull();
  expect(parseEvent(JSON.stringify({ e: "start", k: 1, v: "samurai" }), NOW)).toBeNull();
  const s = summarize([{ day: "2026-09-29", dim: "vstart", name: "killer2", n: 4 }, { day: "2026-09-29", dim: "vdone", name: "killer2", n: 3 }, { day: "2026-09-29", dim: "open", name: "en", n: 1 }]);
  expect(s.variants).toEqual([["killer2", { start: 4, done: 3 }]]);
  expect(s.total.start).toBe(0);
  expect(renderStats(s, 30, "2026-09-29")).toContain("killer Hard");
});
