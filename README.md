# Long Shot 10

A ten-digit luck game, formerly RNGdle 10, in the spirit of [RNGdle](https://www.rngdle.com/), with unlimited rolls. Play it at https://gkson-lab.github.io/longshot10/ or open `index.html` locally. Everything runs and is saved in your browser.

Each roll is a number from 0 to 9,999,999,999, checked against 308 badges (plus 41 mode badges and 5 daily ones): primes, palindromes, straights, sequences like Fibonacci and Catalan, meme numbers, and combos such as palindromic and twin primes. A badge is worth EP equal to its odds, so a 1-in-143 badge adds 143 EP. A second reel lands on one of 100 math multipliers, from ×∛2 to ×⁵2, or on ×1. A roll with no badges still counts as 1 EP, so its multiplier matters.

Every roll shows its odds as 1/N: the chance that a random roll of the same mode does at least as well, measured against two million sampled rolls. An ordinary roll is 1/2. The tier comes straight from N on one ladder shared with badges and multipliers: Common, Uncommon (1/5), Rare (1/25), Epic (1/100), Legendary (1/500), Anomaly (1/2,500), Mythic (1/10,000), Divine (1/50,000), Cosmic (1/250,000), Transcendent (1/1,000,000), Ethereal (1/5,000,000), Celestial (1/25,000,000), Eternal (1/100,000,000), Infinite (1/10⁹), Omega (1/10¹¹), Absolute (1/10¹³), Primordial (1/10¹⁵), Unfathomable (1/10²⁰), Paradox (1/10²⁵), Singularity (1/10³⁰), Multiversal (1/10⁴⁰), Omniversal (1/10⁵⁰), Ineffable (1/10⁷⁵) and Beyond (1/10¹⁰⁰), plus Trash for the bottom 1%.

## Difficulties

Hardcore removes the multiplier reel, so only badges count. Nightmare, Abyss and Oblivion also raise the score to the power 2/3, 1/2 and 1/3. The 1/N still compares with the Standard game, so on Oblivion three rolls in four are Trash. Luck charms work in full on every difficulty; harder difficulties pay more lucky tokens.

## Lucky tokens

Every roll has a 1 in 2 chance to drop a lucky token. Tokens buy permanent luck levels in the Inventory tab: at level k every roll is the best of k + 1, for good. Each level costs 12% more than the last.

## Modes

- Classic: EP times the multiplier.
- Exponent: an exponent is rolled too (2 a quarter of the time, 3 an eighth, and so on) and your score is raised to it.
- Modulo: a modulus from 2 to 9,999 is rolled; if it divides your number, your score is multiplied by it.
- Target: a target number is rolled; the closer you land, the bigger the bonus.
- Prime radar: shows the nearest prime, with badges for landing beside one or far from all of them.

Auto rolls until a tier you choose, or until a badge or multiplier you are hunting turns up. Endless never stops on its own; on Turbo it rolls 90, 250, 500, 1,000, 2,000 or 5,000 times a second (set under Auto settings) and shows the rarest roll of each screen frame. While either runs, the best rolls of the session and of all time stay beside the reels.

## Other things it does

- Collection of badges and multipliers with search and filters; select any of them for the exact count or chance and how often you have landed it against the expectation
- 153 achievements, a hall of fame of your ten best rolls per mode, and starred rolls that never drop off the log
- A luck table comparing your tiers with how often each tier really comes up, a rating of how lucky you have been, an odds calculator, records and milestones
- The prime factorization of every roll, and a lookup for any number
- Copy a roll as text or save it as an image
- Forty-six skins (see below), an effects setting, and offline install from the hosted copy
- Daily quests: three a day per save file, each paying coins and an item, with a bonus for finishing all three, and a free reroll a day; three weekly quests with bigger rewards
- A daily streak with rewards and Streak Freezes, a lucky hour each day, and double coins at weekends
- A token workshop of lasting upgrades, a coin shop, and quick-use buttons for pinned items
- Prestige: after 100,000 rolls (200,000 for the second, and so on) trade in your coins, items and active effects for a lasting bonus, with drops and coins coming half again as often per prestige, and a perk point for one of six lasting perks
- An Arcade tab with four games (higher or lower, digit pick, a daily wheel and scratch cards), each with its exact chances and payback, and challenges: goals in a fixed number of real rolls with their exact chance
- A weekly bingo card of badges and a bounty board that changes every six hours
- A badge book in the Collection: complete a category's page (every badge in it at 1 in 1,000,000 or likelier) to claim a skin or items
- Charts in the Log: rolls per day for the last two weeks, and your tier shares against the expected ones
- Rolling while away: the time the game was closed is rolled when you come back, up to eight hours
- Sound settings (volume and three sound sets) and vibration on rare rolls
- A monthly season of 30 levels, with XP from every roll
- Skins that follow the system's light or dark mode, or change every day
- A profile with titles from your achievements, saved as an image card
- Up to ten save files in the browser, each with its own progress and its newest three automatic backups; export one to move or share it, and importing always adds a new save file instead of replacing yours
- Keys for everything: Space rolls, A toggles Auto, E toggles Endless, ? lists the rest
- Settings for text size, a compact layout, and which notices pop up

## Skins

Skins are picked in Settings and belong to the save file. Midnight, Felt, Daylight and High Contrast are free; Chalkboard is the reward for the Mathematician achievement. Neon, LCD, Blueprint, Terminal, Console, Chat, Handheld and Calculator are hidden somewhere in the game; Settings gives a hint for each, and [Skins and commands](docs/SKINS-AND-COMMANDS.md) spoils them all. Console, Chat, Handheld, Calculator, Spreadsheet, Receipt, Ticker and Smartwatch replace the page with a different way to play: a command line, a chat with Tenny the bot, a pocket console with a D-pad, a calculator whose ten-digit display holds exactly one roll, a spreadsheet driven by formulas, a till roll that prints every roll, a market board, and a round watch face. Terminal turns the page into plain console text with no boxes or lines. Console replaces the page with a command line that runs the whole game: ROLL, AUTO, ENDLESS, STOP, SPEED, RATE, MODE, STATS, LUCK, LOG, BEST, INV, USE, FUSE, SPIN, ODDS, QUESTS, BOOK, BADGES, ACH, PRESTIGE, SKINS, BUY and more (type HELP). The same commands work in the command line hidden in Settings. Gold, Ruby and Aurora come together as a bundle for 500 coins. Graph Paper, Golden Spiral, Odometer, Vaporwave and Spectrum are legendary skins from the Math, Sequences, Digits, Memes and Combos pages of the badge book.

## Inventory

Each save file has an inventory of items you can use from the Inventory tab:

- Luck charms, from the Charm of Ten (luck ×10, the baseline) up to the Charm of Ten Billion (luck ×10,000,000,000). Luck ×L makes each roll the best of L independent rolls, so anything rare turns up roughly L times as often; the 1/N shown is still the result's true odds in the plain game. Above ×2,000 the game does not roll L times: it draws how lucky the best of L rolls would be, from its exact distribution, and builds a real roll that lucky, so even ×10,000,000 takes a few milliseconds.
- Drop boosters: Horn of Plenty (×25), Golden Goose (×100), Diamond Goose (×1,000), Platinum Goose (×10,000) and Cosmic Goose (×100,000) multiply item drop chances for a number of rolls; past 100% you get several of an item at once.
- Multiplier Lens, Prism Lens and Kaleidoscope Lens: for 30 rolls the multiplier reel spins 2, 10 or 100 times and keeps the biggest multiplier.
- Overclock, Overclock II and Overclock III: Turbo rolls 2, 4 or 8 times as fast for 3 minutes.

Items drop from plain rolls of 1/100 or rarer (the chances are listed in the game), every achievement gives one, each save file gets a Charm of Ten once a day, and several of one item fuse into the next one up (ten Charms of a Million make a Charm of Ten Million). Fuse all fuses every set of one item at once, and Fuse everything pushes every item as far up its line as it goes. The Charm of Two, Charm of Five, Magnet and Treasure Map are retired: they no longer drop, but any you own still work and fuse upwards. Rolls made with a charm or the Lens never drop items and are left out of the luck table. Items are part of the save file, so they go along when you export or share it.

## Coin slot

Every plain roll of 1/100 or rarer has a 1 in 3 chance to drop a coin (drop boosters raise that too). Spend coins on the slot machine in the Inventory tab, one coin per spin: spin once, 5, 10 or 20 at a time, or spend every coin at once with Spin all. Every spin wins something, from a fixed table shown next to the slot with chances in whole parts of a billion: a Charm of Ten 40% of the time, every other item in the game from there up, a 0.15% Golden Goose jackpot paying one, two or five, a Charm of a Million at 1 in 133,333 and a Charm of Ten Million at 1 in 1,333,333.

Six prizes have a hard pity: go 2,000 spins without a Golden Goose, 3,000 without a Charm of Ten Thousand, 7,000 without a Diamond Goose, 20,000 without a Charm of a Hundred Thousand, 250,000 without a Charm of a Million or 2,500,000 without a Charm of Ten Million, and the next spin pays it out for sure. The panel shows your progress towards each.

## Sharing save files

Export a save from Settings > Save files, then post it in [Discussions > Show and tell](https://github.com/gkson-lab/longshot10/discussions/categories/show-and-tell); the post form asks for the file and your best roll. To play someone else's save, download their `.json` file and choose Import a save file.

## Exact odds

Every badge probability is a count of qualifying numbers, not an estimate. Digit patterns are counted with small automata over every digit string, sets are generated in full, and prime and prime-radar badges come from a sieve of every prime below 10¹⁰ (it recovers π(10¹⁰) = 455,052,511). Mode badges are exact over every modulus or every target, and each multiplier's chance is a whole number of parts in 10¹⁵. Only a roll's 1/N is sampled, from two million rolls per mode; rolls with equal scores are ordered by the number itself, so each tier holds exactly its share (Trash really is the bottom 1%). Past about 1/100,000 the sample runs thin, so N is extended along the measured tail and shown with ≈.

```
npm run data    # rebuild data.js (sieve, radar scan and percentile tables; a few minutes on 16 threads)
npm run check   # brute-force every badge at small sizes, every mode badge, the multiplier reel, and data.js
npm run icons   # redraw icon.svg and the PNG app icons
npm run contrast  # every skin against the WCAG AA promises in DESIGN.md
npm run smoke   # play the game in Chromium (Playwright) at phone and desktop width; fails on errors and overflow
```

## Documents

- [How to play](docs/HOW-TO-PLAY.md): how a roll is scored, the modes, items, coins, quests, prestige and saves
- [Every chance in the game](docs/ODDS.md): exact odds of every tier, badge, multiplier, drop, slot prize and reward, generated from the game by `npm run docs`
- [Skins and commands](docs/SKINS-AND-COMMANDS.md): where every skin is hidden, every command, and the controls of the Chat, Handheld and Calculator skins
- [Release notes](docs/RELEASE-NOTES.md): the full notes of every release, with the time each went out
- [Design](DESIGN.md): design decisions and their reasons

## Changelog

Each release is stamped with the time it went out, in UTC. The full notes for each are in [Release notes](docs/RELEASE-NOTES.md), and the game lists them under What's new, in the footer.

- v5.0 (2026-10-20 04:43 UTC): Major update: seasons, a 30-level track each month with XP from every roll and the Diamond skin at level 30; skins that follow the system's light or dark mode or change every day; Void (reward for a Rare roll on Oblivion) and Diamond skins; eight achievements, 153 in all. Since v3.33: 55 new features and 27 new skins over twelve releases.
- v4.8 (2026-10-20 04:25 UTC): Challenges: eight goals in a fixed number of real rolls, each with its exact chance for your mode, difficulty and luck, and a CHALLENGE command; Smartwatch, a full-screen secret skin with a round face, a crown and a side button; a compact layout; Sunset (reward for a first challenge) and Lagoon (reward for four challenges) skins; three achievements.
- v4.6 (2026-10-20 04:18 UTC): Ticker, a full-screen secret skin that turns the game into a market board with a live chart; prestige perks, one point per prestige for six lasting perks; the hall of fame by difficulty; Bronze, Silver and Platinum prestige skins; four achievements. Fix: the perks panel refreshes the moment you prestige.
- v4.4 (2026-10-20 04:03 UTC): Rolling while away (the time the game was closed is rolled on your return, one roll a second up to eight hours, using no charm or booster); Night shift in the workshop (up to ten away rolls a second); the Hourglass item (an hour of away rolls at once); volume and three sound sets; vibration on rare rolls; Abacus (reward for Night shift) and Royal (reward for prestige 3) skins; three achievements.
- v4.2 (2026-10-20 03:59 UTC): Receipt, a full-screen secret skin that prints every roll on a till roll; a profile with titles from your achievements, saved as an image card; automatic backups of each save (every 30 minutes and before a prestige or restore, newest three kept) with Restore; PROFILE and RECEIPT commands; Newsprint skin (reward for Front page); three achievements.
- v4.0 (2026-10-20 03:55 UTC): Major update: an Arcade tab with four games that each show their exact chances and payback: higher or lower (95% of the fair price for an exact chance), digit pick (payback 90.8%), a free daily wheel with segments sized by their chances, and scratch cards for lucky tokens; HL, DIGIT, WHEEL and SCRATCH commands; Casino and Marquee skins; eight achievements.
- v3.9 (2026-10-20 03:47 UTC): Spreadsheet, a full-screen secret skin driven by formulas (=ROLL(100), any command, SUM, AVERAGE, MIN, MAX) with sheet tabs for stats, luck, items, quests, best rolls and records; a run summary when Auto or Endless stops; five orders for the Collection; badge mastery (four levels per badge); Olive, a skin bought for 2,000 coins; three achievements.
- v3.8 (2026-10-20 03:37 UTC): Weekly bingo card of 24 badges, paying for every line and a full card; a bounty board of three badges or multipliers that changes every six hours; hunt up to three things at once; Auto can stop on any new badge; Endless can stop after a set number of rolls or minutes; BINGO and BOUNTIES commands; Bingo Hall (reward for a first line) and Punch Card (reward for ten bounties) skins; five achievements.
- v3.7 (2026-10-20 03:29 UTC): Daily streak with rewards on days 3 to 365 and a Streak Freeze every seventh day; Streak Freeze and Quest Ticket items; a lucky hour each day with drops and coins ×2; coins ×2 at weekends; a free quest reroll a day, more with Quest Tickets; three weekly quests with a Diamond Goose for all three; Sakura (reward for a seven-day streak) and Glacier (reward for a weekly clean sweep) skins; four achievements.
- v3.6 (2026-10-20 03:21 UTC): Token workshop with four lasting upgrades (coins, items, tokens and quest coins up to ×3, kept through prestige); a coin shop of eleven items at fixed prices; Coin Magnet and Token Charm items; auto-fuse; quick-use buttons for up to four pinned items; WORKSHOP and SHOP commands; Steel (reward for Tinkerer) and Ledger (reward for Customer) skins; four achievements.
- v3.5 (2026-10-20 03:14 UTC): How lucky you have been (your best plain roll against everyone with as many rolls, as an exact share); an odds calculator for any tier in any number of rolls, also as CHANCE; records and milestones in the Log, also as RECORDS; recent rolls filtered by mode and tier and exported as CSV; a badge's chance in your next 1,000 plain rolls; Nixie (reward for the Pandigital badge) and Index Card (reward for Show and tell) skins.
- v3.4 (2026-10-20 03:06 UTC): What's new, with the time of every release; a key list (press ?) and new keys (B batch, T speed, M mode, S star, 1 to 5 tabs); text size; switches for each kind of notice; batch ×25,000 and ×100,000, and a hunt's batch stops when it finds its target; Keep boosts going renews a charm, lens or drop booster when it runs out; High Contrast (free) and Chalkboard (reward for Mathematician) skins. Fixes: Trophies and the Terminal skin no longer run off a phone screen; a full-screen skin worn from the Settings command line no longer opens under Settings.
- v3.33 (2026-10-19 23:29 UTC): Roll shows its result at once, with no reels spinning (Auto still spins them at 1× and 2×). Batch rolls are counted instead of played one by one, so ×5,000 takes a few milliseconds instead of about two seconds: the best roll is real and recorded, and the other rolls bring their tiers, items, coins, tokens and quest progress but not badges. During a hunt a batch still plays every roll. Endless in batches rolls one batch a second.
- v3.32: batch roll, ×100, ×1,000 or ×5,000 rolls in one go, drawn once at the end with the best roll and a count per tier. Endless can run in batches of 1,000, 5,000 or 10,000 (Auto settings), showing each batch's stats and the run's totals between batches: about 3,100 rolls a second with ×28 luck, and it keeps its pace in a background tab.
- v3.31: luck charms work in full on every difficulty (no more ×100,000 cap off Standard) and every lucky roll is built in about a millisecond, so Turbo keeps going with luck on (about 1,000 rolls a second with ×28 on Standard, about 350 on Hardcore, up from a few). The status line says when luck is what slows Turbo down.
- v3.3: six rarity tiers past Unfathomable, up to Beyond at 1/10¹⁰⁰; Charms of a Hundred Million, a Billion and Ten Billion; Platinum Goose (drops ×10,000) and Cosmic Goose (×100,000); Kaleidoscope Lens (100 multiplier spins); Overclock III (Turbo ×8). Lenses and Overclocks now fuse upwards too. The new items drop from 1/10¹⁰ rolls and rarer, and four of them are slot prizes; a Charm of a Hundred Million has a 30,000,000-spin pity. 108 achievements.
- v3.26: luck charms and permanent luck work on every difficulty. Off Standard every roll of the best-of is played for real, so luck counts as at most ×100,000 there; lenses do nothing without the multiplier reel.
- v3.25: the coin slot handles any number of coins. Batches over 100,000 spins are counted instead of played one by one, so spinning a billion coins takes well under a second; pity still pays out and its counts carry on correctly. Use all uses every one of an item at once, adding up their rolls or minutes.
- v3.2: difficulties and lucky tokens. Hardcore (no multiplier reel, only badges count) and three astronomically hard difficulties, Nightmare, Abyss and Oblivion; 1/N still compares with the Standard game, so tiers get far rarer. Lucky tokens drop on 1 in 2 rolls and buy permanent luck levels. Instant luck now starts above ×32, and is about four times faster. 102 achievements.
- v3.05: luck charms above ×2,000 roll instantly: the best of L is drawn straight from its exact distribution instead of rolling L times (a ×10,000,000 roll took about a minute, now a few milliseconds); Turbo goes up to 2,000 and 5,000 rolls a second.
- v3.1: renamed Long Shot 10; badges doubled to 308 (plus 41 mode and 5 daily badges), all still counted exactly; achievements doubled to 94; Fuse all and Fuse everything; three new full-screen skins to play with: Chat, Handheld and Calculator; how-to-play, odds and skins documents.
- v3.0 (skins): sixteen skins, including secret ones, a 500-coin bundle, a hidden command line in Settings, a text-only Terminal skin, a Console skin that plays the whole game by typed commands, and five legendary skins from the new badge book; Endless on Turbo up to 1,000 rolls a second; easier tiers (Uncommon is now 1 in 5, Rare 1 in 25) and five new ones past Eternal, up to Unfathomable at 1 in 10²⁰; daily quests; prestige; charts in the Log. Item and coin drops are tied to a roll's 1/N rather than its tier, so they come as often as before.
- v2.8.3: slot rebalance. The Charm of Ten drops from 60% to 40% and every other prize is 1.5× as likely; all six pities are lower.
- v2.8.2: spin 5, 10 or 20 at a time, or all your coins at once; big batches show totals per prize.
- v2.8.1: the screen no longer jitters during Endless on Turbo; every slot spin now wins something (the old 30% no-prize share goes to the Charm of Ten); coins drop 1 in 3 instead of 1 in 4.
- v2.8 (slot overhaul): every item is now a slot prize, up to the Charm of Ten Million; ×10 is the new baseline and the Charm of Two, Charm of Five, Magnet and Treasure Map are retired; new Charm of Ten Million, Prism Lens, Overclock II and Diamond Goose; hard pity on the six rarest prizes; a coins-and-odds panel next to the slot.
- v2.7 (major update): coins drop from Rare or rarer rolls and buy spins on a coin slot machine, one to five at a time, with item prizes and a Golden Goose jackpot.
- v2.6.1: the offline copy no longer mixes files from two releases when it updates in the first minutes after a deploy.
- v2.6: luck charms up to ×1,000,000 (run on worker threads), drop boosters up to ×100, and fusing items into the next one up.
- v2.5, the Inventory update: inventory with luck charms, the Multiplier Lens and Overclock; item drops, achievement rewards and a daily gift; items are saved with each save file.
- v2.2: Endless on Turbo rolls about 85 times a second (up from about 22) without blocking the page, and 1× and 2× cycle about twice as fast; long runs now save as they go; save files; sharing saves through GitHub Discussions.
- v2.1: Modulo, Target and Prime radar modes; 100 multipliers on their own reel; a 1/N for every roll; one thirteen-step rarity ladder plus Trash, up to Eternal; Auto settings folded behind one button.
- v2.0.2: the offline cache now fetches fresh files when a new version installs, instead of reusing the browser's copy of the previous version.
- v2.0.1: 192px and 512px PNG app icons so browsers offer Install; the icon is drawn from shapes by `tools/icons.js` so it looks the same on every system.
- v2.0: ten digits, Exponent mode, Endless with side leaderboards, achievements, hall of fame, badge details, luck table, collection filters, starred rolls, factorization, share image, themes, offline install. Fixes the Lonely Digit count, which was 81 instead of 72 in the nine-digit game.
- v1.1: badge hunt, new-badge alerts, number checker, save export and import.
- v1.0: nine-digit rolls, unlimited rolling with autoroll, 143 badges with exact odds.
