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
    { id: 'safePrime', name: 'Safe Prime', desc: 'A prime p where (p - 1) / 2 is prime too', cond: n => n > 4 && P.isPrime((n - 1) / 2) },
    { id: 'tripletPrime', name: 'Prime Triplet', desc: 'Starts three primes within 6, like 5, 7, 11 or 7, 11, 13', cond: n => P.isPrime(n + 6) && (P.isPrime(n + 2) || P.isPrime(n + 4)) },
    { id: 'lonerPrime', name: 'Loner Prime', desc: 'A prime with no other prime within 6', cond: n => [2, 4, 6].every(k => !P.isPrime(n - k) && !P.isPrime(n + k)) },
    { id: 'zeroFreePrime', name: 'Zero-Free Prime', desc: 'A prime without a single 0', cond: (n, s) => !s.includes('0') },
    { id: 'oddPrime', name: 'Odd-Digit Prime', desc: 'A prime made only of odd digits', cond: (n, s) => /^[13579]+$/.test(s) },
    { id: 'sortedPrime', name: 'Sorted Prime', desc: 'A prime whose digits never go down', cond: (n, s) => [...s].every((c, i) => i === 0 || c >= s[i - 1]) },
    { id: 'bookendPrime', name: 'Bookend Prime', desc: 'A prime of two or more digits that starts and ends with the same digit', cond: (n, s) => s.length > 1 && s[0] === s[s.length - 1] },
    { id: 'answerPrime', name: 'The Answer Prime', desc: 'A prime containing 42', cond: (n, s) => s.includes('42') },
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

  // The multiplier reel: [id, name, symbol, value]. Values too big for a double are { log: log10 }.
  // Each lands with chance 1 in N: N = 30 · value^1.2 up to ×10, then 475 · (log10 value)^3.5 so the
  // giants stay rare but reachable (capped at 10^15). Unity (×1) takes the remaining chance.
  const MULTIPLIER_DEFS = [
    ['delian', 'Delian constant', '∛2', 1.2599210499], ['apery', "Apéry's constant", 'ζ(3)', 1.2020569032],
    ['glaisher', 'Glaisher–Kinkelin constant', 'A', 1.2824271291], ['conway', "Conway's constant", 'λ', 1.3035772690],
    ['mills', "Mills' constant", 'θ', 1.3063778839], ['plastic', 'Plastic number', 'ρ', 1.3247179572],
    ['sqrt2', 'Root two', '√2', 1.4142135624], ['soldner', 'Ramanujan–Soldner constant', 'μ', 1.4513692349],
    ['backhouse', "Backhouse's constant", 'B', 1.4560749485], ['supergolden', 'Supergolden ratio', 'ψ', 1.4655712319],
    ['lieb', "Lieb's square ice constant", 'W', 1.5396007179], ['erdos', 'Erdős–Borwein constant', 'E', 1.6066951524],
    ['phi', 'Golden ratio', 'φ', 1.6180339887], ['niven', "Niven's constant", 'C', 1.7052111401],
    ['sqrt3', 'Root three', '√3', 1.7320508076], ['egamma', 'e to the gamma', 'eᵞ', 1.7810724180],
    ['komornik', 'Komornik–Loreti constant', 'q', 1.7872316501], ['brun', "Brun's constant", 'B₂', 1.9021605831],
    ['sqrt5', 'Root five', '√5', 2.2360679775], ['parabolic', 'Universal parabolic constant', 'P', 2.2955871494],
    ['ln10', 'Natural log of ten', 'ln 10', 2.3025850930], ['silver', 'Silver ratio', 'δₛ', 2.4142135624],
    ['feigA', 'Feigenbaum alpha', 'α', 2.5029078751], ['sqrt2pi', 'Root of two pi', '√(2π)', 2.5066282746],
    ['sierpinski', "Sierpiński's constant", 'K', 2.5849817596], ['lemniscate', 'Lemniscate constant', 'ϖ', 2.6220575543],
    ['gelfondS', 'Gelfond–Schneider constant', '2^√2', 2.6651441427], ['khinchin', "Khinchin's constant", 'K₀', 2.6854520011],
    ['e', "Euler's number", 'e', 2.7182818285], ['fransen', 'Fransén–Robinson constant', 'F', 2.8077702420],
    ['pi', 'Pi', 'π', 3.1415926536], ['levy', "Lévy's constant", 'L', 3.2758229187],
    ['bronze', 'Bronze ratio', 'β', 3.3027756377], ['recipFib', 'Reciprocal Fibonacci constant', 'Ψ', 3.3598856662],
    ['feigD', 'Feigenbaum delta', 'δ', 4.6692016091], ['tau', 'Tau', 'τ', 6.2831853072],
    ['piSq', 'Pi squared', 'π²', 9.8696044011], ['eE', 'e to the e', 'eᵉ', 15.1542622415],
    ['almostInt', 'Almost an integer', 'e^π − π', 19.9990999792], ['piE', 'Pi to the e', 'πᵉ', 22.4591577184],
    ['gelfond', "Gelfond's constant", 'e^π', 23.1406926328], ['goldenAngle', 'Golden angle in degrees', '137.5°', 137.5077640500],
    ['two', 'Double', '2', 2], ['three', 'Triple', '3', 3], ['six', 'First perfect number', '6', 6],
    ['seven', 'Lucky seven', '7', 7], ['ten', 'Ten', '10', 10], ['dozen', 'Dozen', '12', 12],
    ['bakers', "Baker's dozen", '13', 13], ['score', 'Score', '20', 20], ['perfect28', 'Second perfect number', '28', 28],
    ['m31', 'Mersenne prime 31', '31', 31], ['answer', 'The Answer', '42', 42], ['nice', 'Nice', '69', 69],
    ['fact5', 'Five factorial', '5!', 120], ['m127', 'Mersenne prime 127', '127', 127], ['gross', 'Gross', '144', 144],
    ['perfect496', 'Third perfect number', '496', 496], ['thousand', 'Thousand', '10³', 1000],
    ['kibi', 'Two to the ten', '2¹⁰', 1024], ['taxicab', 'Taxicab number', '1729', 1729], ['fact7', 'Seven factorial', '7!', 5040],
    ['kaprekar', "Kaprekar's constant", '6174', 6174], ['perfect8128', 'Fourth perfect number', '8128', 8128],
    ['m8191', 'Mersenne prime 8191', '8191', 8191], ['catalan10', 'Tenth Catalan number', 'C₁₀', 16796],
    ['ackermann', 'Ackermann A(4, 1)', 'A(4,1)', 65533], ['two16', 'Two to the sixteen', '2¹⁶', 65536],
    ['bell10', 'Tenth Bell number', 'B₁₀', 115975], ['m17', 'Mersenne prime 2¹⁷ − 1', 'M₁₇', 131071],
    ['m19', 'Mersenne prime 2¹⁹ − 1', 'M₁₉', 524287], ['fib30', 'Thirtieth Fibonacci number', 'F₃₀', 832040],
    ['fact10', 'Ten factorial', '10!', 3628800], ['perfect5', 'Fifth perfect number', '33550336', 33550336],
    ['busyBeaver', 'Busy beaver BB(5)', 'BB(5)', 47176870], ['taxicab3', 'Third taxicab number', 'Ta(3)', 87539319],
    ['lucas40', 'Fortieth Lucas number', 'L₄₀', 228826127], ['bell15', 'Fifteenth Bell number', 'B₁₅', 1382958545],
    ['m31b', 'Mersenne prime 2³¹ − 1', 'M₃₁', 2147483647], ['two32', 'Two to the thirty-two', '2³²', 4294967296],
    ['primorial29', 'Primorial of 29', '29#', 6469693230], ['catalan20', 'Twentieth Catalan number', 'C₂₀', 6564120420],
    ['perfect6', 'Sixth perfect number', '8589869056', 8589869056], ['fib50', 'Fiftieth Fibonacci number', 'F₅₀', 12586269025],
    ['tetra33', 'Three tetrated to three', '³3', 7625597484987], ['ramanujan', "Ramanujan's constant", 'e^(π√163)', 262537412640768744],
    ['fact20', 'Twenty factorial', '20!', 2432902008176640000], ['m61', 'Mersenne prime 2⁶¹ − 1', 'M₆₁', 2305843009213693951],
    ['two64', 'Two to the sixty-four', '2⁶⁴', 18446744073709551616], ['rubik', "Rubik's cube positions", '4.3 × 10¹⁹', 43252003274489856000],
    ['fact25', 'Twenty-five factorial', '25!', 15511210043330985984000000], ['m89', 'Mersenne prime 2⁸⁹ − 1', 'M₈₉', { log: 26.79169 }],
    ['m127b', 'Mersenne prime 2¹²⁷ − 1', 'M₁₂₇', { log: 38.23081 }], ['monster', 'Order of the Monster group', '|M|', { log: 53.90742 }],
    ['deck', 'Orderings of a 52-card deck', '52!', { log: 67.90665 }], ['googol', 'Googol', '10¹⁰⁰', { log: 100 }],
    ['shannon', 'Shannon number', '10¹²⁰', { log: 120 }], ['fact100', 'One hundred factorial', '100!', { log: 157.97000 }],
    ['centillion', 'Centillion', '10³⁰³', { log: 303 }], ['two5', 'Two tetrated to five', '⁵2', { log: 19728.30170 }],
  ];
  const MULT_UNITS = 1e15;

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

    function recur3(a, b, c, f) {
      const out = new Set();
      for (; a < SPACE; [a, b, c] = [b, c, f(a, b, c)]) out.add(a);
      return out;
    }
    const POW5 = seq(k => 5 ** k), POW6 = seq(k => 6 ** k), POW7 = seq(k => 7 ** k);
    const FIFTH = seq(k => k ** 5), SIXTH = seq(k => k ** 6);
    const PRONIC = seq(k => k * (k + 1));
    const OCT = seq(k => k * (3 * k - 2));
    const HEPT = seq(k => (k * (5 * k - 3)) / 2);
    const CSQ = seq(k => 2 * k * (k + 1) + 1);
    const CHEX = seq(k => 3 * k * (k + 1) + 1);
    const SQPYR = seq(k => (k * (k + 1) * (2 * k + 1)) / 6);
    const PENTATOPE = seq(k => (k * (k + 1) * (k + 2) * (k + 3)) / 24);
    const CATERER = seq(k => (k * (k + 1)) / 2 + 1);
    const MERSENNE = seq(k => 2 ** (k + 1) - 1);
    const FERMAT = seq(k => (k > 5 ? SPACE : 2 ** (2 ** k) + 1));
    const REPUNIT = seq(k => (10 ** (k + 1) - 1) / 9);
    const DFACT = seq(k => { let f = 1; for (let i = k + 1; i > 1; i -= 2) f *= i; return f; });
    const TRIB = recur3(0, 0, 1, (a, b, c) => a + b + c);
    const PADOVAN = recur3(1, 1, 1, (a, b) => a + b);
    const PERRIN = recur3(3, 0, 2, (a, b) => a + b);
    const JACOB = recur(0, 1, (a, b) => b + 2 * a);
    const PELL_LUCAS = recur(2, 2, (a, b) => 2 * b + a);
    const LEONARDO = recur(1, 1, (a, b) => a + b + 1);
    const SYLVESTER = new Set();
    for (let v = 2; v < SPACE; v = v * v - v + 1) SYLVESTER.add(v);
    const MOTZKIN = new Set();
    for (let m = [1, 1]; m[m.length - 1] < SPACE || m.length < 3;) {
      for (const v of m) if (v < SPACE) MOTZKIN.add(v);
      const k = m.length; // M(k) = ((2k+1)M(k-1) + 3(k-1)M(k-2)) / (k+2)
      m.push(((2 * k + 1) * m[k - 1] + 3 * (k - 1) * m[k - 2]) / (k + 2));
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
    // Every digit of `need` appears somewhere.
    const needDigitsDfa = need => {
      const full = need.reduce((m, d) => m | (1 << d), 0);
      return recDfa([0], ([m], d) => [m | ((full >> d) & 1 ? 1 << d : 0)], ([m]) => m === full);
    };
    // Full length with no two neighbours equal.
    const restlessDfa = recDfa([-1, 0], ([last, len], d) => (d === last ? DEAD : [d, len + 1]), ([, len]) => len === DIGITS);
    // Full length with as many odd digits as even ones.
    const balancedDfa = recDfa([0, 0], ([len, odd], d) => [len + 1, odd + (d % 2)], ([len, odd]) => len === DIGITS && 2 * odd === DIGITS);
    // Full-length numbers whose first half and second half have equal digit sums (even lengths only).
    function luckyTicketCount() {
      if (DIGITS % 2) return 0;
      const h = DIGITS / 2, ways = lead => {
        let dp = [1];
        for (let i = 0; i < h; i++) {
          const next = new Array(dp.length + 9).fill(0);
          dp.forEach((c, s) => { for (let d = i === 0 && lead ? 1 : 0; d <= 9; d++) next[s + d] += c; });
          dp = next;
        }
        return dp;
      };
      const a = ways(true), b = ways(false);
      return a.reduce((t, c, s) => t + c * (b[s] || 0), 0);
    }
    const isLuckyTicket = s => s.length === DIGITS && DIGITS % 2 === 0
      && digitSum(s.slice(0, DIGITS / 2)) === digitSum(s.slice(DIGITS / 2));
    const isComplement = s => s.length === DIGITS && [...s].every((c, i) => +c + +s[DIGITS - 1 - i] === 9);

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

    // The v3.1 badges: as many again as before, every one still counted exactly.
    const PR100 = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97]);
    const isSq = t => Number.isInteger(Math.sqrt(t));
    const DIGIT_WORDS = ['Zeros', 'Ones', 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes', 'Sevens', 'Eights', 'Nines'];
    const DIGIT_NAMES = ['Zero Hoard', 'Ones Rally', "Two's Company", 'Third Time Lucky', 'Four Score', 'High Five', 'Six Pack', 'Lucky Streak', 'Eight Ball', 'Cloud Nine'];
    const among = (id, cat, name, desc, list, test) => { const set = new Set(list); return { id, cat, name, desc, among: set, test: (n, s, c) => set.has(n) && test(n, s, c) }; };
    const ULTRA = Math.round((DIGITS * 85) / 10);
    const MORE_BADGES = [
      // Size
      { id: 'lowHalf', cat: 'Size', name: 'Lower Half', desc: `Below ${fmt(SPACE / 2)}`, group: 'half', count: SPACE / 2, test: n => n < SPACE / 2 },
      { id: 'topTenth', cat: 'Size', name: 'Top Shelf', desc: `${fmt(SPACE - SPACE / 10)} or more`, group: 'top', count: SPACE / 10, test: n => n >= SPACE - SPACE / 10 },
      { id: 'top100', cat: 'Size', name: 'Top Hundred', desc: `${fmt(SPACE - 100)} or more`, group: 'top', count: 100, test: n => n >= SPACE - 100 },
      { id: 'maxed', cat: 'Size', name: 'Maxed Out', desc: `Exactly ${fmt(SPACE - 1)}, the biggest roll there is`, group: 'top', count: 1, test: n => n === SPACE - 1 },
      { id: 'quarter', cat: 'Size', name: 'Quarter Mark', desc: `Within 500 of ${fmt(SPACE / 4)} or ${fmt((3 * SPACE) / 4)}`, count: 1998, test: n => Math.abs(n - SPACE / 4) < 500 || Math.abs(n - (3 * SPACE) / 4) < 500 },

      // Math
      ...[[17, 'Seventeen', 'A multiple of 17'], [19, 'Nineteen', 'A multiple of 19'], [23, 'Michael Jordan', 'A multiple of 23'],
        [37, 'Thirty-Seven', 'A multiple of 37'], [99, 'Ninety-Nine', 'A multiple of 99'], [101, 'Hundred and One', 'A multiple of 101'],
        [12, 'By the Dozen', 'A multiple of 12'], [360, 'Full Turn', 'A multiple of 360'], [365, 'Year Long', 'A multiple of 365'],
        [1001, 'Scheherazade', 'A multiple of 1001'], [1024, 'Kibibyte', 'A multiple of 1024'], [1729, 'Taxicab Multiple', 'A multiple of 1729'],
        [3600, 'Hour in Seconds', 'A multiple of 3,600'], [86400, 'Day in Seconds', 'A multiple of 86,400'], [65536, 'Sixty-Five K', 'A multiple of 65,536']]
        .map(([m, name, desc]) => ({ id: 'div' + m, cat: 'Math', name, desc, count: multiples(m), test: n => n % m === 0 })),
      { id: 'lcm18', cat: 'Math', name: 'Mega Divisible', desc: 'Divisible by every number from 1 to 18', group: 'lcm', count: multiples(12252240), test: n => n % 12252240 === 0 },
      { id: 'lcm20', cat: 'Math', name: 'Giga Divisible', desc: 'Divisible by every number from 1 to 20', group: 'lcm', count: multiples(232792560), test: n => n % 232792560 === 0 },
      { id: 'r1e8', cat: 'Math', name: 'Round Hundred Million', desc: 'Ends in 00000000', group: 'round', count: multiples(1e8), test: n => n % 1e8 === 0 },
      { id: 'r1e9', cat: 'Math', name: 'Round Billion', desc: 'Ends in 000000000', group: 'round', count: multiples(1e9), test: n => n % 1e9 === 0 },
      { id: 'end7', cat: 'Math', name: 'Lucky Ending', desc: 'Ends in 7', count: congruent(7, 10), test: n => n % 10 === 7 },
      { id: 'end25', cat: 'Math', name: 'Quarter Past', desc: 'Ends in 25', count: congruent(25, 100), test: n => n % 100 === 25 },
      { id: 'end69', cat: 'Math', name: 'Nice Finish', desc: 'Ends in 69', count: congruent(69, 100), test: n => n % 100 === 69 },
      { id: 'end420', cat: 'Math', name: 'Blaze Finish', desc: 'Ends in 420', count: congruent(420, 1000), test: n => n % 1000 === 420 },
      { id: 'end1234', cat: 'Math', name: 'Count to Four', desc: 'Ends in 1234', count: congruent(1234, 1e4), test: n => n % 1e4 === 1234 },
      { id: 'pow5', cat: 'Math', name: 'Power of Five', desc: '1, 5, 25, 125…', set: POW5, test: has(POW5) },
      { id: 'pow6', cat: 'Math', name: 'Power of Six', desc: '1, 6, 36, 216…', set: POW6, test: has(POW6) },
      { id: 'pow7', cat: 'Math', name: 'Power of Seven', desc: '1, 7, 49, 343…', set: POW7, test: has(POW7) },
      { id: 'fifth', cat: 'Math', name: 'Fifth Power', desc: 'Some whole number to the 5th', group: 'power', set: FIFTH, test: has(FIFTH) },
      { id: 'sixth', cat: 'Math', name: 'Sixth Power', desc: 'Some whole number to the 6th', group: 'power', set: SIXTH, test: has(SIXTH) },
      { id: 'mersenne', cat: 'Math', name: 'Mersenne Number', desc: 'One less than a power of two', set: MERSENNE, test: has(MERSENNE) },
      { id: 'fermat', cat: 'Math', name: 'Fermat Number', desc: '3, 5, 17, 257, 65537…', set: FERMAT, test: has(FERMAT) },
      { id: 'dfact', cat: 'Math', name: 'Double Factorial', desc: 'k!!, like 7 × 5 × 3 × 1', set: DFACT, test: has(DFACT) },

      // Sequences
      { id: 'trib', cat: 'Sequences', name: 'Tribonacci', desc: 'Each term the sum of the three before: 0, 0, 1, 1, 2, 4, 7, 13…', set: TRIB, test: has(TRIB) },
      { id: 'padovan', cat: 'Sequences', name: 'Padovan', desc: '1, 1, 1, 2, 2, 3, 4, 5, 7, 9…', set: PADOVAN, test: has(PADOVAN) },
      { id: 'perrin', cat: 'Sequences', name: 'Perrin', desc: '3, 0, 2, 3, 2, 5, 5, 7, 10…', set: PERRIN, test: has(PERRIN) },
      { id: 'jacob', cat: 'Sequences', name: 'Jacobsthal', desc: '0, 1, 1, 3, 5, 11, 21, 43…', set: JACOB, test: has(JACOB) },
      { id: 'pellLucas', cat: 'Sequences', name: 'Pell-Lucas', desc: '2, 2, 6, 14, 34, 82…', set: PELL_LUCAS, test: has(PELL_LUCAS) },
      { id: 'leonardo', cat: 'Sequences', name: 'Leonardo', desc: '1, 1, 3, 5, 9, 15, 25…', set: LEONARDO, test: has(LEONARDO) },
      { id: 'sylvester', cat: 'Sequences', name: 'Sylvester', desc: '2, 3, 7, 43, 1807…', set: SYLVESTER, test: has(SYLVESTER) },
      { id: 'motzkin', cat: 'Sequences', name: 'Motzkin', desc: '1, 1, 2, 4, 9, 21, 51…', set: MOTZKIN, test: has(MOTZKIN) },
      { id: 'pronic', cat: 'Sequences', name: 'Pronic', desc: 'k × (k + 1): 2, 6, 12, 20…', set: PRONIC, test: has(PRONIC) },
      { id: 'oct', cat: 'Sequences', name: 'Octagonal', desc: '1, 8, 21, 40, 65…', set: OCT, test: has(OCT) },
      { id: 'hept', cat: 'Sequences', name: 'Heptagonal', desc: '1, 7, 18, 34, 55…', set: HEPT, test: has(HEPT) },
      { id: 'csq', cat: 'Sequences', name: 'Centered Square', desc: '1, 5, 13, 25, 41…', set: CSQ, test: has(CSQ) },
      { id: 'chex', cat: 'Sequences', name: 'Hex Number', desc: 'Centered hexagonal: 1, 7, 19, 37, 61…', set: CHEX, test: has(CHEX) },
      { id: 'sqpyr', cat: 'Sequences', name: 'Square Pyramid', desc: 'A stack of squares: 1, 5, 14, 30, 55…', set: SQPYR, test: has(SQPYR) },
      { id: 'pentatope', cat: 'Sequences', name: 'Pentatope', desc: '1, 5, 15, 35, 70…', set: PENTATOPE, test: has(PENTATOPE) },
      { id: 'caterer', cat: 'Sequences', name: 'Lazy Caterer', desc: 'The most pieces k straight cuts make of a pancake', set: CATERER, test: has(CATERER) },
      { id: 'repunit', cat: 'Sequences', name: 'Repunit', desc: '1, 11, 111, 1111…', set: REPUNIT, test: has(REPUNIT) },

      // Digits
      { id: 'lead1', cat: 'Digits', name: "Benford's Favourite", desc: 'Starts with 1', group: 'lead', count: prefixCount(1), test: (n, s) => s[0] === '1' },
      { id: 'lead9', cat: 'Digits', name: 'Top Digit', desc: 'Starts with 9', group: 'lead', count: prefixCount(1), test: (n, s) => s[0] === '9' },
      { id: 'lead123', cat: 'Digits', name: 'Lift Off', desc: 'Starts with 123', group: 'lead', count: prefixCount(3), test: (n, s) => s.startsWith('123') },
      { id: 'lead999', cat: 'Digits', name: 'Nines First', desc: 'Starts with 999', group: 'lead', count: prefixCount(3), test: (n, s) => s.startsWith('999') },
      { id: 'run6', cat: 'Digits', name: 'Sextet', desc: 'The same digit six times in a row', group: 'run', dfa: runDfa(6), test: (n, s) => maxRun(s) >= 6 },
      { id: 'run8', cat: 'Digits', name: 'Octave', desc: 'The same digit eight times in a row', group: 'run', dfa: runDfa(8), test: (n, s) => maxRun(s) >= 8 },
      { id: 'run9', cat: 'Digits', name: 'Nine in a Row', desc: 'The same digit nine times in a row', group: 'run', dfa: runDfa(9), test: (n, s) => maxRun(s) >= 9 },
      ...DIGIT_NAMES.map((name, d) => {
        const k = d === 7 ? 6 : 5;
        return { id: `many${d}`, cat: 'Digits', name, desc: `${k} or more ${DIGIT_WORDS[d].toLowerCase()} anywhere`, dfa: digitCountDfa(d, k), test: (n, s) => countOf(s, String(d)) >= k };
      }),
      { id: 'almostPan', cat: 'Digits', name: 'Almost Pandigital', desc: `${LENGTH_NAMES[DIGITS]} using exactly ${DIGITS - 1} different digits`, dfa: distinctDfa(DIGITS - 1, DIGITS), test: (n, s) => s.length === DIGITS && distinct(s) === DIGITS - 1 },
      { id: 'tone4', cat: 'Digits', name: 'Four-Tone', desc: 'Eight or more digits, using exactly four different ones', dfa: distinctDfa(4, 8), test: (n, s) => s.length >= 8 && distinct(s) === 4 },
      { id: 'restless', cat: 'Digits', name: 'Restless', desc: `${LENGTH_NAMES[DIGITS]} with no digit next to its twin`, dfa: restlessDfa, test: (n, s) => s.length === DIGITS && !/(\d)\1/.test(s) },
      { id: 'balanced', cat: 'Digits', name: 'Balanced', desc: `${LENGTH_NAMES[DIGITS]}, half odd and half even`, dfa: balancedDfa, test: (n, s) => s.length === DIGITS && 2 * [...s].filter(c => c % 2).length === DIGITS },
      { id: 'sum7', cat: 'Digits', name: 'Lucky Sum', desc: 'Digits add up to exactly 7', dfa: digitSumDfa(t => t === 7), test: (n, s) => digitSum(s) === 7 },
      { id: 'sum13', cat: 'Digits', name: 'Unlucky Sum', desc: 'Digits add up to exactly 13', dfa: digitSumDfa(t => t === 13), test: (n, s) => digitSum(s) === 13 },
      { id: 'sum42', cat: 'Digits', name: 'Sum of Everything', desc: 'Digits add up to exactly 42', dfa: digitSumDfa(t => t === 42), test: (n, s) => digitSum(s) === 42 },
      { id: 'sum69', cat: 'Digits', name: 'Nice Sum', desc: 'Digits add up to exactly 69', dfa: digitSumDfa(t => t === 69), test: (n, s) => digitSum(s) === 69 },
      { id: 'sum45', cat: 'Digits', name: 'Full Count', desc: 'Digits add up to exactly 45, like 0 to 9 once each', dfa: digitSumDfa(t => t === 45), test: (n, s) => digitSum(s) === 45 },
      { id: 'sumPrime', cat: 'Digits', name: 'Prime Sum', desc: 'Digits add up to a prime', dfa: digitSumDfa(t => PR100.has(t)), test: (n, s) => PR100.has(digitSum(s)) },
      { id: 'sumSquare', cat: 'Digits', name: 'Square Sum', desc: 'Digits add up to a perfect square', dfa: digitSumDfa(isSq), test: (n, s) => isSq(digitSum(s)) },
      { id: 'sumRound', cat: 'Digits', name: 'Round Sum', desc: 'Digits add up to a multiple of 10', dfa: digitSumDfa(t => t % 10 === 0), test: (n, s) => digitSum(s) % 10 === 0 },
      { id: 'ultra', cat: 'Digits', name: 'Ultraheavy', desc: `Digits add up to ${ULTRA} or more`, dfa: digitSumDfa(t => t >= ULTRA), test: (n, s) => digitSum(s) >= ULTRA },
      { id: 'paper', cat: 'Digits', name: 'Paperweight', desc: 'Digits add up to 2 or less', dfa: digitSumDfa(t => t <= 2), test: (n, s) => digitSum(s) <= 2 },
      { id: 'complement', cat: 'Digits', name: 'Complement', desc: `${LENGTH_NAMES[DIGITS]} where each digit and its mirror image add up to 9`, count: DIGITS % 2 ? 0 : 9 * 10 ** (DIGITS / 2 - 1), test: (n, s) => isComplement(s) },
      { id: 'ticket', cat: 'Digits', name: 'Lucky Ticket', desc: `${LENGTH_NAMES[DIGITS]} whose two halves have the same digit sum`, count: luckyTicketCount(), test: (n, s) => isLuckyTicket(s) },
      {
        id: 'outer', cat: 'Digits', name: 'Outer Mirror', desc: 'Four or more digits, with the first two mirrored at the end, like 12…21',
        count: Array.from({ length: Math.max(0, DIGITS - 3) }, (_, i) => 90 * 10 ** i).reduce((a, b) => a + b, 0),
        test: (n, s) => s.length >= 4 && s[0] === s[s.length - 1] && s[1] === s[s.length - 2],
      },
      { id: 'allOdd', cat: 'Digits', name: 'Odd Collection', desc: 'Has every odd digit: 1, 3, 5, 7 and 9', dfa: needDigitsDfa([1, 3, 5, 7, 9]), test: (n, s) => [...'13579'].every(c => s.includes(c)) },
      { id: 'allEven', cat: 'Digits', name: 'Even Collection', desc: 'Has every even digit: 0, 2, 4, 6 and 8', dfa: needDigitsDfa([0, 2, 4, 6, 8]), test: (n, s) => [...'02468'].every(c => s.includes(c)) },
      { id: 'allPrime', cat: 'Digits', name: 'Prime Collection', desc: 'Has every prime digit: 2, 3, 5 and 7', dfa: needDigitsDfa([2, 3, 5, 7]), test: (n, s) => [...'2357'].every(c => s.includes(c)) },
      { id: 'noSeven', cat: 'Digits', name: 'Seven-Less', desc: `${LENGTH_NAMES[DIGITS]} without a single 7`, count: 8 * 9 ** (DIGITS - 1), test: (n, s) => s.length === DIGITS && !s.includes('7') },

      // Memes
      contains('c13', '13', 'Unlucky'),
      contains('c21', '21', 'Blackjack'),
      contains('c51', '51', 'Area 51'),
      contains('c64', '64', 'Sixty-Four Bits'),
      contains('c99', '99', '99 Problems'),
      contains('c101', '101', 'Dalmatians'),
      contains('c255', '255', 'Full Byte'),
      contains('c360', '360', 'No Scope'),
      contains('c500', '500', 'Server Error'),
      contains('c747', '747', 'Jumbo Jet'),
      contains('c1024', '1024', 'Kilobyte'),
      contains('c1138', '1138', 'THX'),
      contains('c1701', '1701', 'Starship'),
      contains('c1729', '1729', 'Hardy-Ramanujan'),
      contains('c1776', '1776', 'Independence'),
      contains('c1999', '1999', 'Party Like It'),
      contains('c2000', '2000', 'Y2K'),
      contains('c2001', '2001', 'Space Odyssey'),
      contains('c2020', '2020', 'Hindsight'),
      contains('c2048', '2048', 'Merge Tiles'),
      contains('c3000', '3000', 'Love You 3000'),
      contains('c7734', '7734', 'Upside-Down Hello'),
      contains('c8888', '8888', 'Fortune'),
      contains('c9000', '9000', 'Over Nine Thousand'),
      contains('c0101', '0101', 'New Year'),
      contains('c0214', '0214', 'Valentine'),
      contains('c1031', '1031', 'Spooky'),
      contains('c1225', '1225', 'Festive'),
      contains('c12345', '12345', 'Luggage Combination', 'Contains 12345, the worst luggage code'),
      contains('c42069', '42069', 'The Ultimate Meme'),
      contains('c314159', '314159', 'Big Slice of Pi'),
      contains('c271828', '271828', 'Big e'),
      contains('c4815162342', '4815162342', 'Lost', 'Exactly 4 8 15 16 23 42'),
      contains('c9876', '9876', 'Countdown'),
      contains('c2112', '2112', 'Palindrome Year'),
      contains('c1492', '1492', 'Ocean Blue'),
      contains('c1969', '1969', 'Moon Landing'),
      contains('c6174', '6174', 'Kaprekar Inside'),
      contains('c161803', '161803', 'Golden Slice'),
      contains('c11235', '11235', 'Fibonacci Start'),
      contains('c24601', '24601', 'Prisoner Number'),
      contains('c4096', '4096', 'Four Kay'),

      // Combos
      among('fibSquare', 'Combos', 'Fibonacci Square', 'A Fibonacci number that is a perfect square', FIB, n => SQUARES.has(n)),
      among('fibTri', 'Combos', 'Triangular Fibonacci', 'A Fibonacci number that is triangular', FIB, n => TRI.has(n)),
      among('fibPal', 'Combos', 'Fibonacci Palindrome', 'A Fibonacci number that is a palindrome', FIB, (n, s) => isPal(s)),
      among('lucasPrime', 'Combos', 'Lucas Prime', 'A Lucas number that is prime', LUCAS, (n, s, c) => c.prime),
      among('pellPrime', 'Combos', 'Pell Prime', 'A Pell number that is prime', PELL, (n, s, c) => c.prime),
      among('mersPrime', 'Combos', 'Mersenne Prime', 'One less than a power of two, and prime', MERSENNE, (n, s, c) => c.prime),
      among('fermatPrime', 'Combos', 'Fermat Prime', 'A Fermat number that is prime', FERMAT, (n, s, c) => c.prime),
      among('tribPrime', 'Combos', 'Tribonacci Prime', 'A Tribonacci number that is prime', TRIB, (n, s, c) => c.prime),
      among('starPrime', 'Combos', 'Star Prime', 'A star number that is prime', STAR, (n, s, c) => c.prime),
      among('csqPrime', 'Combos', 'Centered Square Prime', 'A centered square number that is prime', CSQ, (n, s, c) => c.prime),
      among('repTri', 'Combos', 'Repdigit Triangle', 'A repdigit that is triangular, like 666', REPDIGITS, n => TRI.has(n)),
      among('pronicPal', 'Combos', 'Mirror Pronic', 'A pronic number that is a palindrome', PRONIC, (n, s) => isPal(s)),
      among('pyrSquare', 'Combos', 'Cannonball', 'A square pyramid that is also a perfect square', SQPYR, n => SQUARES.has(n)),
      among('happySquare', 'Combos', 'Happy Square', 'A perfect square that is a happy number', SQUARES, n => isHappy(n)),
      among('happyCube', 'Combos', 'Happy Cube', 'A perfect cube that is a happy number', CUBES, n => isHappy(n)),
      among('powPal', 'Combos', 'Mirror Power', 'A perfect power that is a palindrome', PERFECT_POWERS, (n, s) => isPal(s)),
      { id: 'binHappy', cat: 'Combos', name: 'Happy Binary', desc: 'Only 0s and 1s, and a happy number', dfa: andDfa(onlyDigitsDfa([0, 1]), happyDfa), test: (n, s) => /^[01]+$/.test(s) && isHappy(n) },
      { id: 'oddStairs', cat: 'Combos', name: 'Odd Staircase', desc: 'Odd digits only, each higher than the last, at least three', dfa: andDfa(onlyDigitsDfa([1, 3, 5, 7, 9]), monotoneDfa(1, 3)), test: (n, s) => /^[13579]+$/.test(s) && s.length >= 3 && isStrictlyMonotone(s, 1) },
      { id: 'evenStairs', cat: 'Combos', name: 'Even Staircase', desc: 'Even digits only, each higher than the last, at least three', dfa: andDfa(onlyDigitsDfa([0, 2, 4, 6, 8]), monotoneDfa(1, 3)), test: (n, s) => /^[02468]+$/.test(s) && s.length >= 3 && isStrictlyMonotone(s, 1) },
      { id: 'binRun', cat: 'Combos', name: 'Binary Run', desc: 'Only 0s and 1s, with five of one in a row', dfa: andDfa(onlyDigitsDfa([0, 1]), runDfa(5)), test: (n, s) => /^[01]+$/.test(s) && maxRun(s) >= 5 },
      { id: 'trinity', cat: 'Combos', name: 'Holy Trinity', desc: 'Contains 42, 69 and 420', dfa: andDfa(andDfa(containsDfa('42'), containsDfa('69')), containsDfa('420')), test: (n, s) => s.includes('42') && s.includes('69') && s.includes('420') },
      { id: 'leetNice', cat: 'Combos', name: 'Elite and Nice', desc: 'Contains both 1337 and 69', dfa: andDfa(containsDfa('1337'), containsDfa('69')), test: (n, s) => s.includes('1337') && s.includes('69') },
      { id: 'beastHeavy', cat: 'Combos', name: 'Heavy Metal', desc: `Contains 666, and the digits add up to ${HEAVY_HAPPY} or more`, dfa: andDfa(containsDfa('666'), digitSumDfa(t => t >= HEAVY_HAPPY)), test: (n, s) => s.includes('666') && digitSum(s) >= HEAVY_HAPPY },
      { id: 'luckySum', cat: 'Combos', name: 'Lucky All Over', desc: 'Contains 777, and the digits add up to a multiple of 7', dfa: andDfa(containsDfa('777'), digitSumDfa(t => t % 7 === 0)), test: (n, s) => s.includes('777') && digitSum(s) % 7 === 0 },
    ];

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
      ...MORE_BADGES,
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
    const GOOGOL = thresholds(100), BIGBANG = thresholds(200), STARS = thresholds(300);
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
      { id: 'eFive', name: 'High Five', desc: 'Rolled an exponent of exactly 5', group: 'exp', prob: pExp(5), test: (n, s, c) => c.e === 5 },
      { id: 'eSix', name: 'Sixth Gear', desc: 'Rolled an exponent of exactly 6', group: 'exp', prob: pExp(6), test: (n, s, c) => c.e === 6 },
      { id: 'eTen', name: 'Double Digits', desc: 'Rolled an exponent of 10 or more', group: 'exp', prob: pAtLeast(10), test: (n, s, c) => c.e >= 10 },
      { id: 'eMax', name: 'Redline', desc: `Rolled the top exponent, ${E_MAX}`, group: 'exp', prob: pAtLeast(E_MAX), test: (n, s, c) => c.e >= E_MAX },
      { id: 'stars', name: 'Count the Stars', desc: 'The result has at least 301 digits', group: 'huge', prob: pBeyond(STARS), test: (n, s, c) => c.e >= 1 && n >= STARS[c.e] },
      { id: 'selfpow', name: 'Self Power', desc: 'The base equals the exponent, like 3³', prob: 1 / SPACE, test: (n, s, c) => n === c.e },
      { id: 'oneUp', name: 'Still One', desc: 'A base of 1, so the result is just 1', prob: 1 / SPACE, test: n => n === 1 },
    ].map(b => ({ ...b, cat: 'Powers', power: true, factor: b.group === 'exp' || b.group === 'huge' }));
    // Badges with `factor` multiply the score after the power instead of adding EP before it, so
    // the base EP stays independent of the exponent (which keeps the 1/N calculation exact).

    // Modulo mode: a modulus m is rolled uniformly from 2 to 9,999, and r = n mod m.
    const M_LO = 2, M_HI = 9999, M_COUNT = M_HI - M_LO + 1;
    const pMod = rem => { let t = 0; for (let m = M_LO; m <= M_HI; m++) { const r = rem(m); if (r !== null) t += congruent(r, m); } return t / M_COUNT / SPACE; };
    const MOD_BADGES = [
      { id: 'modClean', name: 'Clean Divide', desc: 'The modulus divides your number exactly', group: 'mod', prob: pMod(() => 0), test: (n, s, c) => c.r === 0 },
      { id: 'modBig', name: 'Big Divide', desc: 'A modulus of 5,000 or more divides your number exactly', group: 'mod', prob: pMod(m => (m >= 5000 ? 0 : null)), test: (n, s, c) => c.r === 0 && c.m >= 5000 },
      { id: 'modOne', name: 'Remainder One', desc: 'Dividing by the modulus leaves exactly 1', group: 'mod', prob: pMod(() => 1), test: (n, s, c) => c.r === 1 },
      { id: 'modShort', name: 'Just Short', desc: 'One more and the modulus would divide it', group: 'mod', prob: pMod(m => m - 1), test: (n, s, c) => c.r === c.m - 1 },
      { id: 'modTwo', name: 'Remainder Two', desc: 'Dividing by the modulus leaves exactly 2', group: 'mod', prob: pMod(m => (m > 2 ? 2 : null)), test: (n, s, c) => c.r === 2 },
      { id: 'mod42', name: 'Remainder 42', desc: 'Dividing by the modulus leaves exactly 42', group: 'mod', prob: pMod(m => (m > 42 ? 42 : null)), test: (n, s, c) => c.r === 42 },
      { id: 'modTiny', name: 'Small Change', desc: 'A modulus of 10 or less divides your number exactly', group: 'mod', prob: pMod(m => (m <= 10 ? 0 : null)), test: (n, s, c) => c.r === 0 && c.m <= 10 },
      { id: 'modThird', name: 'One Third', desc: 'The remainder is exactly a third of the modulus', group: 'mod', prob: pMod(m => (m % 3 ? null : m / 3)), test: (n, s, c) => c.r * 3 === c.m },
      { id: 'modHalf', name: 'Halfway', desc: 'The remainder is exactly half the modulus', group: 'mod', prob: pMod(m => (m % 2 ? null : m / 2)), test: (n, s, c) => c.r * 2 === c.m },
    ].map(b => ({ ...b, cat: 'Modulo', mode: 'mod' }));

    // Target mode: a target t is rolled uniformly and D = |n - t|.
    // Ordered pairs (n, t) with D < d number SPACE(2d - 1) - d(d - 1).
    const pWithin = d => Number(((BigInt(SPACE) * BigInt(2 * d - 1) - BigInt(d) * BigInt(d - 1)) * 10n ** 18n) / (BigInt(SPACE) * BigInt(SPACE))) / 1e18;
    const TARGET_BADGES = [
      { id: 'tBull', name: 'Bullseye', desc: 'Landed exactly on the target', d: 1 },
      { id: 't10', name: 'Point Blank', desc: 'Within 10 of the target', d: 10 },
      { id: 't100', name: 'Hair Width', desc: 'Within 100 of the target', d: 100 },
      { id: 't1k', name: 'Close Call', desc: 'Within 1,000 of the target', d: 1000 },
      { id: 't100k', name: 'Near Miss', desc: 'Within 100,000 of the target', d: 1e5 },
      { id: 't1m', name: 'In Range', desc: 'Within 1,000,000 of the target', d: 1e6 },
      { id: 't1pct', name: 'Warm', desc: 'Within 1% of the whole range from the target', d: SPACE / 100 },
    ].filter(b => b.d <= SPACE / 100)
      .map(b => ({ ...b, cat: 'Target', mode: 'target', group: 'target', prob: pWithin(b.d), test: (n, s, c) => c.D < b.d }));

    // Prime radar: d is the distance from n to the nearest prime (0 when n is prime).
    function nearestPrimeDistance(n) {
      if (P.isPrime(n)) return 0;
      for (let k = 1; ; k++) if (P.isPrime(n - k) || P.isPrime(n + k)) return k;
    }
    const RADAR_BADGES = [
      { id: 'radarNext', name: 'Next Door', desc: 'One away from a prime', group: 'radarNear', test: (n, s, c) => c.d === 1 },
      { id: 'radarNear', name: 'Within Reach', desc: 'Two or three away from the nearest prime', group: 'radarNear', test: (n, s, c) => c.d === 2 || c.d === 3 },
      { id: 'radarOn', name: 'Direct Hit', desc: 'Landed right on a prime', group: 'radarNear', test: (n, s, c) => c.d === 0 },
      { id: 'radarFive', name: 'Almost There', desc: 'Four or five away from the nearest prime', group: 'radarNear', test: (n, s, c) => c.d === 4 || c.d === 5 },
      { id: 'radar10', name: 'Open Ground', desc: 'At least 10 away from every prime', group: 'radarFar', test: (n, s, c) => c.d >= 10 },
      { id: 'radar30', name: 'Wilderness', desc: 'At least 30 away from every prime', group: 'radarFar', test: (n, s, c) => c.d >= 30 },
      { id: 'radar20', name: 'Lonely Stretch', desc: 'At least 20 away from every prime', group: 'radarFar', test: (n, s, c) => c.d >= 20 },
      { id: 'radar50', name: 'Prime Desert', desc: 'At least 50 away from every prime', group: 'radarFar', test: (n, s, c) => c.d >= 50 },
      { id: 'radar100', name: 'Prime Wasteland', desc: 'At least 100 away from every prime', group: 'radarFar', test: (n, s, c) => c.d >= 100 },
    ].map(b => ({ ...b, cat: 'Radar', mode: 'radar', sieve: true }));

    const MODES = [
      { id: 'classic', name: 'Classic', badges: [], desc: 'Your score is the EP of every badge, times the multiplier.' },
      { id: 'exp', name: 'Exponent', badges: POWER_BADGES, desc: 'An exponent is rolled too: 2 a quarter of the time, 3 an eighth, and so on. Your score is raised to it.' },
      { id: 'mod', name: 'Modulo', badges: MOD_BADGES, desc: `A modulus from 2 to ${fmt(M_HI)} is rolled too. If it divides your number, your score is multiplied by it.` },
      { id: 'target', name: 'Target', badges: TARGET_BADGES, desc: `A target number is rolled too. The closer you land, the bigger the bonus, up to ×${fmt(SPACE)} for a bullseye.` },
      { id: 'radar', name: 'Prime radar', badges: RADAR_BADGES, desc: 'Shows the nearest prime. Landing beside one, or far from every prime, earns extra badges.' },
    ];
    const MODE_BY_ID = Object.fromEntries(MODES.map(m => [m.id, m]));

    // One ladder for badges, multipliers and whole rolls, by 1 in N. Each tier starts where `from`
    // says; the lower tiers sit close together so named tiers come up often, and five tiers past
    // Eternal reach the multiplier-driven giants.
    const RARITIES = [
      ['common', 'Common', 1], ['uncommon', 'Uncommon', 5], ['rare', 'Rare', 25], ['epic', 'Epic', 100],
      ['legendary', 'Legendary', 500], ['anomaly', 'Anomaly', 2500], ['mythic', 'Mythic', 1e4], ['divine', 'Divine', 5e4],
      ['cosmic', 'Cosmic', 2.5e5], ['transcendent', 'Transcendent', 1e6], ['ethereal', 'Ethereal', 5e6],
      ['celestial', 'Celestial', 2.5e7], ['eternal', 'Eternal', 1e8], ['infinite', 'Infinite', 1e9], ['omega', 'Omega', 1e11],
      ['absolute', 'Absolute', 1e13], ['primordial', 'Primordial', 1e15], ['unfathomable', 'Unfathomable', 1e20],
    ].map(([id, name, from], i, all) => ({ id, name, from, min: i === all.length - 1 ? 0 : 1 / all[i + 1][2] }));
    const rarityOf = p => RARITIES.findIndex(r => p >= r.min);

    const MULTIPLIERS = MULTIPLIER_DEFS.map(([id, name, symbol, v]) => {
      const log = typeof v === 'object' ? v.log : Math.log10(v);
      const n = log <= 1 ? 30 * 10 ** (1.2 * log) : 475 * log ** 3.5;
      const units = Math.round(MULT_UNITS / Math.min(MULT_UNITS, Math.round(n)));
      return { id, name, symbol, value: typeof v === 'object' ? null : v, log, units, p: units / MULT_UNITS, rarity: rarityOf(units / MULT_UNITS) };
    });
    {
      const used = MULTIPLIERS.reduce((t, m) => t + m.units, 0);
      if (MULTIPLIERS.length !== 100 || new Set(MULTIPLIERS.map(m => m.id)).size !== 100 || used >= MULT_UNITS) throw new Error('multiplier table is invalid');
      MULTIPLIERS.unshift({ id: 'unity', name: 'Unity', symbol: '1', value: 1, log: 0, units: MULT_UNITS - used, p: (MULT_UNITS - used) / MULT_UNITS, rarity: rarityOf((MULT_UNITS - used) / MULT_UNITS) });
    }
    const MULT_BY_ID = Object.fromEntries(MULTIPLIERS.map(m => [m.id, m]));
    const MULT_ORDER = [...MULTIPLIERS].sort((a, b) => b.units - a.units);
    function pickMultiplier(u) { // u in [0, MULT_UNITS)
      for (const m of MULT_ORDER) { if (u < m.units) return m; u -= m.units; }
      return MULT_ORDER[MULT_ORDER.length - 1];
    }

    function computeCount(b) {
      if (b.dfa) return countByDfa(b.dfa);
      if (b.set) return b.set.size;
      if (b.among) return [...b.among].filter(n => b.test(n, String(n), { prime: P.isPrime(n) })).length;
      if (b.sieve) {
        if (SPACE > 1e6) return null; // brute force only for the small test games

        let k = 0;
        for (let n = 0; n < SPACE; n++) {
          const c = { prime: P.isPrime(n), d: b.mode === 'radar' ? nearestPrimeDistance(n) : undefined };
          if (b.test(n, String(n), c)) k++;
        }
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
      b.rarity = rarityOf(b.p);
      return true;
    }
    for (const list of [BADGES, POWER_BADGES, MOD_BADGES, TARGET_BADGES, RADAR_BADGES]) {
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
        { id: 'dayStamp', cat: 'Daily', name: 'Day Stamp', desc: `Contains the day of the month twice in a row (${d}${d})`, dfa: containsDfa(d + d), test: (n, s) => s.includes(d + d) },
        { id: 'usDate', cat: 'Daily', name: 'Month First', desc: `Contains the date month first (${mmdd}${y.slice(2)})`, dfa: containsDfa(mmdd + y.slice(2)), test: (n, s) => s.includes(mmdd + y.slice(2)) },
        { id: 'fullDate', cat: 'Daily', name: 'Full Date', desc: `Contains the whole date (${y}${mmdd})`, dfa: containsDfa(y + mmdd), test: (n, s) => s.includes(y + mmdd) },
      ];
      list.forEach(finish);
      datedCache.set(date, list);
      return list;
    }

    // A roll is { mode, e, m, t, mult }. Score = EP × multiplier, then the mode's twist;
    // `log` is log10 of the score so even ⁵2-sized results compare.
    function context(n, date, roll) {
      const c = { prime: P.isPrime(n), date, e: roll.e, m: roll.m, t: roll.t };
      if (roll.m) c.r = n % roll.m;
      if (roll.t !== undefined) c.D = Math.abs(n - roll.t);
      if (roll.mode === 'radar') c.d = nearestPrimeDistance(n);
      return c;
    }
    function evaluate(n, date, roll = {}) {
      const s = String(n), c = context(n, date, roll);
      const pool = BADGES.concat(datedBadges(date), (MODE_BY_ID[roll.mode] || MODES[0]).badges);
      const hits = pool.filter(b => b.test(n, s, c)).sort((a, b) => a.p - b.p);
      const seen = new Set();
      const badges = hits.filter(b => {
        if (!b.group) return true;
        if (seen.has(b.group)) return false;
        seen.add(b.group);
        return true;
      });
      return { badges, c };
    }
    // Difficulties change your score, never the yardstick: 1/N always compares a roll with the
    // Standard game of its mode, so a harder difficulty reaches each tier far less often.
    // Hardcore drops the multiplier reel (only badges count); the others also take a root of the score.
    const DIFFICULTIES = [
      { id: 'standard', name: 'Standard', root: 1, mult: true, desc: 'Badges and the multiplier reel.' },
      { id: 'hardcore', name: 'Hardcore', root: 1, mult: false, desc: 'No multiplier reel: only your badges count. Charms and lenses are paused.' },
      { id: 'nightmare', name: 'Nightmare', root: 1.5, mult: false, desc: 'Badges only, and your score is raised to the power 2/3.' },
      { id: 'abyss', name: 'Abyss', root: 2, mult: false, desc: 'Badges only, and your score is square-rooted.' },
      { id: 'oblivion', name: 'Oblivion', root: 3, mult: false, desc: 'Badges only, and your score is cube-rooted. Astronomically hard.' },
    ];
    const DIFF_BY_ID = Object.fromEntries(DIFFICULTIES.map(d => [d.id, d]));
    function score(n, date, roll = {}) {
      const mode = roll.mode || 'classic';
      const diff = DIFF_BY_ID[roll.d] || DIFFICULTIES[0];
      const { badges, c } = evaluate(n, date, roll);
      const ep = badges.reduce((t, b) => t + b.ep, 0);
      const factor = badges.filter(b => b.factor).reduce((t, b) => t + b.ep, 0) || 1;
      const base = Math.max(ep - (factor > 1 ? factor : 0), 1); // a roll with no badges still counts as 1 EP
      const mult = (diff.mult && MULT_BY_ID[roll.mult]) || MULT_BY_ID.unity;
      // x is the number's own part of the score (badges plus the modulus or target bonus); the
      // multiplier and the exponent are drawn independently of it. Equal scores are ordered by
      // the number itself (the tiny last term), so every tier holds exactly its share.
      const tie = (n / SPACE) * 1e-7;
      let x = Math.log10(base) + tie;
      if (mode === 'mod' && c.r === 0) x += Math.log10(roll.m);
      if (mode === 'target') x += Math.log10(SPACE / (c.D + 1));
      const full = mode === 'exp' ? roll.e * (x + mult.log) + Math.log10(factor) : x + mult.log;
      const rank = full / diff.root;
      const log = (mode === 'exp' ? full - roll.e * tie : full - tie) / diff.root;
      return { n, mode, roll, badges, ep, base, factor, mult, log, x, rank, c, diff };
    }

    // Roll tiers: Trash is the bottom 1%; every other roll takes the rarity of its 1 in N.
    const ROLL_TIERS = [{ id: 'trash', name: 'Trash' }, ...RARITIES];

    function seededRand(seed) {
      return () => { // mulberry32
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    // Random roll parameters for a mode, from `rand` (uniform in [0, 1)) or from the CSPRNG.
    function sampleRoll(mode, rand) {
      const roll = { mode, mult: pickMultiplier(Math.floor(rand() * MULT_UNITS)).id };
      if (mode === 'exp') { roll.e = 1; while (roll.e < E_MAX && rand() < 0.5) roll.e++; }
      if (mode === 'mod') roll.m = M_LO + Math.floor(rand() * M_COUNT);
      if (mode === 'target') roll.t = Math.floor(rand() * SPACE);
      return roll;
    }
    function randomParams(mode) {
      const roll = { mode, mult: pickMultiplier(randomBelow(MULT_UNITS)).id };
      if (mode === 'exp') roll.e = randomExponent();
      if (mode === 'mod') roll.m = M_LO + randomBelow(M_COUNT);
      if (mode === 'target') roll.t = randomBelow(SPACE);
      return roll;
    }

    // Tables of x (the number's own part of the score) at each point of GRID, per mode.
    // tools/build-data.js builds them from 2,000,000 rolls; without data.js a 20,000-roll sample is used.
    const GRID = [];
    for (let i = 0; i < 1000; i++) GRID.push(i / 10);
    for (let i = 1; i <= 99; i++) GRID.push(+(99.9 + i * 0.001).toFixed(3));
    GRID.push(99.9995, 99.9999, 100);
    function tableFromSorted(sorted) {
      return GRID.map(p => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]);
    }
    function sampleLogs(mode, count, seed, budget) {
      const rand = seededRand(seed), out = new Float64Array(count);
      let i = 0;
      return {
        out,
        step(k = budget) {
          for (const end = Math.min(count, i + k); i < end; i++) out[i] = score(Math.floor(rand() * SPACE), null, sampleRoll(mode, rand)).x;
          return i === count;
        },
      };
    }
    const fromData = opts.quantiles ? Object.fromEntries(Object.entries(opts.quantiles).map(([k, q]) => [k, q.map(v => (v === null ? -Infinity : v))])) : {};
    const tables = { ...fromData };
    const MODE_SEED = { classic: 0x9e3779b9, exp: 0x51ed270b, mod: 0x2545f491, target: 0x6a09e667, radar: 0xbb67ae85 };
    function warmUp(mode) {
      if (tables[mode]) return Promise.resolve();
      return new Promise(resolve => {
        const job = sampleLogs(mode, 20000, MODE_SEED[mode], 1000);
        const tick = () => {
          if (!job.step()) { setTimeout(tick, 0); return; }
          const sorted = Array.from(job.out).sort((a, b) => a - b);
          tables[mode] = tableFromSorted(sorted);
          resolve();
        };
        tick();
      });
    }
    // P(X ≥ x) for the number's own part X, from the sampled table. Past the 99.999th percentile
    // the sample thins out, so the tail falls tenfold per unit of x, as a badge worth 1/p EP turns
    // up with chance p; that stretch is flagged as an estimate.
    const TAIL_B = GRID.indexOf(99.999);
    function tailX(x, Q) {
      if (x <= Q[0]) return { p: 1, est: false };
      if (x > Q[TAIL_B]) return { p: 1e-5 * 10 ** -(x - Q[TAIL_B]), est: true };
      let lo = 0, hi = TAIL_B;
      while (lo < hi) { const m = (lo + hi) >> 1; if (Q[m] < x) lo = m + 1; else hi = m; }
      const a = Q[lo - 1], b = Q[lo];
      const pct = GRID[lo - 1] + ((GRID[lo] - GRID[lo - 1]) * (x - a)) / (b - a || 1);
      return { p: 1 - pct / 100, est: false };
    }
    // P(a random roll of this mode ranks at least as high as `rank`): the multiplier reel and the
    // exponent are exact and independent of the number, so sum over every value they can take.
    // For each exponent: its chance and the log of its exponent badge's bonus. (Googol and Big Bang
    // also depend on the number; at about 1 in 1,000 Exponent rolls they are left out of this sum.)
    const E_TERMS = Array.from({ length: E_MAX }, (_, i) => {
      const e = i + 1;
      const hit = POWER_BADGES.filter(b => b.group === 'exp' && b.test(0, '0', { e })).sort((a, b) => a.p - b.p)[0];
      return [e, pExp(e), hit ? Math.log10(hit.ep) : 0];
    });
    function pBeat(rank, mode) {
      const Q = tables[mode];
      if (!Q) throw new Error(`odds for ${mode} are not ready`);
      let p = 0, est = 0;
      for (const [e, pe, bonus] of mode === 'exp' ? E_TERMS : [[1, 1, 0]]) {
        for (const m of MULTIPLIERS) {
          const t = tailX((rank - bonus) / e - m.log, Q), w = pe * m.p * t.p;
          p += w;
          if (t.est) est += w;
        }
      }
      return { p: Math.min(1, p), estimated: est > p / 2 };
    }
    function percentile(rank, mode) { return 100 * (1 - pBeat(rank, mode).p); }

    // Best of L rolls without rolling L times. The best roll's chance q of being beaten is the
    // smallest of L uniform draws, so it is drawn directly: q = 1 - (1 - U)^(1/L). Then a real roll
    // at least that good is built: a random number and its mode extras, and a multiplier drawn from
    // the reel's own odds among those big enough to reach the target. At these sizes the best of
    // millions of rolls is decided by a rare multiplier, so this is how such rolls really look.
    // Inverse of pBeat, cached at steps of 0.1% in q so repeat lookups are instant.
    const rankCache = {};
    function rankFor(q, mode) {
      const cache = rankCache[mode] || (rankCache[mode] = new Map());
      const key = Math.round(Math.log10(q) * 2000);
      if (cache.has(key)) return cache.get(key);
      q = 10 ** (key / 2000);
      let lo = -1, hi = 1;
      while (pBeat(hi, mode).p > q && hi < 1e300) { lo = hi; hi *= 2; }
      for (let i = 0; i < 60 && hi - lo > 1e-9 * Math.max(1, Math.abs(hi)); i++) { const mid = (lo + hi) / 2; if (pBeat(mid, mode).p > q) lo = mid; else hi = mid; }
      if (cache.size < 50000) cache.set(key, hi);
      return hi;
    }
    function luckyPick(mode, L, date) {
      const u = randomBelow(2 ** 32) / 2 ** 32;
      const q = -Math.expm1(Math.log1p(-u) / L);
      const target = rankFor(Math.max(q, 1e-300), mode);
      // Of 16 candidates, keep the one that clears the target by the least, so the result lands
      // on the drawn luck rather than past it.
      let best = null;
      for (let attempt = 0; attempt < 16 || (!best && attempt < 64); attempt++) {
        const params = randomParams(mode), n = randomBelow(SPACE);
        const plain = score(n, date, { ...params, mult: 'unity' });
        const need = (target - plain.rank) / (params.e || 1);
        const mult = MULT_ASC.find(m => m.log >= need);
        if (!mult) continue;
        const roll = { ...params, mult: mult.id }, rank = score(n, date, roll).rank;
        if (!best || rank < best.rank) best = { roll, n, rank };
      }
      return best; // null when the target is past every multiplier; the caller rolls normally
    }
    const MULT_ASC = [...MULTIPLIERS].sort((a, b) => a.log - b.log);
    // 1 in N, floored at 2 so an ordinary roll reads 1/2. Trash is the bottom 1%.
    function rollTier(rank, mode) {
      const { p, estimated } = pBeat(rank, mode);
      const pct = 100 * (1 - p), oneInLog = Math.max(Math.log10(2), -Math.log10(p));
      const tier = pct < 1 ? ROLL_TIERS[0] : ROLL_TIERS[1 + rarityOf(10 ** -oneInLog)];
      return { pct, tier, oneInLog, estimated };
    }
    // Share of all rolls in each tier. P(N ≥ k) = 1/k by construction, so each step of the
    // ladder holds exactly a tenth of the one below it; Trash is the bottom 1%.
    function tierShares() {
      const out = { trash: 0.01 };
      RARITIES.forEach((r, i) => { out[r.id] = 1 / r.from - (i + 1 < RARITIES.length ? 1 / RARITIES[i + 1].from : 0); });
      out.common -= 0.01;
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
      DIGITS, SPACE, E_MAX, M_LO, M_HI, MULT_UNITS, BADGES, POWER_BADGES, MOD_BADGES, TARGET_BADGES, RADAR_BADGES,
      MODES, MODE_BY_ID, DIFFICULTIES, DIFF_BY_ID, MULTIPLIERS, MULT_BY_ID, RARITIES, ROLL_TIERS, GRID,
      CATEGORIES: ['Size', 'Math', 'Sequences', 'Digits', 'Memes', 'Combos', 'Powers', 'Modulo', 'Target', 'Radar', 'Daily'],
      datedBadges, evaluate, score, rollTier, percentile, luckyPick, warmUp, tierShares, factorize, nearestPrimeDistance,
      randomRoll: () => randomBelow(SPACE), randomParams, sampleRoll, sampleLogs, tableFromSorted, pickMultiplier,
      randomExponent, pExp, computeCount, MODE_SEED,
    };
  }

  function popcount(x) { let c = 0; while (x) { c += x & 1; x >>>= 1; } return c; }

  root.RNGEngine = { createGame, PRIME_COMBOS, P, millerRabin, digitSum, isHappy, E_MAX, pExp, MULTIPLIER_DEFS };
  if (!root.RNG_NO_AUTOSTART) {
    const data = root.RNG_DATA && root.RNG_DATA.digits === 10 ? root.RNG_DATA : {};
    root.RNG = createGame(10, { counts: data.counts, quantiles: data.quantiles });
  }
})(typeof window !== 'undefined' ? window : globalThis);
