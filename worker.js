// Runs part of a lucky roll off the page: the best of `count` independent rolls.
importScripts('data.js', 'badges.js');

self.onmessage = ({ data }) => {
  const { id, mode, count, date, lens } = data;
  const G = self.RNG, STEP = 25000;
  let best = null;
  for (let i = 1; i <= count; i++) {
    const roll = G.randomParams(mode), n = G.randomRoll();
    if (lens) {
      const alt = G.randomParams(mode).mult;
      if (G.MULT_BY_ID[alt].log > G.MULT_BY_ID[roll.mult].log) roll.mult = alt;
    }
    const rank = G.score(n, date, roll).rank;
    if (!best || rank > best.rank) best = { roll, n, rank };
    if (i % STEP === 0) self.postMessage({ id, progress: STEP });
  }
  self.postMessage({ id, progress: count % STEP, best });
};
