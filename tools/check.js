// Sanity checks for badges.js.
//   node tools/check.js [samples]
// 1. Every badge's exact probability agrees with a large random sample.
// 2. The hard-coded number lists match brute force where brute force is cheap.
'use strict';
globalThis.crypto ??= require('crypto').webcrypto;
require('../badges.js');
const { BADGES, randomRoll, millerRabin, digitSum, score, rollTier } = globalThis.RNG9;

let failed = 0;
const fail = msg => { failed++; console.log('FAIL', msg); };

// ---- brute-force list checks below 1e7 -----------------------------------------
const armstrong = n => { const s = String(n); return [...s].reduce((t, c) => t + (+c) ** s.length, 0) === n; };
const automorphic = n => (BigInt(n) * BigInt(n)) % 10n ** BigInt(String(n).length) === BigInt(n);
const selfDescribing = n => { const s = String(n); return [...s].every((c, i) => +c === s.split(String(i)).length - 1); };
const byId = Object.fromEntries(BADGES.map(b => [b.id, b]));
for (const [id, f] of [['armstrong', armstrong], ['automorphic', automorphic], ['selfdesc', selfDescribing]]) {
  for (let n = 10; n < 1e7; n++) {
    const s = String(n);
    if (f(n) !== byId[id].test(n, s, {})) { fail(`${id} disagrees at ${n}`); break; }
  }
}
// The lists' large members must really have the property.
for (const id of ['armstrong', 'automorphic', 'selfdesc']) for (const n of byId[id].set) {
  if (!{ armstrong, automorphic, selfdesc: selfDescribing }[id](n)) fail(`${id} list has ${n}`);
}
for (let n = 0; n < 2e5; n++) {
  let p = n >= 2;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) { p = false; break; }
  if (p !== millerRabin(n)) { fail('isPrime ' + n); break; }
}

// ---- Monte Carlo ---------------------------------------------------------------------
const M = +process.argv[2] || 2e6;
const hits = Object.fromEntries(BADGES.map(b => [b.id, 0]));
for (let i = 0; i < M; i++) {
  const n = randomRoll(), s = String(n), c = { prime: millerRabin(n) };
  for (const b of BADGES) if (b.test(n, s, c)) hits[b.id]++;
}
const rows = [];
for (const b of BADGES) {
  const exp = b.p * M, z = (hits[b.id] - exp) / Math.sqrt(Math.max(exp, 1));
  if (Math.abs(z) > 5) fail(`${b.id}: sampled ${hits[b.id]}, expected ${exp.toFixed(1)} (z=${z.toFixed(1)})`);
  rows.push(`${b.id.padEnd(14)} ${String(b.count).padStart(10)}  1 in ${String(Math.round(1 / b.p)).padEnd(11)} sampled ${String(hits[b.id]).padStart(8)} expected ${exp.toFixed(1)}`);
}
console.log(rows.join('\n'));
console.log(`\n${BADGES.length} badges`);
for (const n of [0, 7, 69, 420, 1729, 123456789, 999999999, 777777777]) {
  const r = score(n), t = rollTier(r.ep);
  console.log(String(n).padStart(9), t.tier.name.padEnd(8), String(r.ep).padStart(11), r.badges.map(b => b.id).join(' '));
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
