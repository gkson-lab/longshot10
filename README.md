# RNGdle 9

A random-number badge game in the spirit of [RNGdle](https://www.rngdle.com/), with nine digits instead of six and unlimited rolls.

Roll a number from 0 to 999,999,999 and it is checked against 143 badges: primes, palindromes, straights, Fibonacci and other sequences, meme numbers, and combos like palindromic primes and twin primes. Each badge is worth EP equal to its odds (a 1-in-143 badge is worth 143 EP), and your roll's total is ranked against all possible rolls, from Trash to Mythic.

- **Roll** as often as you like, or turn on **Auto** with a speed (1×, 2×, Turbo) and a tier to stop at.
- **Collection** tracks every badge you have earned. **Log** keeps your stats and the last 200 rolls.
- Open `#123456789` at the end of the URL to see how any number scores without recording it.
- Everything runs and is saved in your browser. There are no accounts, servers or network requests.

## Exact odds

Every badge's probability is exact over all 10⁹ possible rolls, not estimated:

- Digit patterns are counted with small automata run over every digit string ([`badges.js`](badges.js)).
- Sets and combos are generated in full (every palindrome, square, Fibonacci number, and so on) and tested.
- Prime combos and Harshad numbers come from [`tools/exact-counts.js`](tools/exact-counts.js), which sieves every prime below 10⁹ (it recovers π(10⁹) = 50,847,534).

[`tools/check.js`](tools/check.js) compares every badge against a few million random rolls and brute-forces the hard-coded number lists.

```
npm run check
npm run counts
```

## Run it

Open `index.html` in a browser. No build step.
