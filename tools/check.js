// Verifies badges.js.
//   node tools/check.js
// 1. Builds the game at 5 and 6 digits and brute-forces every badge count over every number.
// 2. Checks power-badge probabilities exactly at 5 digits, summing over every exponent.
// 3. Verifies the hard-coded number lists, and data.js against a fresh count where one is cheap.
// 4. Samples the 10-digit game and compares every badge with its exact odds.
'use strict';
globalThis.crypto ??= require('crypto').webcrypto;
globalThis.RNG_NO_AUTOSTART = true;
const fs = require('fs');
const path = require('path');
require('../badges.js');
const { createGame, millerRabin, pExp, E_MAX } = globalThis.RNGEngine;

let failed = 0;
const fail = msg => { failed++; console.log('FAIL', msg); };
const time = label => { const t = Date.now(); return () => console.log(`${label} (${((Date.now() - t) / 1000).toFixed(1)}s)`); };

for (const D of [5, 6]) {
  const done = time(`brute force at ${D} digits`);
  const g = createGame(D, { dropEmpty: true });
  const date = '2026-10-17';
  const badges = g.BADGES.concat(g.datedBadges(date));
  const hits = new Array(badges.length).fill(0);
  for (let n = 0; n < g.SPACE; n++) {
    const s = String(n), c = { prime: millerRabin(n), date };
    for (let i = 0; i < badges.length; i++) if (badges[i].test(n, s, c)) hits[i]++;
  }
  badges.forEach((b, i) => { if (hits[i] !== b.count) fail(`${D} digits, ${b.id}: counted ${b.count}, brute force ${hits[i]}`); });
  done();

  if (D === 5) {
    const donePow = time('power badges at 5 digits');
    for (const b of g.POWER_BADGES) {
      let p = 0;
      for (let e = 1; e <= E_MAX; e++) {
        let k = 0;
        for (let n = 0; n < g.SPACE; n++) if (b.test(n, String(n), { e })) k++;
        p += (pExp(e) * k) / g.SPACE;
      }
      if (Math.abs(p - b.p) > 1e-15 + 1e-9 * p) fail(`power ${b.id}: p=${b.p}, brute force ${p}`);
    }
    donePow();
  }
}

// Lists: every member has its property, and nothing below 1e7 is missing.
{
  const armstrong = n => { const s = String(n); return [...s].reduce((t, c) => t + BigInt(c) ** BigInt(s.length), 0n) === BigInt(n); };
  const automorphic = n => (BigInt(n) * BigInt(n)) % 10n ** BigInt(String(n).length) === BigInt(n);
  const selfDescribing = n => { const s = String(n); return [...s].every((c, i) => +c === s.split(String(i)).length - 1); };
  const perfect = n => { let t = 1; for (let d = 2; d * d <= n; d++) if (n % d === 0) t += d + (d * d === n ? 0 : n / d); return n > 1 && t === n; };
  const g = createGame(7);
  const byId = Object.fromEntries(g.BADGES.map(b => [b.id, b]));
  const big = createGame(10, { allowMissing: true });
  const bigById = Object.fromEntries(big.BADGES.map(b => [b.id, b]));
  for (const [id, f] of [['armstrong', armstrong], ['automorphic', automorphic], ['selfdesc', selfDescribing], ['perfect', perfect]]) {
    for (const n of bigById[id].set) if (!f(n)) fail(`${id} list has ${n}`);
    for (let n = 10; n < 1e7; n++) if (f(n) !== byId[id].set.has(n)) { fail(`${id} disagrees at ${n}`); break; }
  }
  console.log('lists checked');

  const dataFile = path.join(__dirname, '..', 'data.js');
  if (fs.existsSync(dataFile)) {
    require(dataFile);
    const counts = globalThis.RNG_DATA.counts;
    for (const b of big.BADGES) if (counts[b.id] !== b.count) fail(`data.js ${b.id}: ${counts[b.id]}, fresh count ${b.count}`);
    console.log('data.js agrees with fresh counts');
  } else fail('data.js is missing: run tools/build-data.js');
}

// Sampling at 10 digits catches anything the small sizes cannot reach (and the sieve counts).
if (globalThis.RNG_DATA) {
  const done = time('sampled 10-digit game');
  const g = createGame(10, { counts: globalThis.RNG_DATA.counts });
  const M = 1e6, hits = new Array(g.BADGES.length).fill(0);
  for (let i = 0; i < M; i++) {
    const n = g.randomRoll(), s = String(n), c = { prime: millerRabin(n) };
    for (let j = 0; j < g.BADGES.length; j++) if (g.BADGES[j].test(n, s, c)) hits[j]++;
  }
  g.BADGES.forEach((b, j) => {
    const exp = b.p * M, z = (hits[j] - exp) / Math.sqrt(Math.max(exp, 1));
    if (Math.abs(z) > 5) fail(`${b.id}: sampled ${hits[j]}, expected ${exp.toFixed(1)} (z=${z.toFixed(1)})`);
  });
  const es = new Array(E_MAX + 1).fill(0);
  for (let i = 0; i < 2e5; i++) es[g.randomExponent()]++;
  for (let e = 1; e <= 6; e++) {
    const exp = 2e5 * pExp(e), z = (es[e] - exp) / Math.sqrt(exp);
    if (Math.abs(z) > 5) fail(`exponent ${e}: sampled ${es[e]}, expected ${exp}`);
  }
  done();
  console.log(`${g.BADGES.length} badges + ${g.POWER_BADGES.length} power badges + 2 daily`);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
