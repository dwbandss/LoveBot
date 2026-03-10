/**
 * modules/surpriseEngine.js
 * ─────────────────────────────────────────────────────
 * Manages timed surprise delivery — fires a random
 * message every 2–8 hours even without user interaction.
 * Uses the Page Visibility API so it only triggers when
 * the app is actually open.
 *
 * Public API:
 *   SurpriseEngine.init()               — start the timer loop
 *   SurpriseEngine.stop()               — cancel pending timer
 *   SurpriseEngine.forceNow()           — trigger immediately (for testing)
 */

const SurpriseEngine = (() => {
  const MIN_MS = 2 * 60 * 60 * 1000;   // 2 hours
  const MAX_MS = 8 * 60 * 60 * 1000;   // 8 hours
  const KEY_LAST = 'lb_last_surprise';

  let _timer = null;

  /* ── helpers ──────────────────────────────────── */
  function _randomDelay() {
    return MIN_MS + Math.random() * (MAX_MS - MIN_MS);
  }

  function _fire() {
    // Only show if the tab is visible
    if (document.hidden) return;

    localStorage.setItem(KEY_LAST, Date.now().toString());

    // Dispatch event — app.js handles display
    window.dispatchEvent(new CustomEvent('lb:surprise', {
      detail: { message: MoodEngine.getMessage() }
    }));
  }

  function _schedule() {
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(() => {
      _fire();
      _schedule(); // reschedule indefinitely
    }, _randomDelay());
  }

  /* ── public ───────────────────────────────────── */
  function init()    { _schedule(); }
  function stop()    { if (_timer) { clearTimeout(_timer); _timer = null; } }
  function forceNow(){ _fire(); }

  return { init, stop, forceNow };
})();
