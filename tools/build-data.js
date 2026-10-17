// Writes data.js: exact counts for every 10-digit badge, plus each mode's percentile table, so
// the page does no counting or sampling at load.
//   node tools/build-data.js
// Prime badges need every prime below 1e10: an odd-only bitset (625 MB, shared) is sieved and
// scanned by one worker per core. The percentile tables come from 2,000,000 rolls per mode.
'use strict';
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const fs = require('fs');
const path = require('path');

globalThis.RNG_NO_AUTOSTART = true;
require('../badges.js');
const { createGame, PRIME_COMBOS, P } = globalThis.RNGEngine;

const DIGITS = 10;
const SPACE = 10 ** DIGITS;
const LIMIT = SPACE + 1024; // room to find the next prime past the largest roll
const WORDS = Math.ceil(LIMIT / 64); // each 32-bit word holds the odd numbers of one 64-wide block
const SAMPLES = 2e6;

function lookup(bits) {
  // bit set => odd n is composite
  return n => n === 2 || (n > 2 && n % 2 === 1 && ((bits[Math.floor(n / 64)] >>> ((n % 64) >>> 1)) & 1) === 0);
}

if (isMainThread) {
  const started = Date.now();
  const log = msg => console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${msg}`);
  const buffer = new SharedArrayBuffer(WORDS * 4);
  const bits = new Uint32Array(buffer);
  bits[0] |= 1; // 1 is not prime

  const small = [];
  {
    const lim = Math.ceil(Math.sqrt(LIMIT)), comp = new Uint8Array(lim + 1);
    for (let i = 3; i <= lim; i += 2) {
      if (comp[i]) continue;
      small.push(i);
      for (let j = i * i; j <= lim; j += 2 * i) comp[j] = 1;
    }
  }

  const n = os.cpus().length;
  const blocks = Math.ceil(WORDS / n);
  const ranges = Array.from({ length: n }, (_, i) => [i * blocks * 64, Math.min(WORDS, (i + 1) * blocks) * 64]);
  const workers = ranges.map(([lo, hi], index) => new Worker(__filename, { workerData: { buffer, lo, hi, small, index } }));
  const phase = msg => Promise.all(workers.map(w => new Promise((resolve, reject) => {
    w.once('message', resolve);
    w.once('error', reject);
    w.postMessage(msg);
  })));

  (async () => {
    log(`sieving below ${LIMIT.toLocaleString()} on ${n} threads`);
    await phase({ type: 'sieve' });
    log('sieve done, scanning primes');
    const parts = await phase({ type: 'count' });

    P.isPrime = lookup(bits);
    const counts = { prime: 1 }; // 2 is the only even prime; the workers scan odd numbers
    for (const c of PRIME_COMBOS) counts[c.id] = c.cond(2, '2') ? 1 : 0;
    for (const part of parts) for (const [k, v] of Object.entries(part)) counts[k] = (counts[k] || 0) + v;
    log(`primes below 1e10: ${counts.prime}${counts.prime === 455052511 ? ' (matches pi(1e10))' : ' (WRONG, expected 455052511)'}`);

    // Prime radar: walk the gaps between consecutive primes. Inside a gap of length g, distance k
    // to the nearest prime occurs twice, except k = g/2, which occurs once.
    const dist = new Float64Array(400);
    dist[2]++; dist[1]++; // 0 and 1, whose nearest prime is 2
    dist[0] = counts.prime;
    let prev = 2;
    const addGap = (p, q) => {
      for (let k = 1; 2 * k <= q - p; k++) {
        for (const x of 2 * k === q - p ? [p + k] : [p + k, q - k]) if (x < SPACE) dist[k]++;
      }
    };
    for (let w = 0; w < WORDS; w++) {
      let free = ~bits[w];
      while (free) {
        const b = 31 - Math.clz32(free & -free);
        free &= free - 1;
        const q = w * 64 + 2 * b + 1;
        if (q < 3) continue;
        addGap(prev, q);
        prev = q;
        if (q >= SPACE) break;
      }
      if (prev >= SPACE) break;
    }
    const within = (lo, hi) => { let t = 0; for (let k = lo; k <= hi && k < dist.length; k++) t += dist[k]; return t; };
    Object.assign(counts, {
      radarNext: dist[1], radarNear: dist[2] + dist[3],
      radar20: within(20, 399), radar50: within(50, 399), radar100: within(100, 399),
    });
    const totalN = within(0, 399);
    log(`radar: every number accounted for: ${totalN === SPACE}, farthest from a prime: ${dist.findLastIndex(x => x > 0)}`);

    // Harshad: per digit sum t, count DIGITS-digit strings with sum t and value divisible by t.
    let harshad = 0;
    for (let t = 1; t <= 9 * DIGITS; t++) {
      let dp = new Float64Array((t + 1) * t);
      dp[0] = 1;
      for (let pos = 0; pos < DIGITS; pos++) {
        const next = new Float64Array((t + 1) * t);
        for (let sum = 0; sum <= t; sum++) for (let rem = 0; rem < t; rem++) {
          const c = dp[sum * t + rem];
          if (!c) continue;
          for (let d = 0; d <= 9 && sum + d <= t; d++) next[(sum + d) * t + ((rem * 10 + d) % t)] += c;
        }
        dp = next;
      }
      harshad += dp[t * t];
    }
    counts.harshad = harshad;

    log('counting the other badges');
    const game = createGame(DIGITS, { allowMissing: true });
    for (const b of game.BADGES) counts[b.id] = b.count;

    const quantiles = {};
    for (const mode of game.MODES.map(m => m.id)) {
      const per = Math.ceil(SAMPLES / n);
      const chunks = await phase({ type: 'sample', mode, per, counts });
      const all = new Float64Array(per * n);
      chunks.forEach((c, i) => all.set(c, i * per));
      all.sort();
      quantiles[mode] = game.tableFromSorted(all);
      log(`${mode}: ${all.length.toLocaleString()} rolls sampled`);
    }
    workers.forEach(w => w.terminate());

    const clean = Object.fromEntries(Object.entries(quantiles).map(([k, q]) => [k, q.map(v => (v === -Infinity ? null : +v.toPrecision(9)))]));
    const out = '// Generated by tools/build-data.js. Exact badge counts and percentile tables for 10-digit rolls.\n'
      + `globalThis.RNG_DATA = ${JSON.stringify({ digits: DIGITS, counts, quantiles: clean })};\n`;
    fs.writeFileSync(path.join(__dirname, '..', 'data.js'), out);
    log(`wrote data.js (${(out.length / 1024).toFixed(0)} KB, ${Object.keys(counts).length} counts)`);
    console.log(JSON.stringify(Object.fromEntries(['prime', 'harshad', 'radarNext', 'radarNear', 'radar20', 'radar50', 'radar100'].map(k => [k, counts[k]]))));
  })().catch(e => { console.error(e); process.exit(1); });
} else {
  const { buffer, lo, hi, small, index } = workerData;
  const bits = new Uint32Array(buffer);
  const base = lo / 64;
  let game = null;
  parentPort.on('message', msg => {
    if (msg.type === 'sieve') {
      // Mark odd multiples of each odd prime p inside [lo, hi). Ranges are 64-aligned, so no two
      // workers ever write the same word.
      for (const p of small) {
        let start = Math.max(p * p, Math.ceil(lo / p) * p);
        if (start % 2 === 0) start += p;
        for (let rel = start - lo, end = hi - lo; rel < end; rel += 2 * p) {
          bits[base + Math.floor(rel / 64)] |= 1 << ((rel % 64) >>> 1);
        }
      }
      parentPort.postMessage('done');
    } else if (msg.type === 'count') {
      P.isPrime = lookup(bits);
      const counts = Object.fromEntries([['prime', 0], ...PRIME_COMBOS.map(c => [c.id, 0])]);
      for (let w = 0, words = (hi - lo) / 64; w < words; w++) {
        let free = ~bits[base + w];
        while (free) {
          const b = 31 - Math.clz32(free & -free);
          free &= free - 1;
          const n = lo + w * 64 + 2 * b + 1;
          if (n >= SPACE) continue;
          counts.prime++;
          const s = String(n);
          for (const c of PRIME_COMBOS) if (c.cond(n, s)) counts[c.id]++;
        }
      }
      parentPort.postMessage(counts);
    } else if (msg.type === 'sample') {
      game = game || createGame(DIGITS, { counts: msg.counts });
      const job = game.sampleLogs(msg.mode, msg.per, (game.MODE_SEED[msg.mode] + index * 7919) | 0, Infinity);
      job.step();
      parentPort.postMessage(job.out, [job.out.buffer]);
    }
  });
}
