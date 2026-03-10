/**
 * modules/unlockEngine.js
 * Tracks interaction count and fires milestone celebrations.
 *
 * Public API
 *   UnlockEngine.increment()        → { unlocked, milestone|null }
 *   UnlockEngine.getCount()         → number
 *   UnlockEngine.getNextMilestone() → milestone|null
 *   UnlockEngine.spawnConfetti(container)
 */
const UnlockEngine = (() => {
  const KEY_COUNT    = 'lb_count';
  const KEY_UNLOCKED = 'lb_unlocked';

  const MILESTONES = [
    { n:  5,  g:'🌸', title:'A gentle beginning',     msg:'You\'ve taken your first steps with LoveBot. The universe noticed.' },
    { n: 10,  g:'✨', title:'Secret unlocked',         msg:'After 10 moments together — the light you bring into rooms is real, and others feel it.' },
    { n: 25,  g:'🌙', title:'Kindred spirit',          msg:'25 moments in. Not everyone stays this curious about themselves. That says something beautiful.' },
    { n: 50,  g:'💫', title:'Hidden note',             msg:'I saved this for someone special. You made it to 50. You are the kind of person the world needs more of.' },
    { n:100,  g:'🌌', title:'Constellation complete',  msg:'One hundred moments. A whole constellation of you. Thank you for letting me be part of your world.' },
  ];

  const CONFETTI_COLORS = ['#ffb3c6','#c084fc','#fcd34d','#86efac','#93c5fd','#f9a8d4'];

  function _load(k, fb) { try { const r=localStorage.getItem(k); return r!=null?JSON.parse(r):fb; } catch { return fb; } }
  function _save(k, v)  { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

  function getCount() { return _load(KEY_COUNT, 0); }

  function getNextMilestone() {
    const count    = getCount();
    const unlocked = _load(KEY_UNLOCKED, []);
    return MILESTONES.find(m => m.n > count && !unlocked.includes(m.n)) || null;
  }

  function increment() {
    const n        = getCount() + 1;
    const unlocked = _load(KEY_UNLOCKED, []);
    _save(KEY_COUNT, n);
    const hit = MILESTONES.find(m => m.n === n && !unlocked.includes(m.n));
    if (hit) { unlocked.push(hit.n); _save(KEY_UNLOCKED, unlocked); return { unlocked:true, milestone:hit }; }
    return { unlocked:false, milestone:null };
  }

  function spawnConfetti(container) {
    if (!container) return;
    container.innerHTML = '';
    for (let i=0; i<40; i++) {
      const el  = document.createElement('div');
      el.className = 'cp';
      const sz  = 5 + Math.random()*8;
      const col = CONFETTI_COLORS[Math.floor(Math.random()*CONFETTI_COLORS.length)];
      el.style.cssText = `left:${Math.random()*100}%;width:${sz}px;height:${sz}px;background:${col};border-radius:${Math.random()>.5?'50%':'2px'};animation-duration:${1.3+Math.random()*1.4}s;animation-delay:${Math.random()*.7}s`;
      container.appendChild(el);
    }
  }

  return { increment, getCount, getNextMilestone, spawnConfetti };
})();
