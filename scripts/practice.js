'use strict';
const fs = require('fs');
const path = require('path');
const { Sudoku, TECH_BASE } = require('../src/engine.js');

const OUT = path.join(__dirname, '..', 'src', 'practice.json');
const SEED = 20261004;
const PER_POOL = 10;
const WANT = 24;
const CAPS = [600, 600, 6000, 60000, 30000];
const EASY_CLUES = 38;
const NAKED_PAIR = TECH_BASE[2], HIDDEN_PAIR = 34, NAKED_TRIPLE = 36, HIDDEN_TRIPLE = 40;
const BY_TECH = { 'locked-candidates': 1, 'x-wing': 3, 'swordfish': 5, 'skyscraper': 7, 'two-string-kite': 8, 'y-wing': 4, 'xyz-wing': 6, 'w-wing': 9, 'unique-rectangle': 10, 'finned-x-wing': 14, 'empty-rectangle': 17, 'unique-rectangle-type-4': 22, 'hidden-rectangle': 25, 'finned-swordfish': 15, 'jellyfish': 13, 'wxyz-wing': 19, 'bug-plus-1': 26, 'x-chain': 27, 'xy-chain': 28, 'aic': 30, 'als-xz': 33 };
const MASTER_POOL = ['x-chain', 'xy-chain', 'aic', 'als-xz'];
const LEVEL_POOLS = [
  ['naked-single'],
  ['hidden-single'],
  ['locked-candidates', 'naked-pairs', 'hidden-pairs'],
  Object.keys(BY_TECH).filter(slug => slug !== 'locked-candidates' && !MASTER_POOL.includes(slug)),
  MASTER_POOL,
];
const SLUGS = LEVEL_POOLS.flat();

const e = new Sudoku();
e.seed(SEED);

function solvePath(puzzle) {
  e.load(puzzle);
  const steps = [];
  while (!e.complete()) {
    if (e.stuck()) return null;
    const t = e.step();
    if (t < 0) return null;
    steps.push({ t, r: e.stepRating, u: t === 0 ? e.stepUnit : -1 });
  }
  return steps;
}

function classify(steps) {
  const max = Math.max(...steps.map(s => s.r));
  const hardest = steps.filter(s => s.r === max);
  const count = pred => steps.filter(pred).length;
  const hits = [];
  if (max === TECH_BASE[0]) {
    const hidden = count(s => s.u !== 3);
    hits.push(hidden ? ['hidden-single', hidden] : ['naked-single', steps.length]);
  } else if (hardest.every(s => s.t === 2)) {
    const naked = max === NAKED_PAIR || max === NAKED_TRIPLE;
    const mine = s => s.t === 2 && (naked ? s.r === NAKED_PAIR || s.r === NAKED_TRIPLE : s.r === HIDDEN_PAIR || s.r === HIDDEN_TRIPLE);
    hits.push([naked ? 'naked-pairs' : 'hidden-pairs', count(mine)]);
  } else {
    for (const [slug, id] of Object.entries(BY_TECH)) if (hardest.some(s => s.t === id)) hits.push([slug, count(s => s.t === id)]);
  }
  return { max, hits };
}

const pools = Object.fromEntries(SLUGS.map(slug => [slug, []]));
const sizes = slugs => JSON.stringify(Object.fromEntries(slugs.map(s => [s, pools[s].length])));
const t0 = performance.now();
for (let level = 0; level < LEVEL_POOLS.length; level++) {
  const mine = LEVEL_POOLS[level];
  let i = 0;
  for (; i < CAPS[level] && mine.some(slug => pools[slug].length < WANT); i++) {
    const puzzle = e.generate(level);
    if (level === 0 && puzzle.filter(v => v).length < EASY_CLUES) continue;
    const steps = solvePath(puzzle);
    if (!steps) continue;
    const { max, hits } = classify(steps);
    for (const [slug, n] of hits) if (mine.includes(slug)) pools[slug].push({ p: puzzle.join(''), l: level, r: max, n });
    if (i % 2000 === 0) console.log(`seviye ${level} ${i} ${((performance.now() - t0) / 1000).toFixed(0)} s ${sizes(mine)}`);
  }
  console.log(`seviye ${level} bitti: ${i} bulmaca, ${sizes(mine)}`);
}

const out = {};
for (const slug of SLUGS) {
  const picked = pools[slug]
    .sort((a, b) => Math.min(b.n, 3) - Math.min(a.n, 3) || a.r - b.r)
    .slice(0, PER_POOL)
    .sort((a, b) => a.r - b.r || b.n - a.n);
  out[slug] = picked.map(({ p, l, r, n }) => ({ p, l, r, n }));
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log('yazildi', OUT, SLUGS.map(slug => slug + ':' + out[slug].length).join(' '), ((performance.now() - t0) / 1000).toFixed(0) + ' s');
