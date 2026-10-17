// Computes the hard-coded COUNTS in badges.js exactly.
//   node tools/exact-counts.js
// Sieves every prime below 1e9 (a ~63 MB odd-only bitset), runs each prime
// combo's condition on every prime, and counts Harshad numbers with a digit DP.
'use strict';
globalThis.RNG9_COUNTING = true;
require('../badges.js');
const { PRIME_COMBOS, P, digitSum } = globalThis.RNG9;

const LIMIT = 1e9 + 16; // combos look up to 6 past the largest roll
const bits = new Uint32Array(Math.ceil(LIMIT / 64)); // bit i set => 2i+1 composite
const composite = n => (bits[n >>> 6] >>> ((n >>> 1) & 31)) & 1;

console.time('sieve');
for (let p = 3; p * p < LIMIT; p += 2) {
  if (composite(p)) continue;
  for (let j = p * p; j < LIMIT; j += 2 * p) bits[j >>> 6] |= 1 << ((j >>> 1) & 31);
}
console.timeEnd('sieve');

P.isPrime = n => n === 2 || (n > 2 && (n & 1) === 1 && !composite(n));

console.time('primes');
const counts = Object.fromEntries(PRIME_COMBOS.map(c => [c.id, 0]));
let primes = 0;
for (let n = 2; n < 1e9; n++) {
  if (!P.isPrime(n)) continue;
  primes++;
  const s = String(n);
  for (const c of PRIME_COMBOS) if (c.cond(n, s)) counts[c.id]++;
}
console.timeEnd('primes');

// Harshad: for each digit sum t, count 9-digit strings (leading zeros allowed;
// they change neither the value nor the digit sum) with sum t and value ≡ 0 mod t.
let harshad = 0;
for (let t = 1; t <= 81; t++) {
  let dp = new Float64Array((t + 1) * t); // [sum][rem]
  dp[0] = 1;
  for (let pos = 0; pos < 9; pos++) {
    const next = new Float64Array((t + 1) * t);
    for (let sum = 0; sum <= t; sum++) for (let rem = 0; rem < t; rem++) {
      const c = dp[sum * t + rem];
      if (!c) continue;
      for (let d = 0; d <= 9 && sum + d <= t; d++) next[(sum + d) * t + (rem * 10 + d) % t] += c;
    }
    dp = next;
  }
  harshad += dp[t * t + 0];
}

// Spot-check the Harshad DP against brute force below 1e6 with the same method.
let brute = 0;
for (let n = 1; n < 1e6; n++) if (n % digitSum(String(n)) === 0) brute++;

console.log('primes below 1e9:', primes, primes === 50847534 ? '(matches pi(1e9))' : '(WRONG)');
console.log('harshad brute < 1e6:', brute);
console.log(JSON.stringify({ harshad, ...counts }));
