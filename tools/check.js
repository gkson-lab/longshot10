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

// Mode badges, each against an independent brute force.
{
  const done = time('mode badges');
  const g = createGame(4, { dropEmpty: true }), S = g.SPACE;
  const near = (a, b) => Math.abs(a - b) <= 1e-12 + 1e-9 * Math.abs(b);
  // Modulo: every n with every modulus.
  const modHits = Object.fromEntries(g.MOD_BADGES.map(b => [b.id, 0]));
  for (let m = g.M_LO; m <= g.M_HI; m++) for (let n = 0; n < S; n++) {
    const r = n % m;
    if (r === 0) modHits.modClean++;
    if (r === 0 && m >= 5000) modHits.modBig++;
    if (r === 1) modHits.modOne++;
    if (r === m - 1) modHits.modShort++;
    if (2 * r === m) modHits.modHalf++;
  }
  for (const b of g.MOD_BADGES) {
    const p = modHits[b.id] / ((g.M_HI - g.M_LO + 1) * S);
    if (!near(b.p, p)) fail(`modulo ${b.id}: p=${b.p}, brute force ${p}`);
  }
  // Target: every (n, target) pair.
  for (const b of g.TARGET_BADGES) {
    let k = 0;
    for (let t = 0; t < S; t++) for (let n = 0; n < S; n++) if (Math.abs(n - t) < b.d) k++;
    if (!near(b.p, k / (S * S))) fail(`target ${b.id}: p=${b.p}, brute force ${k / (S * S)}`);
  }
  // Prime radar at 6 digits: a sieve plus a two-pass nearest-prime scan, not the game's search.
  const g6 = createGame(6, { dropEmpty: true }), S6 = g6.SPACE, L = S6 + 200;
  const comp = new Uint8Array(L);
  comp[0] = comp[1] = 1;
  for (let i = 2; i * i < L; i++) if (!comp[i]) for (let j = i * i; j < L; j += i) comp[j] = 1;
  const left = new Int32Array(L), d = new Int32Array(S6);
  for (let i = 0, last = -1e9; i < L; i++) { if (!comp[i]) last = i; left[i] = last; }
  for (let i = L - 1, next = 1e9; i >= 0; i--) { if (!comp[i]) next = i; if (i < S6) d[i] = Math.min(i - left[i], next - i); }
  const tally = test => { let k = 0; for (let i = 0; i < S6; i++) if (test(d[i])) k++; return k; };
  const expect = { radarNext: x => x === 1, radarNear: x => x === 2 || x === 3, radar20: x => x >= 20, radar50: x => x >= 50, radar100: x => x >= 100 };
  for (const b of g6.RADAR_BADGES) if (b.count !== tally(expect[b.id])) fail(`radar ${b.id}: ${b.count}, sieve scan ${tally(expect[b.id])}`);
  // Multipliers: the units add up to exactly 10^15, and the reel lands as often as it should.
  const units = g.MULTIPLIERS.reduce((t, m) => t + m.units, 0);
  if (units !== g.MULT_UNITS || g.MULTIPLIERS.length !== 101) fail(`multipliers: ${g.MULTIPLIERS.length} entries, ${units} units`);
  const picks = {};
  for (let i = 0; i < 2e6; i++) { const m = g.randomParams('classic').mult; picks[m] = (picks[m] || 0) + 1; }
  for (const m of g.MULTIPLIERS) {
    const exp = 2e6 * m.p, z = ((picks[m.id] || 0) - exp) / Math.sqrt(Math.max(exp, 1));
    if (Math.abs(z) > 5) fail(`multiplier ${m.id}: picked ${picks[m.id] || 0}, expected ${exp.toFixed(1)}`);
  }
  done();
}

