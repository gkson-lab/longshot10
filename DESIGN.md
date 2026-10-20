# Long Shot 10 design

Reading this as: an arcade number game for people who roll many times in a sitting, in a lit-reel slot cabinet style, dial ENERGY 3 / RHYTHM 2 / MOTION 3.

Direction from the owner: "sleek and flashy", cleaned up with the antislop rules.

Dial: ENERGY 3 / RHYTHM 2 / MOTION 3

## Decisions and reasons

- **Identity motif: the reel window.** Digits sit in recessed cells, like an odometer or slot reel. The same cell appears in the wordmark, the reels, the hall of fame and the share image, so the game reads as one object.
- **Focal point: the reels and the result under them.** Everything else on the Roll screen is a control for producing the next result.
- **Side leaderboards on wide screens.** During Endless rolling, the session's best and the all-time best stay in view beside the reels, so a big roll is never scrolled away. On phones they stack below.
- **Palette: charcoal neutrals and one brass accent.** Brass is the cabinet trim colour, and it appears only on the Roll button, the one action the screen exists for.
- **The multiplier window.** It sits under the digits and spins like a reel, so the multiplier reads as part of the same machine rather than a separate widget.
- **Mode picker with a one-line description under it.** Five modes change what a roll means, so the active mode says what it does in plain words before you roll.
- **Auto settings behind one button.** Speed, stop tier and hunt matter only while auto-rolling, so they stay folded away and Roll stays the one obvious action. Number lookup moved to the Collection tab for the same reason.
- **Rarity scale: nineteen fixed colours, Trash to Unfathomable (brown-grey, grey, green, blue, violet, orange, red, gold, aqua, pink, white, pale lavender, pale gold, pale rose, then mint, peach, silver, amber and hot pink).** Light skins use a darkened copy of the same scale so every step passes AA on them. This is a data encoding, not decoration. It appears only where it marks a rarity: the tier word, the 1/N under it, a badge's edge stripe, the multiplier symbol and log entries.
- **1/N under the tier word.** It is the most direct answer to "how lucky was that", so it sits right under the tier word, in the tier's colour and in large tabular digits; the formula line under it explains the score.
- **Badge edge stripe.** It carries the badge's rarity, so it is information, not ornament.
- **Dark default (Midnight), and skins.** Lit digits read best on a dark cabinet in long sessions. A skin is only a set of colour tokens, so every screen works in every skin without its own styles. Skins: Midnight, Felt, Daylight and High Contrast are free; Neon, LCD, Blueprint, Terminal, Console, Chat, Handheld and Calculator are secrets found in the page; Gold, Ruby and Aurora are one 500-coin bundle; Graph Paper, Golden Spiral, Odometer, Vaporwave and Spectrum come from badge book pages; achievement rewards (Chalkboard first) each come with one achievement. `npm run contrast` checks every skin against the numbers below, so a new skin cannot ship below them. Every skin is checked for WCAG AA: text tokens and all rarity colours at 4.5:1 on each surface, the accent and focus ring at 3:1.
- **High Contrast is free.** It exists for low vision and glare, so it is never a reward to unlock: white text, borders at a visible grey, a 3 px yellow focus ring, and locked cards at full opacity instead of faded.
- **Text size scales the page, not the skins that replace it.** Large and Larger zoom the page and its dialogs by 15% and 30%, and the layout reflows, so nothing runs off a phone. Console, Chat, Handheld and Calculator keep their fixed sizes because they imitate objects with fixed proportions.
- **Grid backgrounds on Blueprint and Graph Paper only.** The ruled grid is what those two skins are, so it is identity rather than texture.
- **Terminal skin: text only.** It asked for a Windows console, so it drops every box, border, divider, shadow, radius, bar and effect, uses one monospace font, writes buttons as [Label], and puts a prompt and a blinking block cursor on the wordmark. The cursor is the one deliberate endless loop in the game; it stops with the effects setting.
- **Name: Long Shot 10.** A long shot is a bet with long odds, which is every roll here; the 10 is the ten digits, still drawn as two reel cells in the wordmark.
- **Chat, Handheld and Calculator: three more ways to play.** Like Console, each replaces the page and drives the same game through the same functions, so nothing about the odds changes. Each has its own fixed palette, chosen to read as the object it imitates: a messaging app with a light background and blue sent bubbles, a pocket console with the four-shade green screen of early monochrome handhelds, and a dark calculator with a grey-green LCD whose ten digits hold exactly one roll. Every control is at least 44 px and has a keyboard key, and each skin has a visible way out back to the skin worn before.
- **Spreadsheet: the game as a sheet.** A plain white grid with lettered columns, numbered rows, a formula bar and sheet tabs, in neutral greys with one teal for the selected tab and focus, so it reads as any spreadsheet rather than one product. Command output is split into cells at its column gaps, so every table in the game becomes a sheet without its own layout.
- **Mastery as four small reel cells.** The level count reuses the identity motif, a filled cell per level, instead of stars.
- **Console skin: the game as a command line.** Modelled on a PowerShell window: black, light grey text, a PS prompt and a block caret, nothing else on screen. Every screen of the game has a command, notices print as lines, and during Auto and Endless only Epic or rarer rolls print, at most twenty lines a second, so the output stays readable.
- **The hidden command line** sits behind a faint >_ at the bottom of Settings, a full 44 px target that does not draw attention. It always looks like a console, whatever the skin.
- **Charts in the Log.** Rolls per day are bars on a shared zero baseline; tier shares are a dot plot on a log scale, because the shares run from 79% down to one in ten billion. Yours is a filled dot and the expected share a ring, so the two differ by shape as well as by colour; the orange and blue pair passed the dataviz palette validator on the dark and light surfaces. Hovering any mark shows its exact value, and the Luck table under it lists the same numbers.
- **How lucky you have been is a sentence, not a score.** The exact share of players who would do as well reads plainly ("62% of players"), where an invented luck score would need explaining. It uses plain rolls only, for the same reason as the Luck table.
- **Milestones as a timeline.** The first time each tier was reached is a sequence in time, so it is drawn as one line with a dot per tier in that tier's colour, the same rarity encoding as everywhere else.
- **Chances never round up to 100%.** A 99.996% chance is shown as 99.9960%, and anything closer as "more than 99.9999%", because 100% would claim a certainty the odds do not have.
- **The coin shop is folded away.** It is a fallback for a sure item, so it opens on request and the slot keeps the top of the Inventory. Folded sections show a turning marker so they read as openable.
- **Quick use sits under the roll buttons and only appears when something is pinned.** Its buttons are rebuilt only when the pins change, so a click during Turbo never lands on a button that was just replaced.
- **Bingo cells fill with ink when marked.** A filled cell is how a dauber marks paper, and it reads at arm's length without colour. The thin top edge of each cell is its badge's rarity colour, the same encoding as the card stripe elsewhere.
- **The arcade prints its odds on every game.** Each game shows its exact chances and its payback next to the controls, never behind a link, because a game of chance that hides its odds is the opposite of what this game is about. The wheel's segments are drawn at the size of their chances for the same reason, even though real wheels use equal slices.
- **Arcade games reuse the cabinet and the reel cells.** Higher or lower and Digit pick draw their numbers in the same small cells as the wordmark, and the wheel's pointer is the one accent on it, since it decides the prize.
- **Type: the system UI font for text, the system monospace font for digits only.** No web fonts, because the game runs fully offline. Monospace keeps every digit the same width, so reels and number columns line up.
- **Headings in sentence case, with no wide-tracked capitals.** Rarity names are set in weight, not in tracking.
- **Radius scale: 4 / 8 / 12, plus one full pill on the Roll button.** Chips, controls and panels each get their own radius, and the primary action is the only round shape.
- **Shadow only on the reel cabinet and dialogs.** These are the two surfaces that sit above the page.
- **Glow on at most two things: the tier word for Legendary and above, and the reel digits for Divine and above.** Glow marks a rare result and nothing else. The multiplier symbol takes its rarity colour without a glow.
- **Motion.**
  - **Reels:** they spin because spinning is the mechanic.
  - **Escalation:** the tier word pops in; Epic and above add confetti that doubles with each tier; Divine and above add a flash, Celestial and above a bigger shake. The thresholds moved up when the tiers got easier to reach, so the effects stay rare. The celebration grows with the rarity.
  - **No endless loops.** The sheen on Transcendent and above plays once. The Terminal cursor is the only exception.
  - **Effects setting:** Full, Reduced or Off, and the system reduced-motion setting turns them off.
- **Spacing.** Controls are grouped tightly under the reels, and larger gaps separate the result, the badges and the page sections.
