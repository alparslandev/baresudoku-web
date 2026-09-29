import { test, expect } from "bun:test";
import worker, { dayOf, parseEvent, summarize, renderStats } from "../worker/index.js";

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
  expect(parseEvent('{"e":"start","k":4}', NOW)).toBeNull();
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
    { day: "2026-09-29", dim: "start", name: "9", n: 1 }, { day: "2026-09-29", dim: "junk", name: "0", n: 1 },
  ];
  const s = summarize(rows);
  expect(s.total).toEqual({ visit: 3, open: 9, start: 10, done: 4 });
  expect(s.levels[2]).toEqual({ start: 10, done: 4, time: 1200, timed: 4 });
  expect(s.days.map(d => d.day)).toEqual(["2026-09-29", "2026-09-28"]);
  expect(s.days[1]).toEqual({ day: "2026-09-28", visit: 3, open: 5, start: 0, done: 0 });
  expect(s.langs).toEqual([["tr", 5], ["en", 4]]);
  expect(s.devs).toEqual([6, 3]);
  const html = renderStats(s, 30, "2026-09-29");
  expect(html).toContain("40%");
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
  const request = new Request("https://baresudoku.com/api/e", { method: "POST", body, headers: { "Sec-Fetch-Site": "same-origin", "User-Agent": "Mozilla/5.0", ...headers } });
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
