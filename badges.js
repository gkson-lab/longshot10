// Badge engine for RNGdle 10. Every badge's probability is an exact count of
// qualifying numbers; tools/check.js brute-forces each count at 5 and 6 digits.
(function (root) {
  'use strict';

  // a*b mod m for a, b < m < 2^34, without exceeding 2^53.
  function mulmod(a, b, m) {
    const p = a * b;
    if (p < 9007199254740992) return p % m;
    let r = 0;
    for (let shift = 32; shift >= 0; shift -= 16) {
      r = (r * 65536 + a * (Math.floor(b / 2 ** shift) % 65536)) % m;
    }
    return r;
  }

  function powmod(b, e, m) {
    let r = 1;
    b %= m;
    while (e > 0) {
      if (e % 2 === 1) r = mulmod(r, b, m);
      b = mulmod(b, b, m);
      e = Math.floor(e / 2);
    }
    return r;
  }

  // Deterministic Miller-Rabin; bases 2..13 are exact below 3,474,749,660,383.
  function millerRabin(n) {
    if (n < 2) return false;
    for (const p of [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]) {
      if (n === p) return true;
      if (n % p === 0) return false;
    }
    let d = n - 1, r = 0;
    while (d % 2 === 0) { d /= 2; r++; }
    outer: for (const a of [2, 3, 5, 7, 11, 13]) {
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

  // Swappable so tools/build-data.js can substitute a sieve lookup.
  const P = { isPrime: millerRabin };

  const digitSum = s => { let t = 0; for (const c of s) t += c.charCodeAt(0) - 48; return t; };
  const reverse = s => [...s].reverse().join('');
  const sign = x => (x > 0 ? 1 : x < 0 ? -1 : 0);
  const distinct = s => new Set(s).size;
  const countOf = (s, ch) => s.split(ch).length - 1;
  const fmt = n => n.toLocaleString('en-US');

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
  function isPeak(s, dir) {
    if (s.length < 5) return false;
    const d = diffs(s).map(x => sign(x) * dir);
    const turn = d.indexOf(-1);
    return turn > 0 && d.slice(0, turn).every(x => x === 1) && d.slice(turn).every(x => x === -1);
  }
  const isZigzag = s => { const d = diffs(s).map(sign); return s.length >= 5 && d.every((x, i) => x !== 0 && (i === 0 || x === -d[i - 1])); };
  const isWave = s => s.length >= 5 && s[0] !== s[1] && [...s].every((c, i) => c === s[i % 2]);
  const isDigitFib = s => s.length >= 5 && [...s].every((c, i) => i < 2 || +c === +s[i - 1] + +s[i - 2]);
  const isPal = s => s === reverse(s);
  const isRep = s => s.length > 1 && /^(\d)\1+$/.test(s);

  // Prime-only combos: the badge is `prime && cond`. Counted by the sieve.
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
    { id: 'uniqPrime', name: 'Pristine Prime', desc: 'A prime with no repeated digit', cond: (n, s) => distinct(s) === s.length },
    { id: 'happyPrime', name: 'Happy Prime', desc: 'A prime that is also a happy number', cond: n => isHappy(n) },
  ];

  // Exponent mode: P(e = k) = 2^-k for k < E_MAX, and the tail 2^-(E_MAX-1) lands on E_MAX.
  const E_MAX = 40;
  const pExp = k => (k < E_MAX ? 2 ** -k : 2 ** -(E_MAX - 1));

  // Known-complete lists (tools/check.js verifies each member and brute-forces below 1e7).
  const ARMSTRONG = [153, 370, 371, 407, 1634, 8208, 9474, 54748, 92727, 93084, 548834, 1741725,
    4210818, 9800817, 9926315, 24678050, 24678051, 88593477, 146511208, 472335975, 534494836,
    912985153, 4679307774];
  const AUTOMORPHIC = [25, 76, 376, 625, 9376, 90625, 109376, 890625, 2890625, 7109376, 12890625,
    87109376, 212890625, 787109376, 1787109376, 8212890625];
  const SELF_DESCRIBING = [1210, 2020, 21200, 3211000, 42101000, 521001000, 6210001000];
  const PERFECT = [6, 28, 496, 8128, 33550336, 8589869056];
  const KAPREKAR = [495, 6174];
  const MEMES = [42, 69, 420, 666, 1337, 9001, 80085, 5318008, 8008135];

  function createGame(DIGITS, opts = {}) {
    const SPACE = 10 ** DIGITS;
    const pre = (opts.counts) || {};

    function seq(next) {
      const out = new Set();
      for (let k = 0; ; k++) { const v = next(k); if (v >= SPACE) break; if (v >= 0) out.add(v); }
      return out;
    }
    function recur(a, b, f) {
      const out = new Set();
      for (; a < SPACE; [a, b] = [b, f(a, b)]) out.add(a);
      return out;
    }
    const below = list => new Set(list.filter(n => n < SPACE));

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
    for (let row = [1]; row[0] < SPACE;) {
      BELL.add(row[0]);
      const next = [row[row.length - 1]];
      for (const x of row) next.push(next[next.length - 1] + x);
      row = next;
    }

    const SMALL_PRIMES = [];
    {
      const lim = Math.ceil(Math.sqrt(SPACE)) + 1, comp = new Uint8Array(lim + 1);
      for (let i = 2; i <= lim; i++) {
        if (comp[i]) continue;
        SMALL_PRIMES.push(i);
        for (let j = i * i; j <= lim; j += i) comp[j] = 1;
      }
    }
    const PRIME_SQUARES = new Set(SMALL_PRIMES.map(p => p * p).filter(v => v < SPACE));
    const PRIME_CUBES = new Set(SMALL_PRIMES.map(p => p ** 3).filter(v => v < SPACE));
    const PRIMORIALS = new Set([1]);
    for (let i = 0, v = 1; (v *= SMALL_PRIMES[i]) < SPACE; i++) PRIMORIALS.add(v);
    const PERFECT_POWERS = new Set();
    for (let b = 2; b * b < SPACE; b++) for (let v = b * b; v < SPACE; v *= b) PERFECT_POWERS.add(v);
    const TAXICAB = new Set();
    {
      const seen = new Set();
      for (let a = 1; 2 * a ** 3 < SPACE; a++) for (let b = a; a ** 3 + b ** 3 < SPACE; b++) {
        const v = a ** 3 + b ** 3;
        if (seen.has(v)) TAXICAB.add(v); else seen.add(v);
      }
    }
    const ARM = below(ARMSTRONG), AUTO = below(AUTOMORPHIC), SELF = below(SELF_DESCRIBING);
    const PERF = below(PERFECT), KAP = below(KAPREKAR), MEME = below(MEMES);

    const PALINDROMES = [];
    for (let len = 1; len <= DIGITS; len++) {
      const half = Math.ceil(len / 2);
      for (let h = len === 1 ? 0 : 10 ** (half - 1); h < 10 ** half; h++) {
        const hs = String(h);
        PALINDROMES.push(+(hs + reverse(hs).slice(len % 2)));
      }
    }
    const REPDIGITS = [];
    for (let len = 2; len <= DIGITS; len++) for (let d = 1; d <= 9; d++) REPDIGITS.push(+String(d).repeat(len));
    const STRAIGHTS = [];
    for (let len = 4; len <= DIGITS; len++) for (let a = 1; a <= 9; a++) for (const step of [1, -1]) {
      const z = a + step * (len - 1);
      if (z >= 0 && z <= 9) STRAIGHTS.push(+Array.from({ length: len }, (_, i) => a + step * i).join(''));
    }

    // Counts n in [0, SPACE) whose digits (no leading zeros) end in an accepting state.
    function countByDfa({ init, step, accept, key = String }) {
      const add = (m, st, c) => { const k = key(st); const e = m.get(k); if (e) e[1] += c; else m.set(k, [st, c]); };
      let total = accept(step(init, 0)) ? 1 : 0; // the number 0
      let cur = new Map();
      for (let d = 1; d <= 9; d++) add(cur, step(init, d), 1);
      for (let len = 1; len <= DIGITS; len++) {
        for (const [st, c] of cur.values()) if (accept(st)) total += c;
        if (len === DIGITS) break;
        const next = new Map();
        for (const [st, c] of cur.values()) for (let d = 0; d <= 9; d++) add(next, step(st, d), c);
        cur = next;
      }
      return total;
    }

    const DEAD = 'x';
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
    // Records are arrays of small ints; DEAD means the pattern can no longer match.
    function recDfa(init, step, accept) {
      return {
        init,
        step: (r, d) => (r === DEAD ? DEAD : step(r, d)),
        accept: r => r !== DEAD && accept(r),
        key: r => (r === DEAD ? DEAD : r.join(',')),
      };
    }
    const upTo = (len, cap) => Math.min(cap, len + 1);
    const runDfa = need => recDfa([-1, 0, 0], ([last, run, best], d) => {
      const r = Math.min(need, d === last ? run + 1 : 1);
      return [d, r, Math.max(r, best)];
    }, ([, , best]) => best >= need);
    const onlyDigitsDfa = allowed => recDfa([], (r, d) => (allowed.includes(d) ? r : DEAD), () => true);
    const digitSumDfa = pred => recDfa([0], ([t], d) => [t + d], ([t]) => pred(t));
    const digitCountDfa = (digit, min) => recDfa([0], ([k], d) => [Math.min(min, k + (d === digit))], ([k]) => k >= min);
    const distinctDfa = (k, minLen) => recDfa([0, 0], ([mask, len], d) => [mask | (1 << d), upTo(len, minLen)],
      ([mask, len]) => len >= minLen && popcount(mask) === k);
    const happyDfa = recDfa([0], ([t], d) => [t + d * d], ([t]) => isHappy(t));
    const bookendsDfa = recDfa([-1, -1, 0], ([f, , len], d) => [len ? f : d, d, upTo(len, 2)], ([f, l, len]) => len >= 2 && f === l);
    const lonelyDfa = recDfa([0], ([len], d) => (len === 0 || d === 0 ? [upTo(len, 2)] : DEAD), ([len]) => len >= 2);
    const stepDfa = (firstOk, need) => recDfa([-1, 99, 0], ([last, diff, len], d) => {
      if (len === 0) return [d, 99, 1];
      if (len === 1) return firstOk(d - last) ? [d, d - last, 2] : DEAD;
      return d - last === diff ? [d, diff, upTo(len, need)] : DEAD;
    }, ([, , len]) => len >= need);
    const monotoneDfa = (dir, minLen, strict = true) => recDfa([-1, 0], ([last, len], d) => {
      if (len === 0) return [d, 1];
      const x = (d - last) * dir;
      return x > 0 || (!strict && x === 0) ? [d, upTo(len, minLen)] : DEAD;
    }, ([, len]) => len >= minLen);
    const peakDfa = dir => recDfa([-1, 0, 0], ([last, phase, len], d) => {
      if (len === 0) return [d, 0, 1];
      const x = sign(d - last) * dir;
      if (x === 0) return DEAD;
      if (phase === 0) return x > 0 ? [d, 1, 2] : DEAD;
      if (phase === 1) return [d, x > 0 ? 1 : 2, upTo(len, 5)];
      return x < 0 ? [d, 2, upTo(len, 5)] : DEAD;
    }, ([, phase, len]) => phase === 2 && len >= 5);
    const zigzagDfa = recDfa([-1, 0, 0], ([last, dir, len], d) => {
      if (len === 0) return [d, 0, 1];
      const x = sign(d - last);
      return x === 0 || x === dir ? DEAD : [d, x, upTo(len, 5)];
    }, ([, , len]) => len >= 5);
    const waveDfa = recDfa([-1, -1, 0], ([p2, p1, len], d) => {
      if (len === 0) return [-1, d, 1];
      if (len === 1) return d === p1 ? DEAD : [p1, d, 2];
      return d === p2 ? [p1, d, upTo(len, 5)] : DEAD;
    }, ([, , len]) => len >= 5);
    const digitFibDfa = recDfa([-1, -1, 0], ([p2, p1, len], d) => {
      if (len < 2) return [p1, d, len + 1];
      return d === p2 + p1 ? [p1, d, upTo(len, 5)] : DEAD;
    }, ([, , len]) => len >= 5);
    const checkerDfa = recDfa([-1, 0], ([par, len], d) => (len && d % 2 === par ? DEAD : [d % 2, len + 1]), ([, len]) => len === DIGITS);
    const doubleTripleDfa = recDfa([0, 0], ([r, t], d) => (d === 7 ? [(r + 1) % 3, Math.min(2, t + (r === 2))] : [0, t]), ([, t]) => t >= 2);

    // test(n, s, c): the base number, its decimal string, and { prime, date, e }.
    // Within a `group` only the rarest earned badge counts.
    const congruent = (r, m) => (r < SPACE ? Math.floor((SPACE - 1 - r) / m) + 1 : 0); // n < SPACE with n % m === r
    const multiples = k => congruent(0, k);
    const prefixCount = len => { let t = 0; for (let l = len; l <= DIGITS; l++) t += 10 ** (l - len); return t; };
    const has = set => n => set.has(n);
    const contains = (id, pat, name, desc) => ({ id, cat: 'Memes', name, desc: desc || `Contains ${pat}`, dfa: containsDfa(pat), test: (n, s) => s.includes(pat) });
    const LENGTH_NAMES = ['', 'Single Digit', 'Two Digits', 'Three Digits', 'Four Digits', 'Five Digits',
      'Six Digits', 'Seven Digits', 'Eight Digits', 'Nine Digits', 'Ten Digits', 'Eleven Digits'];
    const HALF = Math.floor(DIGITS / 2), THIRD = Math.floor(DIGITS / 3);
    const HEAVY = Math.round((DIGITS * 70) / 9), HEAVY_HAPPY = Math.round((DIGITS * 60) / 9), EMPTY = DIGITS - 4;
    let pandigital = 9;
    for (let i = 1; i < DIGITS; i++) pandigital *= 10 - i;

    const BADGES = [
      // Size
      { id: 'zero', cat: 'Size', name: 'Absolute Zero', desc: 'Rolled exactly 0', group: 'size', count: 1, test: n => n === 0 },
      ...LENGTH_NAMES.slice(1, DIGITS).map((name, i) => ({
        id: 'len' + (i + 1), cat: 'Size', name, group: 'size',
        desc: i === 0 ? 'A number from 1 to 9' : `A number with only ${i + 1} digits`,
        count: 9 * 10 ** i,
        test: (n, s) => n > 0 && s.length === i + 1,
      })),
      { id: 'top1', cat: 'Size', name: 'High Roller', desc: `${fmt(SPACE - SPACE / 100)} or more`, group: 'top', count: SPACE / 100, test: n => n >= SPACE - SPACE / 100 },
      { id: 'top2', cat: 'Size', name: 'Sky High', desc: `${fmt(SPACE - SPACE / 1000)} or more`, group: 'top', count: SPACE / 1000, test: n => n >= SPACE - SPACE / 1000 },
      { id: 'top3', cat: 'Size', name: 'Stratosphere', desc: `${fmt(SPACE - 1000)} or more`, group: 'top', count: 1000, test: n => n >= SPACE - 1000 },
      { id: 'center', cat: 'Size', name: 'Dead Center', desc: `Within 500 of ${fmt(SPACE / 2)}`, count: 999, test: n => Math.abs(n - SPACE / 2) < 500 },

      // Math
      { id: 'prime', cat: 'Math', name: 'Prime', desc: 'Divisible only by 1 and itself', sieve: true, test: (n, s, c) => c.prime },
      { id: 'harshad', cat: 'Math', name: 'Harshad', desc: 'Divisible by the sum of its digits', sieve: true, test: (n, s) => n > 0 && n % digitSum(s) === 0 },
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
      { id: 'perfect', cat: 'Math', name: 'Perfect', desc: 'Equal to the sum of its divisors: 6, 28, 496…', set: PERF, test: has(PERF) },
      { id: 'taxicab', cat: 'Math', name: 'Taxicab', desc: 'The sum of two cubes in two different ways, like 1729', set: TAXICAB, test: has(TAXICAB) },
      { id: 'armstrong', cat: 'Math', name: 'Narcissistic', desc: 'Equal to the sum of its digits, each raised to the number of digits', set: ARM, test: has(ARM) },
      { id: 'automorphic', cat: 'Math', name: 'Automorphic', desc: 'Its square ends in itself, like 76² = 5776', set: AUTO, test: has(AUTO) },
      { id: 'kaprekar', cat: 'Math', name: "Kaprekar's Constant", desc: '495 or 6174', set: KAP, test: has(KAP) },
      { id: 'selfdesc', cat: 'Math', name: 'Self-Describing', desc: 'Digit k counts how many k digits it has, like 2020', set: SELF, test: has(SELF) },
      { id: 'div3', cat: 'Math', name: 'Divisible by Three', desc: 'A multiple of 3', group: 'div3', count: multiples(3), test: n => n % 3 === 0 },
      { id: 'div9', cat: 'Math', name: 'Divisible by Nine', desc: 'A multiple of 9', group: 'div3', count: multiples(9), test: n => n % 9 === 0 },
      { id: 'div7', cat: 'Math', name: 'Divisible by Seven', desc: 'A multiple of 7', count: multiples(7), test: n => n % 7 === 0 },
      { id: 'div11', cat: 'Math', name: 'Divisible by Eleven', desc: 'A multiple of 11', count: multiples(11), test: n => n % 11 === 0 },
      { id: 'div13', cat: 'Math', name: "Baker's Dozen", desc: 'A multiple of 13', count: multiples(13), test: n => n % 13 === 0 },
      { id: 'lcm9', cat: 'Math', name: 'Highly Divisible', desc: 'Divisible by every number from 1 to 9', group: 'lcm', count: multiples(2520), test: n => n % 2520 === 0 },
      { id: 'lcm12', cat: 'Math', name: 'Super Divisible', desc: 'Divisible by every number from 1 to 12', group: 'lcm', count: multiples(27720), test: n => n % 27720 === 0 },
      { id: 'lcm15', cat: 'Math', name: 'Ultra Divisible', desc: 'Divisible by every number from 1 to 15', group: 'lcm', count: multiples(360360), test: n => n % 360360 === 0 },
      { id: 'r100', cat: 'Math', name: 'Round Hundred', desc: 'Ends in 00', group: 'round', count: multiples(100), test: n => n % 100 === 0 },
      { id: 'r1k', cat: 'Math', name: 'Round Thousand', desc: 'Ends in 000', group: 'round', count: multiples(1000), test: n => n % 1000 === 0 },
      { id: 'r10k', cat: 'Math', name: 'Round Ten Thousand', desc: 'Ends in 0000', group: 'round', count: multiples(1e4), test: n => n % 1e4 === 0 },
      { id: 'r1m', cat: 'Math', name: 'Round Million', desc: 'Ends in 000000', group: 'round', count: multiples(1e6), test: n => n % 1e6 === 0 },
      { id: 'almost', cat: 'Math', name: 'Almost Round', desc: 'Ends in 999', count: congruent(999, 1000), test: n => n % 1000 === 999 },
      { id: 'offby1', cat: 'Math', name: 'Off by One', desc: 'One away from a whole million', count: congruent(1, 1e6) + congruent(999999, 1e6), test: n => n % 1e6 === 1 || n % 1e6 === 999999 },

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
      { id: 'pal', cat: 'Digits', name: 'Palindrome', desc: 'Reads the same backwards', count: PALINDROMES.length, test: (n, s) => isPal(s) },
      { id: 'rep', cat: 'Digits', name: 'Repdigit', desc: 'Two or more digits, all the same', count: REPDIGITS.length, test: (n, s) => isRep(s) },
      { id: 'straight', cat: 'Digits', name: 'Straight', desc: 'Four or more consecutive digits, like 3456 or 9876', group: 'order', dfa: stepDfa(x => Math.abs(x) === 1, 4), test: (n, s) => isStraight(s) },
      { id: 'arith', cat: 'Digits', name: 'Arithmetic', desc: 'Four or more digits moving in equal steps, like 2468', group: 'order', dfa: stepDfa(x => x !== 0, 4), test: (n, s) => isArithmetic(s) },
      { id: 'asc', cat: 'Digits', name: 'Staircase Up', desc: 'Three or more digits, each higher than the last', group: 'order', dfa: monotoneDfa(1, 3), test: (n, s) => s.length >= 3 && isStrictlyMonotone(s, 1) },
      { id: 'desc', cat: 'Digits', name: 'Staircase Down', desc: 'Three or more digits, each lower than the last', group: 'order', dfa: monotoneDfa(-1, 3), test: (n, s) => s.length >= 3 && isStrictlyMonotone(s, -1) },
      { id: 'sorted', cat: 'Digits', name: 'Sorted', desc: `${LENGTH_NAMES[DIGITS]} that never go down`, group: 'order', dfa: monotoneDfa(1, DIGITS, false), test: (n, s) => s.length === DIGITS && s === [...s].sort().join('') },
      { id: 'mountain', cat: 'Digits', name: 'Mountain', desc: 'Five or more digits that rise, then fall', dfa: peakDfa(1), test: (n, s) => isPeak(s, 1) },
      { id: 'valley', cat: 'Digits', name: 'Valley', desc: 'Five or more digits that fall, then rise', dfa: peakDfa(-1), test: (n, s) => isPeak(s, -1) },
      { id: 'zigzag', cat: 'Digits', name: 'Zigzag', desc: 'Five or more digits going up, down, up, down', dfa: zigzagDfa, test: (n, s) => isZigzag(s) },
      { id: 'wave', cat: 'Digits', name: 'Wave', desc: 'Two digits taking turns, like 37373', dfa: waveDfa, test: (n, s) => isWave(s) },
      { id: 'digitfib', cat: 'Digits', name: 'Digit Fibonacci', desc: 'Each digit is the sum of the two before it, like 11235', dfa: digitFibDfa, test: (n, s) => isDigitFib(s) },
      { id: 'checker', cat: 'Digits', name: 'Checkerboard', desc: `${LENGTH_NAMES[DIGITS]} alternating odd and even`, dfa: checkerDfa, test: (n, s) => s.length === DIGITS && [...s].every((c, i) => i === 0 || c % 2 !== s[i - 1] % 2) },
      { id: 'bookends', cat: 'Digits', name: 'Bookends', desc: 'Starts and ends with the same digit', dfa: bookendsDfa, test: (n, s) => s.length > 1 && s[0] === s[s.length - 1] },
      {
        id: 'echo', cat: 'Digits', name: 'Echo', desc: 'The second half repeats the first, like 4747', group: 'echo',
        count: Array.from({ length: HALF }, (_, k) => 9 * 10 ** k).reduce((a, b) => a + b, 0),
        test: (n, s) => s.length % 2 === 0 && s.slice(0, s.length / 2) === s.slice(s.length / 2),
      },
      {
        id: 'echo3', cat: 'Digits', name: 'Triple Echo', desc: `A ${THIRD}-digit block said three times, like ${'581'.slice(0, THIRD).repeat(3)}`, group: 'echo',
        count: 9 * 10 ** (THIRD - 1), test: (n, s) => s.length === 3 * THIRD && s.slice(0, THIRD).repeat(3) === s,
      },
      {
        id: 'pairs', cat: 'Digits', name: 'Pair Parade', desc: `${LENGTH_NAMES[2 * HALF]} in doubled pairs, like ${'1144779922'.slice(0, 2 * HALF)}`,
        count: 9 * 10 ** (HALF - 1), test: (n, s) => s.length === 2 * HALF && [...s].every((c, i) => i % 2 === 1 || c === s[i + 1]),
      },
      { id: 'uniq', cat: 'Digits', name: DIGITS === 10 ? 'Pandigital' : 'No Repeats', desc: DIGITS === 10 ? 'Every digit 0 to 9 exactly once' : `${LENGTH_NAMES[DIGITS]}, all different`, count: pandigital, test: (n, s) => s.length === DIGITS && distinct(s) === DIGITS },
      { id: 'nozero', cat: 'Digits', name: 'Zero-Free', desc: `${LENGTH_NAMES[DIGITS]} and not a single 0`, count: 9 ** DIGITS, test: (n, s) => s.length === DIGITS && !s.includes('0') },
      { id: 'zeros', cat: 'Digits', name: 'Mostly Empty', desc: `${EMPTY} or more zeros`, dfa: digitCountDfa(0, EMPTY), test: (n, s) => countOf(s, '0') >= EMPTY },
      { id: 'lonely', cat: 'Digits', name: 'Lonely Digit', desc: 'One non-zero digit followed only by zeros', dfa: lonelyDfa, test: (n, s) => /^[1-9]0+$/.test(s) },
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
      { id: 'heavy', cat: 'Digits', name: 'Heavyweight', desc: `Digits add up to ${HEAVY} or more`, dfa: digitSumDfa(t => t >= HEAVY), test: (n, s) => digitSum(s) >= HEAVY },
      { id: 'pi', cat: 'Digits', name: 'Slice of Pi', desc: 'Starts with 31415', group: 'const', count: prefixCount(5), test: (n, s) => s.startsWith('31415') },
      { id: 'euler', cat: 'Digits', name: "Euler's e", desc: 'Starts with 27182', group: 'const', count: prefixCount(5), test: (n, s) => s.startsWith('27182') },
      { id: 'root2', cat: 'Digits', name: 'Root Two', desc: 'Starts with 14142', group: 'const', count: prefixCount(5), test: (n, s) => s.startsWith('14142') },
      { id: 'phi', cat: 'Digits', name: 'Golden', desc: 'Starts with 1618', group: 'const', count: prefixCount(4), test: (n, s) => s.startsWith('1618') },

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
      contains('c247', '247', 'Around the Clock'),
      contains('c365', '365', 'All Year Long'),
      contains('c1337', '1337', 'Leet'),
      contains('c1984', '1984', 'Big Brother'),
      contains('c8008', '8008', 'Calculator Humor'),
      contains('c6969', '6969', 'Very Nice'),
      contains('c8675309', '8675309', 'Jenny', "Contains 8675309, Jenny's number"),
      { id: 'meme', cat: 'Memes', name: 'Meme Number', desc: 'Exactly 42, 69, 420, 666, 1337, 9001, 80085, 5318008 or 8008135', set: MEME, test: has(MEME) },

      // Combos
      { id: 'palprime', cat: 'Combos', name: 'Palprime', desc: 'A palindrome that is prime', among: PALINDROMES, test: (n, s, c) => c.prime && isPal(s) },
      { id: 'palsquare', cat: 'Combos', name: 'Mirror Square', desc: 'A palindrome that is a perfect square', among: SQUARES, test: (n, s) => SQUARES.has(n) && isPal(s) },
      { id: 'palcube', cat: 'Combos', name: 'Mirror Cube', desc: 'A palindrome that is a perfect cube', among: CUBES, test: (n, s) => CUBES.has(n) && isPal(s) },
      { id: 'paltri', cat: 'Combos', name: 'Mirror Triangle', desc: 'A palindrome that is triangular', among: TRI, test: (n, s) => TRI.has(n) && isPal(s) },
      { id: 'palhappy', cat: 'Combos', name: 'Happy Palindrome', desc: 'A palindrome that is a happy number', among: PALINDROMES, test: (n, s) => isPal(s) && isHappy(n) },
      { id: 'fibprime', cat: 'Combos', name: 'Fibonacci Prime', desc: 'A Fibonacci number that is prime', among: FIB, test: (n, s, c) => c.prime && FIB.has(n) },
      { id: 'sqtri', cat: 'Combos', name: 'Square Triangle', desc: 'Both a perfect square and triangular', among: TRI, test: n => TRI.has(n) && SQUARES.has(n) },
      { id: 'repprime', cat: 'Combos', name: 'Repunit Prime', desc: 'A repdigit that is prime', among: REPDIGITS, test: (n, s, c) => c.prime && isRep(s) },
      { id: 'straightprime', cat: 'Combos', name: 'Prime Straight', desc: 'A straight that is prime, like 4567', among: STRAIGHTS, test: (n, s, c) => c.prime && isStraight(s) },
      ...PRIME_COMBOS.map(pc => ({ id: pc.id, cat: 'Combos', name: pc.name, desc: pc.desc, sieve: true, test: (n, s, c) => c.prime && pc.cond(n, s) })),
      { id: 'niceblaze', cat: 'Combos', name: 'Nice and Blazed', desc: 'Contains both 69 and 420', dfa: andDfa(containsDfa('69'), containsDfa('420')), test: (n, s) => s.includes('69') && s.includes('420') },
      { id: 'heavenhell', cat: 'Combos', name: 'Heaven and Hell', desc: 'Contains both 666 and 777', dfa: andDfa(containsDfa('666'), containsDfa('777')), test: (n, s) => s.includes('666') && s.includes('777') },
      { id: 'answernice', cat: 'Combos', name: 'Life, the Universe and Nice', desc: 'Contains both 42 and 69', dfa: andDfa(containsDfa('42'), containsDfa('69')), test: (n, s) => s.includes('42') && s.includes('69') },
      { id: 'oddtriple', cat: 'Combos', name: 'Odd Triple', desc: 'Odd digits only, with three in a row', dfa: andDfa(onlyDigitsDfa([1, 3, 5, 7, 9]), runDfa(3)), test: (n, s) => /^[13579]+$/.test(s) && maxRun(s) >= 3 },
      { id: 'happyheavy', cat: 'Combos', name: 'Heavy Heart', desc: `A happy number whose digits add up to ${HEAVY_HAPPY} or more`, dfa: andDfa(happyDfa, digitSumDfa(t => t >= HEAVY_HAPPY)), test: (n, s) => isHappy(n) && digitSum(s) >= HEAVY_HAPPY },
      { id: 'jackpot2', cat: 'Combos', name: 'Double Jackpot', desc: 'Contains 777 twice, without sharing a 7', dfa: doubleTripleDfa, test: (n, s) => /777.*777/.test(s) },
    ];

    // Exponent-mode badges look at the exponent e and at base^e.
    // Smallest base b with b^k >= 10^power, exactly (BigInt).
    function powThreshold(k, power) {
      const target = 10n ** BigInt(power);
      let lo = 0, hi = SPACE;
      while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (BigInt(mid) ** BigInt(k) >= target) hi = mid; else lo = mid + 1; }
      return lo;
    }
    const thresholds = power => { const t = []; for (let k = 1; k <= E_MAX; k++) t[k] = powThreshold(k, power); return t; };
    const pAtLeast = k => { let p = 0; for (let j = k; j <= E_MAX; j++) p += pExp(j); return p; };
    const GOOGOL = thresholds(100), BIGBANG = thresholds(200);
    const pBeyond = T => { let p = 0; for (let k = 1; k <= E_MAX; k++) p += (pExp(k) * (SPACE - T[k])) / SPACE; return p; };

    const POWER_BADGES = [
      { id: 'eSq', name: 'Squared', desc: 'Rolled an exponent of 2', group: 'exp', prob: pExp(2), test: (n, s, c) => c.e === 2 },
      { id: 'eCu', name: 'Cubed', desc: 'Rolled an exponent of 3', group: 'exp', prob: pExp(3), test: (n, s, c) => c.e === 3 },
      { id: 'eQuad', name: 'To the Fourth', desc: 'Rolled an exponent of 4', group: 'exp', prob: pExp(4), test: (n, s, c) => c.e === 4 },
      { id: 'eSurge', name: 'Power Surge', desc: 'Rolled an exponent of 5 or more', group: 'exp', prob: pAtLeast(5), test: (n, s, c) => c.e >= 5 },
      { id: 'eOver', name: 'Overdrive', desc: 'Rolled an exponent of 8 or more', group: 'exp', prob: pAtLeast(8), test: (n, s, c) => c.e >= 8 },
      { id: 'eHyper', name: 'Hyperdrive', desc: 'Rolled an exponent of 12 or more', group: 'exp', prob: pAtLeast(12), test: (n, s, c) => c.e >= 12 },
      { id: 'eSingular', name: 'Singularity', desc: 'Rolled an exponent of 20 or more', group: 'exp', prob: pAtLeast(20), test: (n, s, c) => c.e >= 20 },
      { id: 'googol', name: 'Googol', desc: 'The result has at least 101 digits', group: 'huge', prob: pBeyond(GOOGOL), test: (n, s, c) => c.e >= 1 && n >= GOOGOL[c.e] },
      { id: 'bigbang', name: 'Big Bang', desc: 'The result has at least 201 digits', group: 'huge', prob: pBeyond(BIGBANG), test: (n, s, c) => c.e >= 1 && n >= BIGBANG[c.e] },
      { id: 'selfpow', name: 'Self Power', desc: 'The base equals the exponent, like 3³', prob: 1 / SPACE, test: (n, s, c) => n === c.e },
      { id: 'oneUp', name: 'Still One', desc: 'A base of 1, so the result is just 1', prob: 1 / SPACE, test: n => n === 1 },
    ].map(b => ({ ...b, cat: 'Powers', power: true }));

    const RARITIES = [
      { id: 'common', name: 'Common', min: 0.1 },
      { id: 'uncommon', name: 'Uncommon', min: 0.01 },
      { id: 'rare', name: 'Rare', min: 0.001 },
      { id: 'epic', name: 'Epic', min: 0.0001 },
      { id: 'anomaly', name: 'Anomaly', min: 0.00001 },
      { id: 'mythic', name: 'Mythic', min: 0 },
    ];

    function computeCount(b) {
      if (b.dfa) return countByDfa(b.dfa);
      if (b.set) return b.set.size;
      if (b.among) return [...b.among].filter(n => b.test(n, String(n), { prime: P.isPrime(n) })).length;
      if (b.sieve) {
        if (SPACE > 1e7) return null;
        let k = 0;
        for (let n = 0; n < SPACE; n++) if (b.test(n, String(n), { prime: P.isPrime(n) })) k++;
        return k;
      }
      return b.count;
    }
    function finish(b) {
      if (b.prob !== undefined) b.p = b.prob;
      else {
        b.count = b.id in pre ? pre[b.id] : computeCount(b);
        if (b.count === null) {
          if (!opts.allowMissing) throw new Error(`No count for ${b.id}: run tools/build-data.js`);
          return false;
        }
        if (!(b.count > 0)) {
          if (opts.dropEmpty) return false; // e.g. "contains 8675309" in a 5-digit test game
          throw new Error(`Badge ${b.id} matches no numbers`);
        }
        b.p = b.count / SPACE;
      }
      b.ep = Math.round(1 / b.p);
      b.rarity = RARITIES.findIndex(r => b.p > r.min);
      return true;
    }
    for (const list of [BADGES, POWER_BADGES]) {
      const keep = list.filter(finish);
      list.length = 0;
      list.push(...keep);
    }

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

    // Classic: score = total EP. Exponent mode: score = (total EP) ^ e. `log` is log10 of the score.
    function evaluate(n, date, e) {
      const s = String(n);
      const c = { prime: P.isPrime(n), date, e };
      let pool = BADGES.concat(datedBadges(date));
      if (e) pool = pool.concat(POWER_BADGES);
      const hits = pool.filter(b => b.test(n, s, c)).sort((a, b) => a.p - b.p);
      const seen = new Set();
      return hits.filter(b => {
        if (!b.group) return true;
        if (seen.has(b.group)) return false;
        seen.add(b.group);
        return true;
      });
    }
    function score(n, date, e) {
      const badges = evaluate(n, date, e);
      const ep = badges.reduce((t, b) => t + b.ep, 0);
      return { n, e, badges, ep, log: ep > 0 ? (e || 1) * Math.log10(ep) : -Infinity };
    }

    const ROLL_TIERS = [
      { id: 'trash', name: 'Trash', below: 1 },
      { id: 'common', name: 'Common', below: 50 },
      { id: 'uncommon', name: 'Uncommon', below: 75 },
      { id: 'rare', name: 'Rare', below: 90 },
      { id: 'epic', name: 'Epic', below: 95 },
      { id: 'anomaly', name: 'Anomaly', below: 99 },
      { id: 'mythic', name: 'Mythic', below: Infinity },
    ];
    const SAMPLE = 30000;
    const samples = {};
    function seededRand(seed) {
      return () => { // mulberry32
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    // Fixed-seed sample of log-scores per mode, so every player sees the same percentiles.
    // Built in slices so the page never freezes; distribution() finishes it synchronously if needed.
    function sampler(mode) {
      if (samples[mode]) return samples[mode];
      const rand = seededRand(mode === 'exp' ? 0x51ed270b : 0x9e3779b9);
      const st = { values: new Float64Array(SAMPLE), i: 0, sorted: false };
      st.step = budget => {
        for (const end = Math.min(SAMPLE, st.i + budget); st.i < end; st.i++) {
          const n = Math.floor(rand() * SPACE);
          let e;
          if (mode === 'exp') { e = 1; while (e < E_MAX && rand() < 0.5) e++; }
          st.values[st.i] = score(n, null, e).log;
        }
        if (st.i === SAMPLE && !st.sorted) { st.values.sort(); st.sorted = true; }
        return st.sorted;
      };
      return (samples[mode] = st);
    }
    function distribution(mode) { const st = sampler(mode); st.step(Infinity); return st.values; }
    function warmUp(mode) {
      return new Promise(resolve => {
        const st = sampler(mode);
        const tick = () => (st.step(1500) ? resolve() : setTimeout(tick, 0));
        tick();
      });
    }
    function percentile(log, mode) {
      const d = distribution(mode);
      const bound = strict => {
        let lo = 0, hi = d.length;
        while (lo < hi) { const m = (lo + hi) >> 1; if (strict ? d[m] < log : d[m] <= log) lo = m + 1; else hi = m; }
        return lo;
      };
      const lo = bound(true), hi = bound(false);
      return (100 * (lo + (hi - lo) / 2)) / d.length;
    }
    function rollTier(log, mode) {
      const pct = percentile(log, mode);
      return { pct, tier: ROLL_TIERS.find(t => pct < t.below) };
    }
    // Share of all rolls that land in each tier (ties make this differ from the nominal bands).
    function tierShares(mode) {
      const d = distribution(mode), out = Object.fromEntries(ROLL_TIERS.map(t => [t.id, 0]));
      for (let i = 0; i < d.length;) {
        let j = i;
        while (j < d.length && d[j] === d[i]) j++;
        out[rollTier(d[i], mode).tier.id] += (j - i) / d.length;
        i = j;
      }
      return out;
    }

    function factorize(n) {
      if (n < 2) return [];
      const out = [];
      for (const p of SMALL_PRIMES) {
        if (p * p > n) break;
        if (n % p === 0) { let k = 0; while (n % p === 0) { n /= p; k++; } out.push([p, k]); }
      }
      if (n > 1) out.push([n, 1]);
      return out;
    }

    function randomBelow(m) {
      const bits = Math.ceil(Math.log2(m)), buf = new Uint32Array(2);
      for (;;) {
        root.crypto.getRandomValues(buf);
        const hi = bits > 32 ? (buf[0] % 2 ** (bits - 32)) * 4294967296 : 0;
        const lo = bits >= 32 ? buf[1] : buf[1] % 2 ** bits;
        if (hi + lo < m) return hi + lo;
      }
    }
    function randomExponent() {
      const buf = new Uint32Array(2);
      root.crypto.getRandomValues(buf);
      let e = 1;
      for (let i = 0; e < E_MAX && i < 64 && ((buf[i >> 5] >>> (i & 31)) & 1); i++) e++;
      return e;
    }

    return {
      DIGITS, SPACE, E_MAX, BADGES, POWER_BADGES, RARITIES, ROLL_TIERS,
      CATEGORIES: ['Size', 'Math', 'Sequences', 'Digits', 'Memes', 'Combos', 'Powers', 'Daily'],
      datedBadges, evaluate, score, rollTier, distribution, warmUp, tierShares, factorize,
      randomRoll: () => randomBelow(SPACE), randomExponent, pExp, computeCount,
    };
  }

  function popcount(x) { let c = 0; while (x) { c += x & 1; x >>>= 1; } return c; }

  root.RNGEngine = { createGame, PRIME_COMBOS, P, millerRabin, digitSum, isHappy, E_MAX, pExp };
  if (!root.RNG_NO_AUTOSTART) {
    const data = root.RNG_DATA && root.RNG_DATA.digits === 10 ? root.RNG_DATA : null;
    root.RNG = createGame(10, { counts: data && data.counts });
  }
})(typeof window !== 'undefined' ? window : globalThis);
