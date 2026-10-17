# RNGdle 10 design

Reading this as: an arcade number game for people who roll many times in a sitting, in a lit-reel slot cabinet style, dial ENERGY 3 / RHYTHM 2 / MOTION 3.

Direction from the owner: "sleek and flashy", cleaned up with the antislop rules.

Dial: ENERGY 3 / RHYTHM 2 / MOTION 3

## Decisions and reasons

- **Identity motif: the reel window.** Digits sit in recessed cells, like an odometer or slot reel. The same cell appears in the wordmark, the reels, the hall of fame and the share image, so the game reads as one object.
- **Focal point: the reels and the result under them.** Everything else on the Roll screen is a control for producing the next result.
- **Side leaderboards on wide screens.** During Endless rolling, the session's best and the all-time best stay in view beside the reels, so a big roll is never scrolled away. On phones they stack below.
- **Palette: charcoal neutrals and one brass accent.** Brass is the cabinet trim colour, and it appears only on the Roll button, the one action the screen exists for.
- **Rarity scale: seven fixed colours (brown-grey, grey, green, blue, violet, orange, gold), Trash to Mythic.** This is a data encoding, not decoration. It appears only where it marks a rarity: the tier word, a badge's edge stripe, the tier bar and log entries.
- **Badge edge stripe.** It carries the badge's rarity, so it is information, not ornament.
- **Dark default (Midnight), with Felt and Daylight themes.** Lit digits read best on a dark cabinet in long sessions. Daylight exists for bright rooms, and all three themes pass WCAG AA.
- **Type: the system UI font for text, the system monospace font for digits only.** No web fonts, because the game runs fully offline. Monospace keeps every digit the same width, so reels and number columns line up.
- **Headings in sentence case, with no wide-tracked capitals.** Rarity names are set in weight, not in tracking.
- **Radius scale: 4 / 8 / 12, plus one full pill on the Roll button.** Chips, controls and panels each get their own radius, and the primary action is the only round shape.
- **Shadow only on the reel cabinet and dialogs.** These are the two surfaces that sit above the page.
- **Glow on at most two things: the tier word for Epic and above, and the reel digits for Anomaly and above.** Glow marks a rare result and nothing else.
- **Motion.**
  - **Reels:** they spin because spinning is the mechanic.
  - **Escalation:** the tier word pops in; Rare and above add confetti; Anomaly and above add a shake and a flash. The celebration grows with the rarity.
  - **No endless loops.** The Mythic sheen plays once.
  - **Effects setting:** Full, Reduced or Off, and the system reduced-motion setting turns them off.
- **Spacing.** Controls are grouped tightly under the reels, and larger gaps separate the result, the badges and the page sections.