// Lists: every member has its property, and nothing below 1e7 is missing.
{
  const armstrong = n => { const s = String(n); return [...s].reduce((t, c) => t + BigInt(c) ** BigInt(s.length), 0n) === BigInt(n); };
  const automorphic = n => (BigInt(n) * BigInt(n)) % 10n ** BigInt(String(n).length) === BigInt(n);
  const selfDescribing = n => { const s = String(n); return [...s].every((c, i) => +c === s.split(String(i)).length - 1); };
  const perfect = n => { let t = 1; for (let d = 2; d * d <= n; d++) if (n % d === 0) t += d + (d * d === n ? 0 : n / d); return n > 1 && t === n; };
  const g = createGame(7, { allowMissing: true, dropEmpty: true }); // only the generated lists are needed here
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
    for (const m of big.MODES) if (!globalThis.RNG_DATA.quantiles || !globalThis.RNG_DATA.quantiles[m.id]) fail(`data.js has no percentile table for ${m.id}`);
    console.log('data.js agrees with fresh counts');
  } else fail('data.js is missing: run tools/build-data.js');
}

// Sampling at 10 digits catches anything the small sizes cannot reach (and the sieve counts).
if (globalThis.RNG_DATA) {
  const done = time('sampled 10-digit game');
  const g = createGame(10, { counts: globalThis.RNG_DATA.counts });
  const M = 1e6, all = g.BADGES.concat(g.RADAR_BADGES), hits = new Array(all.length).fill(0);
  for (let i = 0; i < M; i++) {
    const n = g.randomRoll(), s = String(n), c = { prime: millerRabin(n), d: g.nearestPrimeDistance(n) };
    for (let j = 0; j < all.length; j++) if (all[j].test(n, s, c)) hits[j]++;
  }
  all.forEach((b, j) => {
    const exp = b.p * M, z = (hits[j] - exp) / Math.sqrt(Math.max(exp, 1));
    if (Math.abs(z) > 5) fail(`${b.id}: sampled ${hits[j]}, expected ${exp.toFixed(1)} (z=${z.toFixed(1)})`);
  });
  // 1/N must mean what it says: in fresh random rolls, 10% should read 1/10 or rarer and 1% 1/100 or rarer.
  const gq = createGame(10, { counts: globalThis.RNG_DATA.counts, quantiles: globalThis.RNG_DATA.quantiles });
  for (const mode of gq.MODES.map(m => m.id)) {
    const R = 1e5;
    let k10 = 0, k100 = 0, trash = 0;
    for (let i = 0; i < R; i++) {
      const r = gq.score(gq.randomRoll(), null, gq.randomParams(mode)), t = gq.rollTier(r.rank, mode);
      if (t.oneInLog >= 1) k10++;
      if (t.oneInLog >= 2) k100++;
      if (t.tier.id === 'trash') trash++;
    }
    for (const [k, p, what] of [[k10, 0.1, '1/10 or rarer'], [k100, 0.01, '1/100 or rarer'], [trash, 0.01, 'Trash']]) {
      const z = (k - R * p) / Math.sqrt(R * p * (1 - p));
      if (Math.abs(z) > 5) fail(`${mode}: ${k} of ${R} rolls ${what}, expected ${R * p}`);
    }
    console.log(`${mode.padEnd(7)} 1/10+: ${(100 * k10 / R).toFixed(2)}%  1/100+: ${(100 * k100 / R).toFixed(2)}%  Trash: ${(100 * trash / R).toFixed(2)}%`);
  }
  const es = new Array(E_MAX + 1).fill(0);
  for (let i = 0; i < 2e5; i++) es[g.randomExponent()]++;
  for (let e = 1; e <= 6; e++) {
    const exp = 2e5 * pExp(e), z = (es[e] - exp) / Math.sqrt(exp);
    if (Math.abs(z) > 5) fail(`exponent ${e}: sampled ${es[e]}, expected ${exp}`);
  }
  done();
  const modeBadges = g.MODES.reduce((t, m) => t + m.badges.length, 0);
  console.log(`${g.BADGES.length} badges + ${modeBadges} mode badges + 2 daily, ${g.MULTIPLIERS.length - 1} multipliers`);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
