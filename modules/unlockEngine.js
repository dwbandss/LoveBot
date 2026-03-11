/**
 * modules/unlockEngine.js  v3.0
 *
 * REAL FEATURE UNLOCKS — each milestone visually changes the app:
 *
 *  5 taps  → Warm welcome (no UI change yet, just celebration)
 * 10 taps  → Voice memories activated (admin clips play more often)
 * 25 taps  → Golden nodes — all constellation nodes turn gold ✨
 * 50 taps  → Moon orb — the centre orb glyph becomes 🌙
 * 100 taps → Secret message — admin's special 100-tap message plays
 * 150 taps → Full constellation — 6 extra nodes appear in the sky
 *
 * Public API
 *   UnlockEngine.increment()          → { unlocked:bool, milestone|null }
 *   UnlockEngine.getCount()           → number
 *   UnlockEngine.getNextMilestone()   → milestone|null
 *   UnlockEngine.applyAllUnlocks()    → call on boot to restore UI state
 *   UnlockEngine.spawnConfetti(el)
 */
const UnlockEngine = (() => {
  const KEY_COUNT    = 'lb_count';
  const KEY_UNLOCKED = 'lb_unlocked';

  /* ── Milestone definitions ───────────────────────────────────
     feature: string key that applyAllUnlocks() acts on          */
  const MILESTONES = [
    {
      n: 5,
      g: '🌸',
      title: 'A gentle beginning',
      msg:  'You\'ve taken your first steps with LoveBot. The universe noticed.',
      feature: null,
    },
    {
      n: 10,
      g: '🎙',
      title: 'Voice memories unlocked',
      msg:  'From now on, LoveBot will sometimes play a special voice memory just for you.',
      feature: 'voice_memories',
    },
    {
      n: 25,
      g: '✨',
      title: 'Golden constellation',
      msg:  '25 moments in. The stars around you have turned to gold — just like you.',
      feature: 'gold_nodes',
    },
    {
      n: 50,
      g: '🌙',
      title: 'The moon is yours',
      msg:  'Fifty moments together. The orb has become the moon — a light that stays.',
      feature: 'moon_orb',
    },
    {
      n: 100,
      g: '💌',
      title: 'A secret revealed',
      msg:  'One hundred moments. Someone left you something special. Listen closely.',
      feature: 'secret_message',
    },
    {
      n: 150,
      g: '🌌',
      title: 'Full constellation',
      msg:  'The sky has expanded. Every star is a moment we\'ve shared.',
      feature: 'full_constellation',
    },
  ];

  const CONFETTI_COLORS = ['#ffb3c6','#c084fc','#fcd34d','#86efac','#93c5fd','#f9a8d4'];

  function _load(k, fb) { try { const r=localStorage.getItem(k); return r!=null?JSON.parse(r):fb; } catch { return fb; } }
  function _save(k, v)  { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

  function getCount()     { return _load(KEY_COUNT, 0); }
  function getUnlocked()  { return _load(KEY_UNLOCKED, []); }
  function hasFeature(f)  { return getUnlocked().includes(f); }

  function getNextMilestone() {
    const n = getCount();
    const u = getUnlocked();
    return MILESTONES.find(m => m.n > n && !u.includes(m.feature || m.n)) || null;
  }

  function increment() {
    const n = getCount() + 1;
    const u = getUnlocked();
    _save(KEY_COUNT, n);
    const hit = MILESTONES.find(m => m.n === n && !u.includes(m.feature || m.n));
    if (hit) {
      u.push(hit.feature || hit.n);
      _save(KEY_UNLOCKED, u);
      return { unlocked: true, milestone: hit };
    }
    return { unlocked: false, milestone: null };
  }

  /* ── Apply all unlocked visual features on boot ─────────── */
  function applyAllUnlocks() {
    const u = getUnlocked();

    if (u.includes('gold_nodes'))        _applyGoldNodes();
    if (u.includes('moon_orb'))          _applyMoonOrb();
    if (u.includes('full_constellation')) _applyFullConstellation();
  }

  /* ── Individual feature appliers ────────────────────────── */
  function _applyGoldNodes() {
    document.querySelectorAll('.node').forEach(n => {
      n.classList.remove('rose');
      n.classList.add('gold');
    });
    // Also update canvas line colour to gold
    window.dispatchEvent(new CustomEvent('lb:goldNodes'));
  }

  function _applyMoonOrb() {
    const glyph = document.querySelector('.orb-glyph');
    if (glyph) {
      glyph.textContent = '🌙';
      glyph.style.fontSize = '1.6rem';
      glyph.style.animation = 'none'; // moon doesn't spin
    }
    const inner = document.querySelector('.orb-inner');
    if (inner) {
      inner.style.background = 'linear-gradient(135deg,rgba(253,211,77,.28),rgba(192,132,252,.22))';
      inner.style.borderColor = 'rgba(253,211,77,.55)';
      inner.style.boxShadow   = '0 0 32px rgba(253,211,77,.28),inset 0 0 18px rgba(253,211,77,.1)';
    }
  }

  function _applyFullConstellation() {
    // Signal constellationEngine to add extra nodes
    window.dispatchEvent(new CustomEvent('lb:expandConstellation'));
  }

  /* ── Trigger feature on unlock (instant visual) ─────────── */
  function triggerFeature(feature, milestone) {
    switch (feature) {
      case 'gold_nodes':
        setTimeout(_applyGoldNodes, 1800); // after overlay shown
        break;
      case 'moon_orb':
        setTimeout(_applyMoonOrb, 1800);
        break;
      case 'secret_message':
        // Play admin's special clip or show admin message after overlay closes
        setTimeout(() => {
          const clip = typeof AdminEngine !== 'undefined' && AdminEngine.getRandomAdminClip();
          if (clip) {
            try { new Audio(clip.data).play(); } catch {}
            window.dispatchEvent(new CustomEvent('lb:showMessage', {
              detail: { message: { t: '💌 A secret kept just for you ✦', c: 'from you 💌' } }
            }));
          }
        }, 6000);
        break;
      case 'full_constellation':
        setTimeout(_applyFullConstellation, 1800);
        break;
      default:
        break;
    }
  }

  /* ── Confetti ─────────────────────────────────────────────── */
  function spawnConfetti(container) {
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 45; i++) {
      const el  = document.createElement('div');
      el.className = 'cp';
      const sz  = 5 + Math.random() * 9;
      const col = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      el.style.cssText = `left:${Math.random()*100}%;width:${sz}px;height:${sz}px;background:${col};border-radius:${Math.random()>.5?'50%':'2px'};animation-duration:${1.2+Math.random()*1.6}s;animation-delay:${Math.random()*.8}s`;
      container.appendChild(el);
    }
  }

  return { increment, getCount, getNextMilestone, applyAllUnlocks, triggerFeature, hasFeature, spawnConfetti };
})();
