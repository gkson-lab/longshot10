(function () {
  'use strict';
  const G = window.RNG;
  const { BADGES, POWER_BADGES, RARITIES, ROLL_TIERS, CATEGORIES } = G;
  const $ = id => document.getElementById(id);
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const sup = n => String(n).replace(/\d/g, d => SUP[d]);
  const TIER_INDEX = Object.fromEntries(ROLL_TIERS.map((t, i) => [t.id, i]));
  const MODE_NAME = { classic: 'Classic', exp: 'Exponent' };
  const tierVar = id => `var(--r-${id})`;
  const systemReduced = matchMedia('(prefers-reduced-motion: reduce)');

  function dayKey(t = Date.now()) {
    const d = new Date(t), p = x => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  const rollLabel = (n, e) => fmt(n) + (e ? sup(e) : '');
  const rollHash = (n, e) => '#' + n + (e ? '^' + e : '');
  const odds = p => (1 / p < 10 ? `1 in ${(1 / p).toFixed(1)}` : `1 in ${fmt(1 / p)}`);
  const beats = pct => (pct >= 99.99 ? '99.99' : pct >= 99 ? pct.toFixed(2) : pct.toFixed(1));

  // A score is stored as log10 so exponent-mode results like 10^300 stay comparable.
  function bigText(log, exact) {
    if (log === -Infinity) return '0';
    if (log < 18 && exact) return exact().toLocaleString('en-US');
    let ex = Math.floor(log), mant = Number((10 ** (log - ex)).toFixed(2));
    if (mant >= 10) { mant /= 10; ex++; } // 9.999 rounds up to 10.00
    return `${mant.toFixed(2)} × 10${sup(ex)}`;
  }
  const scoreText = r => bigText(r.log, () => BigInt(r.ep) ** BigInt(r.e || 1));
  function valueText(n, e) {
    if (n < 2) return String(n);
    const log = e * Math.log10(n);
    if (log < 21) return (BigInt(n) ** BigInt(e)).toLocaleString('en-US');
    return `${bigText(log)}, ${fmt(Math.floor(log) + 1)} digits`;
  }
  function factorText(n) {
    if (n < 2) return '';
    const f = G.factorize(n);
    if (f.length === 1 && f[0][1] === 1) return 'Prime';
    return f.map(([p, k]) => fmt(p) + (k > 1 ? sup(k) : '')).join(' × ');
  }

  // Storage. Older saves from RNGdle 9 are carried over on first load.
  const KEY = 'rngdle10:v3';
  const LOG_LIMIT = 200;
  const blank = () => ({
    v: 3, log: [], total: 0, totals: { classic: 0, exp: 0 }, counts: {}, first: {},
    tiers: { classic: {}, exp: {} }, hof: { classic: [], exp: [] }, favs: [], ach: {}, huntsDone: 0, shares: 0,
    settings: { theme: 'midnight', effects: 'full', sound: true }, mode: 'classic',
  });
  let storageOk = true;
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s) {
        const st = Object.assign(blank(), s);
        st.settings = Object.assign(blank().settings, s.settings);
        return st;
      }
      const old = JSON.parse(localStorage.getItem('rngdle9:v2'));
      const st = blank();
      if (old) {
        Object.assign(st, { total: old.total || 0, counts: old.counts || {}, first: old.first || {} });
        st.totals.classic = st.total;
        st.tiers.classic = old.tiers || {};
        st.settings.sound = old.sound !== false;
        st.log = (old.log || []).filter(x => Number.isInteger(x.n));
        for (const x of st.log) insertTop(st.hof.classic, entryFor(x.n, x.t));
      }
      return st;
    } catch { return blank(); }
  }
  let saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); storageOk = true; } catch { storageOk = false; }
      $('storageNotice').hidden = storageOk;
    }, 200);
  }

  function entryFor(n, t, e) {
    const mode = e ? 'exp' : 'classic';
    const r = G.score(n, dayKey(t), e);
    const { pct, tier } = G.rollTier(r.log, mode);
    return { n, t, e, ep: r.ep, log: r.log, tier: tier.id, pct };
  }
  function insertTop(list, entry, size = 10) {
    if (list.length >= size && entry.log <= list[list.length - 1].log) return false;
    list.push(entry);
    list.sort((a, b) => b.log - a.log || a.t - b.t);
    list.length = Math.min(list.length, size);
    return true;
  }

  const state = load();
  const session = { rolls: 0, best: { classic: [], exp: [] }, start: Date.now() };

  function record(n, t, e) {
    const mode = e ? 'exp' : 'classic';
    const r = G.score(n, dayKey(t), e);
    const { pct, tier } = G.rollTier(r.log, mode);
    const entry = { n, t, e, ep: r.ep, log: r.log, tier: tier.id, pct };
    state.log.unshift(e ? { n, t, e } : { n, t });
    if (state.log.length > LOG_LIMIT) state.log.length = LOG_LIMIT;
    state.total++;
    state.totals[mode]++;
    const fresh = new Set();
    for (const b of r.badges) {
      if (!state.counts[b.id]) { fresh.add(b.id); state.first[b.id] = e ? [n, e] : n; }
      state.counts[b.id] = (state.counts[b.id] || 0) + 1;
    }
    state.tiers[mode][tier.id] = (state.tiers[mode][tier.id] || 0) + 1;
    const madeHof = insertTop(state.hof[mode], entry);
    const madeSession = insertTop(session.best[mode], entry);
    session.rolls++;
    return { r, pct, tier, fresh, entry, madeHof, madeSession };
  }

  // Sound
  let audio = null;
  function tone(freq, dur, { type = 'triangle', gain = 0.05, when = 0 } = {}) {
    if (!state.settings.sound) return;
    try {
      audio = audio || new AudioContext();
      const t0 = audio.currentTime + when, o = audio.createOscillator(), g = audio.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(audio.destination);
      o.start(t0);
      o.stop(t0 + dur);
    } catch { /* audio unavailable */ }
  }
  const tick = i => tone(380 + i * 45, 0.06, { type: 'square', gain: 0.02 });
  function fanfare(i) {
    const scale = [261.6, 329.6, 392, 523.3, 659.3, 784, 1046.5];
    for (let k = 0; k < Math.max(1, i); k++) tone(scale[k], 0.3 + k * 0.05, { when: k * 0.07 });
  }
  function paintSound() {
    const on = state.settings.sound;
    $('soundBtn').setAttribute('aria-label', on ? 'Mute sound' : 'Turn sound on');
    $('soundBtn').innerHTML = on
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m22 9-6 6M16 9l6 6"/></svg>';
  }
  $('soundBtn').addEventListener('click', () => { state.settings.sound = !state.settings.sound; paintSound(); save(); });

  const effects = () => (systemReduced.matches ? 'off' : state.settings.effects);

  // Reels
  const reels = [];
  {
    const groups = [1, 3, 3, 3]; // 1,234,567,890
    for (const size of groups) {
      const trio = document.createElement('div');
      trio.className = 'trio';
      for (let i = 0; i < size; i++) {
        const reel = document.createElement('div');
        reel.className = 'reel lead';
        reel.innerHTML = '<div class="strip"><div>0</div></div>';
        trio.appendChild(reel);
        reels.push(reel);
      }
      $('reels').appendChild(trio);
    }
  }
  const leadCount = n => G.DIGITS - (n === 0 ? 1 : String(n).length);

  function setReel(reel, digit, lead) {
    const strip = reel.firstChild;
    reel.classList.remove('spinning', 'hit');
    reel.classList.toggle('lead', lead);
    strip.style.transition = 'none';
    strip.style.transform = '';
    strip.innerHTML = `<div>${digit}</div>`;
  }
  function setReels(n, e) {
    const s = String(n).padStart(G.DIGITS, '0'), lead = leadCount(n);
    reels.forEach((r, i) => setReel(r, s[i], i < lead));
    $('expWrap').hidden = !e;
    if (e) setReel($('expReel'), e, false);
    $('reels').setAttribute('aria-label', rollLabel(n, e));
  }
  function spinReel(reel, target, ms, spins, lead, onStop) {
    return new Promise(resolve => {
      const strip = reel.firstChild;
      const from = strip.lastChild ? strip.lastChild.textContent : '0';
      let html = `<div>${from}</div>`;
      for (let j = 1; j < spins; j++) html += `<div>${Math.floor(Math.random() * 10)}</div>`;
      strip.innerHTML = html + `<div>${target}</div>`;
      reel.classList.remove('lead', 'hit');
      reel.classList.add('spinning');
      strip.style.transition = 'none';
      strip.style.transform = 'translateY(0)';
      strip.getBoundingClientRect();
      strip.style.transition = `transform ${ms}ms cubic-bezier(.15,.75,.25,1.04)`;
      strip.style.transform = `translateY(-${(spins / (spins + 1)) * 100}%)`;
      let done = false;
      const settle = () => { // transitionend, or the timer when a background tab pauses the animation
        if (done) return;
        done = true;
        setReel(reel, target, lead);
        if (onStop) onStop();
        resolve();
      };
      strip.addEventListener('transitionend', settle, { once: true });
      setTimeout(settle, ms + 150);
    });
  }
  function spinTo(n, e, speed) {
    if (speed === 3 || effects() === 'off') { setReels(n, e); return Promise.resolve(); }
    const s = String(n).padStart(G.DIGITS, '0'), lead = leadCount(n);
    const base = speed === 1 ? 650 : 240, stagger = speed === 1 ? 100 : 30, spins = speed === 1 ? 24 : 10;
    $('expWrap').hidden = !e;
    const jobs = reels.map((r, i) => spinReel(r, s[i], base + i * stagger, spins + i * 2, i < lead, speed === 1 ? () => tick(i) : null));
    if (e) jobs.push(spinReel($('expReel'), e, base + reels.length * stagger + (speed === 1 ? 250 : 60), spins + 24, false, null));
    return Promise.all(jobs).then(() => $('reels').setAttribute('aria-label', rollLabel(n, e)));
  }

  // Confetti, shake and flash scale with the tier.
  const canvas = $('fx'), ctx = canvas.getContext('2d');
  let parts = [], raf = 0;
  const sizeCanvas = () => { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio; };
  sizeCanvas();
  addEventListener('resize', sizeCanvas);
  function burst(color, count, power) {
    const r = $('cabinet').getBoundingClientRect(), d = devicePixelRatio;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, v = (Math.random() * 0.8 + 0.2) * power * d;
      parts.push({ x: (r.left + r.width * (0.1 + Math.random() * 0.8)) * d, y: (r.top + r.height / 2) * d, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4 * d, life: 1, size: (Math.random() * 3 + 1.5) * d, color, spin: Math.random() * 6 });
    }
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      p.vy += 0.22 * devicePixelRatio; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.life -= 0.013; p.spin += 0.2;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin);
      ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
      ctx.restore();
    }
    raf = parts.length ? requestAnimationFrame(frame) : 0;
  }
  const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  let lastFlash = 0;
  function celebrate(tierId, speed) {
    const i = TIER_INDEX[tierId], color = cssVar(`--r-${tierId}`);
    const hit = i >= 5;
    for (const r of reels.concat($('expReel'))) { r.style.setProperty('--tc', color); r.classList.toggle('hit', hit && !r.classList.contains('lead')); }
    if (speed !== 3) fanfare(i);
    if (effects() !== 'full' || (speed === 3 && i < 6)) return;
    if (i >= 3) burst(color, [0, 0, 0, 30, 70, 140, 280][i], [0, 0, 0, 7, 9, 12, 16][i]);
    // No shake or flash in Turbo, and never more than one flash every 3 seconds.
    if (i >= 5 && speed !== 3 && Date.now() - lastFlash > 3000) {
      lastFlash = Date.now();
      const c = $('cabinet');
      c.classList.remove('shake', 'shake-big'); void c.offsetWidth;
      c.classList.add(i === 6 ? 'shake-big' : 'shake');
      const f = $('flash');
      f.style.setProperty('--tc', color);
      f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
    }
  }

  function toast(html, tierOrRarity) {
    if (auto && speed === 3 && $('toasts').children.length >= 4) return; // Turbo can earn badges faster than anyone can read
    const el = document.createElement('div');
    el.className = 'toast';
    el.style.setProperty('--tc', tierVar(tierOrRarity));
    el.innerHTML = html;
    $('toasts').appendChild(el);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3000);
  }

  // Badge cards and the badge detail dialog
  const allBadges = () => BADGES.concat(POWER_BADGES, G.datedBadges(dayKey()));
  const findBadge = id => allBadges().find(b => b.id === id);

  function card(b, { locked = false, times = 0, delay = null, isNew = false } = {}) {
    const r = RARITIES[b.rarity];
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card' + (locked ? ' locked' : '') + (delay !== null ? ' in' : '');
    btn.style.setProperty('--rc', tierVar(r.id));
    if (delay !== null) btn.style.animationDelay = delay + 'ms';
    btn.innerHTML = `<span class="name"></span><span class="desc"></span><span class="right"><span class="rar"></span> <span class="pts num"></span><br><span class="odds"></span></span>`;
    btn.querySelector('.name').textContent = b.name;
    if (isNew) btn.querySelector('.name').insertAdjacentHTML('beforeend', '<span class="new">New</span>');
    btn.querySelector('.desc').textContent = b.desc;
    btn.querySelector('.rar').textContent = r.name;
    btn.querySelector('.pts').textContent = '+' + fmt(b.ep);
    btn.querySelector('.odds').textContent = times ? `${odds(b.p)}, earned ${fmt(times)}×` : odds(b.p);
    btn.addEventListener('click', () => openBadge(b));
    li.appendChild(btn);
    return li;
  }

  let dialogBadge = null;
  function openBadge(b) {
    dialogBadge = b;
    const r = RARITIES[b.rarity];
    $('bdTitle').textContent = b.name;
    $('bdMeta').innerHTML = `<span style="color:${tierVar(r.id)};font-weight:700">${r.name}</span> · ${esc(b.cat)}`;
    $('bdDesc').textContent = b.desc;
    const rolls = b.power ? state.totals.exp : state.total;
    const have = state.counts[b.id] || 0;
    const rows = [
      b.power ? ['Chance', `${odds(b.p)} per Exponent roll`] : ['Qualifying numbers', `${fmt(b.count)} of ${fmt(G.SPACE)}`],
      ['Odds', odds(b.p)],
      ['Worth', `${fmt(b.ep)} EP`],
      ['You earned it', `${fmt(have)} ${have === 1 ? 'time' : 'times'}`],
      [`Expected in your ${fmt(rolls)} ${b.power ? 'Exponent ' : ''}rolls`, (rolls * b.p).toFixed(rolls * b.p < 10 ? 2 : 0)],
    ];
    const first = state.first[b.id];
    $('bdFacts').innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd class="num">${esc(v)}</dd>`).join('');
    if (first !== undefined) {
      const [n, e] = Array.isArray(first) ? first : [first];
      $('bdFacts').insertAdjacentHTML('beforeend', `<dt>First found</dt><dd class="num"><a href="${rollHash(n, e)}" data-close>${esc(rollLabel(n, e))}</a></dd>`);
    }
    $('bdHunt').hidden = b.cat === 'Daily';
    $('badgeDialog').showModal();
  }
  $('bdHunt').addEventListener('click', () => {
    if (dialogBadge.power && state.mode !== 'exp') setMode('exp');
    setHunt(dialogBadge.id);
    $('badgeDialog').close();
    selectTab('roll');
  });
  for (const d of document.querySelectorAll('dialog')) {
    d.addEventListener('click', e => {
      if (e.target === d || e.target.closest('[data-close]')) d.close();
    });
  }

  // Result
  let shown = null;
  function showResult(entry, { animate = false, speed = 1, preview = false, fresh = null } = {}) {
    const { n, t, e } = entry;
    const r = G.score(n, dayKey(t), e);
    const mode = e ? 'exp' : 'classic';
    const { pct, tier } = G.rollTier(r.log, mode);
    shown = { n, t, e, r, pct, tier, preview };
    $('firstRun').hidden = true;
    $('result').hidden = false;

    const w = $('tierWord');
    w.textContent = tier.name;
    w.style.setProperty('--tc', tierVar(tier.id));
    const i = TIER_INDEX[tier.id];
    w.className = 'tier-word' + (i >= 4 ? ' glow' : '');
    if (animate && speed !== 3 && effects() !== 'off') { void w.offsetWidth; w.classList.add(i === 6 ? 'sheen' : 'pop'); }

    $('scoreLine').innerHTML = e > 1
      ? `<b class="num">${fmt(r.ep)}</b> EP${sup(e)} = <b class="num">${esc(scoreText(r))}</b> · beats ${beats(pct)}% of Exponent rolls`
      : `<b class="num">${fmt(r.ep)}</b> EP · beats ${beats(pct)}% of ${e ? 'Exponent ' : ''}rolls`;
    const facts = [factorText(n)];
    if (e && e > 1) facts.push(`${rollLabel(n, e)} = <span class="value num">${esc(valueText(n, e))}</span>`);
    $('facts').innerHTML = facts.filter(Boolean).map((x, k) => (k === 0 ? `<span class="num">${esc(x)}</span>` : x)).join(' · ')
      + (preview ? ' · <span>preview, not recorded</span>' : '');

    $('badgeHead').textContent = r.badges.length === 1 ? '1 badge' : `${r.badges.length} badges`;
    $('badgeSub').textContent = r.badges.length ? 'select a badge for its exact odds' : '';
    const list = $('badges');
    list.replaceChildren();
    if (!r.badges.length) {
      list.innerHTML = '<li class="empty-state">No badges on this roll. Most numbers earn one or two; about 1 in 7 earns none.</li>';
    }
    const stagger = animate && speed === 1 && effects() !== 'off';
    r.badges.forEach((b, k) => list.appendChild(card(b, { delay: stagger ? k * 60 : null, isNew: !!fresh && fresh.has(b.id) })));
    paintStar();
    $('starBtn').hidden = preview;
    return tier;
  }

  const isFav = (n, t) => state.favs.some(f => f.n === n && f.t === t);
  function paintStar() {
    if (!shown) return;
    const on = isFav(shown.n, shown.t);
    $('starBtn').setAttribute('aria-pressed', String(on));
    $('starBtn').textContent = on ? 'Starred' : 'Star';
  }
  $('starBtn').addEventListener('click', () => {
    if (!shown || shown.preview) return;
    const { n, t, e } = shown;
    if (isFav(n, t)) state.favs = state.favs.filter(f => !(f.n === n && f.t === t));
    else { state.favs.unshift(e ? { n, t, e } : { n, t }); checkAchievements(); }
    paintStar();
    save();
  });

  function shareText() {
    const { n, e, r, pct, tier } = shown;
    const squares = ['⬜', '🟩', '🟦', '🟪', '🟧', '🟨']; // one per badge, coloured by rarity, as in Wordle shares
    return [
      'RNGdle 10' + (e ? ' · Exponent' : ''),
      rollLabel(n, e),
      `${tier.name} · ${e > 1 ? `${fmt(r.ep)} EP${sup(e)} = ${scoreText(r)}` : `${fmt(r.ep)} EP`} · beats ${beats(pct)}%`,
      r.badges.map(b => squares[b.rarity]).join('') || 'no badges',
    ].join('\n');
  }
  $('copyBtn').addEventListener('click', async () => {
    const text = shareText();
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    $('copyBtn').textContent = 'Copied';
    setTimeout(() => { $('copyBtn').textContent = 'Copy text'; }, 1400);
    state.shares++; checkAchievements(); save();
  });

  // Share image: the reel motif drawn on a 1200×630 card.
  $('imageBtn').addEventListener('click', () => {
    const { n, e, r, pct, tier } = shown;
    const W = 1200, H = 630, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const v = name => cssVar(name);
    const sans = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    const mono = 'ui-monospace, Cascadia Mono, SF Mono, Menlo, Consolas, monospace';
    g.fillStyle = v('--bg'); g.fillRect(0, 0, W, H);
    g.fillStyle = v('--ink'); g.font = `800 34px ${sans}`; g.fillText('RNGdle 10', 60, 80);
    g.fillStyle = v('--muted'); g.font = `500 22px ${sans}`; g.fillText(e ? 'Exponent mode' : 'Classic mode', 60, 114);
    const s = String(n).padStart(G.DIGITS, '0'), lead = leadCount(n);
    const cw = 76, ch = 112, gap = 8, gg = 22;
    let x = 60;
    for (let k = 0; k < s.length; k++) {
      if (k === 1 || k === 4 || k === 7) x += gg;
      g.fillStyle = v('--cell'); g.beginPath(); g.roundRect(x, 160, cw, ch, 8); g.fill();
      g.fillStyle = k < lead ? v('--cell-lead') : v('--cell-ink'); g.font = `700 66px ${mono}`; g.textAlign = 'center';
      g.fillText(s[k], x + cw / 2, 160 + ch / 2 + 23);
      x += cw + gap;
    }
    if (e) {
      g.fillStyle = v('--cell'); g.beginPath(); g.roundRect(x + 10, 150, 52, 72, 6); g.fill();
      g.fillStyle = v('--cell-ink'); g.font = `700 40px ${mono}`; g.fillText(String(e), x + 36, 200);
    }
    g.textAlign = 'left';
    g.fillStyle = v(`--r-${tier.id}`); g.font = `900 78px ${sans}`; g.fillText(tier.name, 60, 380);
    g.fillStyle = v('--ink'); g.font = `600 28px ${sans}`;
    g.fillText(`${e > 1 ? `${fmt(r.ep)} EP${sup(e)} = ${scoreText(r)}` : `${fmt(r.ep)} EP`} · beats ${beats(pct)}% of rolls`, 60, 428);
    r.badges.slice(0, 6).forEach((b, k) => {
      const col = k % 2, row = Math.floor(k / 2), bx = 60 + col * 540, by = 482 + row * 40;
      g.fillStyle = v(`--r-${RARITIES[b.rarity].id}`); g.fillRect(bx, by - 20, 5, 26);
      g.fillStyle = v('--ink'); g.font = `600 24px ${sans}`; g.fillText(b.name, bx + 16, by);
    });
    if (r.badges.length > 6) { g.fillStyle = v('--muted'); g.font = `500 22px ${sans}`; g.fillText(`and ${r.badges.length - 6} more`, 60, 606); }
    c.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `rngdle10-${n}${e ? '-pow' + e : ''}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    state.shares++; checkAchievements(); save();
  });

  // Side boards: the best rolls of this session and of all time, for the current mode.
  let freshEntry = null;
  function renderBoards() {
    const mode = state.mode;
    for (const el of document.querySelectorAll('[data-board]')) {
      const all = el.dataset.board === 'all';
      const list = all ? state.hof[mode] : session.best[mode];
      const sub = all ? `${MODE_NAME[mode]} · ${fmt(state.totals[mode])} rolls` : `${MODE_NAME[mode]} · ${fmt(session.rolls)} rolls`;
      const items = list.map((x, k) => {
        const tier = ROLL_TIERS[TIER_INDEX[x.tier]];
        return `<li${x === freshEntry ? ' class="fresh"' : ''} style="--tc:${tierVar(x.tier)}"><a href="${rollHash(x.n, x.e)}"><span class="rank num">${k + 1}</span><span class="n num">${esc(rollLabel(x.n, x.e))}</span><span class="sc num">${esc(bigText(x.log, () => BigInt(x.ep) ** BigInt(x.e || 1)))}</span><span class="tier">${tier.name}</span></a></li>`;
      }).join('');
      el.innerHTML = `<h2>${all ? 'All time' : 'This session'}</h2><p class="sub num">${sub}</p>`
        + (items ? `<ol>${items}</ol>` : `<p class="empty">${all ? 'Your ten best rolls ever land here.' : 'Your ten best rolls this session land here.'}</p>`);
    }
  }

  // Rolling
  let speed = 1, auto = null, busy = false, hunt = '', huntRolls = 0;

  async function rollOnce() {
    const mode = state.mode;
    const n = G.randomRoll(), e = mode === 'exp' ? G.randomExponent() : undefined, t = Date.now();
    const rec = record(n, t, e);
    save();
    for (const b of rec.r.badges) {
      if (rec.fresh.has(b.id)) toast(`New badge: <b>${esc(b.name)}</b> (${RARITIES[b.rarity].name})`, RARITIES[b.rarity].id);
    }
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    const sp = auto && speed === 3 ? 3 : speed;
    if (sp !== 3) $('result').hidden = true;
    await spinTo(n, e, sp);
    showResult(rec.entry, { animate: true, speed: sp, fresh: rec.fresh });
    celebrate(rec.tier.id, sp);
    freshEntry = rec.madeSession || rec.madeHof ? rec.entry : null;
    renderBoards();

    let found = false;
    if (hunt) {
      huntRolls++;
      found = rec.r.badges.some(b => b.id === hunt);
      if (found) {
        const b = findBadge(hunt);
        toast(`Found <b>${esc(b.name)}</b> after ${fmt(huntRolls)} ${huntRolls === 1 ? 'roll' : 'rolls'}`, RARITIES[b.rarity].id);
        state.huntsDone++;
        state.lastHuntP = b.p;
        huntRolls = 0;
      }
    }
    checkAchievements(rec);
    paintStatus();
    return { tier: rec.tier, found };
  }

  function paintStatus() {
    const parts = [];
    if (session.rolls) {
      const best = session.best[state.mode][0];
      parts.push(`This session: <b class="num">${fmt(session.rolls)}</b> ${session.rolls === 1 ? 'roll' : 'rolls'}`
        + (best ? `, best <b style="color:${tierVar(best.tier)}">${ROLL_TIERS[TIER_INDEX[best.tier]].name}</b>` : ''));
    }
    if (auto === 'endless') {
      const mins = (Date.now() - session.start) / 60000;
      parts.push(`Endless is on: it keeps rolling until you press Stop${mins > 0.5 ? `, about ${fmt(session.rolls / mins)} rolls a minute` : ''}`);
    }
    if (hunt) {
      const b = findBadge(hunt);
      parts.push(`Hunting <b>${esc(b.name)}</b> (${odds(b.p)}), <span class="num">${fmt(huntRolls)}</span> rolls so far`);
    }
    $('status').innerHTML = parts.join('<br>');
  }

  async function rollClicked() {
    if (auto) { setAuto(null); return; }
    if (busy || !ready[state.mode]) return;
    busy = true;
    $('rollBtn').disabled = true;
    await rollOnce();
    busy = false;
    $('rollBtn').disabled = false;
  }
  $('rollBtn').addEventListener('click', rollClicked);

  function setAuto(kind) {
    auto = kind;
    $('autoBtn').setAttribute('aria-pressed', String(kind === 'auto'));
    $('endlessBtn').setAttribute('aria-pressed', String(kind === 'endless'));
    paintRollButton();
    paintStatus();
    if (kind && !busy) autoLoop();
  }
  async function autoLoop() {
    busy = true;
    while (auto) {
      if (!ready[state.mode]) { await warm(state.mode); continue; }
      const kind = auto;
      const { tier, found } = await rollOnce();
      if (kind === 'auto' && auto === 'auto' && (found || TIER_INDEX[tier.id] >= +$('stopAt').value)) { setAuto(null); break; }
      await sleep(speed === 1 ? 800 : speed === 2 ? 300 : 40);
    }
    busy = false;
    paintRollButton();
  }
  $('autoBtn').addEventListener('click', () => setAuto(auto === 'auto' ? null : 'auto'));
  $('endlessBtn').addEventListener('click', () => setAuto(auto === 'endless' ? null : 'endless'));
  $('speed').addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    speed = +b.dataset.speed;
    $('speed').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  });

  function paintRollButton() {
    const btn = $('rollBtn');
    if (auto) { btn.textContent = 'Stop'; btn.disabled = false; return; }
    btn.textContent = ready[state.mode] ? 'Roll' : 'Loading odds…';
    btn.disabled = !ready[state.mode] || busy;
  }

  document.addEventListener('keydown', ev => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || $('tab-roll').hidden || document.querySelector('dialog[open]')) return;
    const t = ev.target.closest ? ev.target : document.body;
    if (t.closest('input, select, textarea')) return;
    if (ev.code === 'Space') {
      if (t.closest('button, a')) return; // the focused control handles Space itself
      ev.preventDefault();
      rollClicked();
    }
    if (ev.code === 'KeyA') setAuto(auto === 'auto' ? null : 'auto');
    if (ev.code === 'KeyE') setAuto(auto === 'endless' ? null : 'endless');
  });

  // Modes and the odds sample each mode needs before its first roll.
  const ready = { classic: false, exp: false };
  const warming = {};
  function warm(mode) {
    if (!warming[mode]) {
      warming[mode] = G.warmUp(mode).then(() => { ready[mode] = true; paintRollButton(); })
        .catch(err => { $('status').textContent = `The odds could not be prepared (${err.message}). Reload the page to try again.`; });
    }
    return warming[mode];
  }
  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('.modes [data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    $('expWrap').hidden = mode !== 'exp';
    fillHunt();
    warm(mode);
    paintRollButton();
    renderBoards();
    paintStatus();
    save();
  }
  document.querySelectorAll('.modes [data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

  function fillHunt() {
    const sel = $('hunt');
    const keep = hunt;
    sel.replaceChildren(new Option('No badge', ''));
    for (const cat of CATEGORIES) {
      if (cat === 'Daily' || (cat === 'Powers' && state.mode !== 'exp')) continue;
      const og = document.createElement('optgroup');
      og.label = cat;
      for (const b of allBadges().filter(x => x.cat === cat).sort((a, c) => c.p - a.p)) og.appendChild(new Option(`${b.name} (${odds(b.p)})`, b.id));
      sel.appendChild(og);
    }
    setHunt([...sel.options].some(o => o.value === keep) ? keep : '');
  }
  function setHunt(id) {
    if (id !== hunt) huntRolls = 0;
    hunt = id;
    $('hunt').value = id;
    paintStatus();
  }
  $('hunt').addEventListener('change', () => setHunt($('hunt').value));

  // Preview any number (and exponent) from the URL: #1729 or #1729^3
  function fromHash() {
    const m = location.hash.match(/^#(\d{1,10})(?:\^(\d{1,2}))?$/);
    if (!m) return;
    const n = Number(m[1]), e = m[2] ? Math.min(G.E_MAX, Math.max(1, Number(m[2]))) : undefined;
    if (e && state.mode !== 'exp') setMode('exp');
    if (!ready[e ? 'exp' : 'classic']) { warm(e ? 'exp' : 'classic').then(fromHash); return; }
    setReels(n, e);
    const tier = showResult({ n, t: Date.now(), e }, { preview: true });
    celebrate(tier.id, 3);
    selectTab('roll');
  }
  addEventListener('hashchange', fromHash);
  $('checkForm').addEventListener('submit', ev => {
    ev.preventDefault();
    const raw = $('checkInput').value.replace(/[\s,_]/g, '');
    const m = raw.match(/^(\d{1,10})(?:\^(\d{1,2}))?$/);
    if (!m) {
      $('checkInput').setCustomValidity('Enter a whole number from 0 to 9,999,999,999, optionally with ^ and an exponent, like 1729^3');
      $('checkInput').reportValidity();
      return;
    }
    const hash = rollHash(Number(m[1]), m[2] ? Number(m[2]) : undefined);
    if (location.hash === hash) fromHash(); else location.hash = hash;
  });
  $('checkInput').addEventListener('input', () => $('checkInput').setCustomValidity(''));

  // Achievements
  const collectable = () => BADGES.concat(POWER_BADGES);
  const collected = () => collectable().filter(b => state.counts[b.id]).length;
  const reached = (mode, idx) => ROLL_TIERS.slice(idx).some(t => state.tiers.classic[t.id] || state.tiers.exp[t.id]);
  const ACHIEVEMENTS = [
    { id: 'first', name: 'First roll', desc: 'Roll once', test: () => state.total >= 1 },
    { id: 'r100', name: 'Warming up', desc: 'Roll 100 times', test: () => state.total >= 100 },
    { id: 'r1k', name: 'Thousandaire', desc: 'Roll 1,000 times', test: () => state.total >= 1000 },
    { id: 'r10k', name: 'Ten thousand club', desc: 'Roll 10,000 times', test: () => state.total >= 1e4 },
    { id: 'r100k', name: 'Six figures', desc: 'Roll 100,000 times', test: () => state.total >= 1e5 },
    { id: 'rare', name: 'Shiny', desc: 'Roll Rare or better', test: () => reached(null, 3) },
    { id: 'epic', name: 'Epic moment', desc: 'Roll Epic or better', test: () => reached(null, 4) },
    { id: 'anomaly', name: 'Anomaly detected', desc: 'Roll Anomaly or better', test: () => reached(null, 5) },
    { id: 'mythic', name: 'Myth made real', desc: 'Roll Mythic', test: () => reached(null, 6) },
    { id: 'trash', name: 'Bottom of the barrel', desc: 'Roll Trash, the bottom 1%', test: () => state.tiers.classic.trash || state.tiers.exp.trash },
    { id: 'none', name: 'Just a number', desc: 'Roll a number with no badges', test: rec => rec && rec.r.badges.length === 0 },
    { id: 'pile', name: 'Badge pile', desc: 'Earn 8 or more badges on one roll', test: rec => rec && rec.r.badges.length >= 8 },
    { id: 'c25', name: 'Collector', desc: 'Collect 25 different badges', test: () => collected() >= 25 },
    { id: 'c60', name: 'Curator', desc: 'Collect 60 different badges', test: () => collected() >= 60 },
    { id: 'c100', name: 'Archivist', desc: 'Collect 100 different badges', test: () => collected() >= 100 },
    { id: 'call', name: 'Every last one', desc: 'Collect every badge', test: () => collected() === collectable().length },
    { id: 'hunt', name: 'Found it', desc: 'Finish a badge hunt', test: () => state.huntsDone >= 1 },
    { id: 'hunthard', name: 'Needle in a haystack', desc: 'Finish a hunt for a badge rarer than 1 in 10,000', test: () => state.lastHuntP !== undefined && state.lastHuntP < 1e-4 },
    { id: 'exp', name: 'Raised', desc: 'Make an Exponent roll', test: () => state.totals.exp >= 1 },
    { id: 'e8', name: 'Overclocked', desc: 'Roll an exponent of 8 or more', test: () => state.counts.eOver || state.counts.eHyper || state.counts.eSingular },
    { id: 'googol', name: 'Off the charts', desc: 'Earn Googol: a result with 101 or more digits', test: () => state.counts.googol || state.counts.bigbang },
    { id: 'star', name: 'Keeper', desc: 'Star a roll', test: () => state.favs.length >= 1 },
    { id: 'share', name: 'Show and tell', desc: 'Copy or save a roll to share', test: () => state.shares >= 1 },
    { id: 'marathon', name: 'Marathon', desc: 'Roll 1,000 times in one session', test: () => session.rolls >= 1000 },
    { id: 'owl', name: 'Night owl', desc: 'Roll between 2 and 4 a.m.', test: rec => rec && [2, 3].includes(new Date(rec.entry.t).getHours()) },
  ];
  function checkAchievements(rec) {
    for (const a of ACHIEVEMENTS) {
      if (state.ach[a.id] || !a.test(rec)) continue;
      state.ach[a.id] = Date.now();
      toast(`Achievement: <b>${esc(a.name)}</b>`, 'rare');
    }
  }

  function renderTrophies() {
    const got = ACHIEVEMENTS.filter(a => state.ach[a.id]).length;
    $('achCount').textContent = `${got} of ${ACHIEVEMENTS.length}`;
    $('achList').innerHTML = ACHIEVEMENTS.map(a => {
      const when = state.ach[a.id];
      return `<li class="${when ? 'got' : ''}"><span class="tick" aria-hidden="true">${when ? '✓' : ''}</span><b>${esc(a.name)}</b><span>${esc(a.desc)}${when ? ` <span class="when">· ${new Date(when).toLocaleDateString()}</span>` : ''}</span></li>`;
    }).join('');
    const mode = $('hofMode').querySelector('[aria-pressed="true"]').dataset.mode;
    const hof = state.hof[mode];
    $('hofList').innerHTML = hof.length ? hof.map(x => rowHtml(x, false)).join('')
      : `<li class="empty-state">No ${MODE_NAME[mode]} rolls yet. Your ten best will stay here even after the log moves on.</li>`;
    $('favCount').textContent = state.favs.length ? `${state.favs.length}` : '';
    $('favList').innerHTML = state.favs.length ? state.favs.map(f => rowHtml(entryFor(f.n, f.t, f.e), true)).join('')
      : '<li class="empty-state">Star a roll on the Roll tab to keep it here. Starred rolls never drop off.</li>';
  }
  function rowHtml(x, removable) {
    const tier = ROLL_TIERS[TIER_INDEX[x.tier]];
    return `<li style="--tc:${tierVar(x.tier)}"><a class="num" href="${rollHash(x.n, x.e)}">${esc(rollLabel(x.n, x.e))}</a><span class="t">${tier.name}</span>`
      + (removable ? `<button class="btn x" type="button" data-unstar="${x.n},${x.t}" aria-label="Unstar ${esc(rollLabel(x.n, x.e))}">Unstar</button>`
        : `<span class="e num">${esc(bigText(x.log, () => BigInt(x.ep) ** BigInt(x.e || 1)))}</span>`) + '</li>';
  }
  $('hofMode').addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    $('hofMode').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    renderTrophies();
  });
  $('favList').addEventListener('click', ev => {
    const b = ev.target.closest('[data-unstar]');
    if (!b) return;
    const [n, t] = b.dataset.unstar.split(',').map(Number);
    state.favs = state.favs.filter(f => !(f.n === n && f.t === t));
    save();
    renderTrophies();
    paintStar();
  });

  // Collection
  RARITIES.forEach((r, i) => $('collRarity').appendChild(new Option(r.name, String(i))));
  function renderCollection() {
    const all = allBadges();
    const have = all.filter(b => state.counts[b.id]).length;
    $('collCount').textContent = `${have} of ${all.length} collected`;
    $('collBar').style.width = (100 * have / all.length) + '%';
    const q = $('collSearch').value.trim().toLowerCase();
    const status = $('collStatus').value, rarity = $('collRarity').value;
    const keep = b => (!q || (b.name + ' ' + b.desc).toLowerCase().includes(q))
      && (status === 'all' || (status === 'have') === !!state.counts[b.id])
      && (rarity === '' || String(b.rarity) === rarity);
    const root = $('collection');
    root.replaceChildren();
    let shownCount = 0;
    for (const cat of CATEGORIES) {
      const list = all.filter(b => b.cat === cat && keep(b)).sort((a, b) => b.p - a.p);
      if (!list.length) continue;
      shownCount += list.length;
      const sec = document.createElement('div');
      sec.className = 'cat';
      const got = all.filter(b => b.cat === cat && state.counts[b.id]).length;
      const total = all.filter(b => b.cat === cat).length;
      sec.innerHTML = `<div class="section-head"><h2>${cat}</h2><span>${got} of ${total}${cat === 'Powers' ? ', Exponent mode only' : cat === 'Daily' ? ', change with the date' : ''}</span></div>`;
      const ul = document.createElement('ul');
      ul.className = 'cards';
      list.forEach(b => ul.appendChild(card(b, { locked: !state.counts[b.id], times: state.counts[b.id] || 0 })));
      sec.appendChild(ul);
      root.appendChild(sec);
    }
    if (!shownCount) {
      root.innerHTML = '<p class="empty-state">No badges match these filters. <button class="btn" type="button" id="clearFilters">Clear filters</button></p>';
      $('clearFilters').addEventListener('click', () => { $('collSearch').value = ''; $('collStatus').value = 'all'; $('collRarity').value = ''; renderCollection(); });
    }
  }
  for (const id of ['collSearch', 'collStatus', 'collRarity']) $(id).addEventListener('input', renderCollection);

  // Log: stats, luck against the exact tier shares, recent rolls
  function renderLog() {
    const stat = (v, k) => `<div class="stat"><div class="v num">${v}</div><div class="k">${k}</div></div>`;
    const best = mode => (state.hof[mode][0] ? esc(bigText(state.hof[mode][0].log, () => BigInt(state.hof[mode][0].ep) ** BigInt(state.hof[mode][0].e || 1))) : 'none yet');
    $('stats').innerHTML = stat(fmt(state.total), 'Rolls') + stat(best('classic'), 'Best Classic score')
      + stat(best('exp'), 'Best Exponent score') + stat(`${collected()} / ${collectable().length}`, 'Badges collected');

    let html = '';
    for (const mode of ['classic', 'exp']) {
      const total = state.totals[mode];
      if (!total) continue;
      const shares = G.tierShares(mode);
      html += `<thead><tr><th>${MODE_NAME[mode]}, ${fmt(total)} rolls</th><th>Rolls</th><th>You</th><th>Expected</th></tr></thead><tbody>`;
      for (const t of ROLL_TIERS) {
        const k = state.tiers[mode][t.id] || 0;
        html += `<tr><td style="color:${tierVar(t.id)};font-weight:700">${t.name}</td><td class="num">${fmt(k)}</td><td class="num">${(100 * k / total).toFixed(1)}%</td><td class="num">${(100 * shares[t.id]).toFixed(1)}%</td></tr>`;
      }
      const yours = ROLL_TIERS.slice(3).reduce((s, t) => s + (state.tiers[mode][t.id] || 0), 0) / total;
      const expected = ROLL_TIERS.slice(3).reduce((s, t) => s + shares[t.id], 0);
      html += `<tr><td><b>Rare or better</b></td><td></td><td class="num"><b>${(100 * yours).toFixed(1)}%</b></td><td class="num"><b>${(100 * expected).toFixed(1)}%</b></td></tr></tbody>`;
    }
    $('luck').innerHTML = html || '<tbody><tr><td class="empty-state">Roll a few times and this compares your tiers with the exact odds.</td></tr></tbody>';

    $('log').innerHTML = state.log.length ? state.log.map(x => rowHtml(entryFor(x.n, x.t, x.e), false)).join('')
      : '<li class="empty-state">No rolls yet. Your last 200 rolls appear here.</li>';
  }

  // Tabs, with arrow-key movement between them
  const TABS = ['roll', 'collection', 'trophies', 'log'];
  function selectTab(name) {
    document.querySelectorAll('.tabs [role="tab"]').forEach(b => {
      const on = b.dataset.tab === name;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    for (const t of TABS) $('tab-' + t).hidden = t !== name;
    if (name === 'collection') renderCollection();
    if (name === 'trophies') renderTrophies();
    if (name === 'log') renderLog();
  }
  const tabBar = document.querySelector('.tabs');
  tabBar.addEventListener('click', ev => { const b = ev.target.closest('[role="tab"]'); if (b) selectTab(b.dataset.tab); });
  tabBar.addEventListener('keydown', ev => {
    const i = TABS.indexOf(document.activeElement.dataset.tab);
    if (i < 0 || !['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
    const next = TABS[(i + (ev.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    selectTab(next);
    tabBar.querySelector(`[data-tab="${next}"]`).focus();
  });

  // Settings
  function applySettings() {
    const s = state.settings;
    document.documentElement.dataset.theme = s.theme;
    document.documentElement.dataset.effects = s.effects;
    document.querySelector('meta[name="theme-color"]').content = cssVar('--bg');
    for (const r of document.querySelectorAll('#settingsDialog input[name="theme"]')) r.checked = r.value === s.theme;
    for (const r of document.querySelectorAll('#settingsDialog input[name="effects"]')) r.checked = r.value === s.effects;
  }
  $('settingsBtn').addEventListener('click', () => { $('dataMsg').textContent = ''; paintInstall(); $('settingsDialog').showModal(); });
  $('settingsDialog').addEventListener('change', ev => {
    if (ev.target.name === 'theme') state.settings.theme = ev.target.value;
    if (ev.target.name === 'effects') state.settings.effects = ev.target.value;
    applySettings();
    save();
  });

  let installPrompt = null;
  addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); installPrompt = ev; paintInstall(); });
  function paintInstall() {
    const text = $('installText'), btn = $('installBtn');
    btn.hidden = !installPrompt;
    if (matchMedia('(display-mode: standalone)').matches) text.textContent = 'Installed. It runs offline.';
    else if (location.protocol === 'file:') text.innerHTML = 'Installing works from the hosted copy: open <a href="https://gkson-lab.github.io/rngdle9/">gkson-lab.github.io/rngdle9</a>.';
    else if (installPrompt) text.textContent = 'Install it as an app that opens in its own window and works offline.';
    else text.textContent = "Use your browser's Install app or Add to Home Screen option. Once installed, it works offline.";
  }
  $('installBtn').addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    paintInstall();
  });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support unavailable; the game still works */ });
  }

  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ game: 'rngdle10', version: 3, state })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rngdle10-save-${dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    $('dataMsg').textContent = `Saved ${fmt(state.total)} rolls to a file.`;
  });
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async () => {
    const file = $('importFile').files[0];
    $('importFile').value = '';
    if (!file) return;
    let data = null;
    try { data = JSON.parse(await file.text()); } catch { /* reported below */ }
    const s = data && ['rngdle10', 'rngdle9'].includes(data.game) && data.state;
    if (!s || !Array.isArray(s.log) || typeof s.total !== 'number') {
      $('dataMsg').textContent = 'That file is not an RNGdle save, so nothing changed.';
      return;
    }
    if (!confirm(`Replace your progress (${fmt(state.total)} rolls) with this save (${fmt(s.total)} rolls)?`)) return;
    setAuto(null);
    const fresh = blank();
    Object.assign(state, fresh, s, { settings: state.settings });
    for (const k of ['totals', 'tiers', 'hof']) state[k] = Object.assign(fresh[k], s[k]);
    if (data.game === 'rngdle9') { state.totals.classic = s.total; state.tiers.classic = s.tiers || {}; }
    state.log = s.log.filter(x => Number.isInteger(x.n) && x.n >= 0 && x.n < G.SPACE).slice(0, LOG_LIMIT);
    save();
    renderBoards();
    $('dataMsg').textContent = `Loaded a save with ${fmt(state.total)} rolls.`;
  });
  $('resetBtn').addEventListener('click', () => {
    if (!confirm('Erase every roll, badge, star and achievement in this browser? This cannot be undone.')) return;
    setAuto(null);
    const keep = state.settings;
    Object.assign(state, blank(), { settings: keep });
    session.rolls = 0;
    session.best = { classic: [], exp: [] };
    try { localStorage.removeItem('rngdle9:v2'); } catch { /* nothing to remove */ }
    save();
    renderBoards();
    paintStatus();
    $('dataMsg').textContent = 'Everything was erased.';
  });

  // Start
  applySettings();
  paintSound();
  fillHunt();
  setMode(state.mode);
  warm(state.mode).then(() => warm(state.mode === 'exp' ? 'classic' : 'exp'));
  if (state.log.length) {
    const last = state.log[0];
    warm(last.e ? 'exp' : 'classic').then(() => {
      if (location.hash || shown) return;
      setReels(last.n, last.e);
      showResult({ n: last.n, t: last.t, e: last.e });
    });
  }
  fromHash();
})();
