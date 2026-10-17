# RNGdle 10

A random-number badge game in the spirit of [RNGdle](https://www.rngdle.com/), with ten digits and unlimited rolls. Play it at https://gkson-lab.github.io/rngdle9/ or open `index.html` locally. Everything runs and is saved in your browser.

Each roll is a number from 0 to 9,999,999,999, checked against 155 badges: primes, palindromes, straights, sequences like Fibonacci and Catalan, meme numbers, and combos such as palindromic and twin primes. A badge is worth EP equal to its odds, so a 1-in-143 badge adds 143 EP. Your total is ranked against all possible rolls, from Trash to Mythic.

## Modes

Classic scores the total EP. Exponent mode also rolls an exponent (2 comes up a quarter of the time, 3 an eighth, and so on), raises your EP to that power, and adds badges for big exponents and results past a googol.

Auto rolls until a tier you choose or a badge you are hunting appears. Endless never stops on its own. While either runs, the best rolls of the session and of all time stay on the sides of the reels.

## Other things it does

- Collection with search and filters; select any badge to see exactly how many numbers qualify and how often you have earned it against the expectation
- 25 achievements, a hall of fame of your ten best rolls per mode, and starred rolls that never drop off the log
- A luck table comparing your tiers with the exact share of all rolls
- The prime factorization of every roll
- Copy a roll as text or save it as an image
- Midnight, Felt and Daylight themes, and an effects setting
- Installs as an app that works offline (from the hosted copy)
- Export and import your save; Space rolls, A toggles Auto, E toggles Endless

## Exact odds

Every probability is a count of qualifying numbers, not an estimate. Digit patterns are counted with small automata over every digit string, sets are generated in full, and prime badges come from a sieve of every prime below 10¹⁰ (it recovers π(10¹⁰) = 455,052,511).

```
npm run data    # rebuild data.js (sieve, about two minutes on 16 threads)
npm run check   # brute-force every badge at 5 and 6 digits, verify lists and data.js, sample the real game
```

Design decisions and their reasons are in [DESIGN.md](DESIGN.md).

## Changelog

- v2.0.2: the offline cache now fetches fresh files when a new version installs, instead of reusing the browser's copy of the previous version.
- v2.0.1: 192px and 512px PNG app icons so browsers offer Install; the icon is drawn from shapes by `tools/icons.js` so it looks the same on every system.
- v2.0: ten digits, Exponent mode, Endless with side leaderboards, achievements, hall of fame, badge details, luck table, collection filters, starred rolls, factorization, share image, themes, offline install. Fixes the Lonely Digit count, which was 81 instead of 72 in the nine-digit game.
- v1.1: badge hunt, new-badge alerts, number checker, save export and import.
- v1.0: nine-digit rolls, unlimited rolling with autoroll, 143 badges with exact odds.
