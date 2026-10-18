# How Long Shot 10 works

Long Shot 10 is a luck game about one ten-digit number. Press Roll and you get a random number from 0 to 9,999,999,999, every one equally likely. The game then works out how lucky that number was. The exact chance of everything below is in [ODDS.md](ODDS.md). How to find every skin and every command is in [SKINS-AND-COMMANDS.md](SKINS-AND-COMMANDS.md).

## A roll, step by step

1. **The number.** Ten reels spin and land on your number. Leading zeros are dimmed, so 0000004096 reads as 4,096.
2. **Badges.** The number is checked against 308 badges (plus 41 that belong to one mode and 5 that change with the date): primes, palindromes, runs of the same digit, famous sequences like Fibonacci, meme numbers like 69 and 420, and combos like a palindrome that is also prime. Every badge's chance is an exact count of the numbers that earn it.
3. **EP.** Each badge is worth EP equal to its odds: a badge that 1 number in 143 earns is worth 143 EP. Your badges add up. Some badges sit in a group (a power of two is also a perfect power), and then only the rarest one in the group counts, so nothing is counted twice. A roll with no badges at all still counts as 1 EP.
4. **The multiplier.** A second reel lands on ×1 most of the time, or on one of 100 math constants from ×∛2 up to ×⁵2. Rarer multipliers are bigger. Your score is your EP times the multiplier.
5. **Your 1/N.** Finally the game asks: out of every possible roll in this mode, what share would score at least this high? If 1 roll in 500 would, your roll is **1/500**. An ordinary roll is about 1/2.
6. **The tier.** The 1/N decides the tier, from Common up through Legendary, Mythic and Eternal to Unfathomable at 1/10²⁰. The bottom 1% of rolls are Trash.

Because 1/N is measured against every roll of the mode, it means exactly what it says: a 1/500 or better roll really does come up 1 time in 500, whichever mode you play.

## Modes

| Mode | What changes |
| --- | --- |
| Classic | EP times the multiplier. |
| Exponent | An exponent is rolled too (2 a quarter of the time, 3 an eighth, and so on) and your score is raised to it. |
| Modulo | A modulus from 2 to 9,999 is rolled. If it divides your number exactly, your score is multiplied by the modulus. |
| Target | A target number is rolled. The closer you land, the bigger the bonus, up to ×10,000,000,000 for a bullseye. |
| Prime radar | Shows the nearest prime. Landing on one, beside one, or far from every prime earns extra badges. |

Each mode has badges of its own. Your 1/N always compares you with rolls of the same mode.

## Difficulties

Pick a difficulty under the mode buttons. It changes your score but not the yardstick, so the harder it is, the rarer every tier gets:

| Difficulty | Rule |
| --- | --- |
| Standard | Badges and the multiplier reel. |
| Hardcore | No multiplier reel: only badges count. |
| Nightmare | Badges only, and your score is raised to the power 2/3. |
| Abyss | Badges only, and your score is square-rooted. |
| Oblivion | Badges only, and your score is cube-rooted. Three in four rolls are Trash. |

Charms and lenses are paused on every difficulty but Standard. Harder difficulties pay more lucky tokens: ×2, ×3, ×5 and ×10. How often each one reaches each tier is in [ODDS.md](ODDS.md#difficulties).

## Lucky tokens and permanent luck

Every roll has a 1 in 2 chance to drop a lucky token, whatever its tier. Spend tokens in the Inventory tab on permanent luck levels: at level k, every roll is the best of k + 1 rolls, for good. Each level costs 12% more than the last. Permanent luck multiplies with charms, keeps working through prestige, and unlike charms it does not stop item drops.

## Rolling a lot

- **Roll** (or Space) rolls once.
- **Auto** (or A) rolls until a tier you choose, or until a badge you are hunting turns up.
- **Endless** (or E) never stops on its own.
- **Speed:** 1×, 2× or Turbo. Turbo rolls 90, 250, 500, 1,000, 2,000 or 5,000 times a second (set it under Auto settings) and shows the rarest roll of each screen frame, so a big roll is never skipped.
- Your best rolls of the session and of all time stay beside the reels.

## Items

Rolls of 1/100 or rarer can drop items, and rarer rolls drop better ones. Use items from the Inventory tab:

- **Luck charms** (×10 up to ×10,000,000) make each roll the best of that many rolls. Anything rare turns up about that many times as often. Above ×32 the game draws the best roll's luck straight from its exact odds instead of rolling every one, so even ×10,000,000 is instant. The 1/N shown is still the roll's true chance in the plain game.
- **Drop boosters** (Horn of Plenty, Golden Goose, Diamond Goose) multiply item and coin drop chances for a number of rolls.
- **Lenses** spin the multiplier reel 2 or 10 times and keep the biggest.
- **Overclocks** make Turbo 2 or 4 times as fast for 3 minutes.

Rolls made with a charm or lens never drop items, so boosts cannot feed themselves. Several of one item **fuse** into the next one up: use Fuse for one set, Fuse all for every set of that item, or Fuse everything to push every item as far up its line as it goes.

## Coins and the slot machine

A plain roll of 1/100 or rarer has a 1 in 3 chance to drop a coin. Each coin buys one spin of the coin slot in the Inventory tab, and every spin wins an item. The rarest prizes have a **hard pity**: go long enough without one and the next spin pays it for sure. The panel next to the slot shows every chance and your pity progress.

## Collecting

- **Collection:** every badge and multiplier, with search and filters. Select one for its exact count and how often you have found it against the expectation.
- **Badge book:** each category is a page. Collect every badge on a page that comes up at least 1 in 1,000,000 and claim a reward. Five pages give a legendary skin.
- **Achievements:** 102 of them, each with an item reward.
- **Hall of fame:** your ten best rolls per mode, kept forever, plus any rolls you star.

## Daily things

- **Daily gift:** a Charm of Ten every day, per save file.
- **Daily quests:** three a day, like "Roll Epic or rarer 3 times". Each pays coins and an item, and finishing all three pays a bonus.

## Prestige

After 100,000 rolls (then 200,000 more for the second, and so on) you can prestige. It clears your coins, items and active effects. In return every drop and coin chance is multiplied for good: ×1.5 after the first, ×2 after the second, and half again for each one after. Rolls, badges, skins, achievements and the hall of fame stay.

## Skins

Skins change how the whole game looks, and some change how you play it. Three are free, some are hidden in the game, three come in a 500-coin bundle and five come from the badge book. Four of the hidden skins replace the page with a completely different way to play: a command line, a chat with a bot, a pocket game console and a calculator. See [SKINS-AND-COMMANDS.md](SKINS-AND-COMMANDS.md).

## Your saves

Everything is saved in your browser and nothing is sent anywhere. Settings > Save files holds up to ten save files, each with its own rolls, items and skins. Export a save to back it up or share it; importing always adds a new save file, so it can never overwrite yours.
