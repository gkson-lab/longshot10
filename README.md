# RNGdle 10

A random-number badge game in the spirit of [RNGdle](https://www.rngdle.com/), with ten digits and unlimited rolls. Play it at https://gkson-lab.github.io/rngexp10/ or open `index.html` locally. Everything runs and is saved in your browser.

Each roll is a number from 0 to 9,999,999,999, checked against 142 badges: primes, palindromes, straights, sequences like Fibonacci and Catalan, meme numbers, and combos such as palindromic and twin primes. A badge is worth EP equal to its odds, so a 1-in-143 badge adds 143 EP. A second reel lands on one of 100 math multipliers, from ×∛2 to ×⁵2, or on ×1. A roll with no badges still counts as 1 EP, so its multiplier matters.

Every roll shows its odds as 1/N: the chance that a random roll of the same mode does at least as well, measured against two million sampled rolls. An ordinary roll is 1/2. The tier comes straight from N on one ladder shared with badges and multipliers, each step ten times rarer: Common, Uncommon (1/10), Rare (1/100), Epic, Legendary, Anomaly, Mythic, Divine, Cosmic, Transcendent, Ethereal, Celestial and Eternal (1/1,000,000,000,000), plus Trash for the bottom 1%.

## Modes

- Classic: EP times the multiplier.
- Exponent: an exponent is rolled too (2 a quarter of the time, 3 an eighth, and so on) and your score is raised to it.
- Modulo: a modulus from 2 to 9,999 is rolled; if it divides your number, your score is multiplied by it.
- Target: a target number is rolled; the closer you land, the bigger the bonus.
- Prime radar: shows the nearest prime, with badges for landing beside one or far from all of them.

Auto rolls until a tier you choose, or until a badge or multiplier you are hunting turns up. Endless never stops on its own; on Turbo it rolls about 90 times a second and shows the rarest roll of each screen frame. While either runs, the best rolls of the session and of all time stay beside the reels.

## Other things it does

- Collection of badges and multipliers with search and filters; select any of them for the exact count or chance and how often you have landed it against the expectation
- 39 achievements, a hall of fame of your ten best rolls per mode, and starred rolls that never drop off the log
- A luck table comparing your tiers with how often each tier really comes up
- The prime factorization of every roll, and a lookup for any number
- Copy a roll as text or save it as an image
- Midnight, Felt and Daylight themes, an effects setting, and offline install from the hosted copy
- Up to ten save files in the browser, each with its own progress; export one to move or share it, and importing always adds a new save file instead of replacing yours
- Space rolls, A toggles Auto, E toggles Endless

## Inventory

Each save file has an inventory of items you can use from the Inventory tab:

- Charm of Two, Five, Ten and a Hundred: luck ×2, ×5, ×10 or ×100 for a number of rolls. Luck ×L makes each roll the best of L independent rolls, so anything rare turns up roughly L times as often; the 1/N shown is still the result's true odds in the plain game.
- Multiplier Lens: for 30 rolls the multiplier reel spins twice and keeps the bigger multiplier.
- Overclock: Turbo rolls twice as fast for 3 minutes.

Items drop from Rare and rarer plain rolls (the chances are listed in the game), every achievement gives one, and each save file gets a Charm of Two once a day. Rolls made with a charm or the Lens never drop items and are left out of the luck table. Items are part of the save file, so they go along when you export or share it.

## Sharing save files

Export a save from Settings > Save files, then post it in [Discussions > Show and tell](https://github.com/gkson-lab/rngexp10/discussions/categories/show-and-tell); the post form asks for the file and your best roll. To play someone else's save, download their `.json` file and choose Import a save file.

## Exact odds

Every badge probability is a count of qualifying numbers, not an estimate. Digit patterns are counted with small automata over every digit string, sets are generated in full, and prime and prime-radar badges come from a sieve of every prime below 10¹⁰ (it recovers π(10¹⁰) = 455,052,511). Mode badges are exact over every modulus or every target, and each multiplier's chance is a whole number of parts in 10¹⁵. Only a roll's 1/N is sampled, from two million rolls per mode; rolls with equal scores are ordered by the number itself, so each tier holds exactly its share (Trash really is the bottom 1%). Past about 1/100,000 the sample runs thin, so N is extended along the measured tail and shown with ≈.

```
npm run data    # rebuild data.js (sieve, radar scan and percentile tables; a few minutes on 16 threads)
npm run check   # brute-force every badge at small sizes, every mode badge, the multiplier reel, and data.js
npm run icons   # redraw icon.svg and the PNG app icons
```

Design decisions and their reasons are in [DESIGN.md](DESIGN.md).

## Changelog

- v2.5, the Inventory update: inventory with luck charms, the Multiplier Lens and Overclock; item drops, achievement rewards and a daily gift; items are saved with each save file.
- v2.2: Endless on Turbo rolls about 85 times a second (up from about 22) without blocking the page, and 1× and 2× cycle about twice as fast; long runs now save as they go; save files; sharing saves through GitHub Discussions.
- v2.1: Modulo, Target and Prime radar modes; 100 multipliers on their own reel; a 1/N for every roll; one thirteen-step rarity ladder plus Trash, up to Eternal; Auto settings folded behind one button.
- v2.0.2: the offline cache now fetches fresh files when a new version installs, instead of reusing the browser's copy of the previous version.
- v2.0.1: 192px and 512px PNG app icons so browsers offer Install; the icon is drawn from shapes by `tools/icons.js` so it looks the same on every system.
- v2.0: ten digits, Exponent mode, Endless with side leaderboards, achievements, hall of fame, badge details, luck table, collection filters, starred rolls, factorization, share image, themes, offline install. Fixes the Lonely Digit count, which was 81 instead of 72 in the nine-digit game.
- v1.1: badge hunt, new-badge alerts, number checker, save export and import.
- v1.0: nine-digit rolls, unlimited rolling with autoroll, 143 badges with exact odds.
