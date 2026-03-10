/**
 * modules/memoryAI.js
 * ─────────────────────────────────────────────────────
 * Memory-based emotional companion layer.
 *
 * Features:
 *   • Once-per-day gratitude prompt: "What made you smile today?"
 *   • Stores answers with timestamps
 *   • 30% chance on tap to reference a saved memory back to the user
 *     e.g. "You once told me talking to your friend made you smile.
 *            I hope today has a moment like that too."
 *   • Time Capsule: store a message to unlock after N days
 *
 * Public API
 *   MemoryAI.init()                    — check daily prompt trigger
 *   MemoryAI.getCallbackMessage()      → { t, c } | null
 *   MemoryAI.shouldAskGratitude()      → bool
 *   MemoryAI.saveGratitude(text)
 *   MemoryAI.getMemories()             → array
 *   MemoryAI.checkTimeCapsules()       → [ { t, c } ] unlocked capsules
 *   MemoryAI.addTimeCapsule(text, days)
 */

const MemoryAI = (() => {
  const KEY_MEMS     = 'lb_ai_mems';
  const KEY_LAST_Q   = 'lb_ai_last_q';
  const KEY_CAPSULES = 'lb_ai_capsules';

  function _get(k, fb) { try { const r=localStorage.getItem(k); return r!=null?JSON.parse(r):fb; } catch { return fb; } }
  function _set(k, v)  { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} }
  function _pick(arr)  { return arr[Math.floor(Math.random()*arr.length)]; }

  /* ── Gratitude / memory storage ───────────────── */
  function getMemories()      { return _get(KEY_MEMS, []); }

  function saveGratitude(text) {
    if (!text || !text.trim()) return;
    const mems = getMemories();
    mems.push({ text: text.trim(), ts: Date.now() });
    _set(KEY_MEMS, mems);
    _set(KEY_LAST_Q, new Date().toDateString());
  }

  function shouldAskGratitude() {
    const last = localStorage.getItem(KEY_LAST_Q);
    return last !== new Date().toDateString();
  }

  /* ── Memory callback message ──────────────────── */
  // Called when orb is tapped; 30% chance returns a message referencing a stored memory
  function getCallbackMessage() {
    const mems = getMemories();
    if (!mems.length || Math.random() > 0.3) return null;

    const mem = _pick(mems);
    const templates = [
      `You once told me: "${mem.text}". I hope today holds something like that too.`,
      `I remembered something you shared — "${mem.text}". It stayed with me.`,
      `"${mem.text}" — you said that. I think about it sometimes.`,
      `Do you remember when you told me "${mem.text}"? I do.`,
      `You once mentioned "${mem.text}". I hope that feeling finds you again today.`,
    ];
    return { t: _pick(templates), c: 'memory' };
  }

  /* ── Time Capsule ─────────────────────────────── */
  function getCapsules()  { return _get(KEY_CAPSULES, []); }

  function addTimeCapsule(text, days) {
    if (!text || !text.trim() || !days) return;
    const caps = getCapsules();
    caps.push({
      id:      Date.now(),
      text:    text.trim(),
      unlockAt: Date.now() + days * 24 * 60 * 60 * 1000,
      days,
      seen:    false,
    });
    _set(KEY_CAPSULES, caps);
  }

  /** Returns array of newly-unlocked capsule messages (marks them seen) */
  function checkTimeCapsules() {
    const caps    = getCapsules();
    const now     = Date.now();
    const unlocked = [];
    let changed   = false;

    caps.forEach(c => {
      if (!c.seen && now >= c.unlockAt) {
        unlocked.push({ t: c.text, c: 'time capsule 💌', _capsule: true });
        c.seen = true;
        changed = true;
      }
    });

    if (changed) _set(KEY_CAPSULES, caps);
    return unlocked;
  }

  /* ── Daily gratitude prompt dispatch ─────────── */
  function init() {
    // Check time capsules on load and dispatch any unlocked ones
    const unlocked = checkTimeCapsules();
    unlocked.forEach((msg, i) => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('lb:showMessage', { detail: { message: msg } }));
      }, 3000 + i * 8000); // stagger if multiple
    });
  }

  return {
    init,
    shouldAskGratitude,
    saveGratitude,
    getCallbackMessage,
    getMemories,
    addTimeCapsule,
    checkTimeCapsules,
  };
})();
