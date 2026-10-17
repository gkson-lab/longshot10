// Badge definitions and scoring for RNGdle 9.
// Rolls are integers in [0, 1e9). Every badge's probability is exact. A badge
// gets its count of qualifying numbers in one of four ways:
//   count  - derived by hand, or by tools/exact-counts.js (full prime sieve)
//   dfa    - counted over every digit string at load time
//   among  - the test is run over a finite candidate list at load time
//   set    - the badge is membership in a generated set
(function (root) {
  'use strict';

  const SPACE = 1e9;

  // ---- primality -------------------------------------------------------------

  // a*b mod m without exceeding 2^53 (a, b, m < 2^31)
  function mulmod(a, b, m) {
    return (((a * (b >>> 15)) % m) * 32768 + a * (b & 32767)) % m;
  }

  function powmod(b, e, m) {
    let r = 1;
    b %= m;
    while (e > 0) {
      if (e & 1) r = mulmod(r, b, m);
      b = mulmod(b, b, m);
      e = Math.floor(e / 2);
    }
    return r;
  }

  // Deterministic Miller-Rabin; bases 2,3,5,7 are exact below 3,215,031,751.
  function millerRabin(n) {
    if (n < 2) return false;
    for (const p of [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]) {
      if (n === p) return true;
      if (n % p === 0) return false;
    }
    let d = n - 1, r = 0;
    while (d % 2 === 0) { d /= 2; r++; }
    outer: for (const a of [2, 3, 5, 7]) {
      let x = powmod(a, d, n);
      if (x === 1 || x === n - 1) continue;
      for (let i = 1; i < r; i++) {
        x = mulmod(x, x, n);
        if (x === n - 1) continue outer;
      }
      return false;
    }
    return true;
  }

  // Swappable so tools/exact-counts.js can substitute a sieve lookup.
  const P = { isPrime: millerRabin };

  // ---- number helpers ------------------------------------------------------------

  const isSquare = n => { const r = Math.round(Math.sqrt(n)); return r * r === n; };
  const isCube = n => { const r = Math.round(Math.cbrt(n)); return r * r * r === n; };
  const digitSum = s => { let t = 0; for (const c of s) t += c.charCodeAt(0) - 48; return t; };
  const reverse = s => [...s].reverse().join('');
  const sign = x => (x > 0 ? 1 : x < 0 ? -1 : 0);

  function squareDigitSum(n) { let t = 0; for (; n > 0; n = Math.floor(n / 10)) t += (n % 10) ** 2; return t; }
  function isHappy(n) {
    if (n <= 0) return false;
    const seen = new Set();
    while (n !== 1 && !seen.has(n)) { seen.add(n); n = squareDigitSum(n); }
    return n === 1;
  }

  function maxRun(s) {
    let best = 1, run = 1;
    for (let i = 1; i < s.length; i++) {
      run = s[i] === s[i - 1] ? run + 1 : 1;
      if (run > best) best = run;
    }
    return best;
  }

  const diffs = s => [...s].slice(1).map((c, i) => c.charCodeAt(0) - s.charCodeAt(i));
  const isStrictlyMonotone = (s, dir) => diffs(s).every(d => d * dir > 0);
  const isArithmetic = s => { const d = diffs(s); return s.length >= 4 && d[0] !== 0 && d.every(x => x === d[0]); };
  const isStraight = s => isArithmetic(s) && Math.abs(s.charCodeAt(1) - s.charCodeAt(0)) === 1;
  function isPeak(s, dir) { // strictly up then strictly down (dir=1), or the reverse
    if (s.length < 5) return false;
    const d = diffs(s).map(x => sign(x) * dir);
    const turn = d.indexOf(-1);
    return turn > 0 && d.slice(0, turn).every(x => x === 1) && d.slice(turn).every(x => x === -1);
  }
  const isZigzag = s => { const d = diffs(s).map(sign); return s.length >= 5 && d.every((x, i) => x !== 0 && (i === 0 || x === -d[i - 1])); };
  const isWave = s => s.length >= 5 && s[0] !== s[1] && [...s].every((c, i) => c === s[i % 2]);
  const isDigitFib = s => s.length >= 5 && [...s].every((c, i) => i < 2 || +c === +s[i - 1] + +s[i - 2]);
  const countOf = (s, ch) => s.split(ch).length - 1;
  const distinct = s => new Set(s).size;

  // ---- generated sets ---------------------------------------------------------------

  function seq(next) { // values of next(k) for k = 0, 1, 2 … while below SPACE
    const out = new Set();
    for (let k = 0; ; k++) { const v = next(k); if (v >= SPACE) break; if (v >= 0) out.add(v); }
    return out;
  }
  function recur(a, b, f) { // linear recurrences: a, b, f(a, b) …
    const out = new Set();
    for (; a < SPACE; [a, b] = [b, f(a, b)]) out.add(a);
    return out;
  }

  const SQUARES = seq(k => k * k);
  const CUBES = seq(k => k * k * k);
  const TRI = seq(k => (k * (k + 1)) / 2);
  const TETRA = seq(k => (k * (k + 1) * (k + 2)) / 6);
  const PENT = seq(k => (k * (3 * k - 1)) / 2);
  const HEX = seq(k => k * (2 * k - 1));
  const STAR = seq(k => 6 * (k + 1) * k + 1);
  const POW2 = seq(k => 2 ** k);
  const POW3 = seq(k => 3 ** k);
  const POW10 = seq(k => 10 ** k);
  const FIB = recur(0, 1, (a, b) => a + b);
  const LUCAS = recur(2, 1, (a, b) => a + b);
  const PELL = recur(0, 1, (a, b) => 2 * b + a);
  const FACT = seq(k => { let f = 1; for (let i = 2; i <= k + 1; i++) f *= i; return f; });
  const CATALAN = seq(k => { let c = 1; for (let i = 0; i < k; i++) c = (c * 2 * (2 * i + 1)) / (i + 2); return Math.round(c); });

  const BELL = new Set();
  for (let row = [1]; row[0] < SPACE;) { // Bell triangle
    BELL.add(row[0]);
    const next = [row[row.length - 1]];
    for (const x of row) next.push(next[next.length - 1] + x);
    row = next;
  }

  const SMALL_PRIMES = [];
  for (let k = 2; k * k < SPACE; k++) if (millerRabin(k)) SMALL_PRIMES.push(k);
  const PRIME_SQUARES = new Set(SMALL_PRIMES.map(p => p * p));
  const PRIME_CUBES = new Set(SMALL_PRIMES.filter(p => p ** 3 < SPACE).map(p => p ** 3));
  const PRIMORIALS = new Set([1]);
  for (let i = 0, v = 1; (v *= SMALL_PRIMES[i]) < SPACE; i++) PRIMORIALS.add(v);

  const PERFECT_POWERS = new Set();
  for (let b = 2; b * b < SPACE; b++) for (let v = b * b; v < SPACE; v *= b) PERFECT_POWERS.add(v);

  const TAXICAB = new Set(); // sum of two positive cubes in two different ways
  {
    const seen = new Set();
    for (let a = 1; a ** 3 < SPACE; a++) for (let b = a; a ** 3 + b ** 3 < SPACE; b++) {
      const v = a ** 3 + b ** 3;
      if (seen.has(v)) TAXICAB.add(v); else seen.add(v);
    }
  }

  // Known-complete lists below 1e9 (checked by tools/check.js).
  const ARMSTRONG = new Set([153, 370, 371, 407, 1634, 8208, 9474, 54748, 92727, 93084, 548834, 1741725,
    4210818, 9800817, 9926315, 24678050, 24678051, 88593477, 146511208, 472335975, 534494836, 912985153]);
  const AUTOMORPHIC = new Set([25, 76, 376, 625, 9376, 90625, 109376, 890625, 2890625, 7109376,
    12890625, 87109376, 212890625, 787109376]);
  const SELF_DESCRIBING = new Set([1210, 2020, 21200, 3211000, 42101000, 521001000]);
  const PERFECT = new Set([6, 28, 496, 8128, 33550336]);
  const KAPREKAR = new Set([495, 6174]);
  const MEMES = new Set([42, 69, 420, 666, 1337, 9001, 80085, 5318008, 8008135]);

  const PALINDROMES = [];
  for (let len = 1; len <= 9; len++) {
    const half = Math.ceil(len / 2);
    for (let h = len === 1 ? 0 : 10 ** (half - 1); h < 10 ** half; h++) {
      const hs = String(h);
      PALINDROMES.push(+(hs + reverse(hs).slice(len % 2)));
    }
  }
  const REPDIGITS = [];
  for (let len = 2; len <= 9; len++) for (let d = 1; d <= 9; d++) REPDIGITS.push(+String(d).repeat(len));
  const STRAIGHTS = [];
  for (let len = 4; len <= 9; len++) for (let a = 0; a <= 9; a++) for (const step of [1, -1]) {
    const z = a + step * (len - 1);
    if (a > 0 && z >= 0 && z <= 9) STRAIGHTS.push(+Array.from({ length: len }, (_, i) => a + step * i).join(''));
  }

  // ---- exact counting over digit strings ---------------------------------------------
  // Counts n in [0, 1e9) whose decimal string (no leading zeros) drives the
  // automaton into an accepting state. `key` maps a state to a Map key.
  function countByDfa({ init, step, accept, key = String }) {
    const add = (m, st, c) => { const k = key(st); const e = m.get(k); if (e) e[1] += c; else m.set(k, [st, c]); };
    let total = accept(step(init, 0)) ? 1 : 0; // the number 0
    let cur = new Map();
    for (let d = 1; d <= 9; d++) add(cur, step(init, d), 1);
    for (let len = 1; len <= 9; len++) {
      for (const [st, c] of cur.values()) if (accept(st)) total += c;
      if (len === 9) break;
      const next = new Map();
      for (const [st, c] of cur.values()) for (let d = 0; d <= 9; d++) add(next, step(st, d), c);
      cur = next;
    }
    return total;
  }

  const DEAD = 'x';

  // KMP automaton for "contains `pat`"; state -1 = matched.
  function containsDfa(pat) {
    const p = [...pat].map(Number);
    const fail = [0];
    for (let i = 1, k = 0; i < p.length; i++) {
      while (k && p[i] !== p[k]) k = fail[k - 1];
      if (p[i] === p[k]) k++;
      fail[i] = k;
    }
    return {
      init: 0,
      step(k, d) {
        if (k === -1) return -1;
        while (k && d !== p[k]) k = fail[k - 1];
        if (d === p[k]) k++;
        return k === p.length ? -1 : k;
      },
      accept: k => k === -1,
    };
  }

  function andDfa(a, b) {
    const ka = a.key || String, kb = b.key || String;
    return {
      init: [a.init, b.init],
      step: ([x, y], d) => [a.step(x, d), b.step(y, d)],
      accept: ([x, y]) => a.accept(x) && b.accept(y),
      key: ([x, y]) => ka(x) + '~' + kb(y),
    };
  }

  // Generic "walk the digits keeping a small record" automaton. `step(rec, d)`
  // returns the next record or DEAD; records are plain arrays of small ints.
  function recDfa(init, step, accept) {
    return {
      init,
      step: (r, d) => (r === DEAD ? DEAD : step(r, d)),
      accept: r => r !== DEAD && accept(r),
      key: r => (r === DEAD ? DEAD : r.join(',')),
    };
  }

  const runDfa = need => recDfa([-1, 0, 0], ([last, run, best], d) => {
    const r = Math.min(need, d === last ? run + 1 : 1);
    return [d, r, Math.max(r, best)];
  }, ([, , best]) => best >= need);

  const onlyDigitsDfa = allowed => recDfa([], (r, d) => (allowed.includes(d) ? r : DEAD), () => true);
  const digitSumDfa = pred => recDfa([0], ([t], d) => [t + d], ([t]) => pred(t));
  const digitCountDfa = (digit, min) => recDfa([0], ([k], d) => [Math.min(min, k + (d === digit))], ([k]) => k >= min);
  const distinctDfa = (k, minLen) => recDfa([0, 0], ([mask, len], d) => [mask | (1 << d), Math.min(minLen, len + 1)],
    ([mask, len]) => len >= minLen && popcount(mask) === k);
  const happyDfa = recDfa([0], ([t], d) => [t + d * d], ([t]) => isHappy(t));
  const bookendsDfa = recDfa([-1, -1, 0], ([f, , len], d) => [len ? f : d, d, Math.min(2, len + 1)],
    ([f, l, len]) => len >= 2 && f === l);
  const lenAtLeast = (r, n) => Math.min(n, r + 1);

  const arithDfa = recDfa([-1, 99, 0], ([last, diff, len], d) => {
    if (len === 0) return [d, 99, 1];
    if (len === 1) return d === last ? DEAD : [d, d - last, 2];
    return d - last === diff ? [d, diff, lenAtLeast(len, 4)] : DEAD;
  }, ([, , len]) => len >= 4);

  const straightDfa = recDfa([-1, 99, 0], ([last, diff, len], d) => {
    if (len === 0) return [d, 99, 1];
    if (len === 1) return Math.abs(d - last) === 1 ? [d, d - last, 2] : DEAD;
    return d - last === diff ? [d, diff, lenAtLeast(len, 4)] : DEAD;
  }, ([, , len]) => len >= 4);

  const monotoneDfa = (dir, minLen, strict = true) => recDfa([-1, 0], ([last, len], d) => {
    if (len === 0) return [d, 1];
    const x = (d - last) * dir;
    return x > 0 || (!strict && x === 0) ? [d, lenAtLeast(len, minLen)] : DEAD;
  }, ([, len]) => len >= minLen);

  const peakDfa = dir => recDfa([-1, 0, 0], ([last, phase, len], d) => { // phase 0 start, 1 rising, 2 falling
    if (len === 0) return [d, 0, 1];
    const x = sign(d - last) * dir;
    if (x === 0) return DEAD;
    if (phase === 0) return x > 0 ? [d, 1, 2] : DEAD;
    if (phase === 1) return [d, x > 0 ? 1 : 2, lenAtLeast(len, 5)];
    return x < 0 ? [d, 2, lenAtLeast(len, 5)] : DEAD;
  }, ([, phase, len]) => phase === 2 && len >= 5);

  const zigzagDfa = recDfa([-1, 0, 0], ([last, dir, len], d) => {
    if (len === 0) return [d, 0, 1];
    const x = sign(d - last);
    if (x === 0 || x === dir) return DEAD;
    return [d, x, lenAtLeast(len, 5)];
  }, ([, , len]) => len >= 5);

  const waveDfa = recDfa([-1, -1, 0], ([p2, p1, len], d) => {
    if (len === 0) return [-1, d, 1];
    if (len === 1) return d === p1 ? DEAD : [p1, d, 2];
    return d === p2 ? [p1, d, lenAtLeast(len, 5)] : DEAD;
  }, ([, , len]) => len >= 5);

  const digitFibDfa = recDfa([-1, -1, 0], ([p2, p1, len], d) => {
    if (len < 2) return [p1, d, len + 1];
    return d === p2 + p1 ? [p1, d, lenAtLeast(len, 5)] : DEAD;
  }, ([, , len]) => len >= 5);

  const checkerDfa = recDfa([-1, 0], ([par, len], d) => (len && d % 2 === par ? DEAD : [d % 2, len + 1]), ([, len]) => len === 9);

  function popcount(x) { let c = 0; while (x) { c += x & 1; x >>>= 1; } return c; }

  // ---- badges -------------------------------------------------------------------------
  // Tests receive (n, s, c): the roll, its decimal string, and { prime, date }.
  // `group`: when several badges of one group are earned, only the rarest counts.

  const CATEGORIES = ['Size', 'Math', 'Sequences', 'Digits', 'Memes', 'Combos', 'Daily'];

  const LENGTH_NAMES = ['', 'Single Digit', 'Two Digits', 'Three Digits', 'Four Digits',
    'Five Digits', 'Six Digits', 'Seven Digits', 'Eight Digits'];

  const has = set => n => set.has(n);
  const contains = (id, pat, name, desc) => ({ id, cat: 'Memes', name, desc: desc || `Contains ${pat}`, dfa: containsDfa(pat), test: (n, s) => s.includes(pat) });

  // Exact counts from tools/exact-counts.js (sieve of every prime below 1e9).
  const COUNTS = {
    harshad: 61574509, twin: 6849011, cousin: 6849359, sexy: 12939931, emirp: 4809260,
    primeSum: 18661619, purePrime: 23169, luckyPrime: 391417, beastPrime: 278019,
    nicePrime: 4658435, leetPrime: 38200, uniqPrime: 145227, happyPrime: 7408754,
  };

  // Prime-only combos: the badge is `prime && cond`. Counted by the sieve tool.
  const PRIME_COMBOS = [
    { id: 'twin', name: 'Twin Prime', desc: 'A prime with another prime 2 away', cond: n => P.isPrime(n - 2) || P.isPrime(n + 2) },
    { id: 'cousin', name: 'Cousin Prime', desc: 'A prime with another prime 4 away', cond: n => P.isPrime(n - 4) || P.isPrime(n + 4) },
    { id: 'sexy', name: 'Sexy Prime', desc: 'A prime with another prime 6 away', cond: n => P.isPrime(n - 6) || P.isPrime(n + 6) },
    { id: 'emirp', name: 'Emirp', desc: 'A prime that is a different prime backwards', cond: (n, s) => { const r = +reverse(s); return r !== n && P.isPrime(r); } },
    { id: 'primeSum', name: 'Prime Inside and Out', desc: 'A prime whose digits add up to a prime', cond: (n, s) => P.isPrime(digitSum(s)) },
    { id: 'purePrime', name: 'Pure Prime', desc: 'A prime made only of the digits 2, 3, 5 and 7', cond: (n, s) => /^[2357]+$/.test(s) },
    { id: 'luckyPrime', name: 'Lucky Prime', desc: 'A prime containing 777', cond: (n, s) => s.includes('777') },
    { id: 'beastPrime', name: 'Prime Evil', desc: 'A prime containing 666', cond: (n, s) => s.includes('666') },
    { id: 'nicePrime', name: 'Nice Prime', desc: 'A prime containing 69', cond: (n, s) => s.includes('69') },
    { id: 'leetPrime', name: 'Leet Prime', desc: 'A prime containing 1337', cond: (n, s) => s.includes('1337') },
    { id: 'uniqPrime', name: 'Pristine Prime', desc: 'A nine-digit prime with no repeated digit', cond: (n, s) => s.length === 9 && distinct(s) === 9 },
    { id: 'happyPrime', name: 'Happy Prime', desc: 'A prime that is also a happy number', cond: n => isHappy(n) },
  ];

  const BADGES = [
    // Size
    { id: 'zero', cat: 'Size', name: 'Absolute Zero', desc: 'Rolled exactly 0', group: 'size', count: 1, test: n => n === 0 },
    ...LENGTH_NAMES.slice(1).map((name, i) => ({
      id: 'len' + (i + 1), cat: 'Size', name, group: 'size',
      desc: i === 0 ? 'A number from 1 to 9' : `A number with only ${i + 1} digits`,
      count: 9 * 10 ** i,
      test: (n, s) => n > 0 && s.length === i + 1,
    })),
    { id: 'top1', cat: 'Size', name: 'High Roller', desc: '990,000,000 or more', group: 'top', count: 1e7, test: n => n >= 990000000 },
    { id: 'top2', cat: 'Size', name: 'Sky High', desc: '999,000,000 or more', group: 'top', count: 1e6, test: n => n >= 999000000 },
    { id: 'top3', cat: 'Size', name: 'Stratosphere', desc: '999,999,000 or more', group: 'top', count: 1000, test: n => n >= 999999000 },
    { id: 'center', cat: 'Size', name: 'Dead Center', desc: 'Within 500 of 500,000,000', count: 999, test: n => Math.abs(n - 5e8) < 500 },

    // Math
    { id: 'prime', cat: 'Math', name: 'Prime', desc: 'Divisible only by 1 and itself', count: 50847534, test: (n, s, c) => c.prime },
    { id: 'harshad', cat: 'Math', name: 'Harshad', desc: 'Divisible by the sum of its digits', count: COUNTS.harshad, test: (n, s) => n > 0 && n % digitSum(s) === 0 },
    { id: 'happy', cat: 'Math', name: 'Happy Number', desc: 'Summing the squares of its digits over and over reaches 1', dfa: happyDfa, test: n => isHappy(n) },
    { id: 'square', cat: 'Math', name: 'Perfect Square', desc: 'Some whole number squared', group: 'power', set: SQUARES, test: has(SQUARES) },
    { id: 'cube', cat: 'Math', name: 'Perfect Cube', desc: 'Some whole number cubed', group: 'power', set: CUBES, test: has(CUBES) },
    { id: 'ppower', cat: 'Math', name: 'Perfect Power', desc: 'A whole number raised to the 2nd power or higher', group: 'power', set: PERFECT_POWERS, test: has(PERFECT_POWERS) },
    { id: 'pow2', cat: 'Math', name: 'Power of Two', desc: '1, 2, 4, 8, 16…', set: POW2, test: has(POW2) },
    { id: 'pow3', cat: 'Math', name: 'Power of Three', desc: '1, 3, 9, 27, 81…', set: POW3, test: has(POW3) },
    { id: 'pow10', cat: 'Math', name: 'Power of Ten', desc: '1, 10, 100, 1000…', set: POW10, test: has(POW10) },
    { id: 'pSquare', cat: 'Math', name: 'Prime Squared', desc: 'The square of a prime', set: PRIME_SQUARES, test: has(PRIME_SQUARES) },
    { id: 'pCube', cat: 'Math', name: 'Prime Cubed', desc: 'The cube of a prime', set: PRIME_CUBES, test: has(PRIME_CUBES) },
    { id: 'fact', cat: 'Math', name: 'Factorial', desc: 'k! for some k', set: FACT, test: has(FACT) },
    { id: 'primorial', cat: 'Math', name: 'Primorial', desc: 'The product of the first few primes', set: PRIMORIALS, test: has(PRIMORIALS) },
    { id: 'perfect', cat: 'Math', name: 'Perfect', desc: 'Equal to the sum of its divisors: 6, 28, 496…', set: PERFECT, test: has(PERFECT) },
    { id: 'taxicab', cat: 'Math', name: 'Taxicab', desc: 'The sum of two cubes in two different ways, like 1729', set: TAXICAB, test: has(TAXICAB) },
    { id: 'armstrong', cat: 'Math', name: 'Narcissistic', desc: 'Equal to the sum of its digits, each raised to the number of digits', set: ARMSTRONG, test: has(ARMSTRONG) },
    { id: 'automorphic', cat: 'Math', name: 'Automorphic', desc: 'Its square ends in itself, like 76² = 5776', set: AUTOMORPHIC, test: has(AUTOMORPHIC) },
    { id: 'kaprekar', cat: 'Math', name: "Kaprekar's Constant", desc: '495 or 6174', set: KAPREKAR, test: has(KAPREKAR) },
    { id: 'selfdesc', cat: 'Math', name: 'Self-Describing', desc: 'Digit k counts how many k digits it has, like 2020', set: SELF_DESCRIBING, test: has(SELF_DESCRIBING) },
    { id: 'div3', cat: 'Math', name: 'Divisible by Three', desc: 'A multiple of 3', group: 'div3', count: 333333334, test: n => n % 3 === 0 },
    { id: 'div9', cat: 'Math', name: 'Divisible by Nine', desc: 'A multiple of 9', group: 'div3', count: 111111112, test: n => n % 9 === 0 },
    { id: 'div7', cat: 'Math', name: 'Divisible by Seven', desc: 'A multiple of 7', count: 142857143, test: n => n % 7 === 0 },
    { id: 'div11', cat: 'Math', name: 'Divisible by Eleven', desc: 'A multiple of 11', count: 90909091, test: n => n % 11 === 0 },
    { id: 'div13', cat: 'Math', name: "Baker's Dozen", desc: 'A multiple of 13', count: 76923077, test: n => n % 13 === 0 },
    { id: 'lcm9', cat: 'Math', name: 'Highly Divisible', desc: 'Divisible by every number from 1 to 9', group: 'lcm', count: 396826, test: n => n % 2520 === 0 },
    { id: 'lcm12', cat: 'Math', name: 'Super Divisible', desc: 'Divisible by every number from 1 to 12', group: 'lcm', count: 36076, test: n => n % 27720 === 0 },
    { id: 'lcm15', cat: 'Math', name: 'Ultra Divisible', desc: 'Divisible by every number from 1 to 15', group: 'lcm', count: 2776, test: n => n % 360360 === 0 },
    { id: 'r100', cat: 'Math', name: 'Round Hundred', desc: 'Ends in 00', group: 'round', count: 1e7, test: n => n % 100 === 0 },
    { id: 'r1k', cat: 'Math', name: 'Round Thousand', desc: 'Ends in 000', group: 'round', count: 1e6, test: n => n % 1000 === 0 },
    { id: 'r10k', cat: 'Math', name: 'Round Ten Thousand', desc: 'Ends in 0000', group: 'round', count: 1e5, test: n => n % 10000 === 0 },
    { id: 'r1m', cat: 'Math', name: 'Round Million', desc: 'Ends in 000000', group: 'round', count: 1000, test: n => n % 1e6 === 0 },
    { id: 'almost', cat: 'Math', name: 'Almost Round', desc: 'Ends in 999', count: 1e6, test: n => n % 1000 === 999 },
    { id: 'offby1', cat: 'Math', name: 'Off by One', desc: 'One away from a whole million', count: 2000, test: n => n % 1e6 === 1 || n % 1e6 === 999999 },

    // Sequences
    { id: 'fib', cat: 'Sequences', name: 'Fibonacci', desc: '0, 1, 1, 2, 3, 5, 8, 13…', set: FIB, test: has(FIB) },
    { id: 'lucas', cat: 'Sequences', name: 'Lucas', desc: '2, 1, 3, 4, 7, 11, 18…', set: LUCAS, test: has(LUCAS) },
    { id: 'pell', cat: 'Sequences', name: 'Pell', desc: '0, 1, 2, 5, 12, 29, 70…', set: PELL, test: has(PELL) },
    { id: 'catalan', cat: 'Sequences', name: 'Catalan', desc: '1, 2, 5, 14, 42, 132…', set: CATALAN, test: has(CATALAN) },
    { id: 'bell', cat: 'Sequences', name: 'Bell', desc: '1, 2, 5, 15, 52, 203…', set: BELL, test: has(BELL) },
    { id: 'tri', cat: 'Sequences', name: 'Triangular', desc: '1 + 2 + 3 + … + k for some k', group: 'tri', set: TRI, test: has(TRI) },
    { id: 'hex', cat: 'Sequences', name: 'Hexagonal', desc: '1, 6, 15, 28, 45…', group: 'tri', set: HEX, test: has(HEX) },
    { id: 'pent', cat: 'Sequences', name: 'Pentagonal', desc: '1, 5, 12, 22, 35…', set: PENT, test: has(PENT) },
    { id: 'tetra', cat: 'Sequences', name: 'Tetrahedral', desc: 'A stack of triangles: 1, 4, 10, 20, 35…', set: TETRA, test: has(TETRA) },
    { id: 'star', cat: 'Sequences', name: 'Star Number', desc: '1, 13, 37, 73, 121…', set: STAR, test: has(STAR) },

    // Digits
    { id: 'pal', cat: 'Digits', name: 'Palindrome', desc: 'Reads the same backwards', count: PALINDROMES.length, test: (n, s) => s === reverse(s) },
    { id: 'rep', cat: 'Digits', name: 'Repdigit', desc: 'Two or more digits, all the same', count: REPDIGITS.length, test: (n, s) => s.length > 1 && /^(\d)\1+$/.test(s) },
    { id: 'straight', cat: 'Digits', name: 'Straight', desc: 'Four or more consecutive digits, like 3456 or 9876', group: 'order', dfa: straightDfa, test: (n, s) => isStraight(s) },
    { id: 'arith', cat: 'Digits', name: 'Arithmetic', desc: 'Four or more digits climbing in equal steps, like 2468', group: 'order', dfa: arithDfa, test: (n, s) => isArithmetic(s) },
    { id: 'asc', cat: 'Digits', name: 'Staircase Up', desc: 'Three or more digits, each higher than the last', group: 'order', dfa: monotoneDfa(1, 3), test: (n, s) => s.length >= 3 && isStrictlyMonotone(s, 1) },
    { id: 'desc', cat: 'Digits', name: 'Staircase Down', desc: 'Three or more digits, each lower than the last', group: 'order', dfa: monotoneDfa(-1, 3), test: (n, s) => s.length >= 3 && isStrictlyMonotone(s, -1) },
    { id: 'sorted', cat: 'Digits', name: 'Sorted', desc: 'Nine digits that never go down', group: 'order', dfa: monotoneDfa(1, 9, false), test: (n, s) => s.length === 9 && s === [...s].sort().join('') },
    { id: 'mountain', cat: 'Digits', name: 'Mountain', desc: 'Five or more digits that rise, then fall', dfa: peakDfa(1), test: (n, s) => isPeak(s, 1) },
    { id: 'valley', cat: 'Digits', name: 'Valley', desc: 'Five or more digits that fall, then rise', dfa: peakDfa(-1), test: (n, s) => isPeak(s, -1) },
    { id: 'zigzag', cat: 'Digits', name: 'Zigzag', desc: 'Five or more digits going up, down, up, down', dfa: zigzagDfa, test: (n, s) => isZigzag(s) },
    { id: 'wave', cat: 'Digits', name: 'Wave', desc: 'Two digits taking turns, like 37373', dfa: waveDfa, test: (n, s) => isWave(s) },
    { id: 'digitfib', cat: 'Digits', name: 'Digit Fibonacci', desc: 'Each digit is the sum of the two before it, like 11235', dfa: digitFibDfa, test: (n, s) => isDigitFib(s) },
    { id: 'checker', cat: 'Digits', name: 'Checkerboard', desc: 'Nine digits alternating odd and even', dfa: checkerDfa, test: (n, s) => s.length === 9 && [...s].every((c, i) => i === 0 || c % 2 !== s[i - 1] % 2) },
    { id: 'bookends', cat: 'Digits', name: 'Bookends', desc: 'Starts and ends with the same digit', dfa: bookendsDfa, test: (n, s) => s.length > 1 && s[0] === s[s.length - 1] },
    { id: 'echo', cat: 'Digits', name: 'Echo', desc: 'The second half repeats the first, like 4747', group: 'echo', count: 9999, test: (n, s) => s.length % 2 === 0 && s.slice(0, s.length / 2) === s.slice(s.length / 2) },
    { id: 'echo3', cat: 'Digits', name: 'Triple Echo', desc: 'Three digits said three times, like 581581581', group: 'echo', count: 900, test: (n, s) => s.length === 9 && s.slice(0, 3).repeat(3) === s },
    { id: 'pairs', cat: 'Digits', name: 'Pair Parade', desc: 'Eight digits in doubled pairs, like 11447799', count: 9000, test: (n, s) => /^(\d)\1(\d)\2(\d)\3(\d)\4$/.test(s) },
    { id: 'uniq', cat: 'Digits', name: 'No Repeats', desc: 'Nine digits, all different', count: 3265920, test: (n, s) => s.length === 9 && distinct(s) === 9 },
    { id: 'nozero', cat: 'Digits', name: 'Zero-Free', desc: 'Nine digits and not a single 0', count: 9 ** 9, test: (n, s) => s.length === 9 && !s.includes('0') },
    { id: 'zeros', cat: 'Digits', name: 'Mostly Empty', desc: 'Six or more zeros', dfa: digitCountDfa(0, 6), test: (n, s) => countOf(s, '0') >= 6 },
    { id: 'lonely', cat: 'Digits', name: 'Lonely Digit', desc: 'One non-zero digit followed only by zeros', count: 81, test: (n, s) => /^[1-9]0+$/.test(s) },
    { id: 'run3', cat: 'Digits', name: 'Triple', desc: 'The same digit three times in a row', group: 'run', dfa: runDfa(3), test: (n, s) => maxRun(s) >= 3 },
    { id: 'run4', cat: 'Digits', name: 'Quad', desc: 'The same digit four times in a row', group: 'run', dfa: runDfa(4), test: (n, s) => maxRun(s) >= 4 },
    { id: 'run5', cat: 'Digits', name: 'Quint', desc: 'The same digit five times in a row', group: 'run', dfa: runDfa(5), test: (n, s) => maxRun(s) >= 5 },
    { id: 'run7', cat: 'Digits', name: 'Avalanche', desc: 'The same digit seven or more times in a row', group: 'run', dfa: runDfa(7), test: (n, s) => maxRun(s) >= 7 },
    { id: 'odd', cat: 'Digits', name: 'Odd Digits Only', desc: 'Every digit is 1, 3, 5, 7 or 9', dfa: onlyDigitsDfa([1, 3, 5, 7, 9]), test: (n, s) => /^[13579]+$/.test(s) },
    { id: 'even', cat: 'Digits', name: 'Even Digits Only', desc: 'Every digit is 0, 2, 4, 6 or 8', dfa: onlyDigitsDfa([0, 2, 4, 6, 8]), test: (n, s) => /^[02468]+$/.test(s) },
    { id: 'primeDigits', cat: 'Digits', name: 'Prime Digits Only', desc: 'Every digit is 2, 3, 5 or 7', dfa: onlyDigitsDfa([2, 3, 5, 7]), test: (n, s) => /^[2357]+$/.test(s) },
    { id: 'low', cat: 'Digits', name: 'Small Fry', desc: 'Every digit is 4 or less', dfa: onlyDigitsDfa([0, 1, 2, 3, 4]), test: (n, s) => /^[0-4]+$/.test(s) },
    { id: 'high', cat: 'Digits', name: 'Big Digits', desc: 'Every digit is 5 or more', dfa: onlyDigitsDfa([5, 6, 7, 8, 9]), test: (n, s) => /^[5-9]+$/.test(s) },
    { id: 'bin', cat: 'Digits', name: 'Looks Binary', desc: 'Only the digits 0 and 1', dfa: onlyDigitsDfa([0, 1]), test: (n, s) => /^[01]+$/.test(s) },
    { id: 'duo', cat: 'Digits', name: 'Two-Tone', desc: 'Four or more digits, using exactly two different ones', dfa: distinctDfa(2, 4), test: (n, s) => s.length >= 4 && distinct(s) === 2 },
    { id: 'trio', cat: 'Digits', name: 'Three-Tone', desc: 'Six or more digits, using exactly three different ones', dfa: distinctDfa(3, 6), test: (n, s) => s.length >= 6 && distinct(s) === 3 },
    { id: 'sevens', cat: 'Digits', name: 'Seven Heaven', desc: 'Four or more 7s anywhere', dfa: digitCountDfa(7, 4), test: (n, s) => countOf(s, '7') >= 4 },
    { id: 'light', cat: 'Digits', name: 'Featherweight', desc: 'Digits add up to 5 or less', dfa: digitSumDfa(t => t <= 5), test: (n, s) => digitSum(s) <= 5 },
    { id: 'heavy', cat: 'Digits', name: 'Heavyweight', desc: 'Digits add up to 70 or more', dfa: digitSumDfa(t => t >= 70), test: (n, s) => digitSum(s) >= 70 },
    { id: 'pi', cat: 'Digits', name: 'Slice of Pi', desc: 'Starts with 31415', group: 'const', count: 11111, test: (n, s) => s.startsWith('31415') },
    { id: 'euler', cat: 'Digits', name: "Euler's e", desc: 'Starts with 27182', group: 'const', count: 11111, test: (n, s) => s.startsWith('27182') },
    { id: 'root2', cat: 'Digits', name: 'Root Two', desc: 'Starts with 14142', group: 'const', count: 11111, test: (n, s) => s.startsWith('14142') },
    { id: 'phi', cat: 'Digits', name: 'Golden', desc: 'Starts with 1618', group: 'const', count: 111111, test: (n, s) => s.startsWith('1618') },

    // Memes
    contains('c42', '42', 'The Answer'),
    contains('c69', '69', 'Nice'),
    contains('c420', '420', 'Blaze It'),
    contains('c404', '404', 'Not Found'),
    contains('c666', '666', 'Beast'),
    contains('c777', '777', 'Jackpot'),
    contains('c007', '007', 'Licensed to Kill'),
    contains('c911', '911', 'Emergency'),
    contains('c123', '123', 'Easy as 123'),
    contains('c314', '314', 'Pi Day'),
    contains('c247', '247', 'Around the Clock', 'Contains 247'),
    contains('c365', '365', 'All Year Long'),
    contains('c1337', '1337', 'Leet'),
    contains('c1984', '1984', 'Big Brother'),
    contains('c8008', '8008', 'Calculator Humor'),
    contains('c6969', '6969', 'Very Nice'),
    contains('c8675309', '8675309', 'Jenny', "Contains 8675309, Jenny's number"),
    { id: 'meme', cat: 'Memes', name: 'Meme Number', desc: 'Exactly 42, 69, 420, 666, 1337, 9001, 80085, 5318008 or 8008135', set: MEMES, test: has(MEMES) },

    // Combos
    { id: 'palprime', cat: 'Combos', name: 'Palprime', desc: 'A palindrome that is prime', among: PALINDROMES, test: (n, s, c) => c.prime && s === reverse(s) },
    { id: 'palsquare', cat: 'Combos', name: 'Mirror Square', desc: 'A palindrome that is a perfect square', among: SQUARES, test: (n, s) => SQUARES.has(n) && s === reverse(s) },
    { id: 'palcube', cat: 'Combos', name: 'Mirror Cube', desc: 'A palindrome that is a perfect cube', among: CUBES, test: (n, s) => CUBES.has(n) && s === reverse(s) },
    { id: 'paltri', cat: 'Combos', name: 'Mirror Triangle', desc: 'A palindrome that is triangular', among: TRI, test: (n, s) => TRI.has(n) && s === reverse(s) },
    { id: 'palhappy', cat: 'Combos', name: 'Happy Palindrome', desc: 'A palindrome that is a happy number', among: PALINDROMES, test: (n, s) => s === reverse(s) && isHappy(n) },
    { id: 'fibprime', cat: 'Combos', name: 'Fibonacci Prime', desc: 'A Fibonacci number that is prime', among: FIB, test: (n, s, c) => c.prime && FIB.has(n) },
    { id: 'sqtri', cat: 'Combos', name: 'Square Triangle', desc: 'Both a perfect square and triangular', among: TRI, test: n => TRI.has(n) && SQUARES.has(n) },
    { id: 'repprime', cat: 'Combos', name: 'Repunit Prime', desc: 'A repdigit that is prime', among: REPDIGITS, test: (n, s, c) => c.prime && s.length > 1 && /^(\d)\1+$/.test(s) },
    { id: 'straightprime', cat: 'Combos', name: 'Prime Straight', desc: 'A straight that is prime, like 4567', among: STRAIGHTS, test: (n, s, c) => c.prime && isStraight(s) },
    ...PRIME_COMBOS.map(pc => ({
      id: pc.id, cat: 'Combos', name: pc.name, desc: pc.desc, count: COUNTS[pc.id],
      test: (n, s, c) => c.prime && pc.cond(n, s),
    })),
    { id: 'niceblaze', cat: 'Combos', name: 'Nice and Blazed', desc: 'Contains both 69 and 420', dfa: andDfa(containsDfa('69'), containsDfa('420')), test: (n, s) => s.includes('69') && s.includes('420') },
    { id: 'heavenhell', cat: 'Combos', name: 'Heaven and Hell', desc: 'Contains both 666 and 777', dfa: andDfa(containsDfa('666'), containsDfa('777')), test: (n, s) => s.includes('666') && s.includes('777') },
    { id: 'answernice', cat: 'Combos', name: 'Life, the Universe and Nice', desc: 'Contains both 42 and 69', dfa: andDfa(containsDfa('42'), containsDfa('69')), test: (n, s) => s.includes('42') && s.includes('69') },
    { id: 'oddtriple', cat: 'Combos', name: 'Odd Triple', desc: 'Odd digits only, with three in a row', dfa: andDfa(onlyDigitsDfa([1, 3, 5, 7, 9]), runDfa(3)), test: (n, s) => /^[13579]+$/.test(s) && maxRun(s) >= 3 },
    { id: 'happyheavy', cat: 'Combos', name: 'Heavy Heart', desc: 'A happy number whose digits add up to 60 or more', dfa: andDfa(happyDfa, digitSumDfa(t => t >= 60)), test: (n, s) => isHappy(n) && digitSum(s) >= 60 },
    {
      id: 'jackpot2', cat: 'Combos', name: 'Double Jackpot', desc: 'Contains 777 twice, without sharing a 7',
      // [length of the current run of 7s mod 3, triples completed so far]
      dfa: recDfa([0, 0], ([r, t], d) => (d === 7 ? [(r + 1) % 3, Math.min(2, t + (r === 2))] : [0, t]), ([, t]) => t >= 2),
      test: (n, s) => /777.*777/.test(s),
    },
  ];

  // Daily badges depend on the date the roll was made.
  const datedCache = new Map();
  function datedBadges(date) {
    if (!date) return [];
    if (datedCache.has(date)) return datedCache.get(date);
    const [y, m, d] = date.split('-');
    const mmdd = m + d;
    const list = [
      { id: 'calendar', cat: 'Daily', name: 'Calendar', desc: `Contains the month and day of the roll (${mmdd})`, dfa: containsDfa(mmdd), test: (n, s) => s.includes(mmdd) },
      { id: 'year', cat: 'Daily', name: 'Year Stamp', desc: `Contains the year of the roll (${y})`, dfa: containsDfa(y), test: (n, s) => s.includes(y) },
    ];
    list.forEach(finish);
    datedCache.set(date, list);
    return list;
  }

  const RARITIES = [
    { id: 'common', name: 'Common', min: 0.1 },
    { id: 'uncommon', name: 'Uncommon', min: 0.01 },
    { id: 'rare', name: 'Rare', min: 0.001 },
    { id: 'epic', name: 'Epic', min: 0.0001 },
    { id: 'anomaly', name: 'Anomaly', min: 0.00001 },
    { id: 'mythic', name: 'Mythic', min: 0 },
  ];

  function finish(b) {
    if (b.dfa) b.count = countByDfa(b.dfa);
    else if (b.set) b.count = b.set.size;
    else if (b.among) b.count = [...b.among].filter(n => b.test(n, String(n), { prime: P.isPrime(n) })).length;
    b.p = b.count / SPACE;
    b.ep = Math.round(1 / b.p);
    b.rarity = RARITIES.findIndex(r => b.p > r.min);
  }

  function init() {
    for (const b of BADGES) {
      finish(b);
      if (!(b.count > 0) && !root.RNG9_COUNTING) throw new Error('badge has no count: ' + b.id);
    }
  }

  // Badges earned by n on `date`, rarest first, group duplicates collapsed.
  function evaluate(n, date) {
    const s = String(n);
    const c = { prime: P.isPrime(n), date };
    const hits = BADGES.concat(datedBadges(date)).filter(b => b.test(n, s, c)).sort((a, b) => a.p - b.p);
    const seen = new Set();
    return hits.filter(b => {
      if (!b.group) return true;
      if (seen.has(b.group)) return false;
      seen.add(b.group);
      return true;
    });
  }

  function score(n, date) {
    const badges = evaluate(n, date);
    return { n, badges, ep: badges.reduce((t, b) => t + b.ep, 0) };
  }

  // ---- roll rarity -------------------------------------------------------------------------
  // EP distribution of all rolls, estimated from a fixed-seed sample so every
  // player sees the same percentiles.
  const ROLL_TIERS = [
    { id: 'trash', name: 'Trash', below: 1 },
    { id: 'common', name: 'Common', below: 50 },
    { id: 'uncommon', name: 'Uncommon', below: 75 },
    { id: 'rare', name: 'Rare', below: 90 },
    { id: 'epic', name: 'Epic', below: 95 },
    { id: 'anomaly', name: 'Anomaly', below: 99 },
    { id: 'mythic', name: 'Mythic', below: Infinity },
  ];

  let sample = null;
  function distribution() {
    if (sample) return sample;
    let seed = 0x9e3779b9;
    const rand = () => { // mulberry32
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const eps = new Float64Array(60000);
    for (let i = 0; i < eps.length; i++) eps[i] = score(Math.floor(rand() * SPACE)).ep;
    eps.sort();
    return (sample = eps);
  }

  // Mid-rank percentile, so rolls that tie land in the middle of their tie.
  function percentile(ep) {
    const d = distribution();
    const bound = strict => {
      let lo = 0, hi = d.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (strict ? d[m] < ep : d[m] <= ep) lo = m + 1; else hi = m; }
      return lo;
    };
    const below = bound(true), upTo = bound(false);
    return (100 * (below + (upTo - below) / 2)) / d.length;
  }

  function rollTier(ep) {
    const pct = percentile(ep);
    return { pct, tier: ROLL_TIERS.find(t => pct < t.below) };
  }

  // Uniform integer in [0, 1e9) from the platform CSPRNG, without modulo bias.
  function randomRoll() {
    const buf = new Uint32Array(1);
    const limit = Math.floor(4294967296 / SPACE) * SPACE;
    do { root.crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % SPACE;
  }

  root.RNG9 = {
    SPACE, BADGES, CATEGORIES, RARITIES, ROLL_TIERS, PRIME_COMBOS, COUNTS, P,
    init, datedBadges, evaluate, score, rollTier, distribution, randomRoll, millerRabin, digitSum,
  };
  if (!root.RNG9_COUNTING) init();
})(typeof window !== 'undefined' ? window : globalThis);
