/**
 * modules/dailyEngine.js
 * ─────────────────────────────────────────────────────
 * Two automatic delivery systems:
 *
 * 1. DAILY GREETING — fires once per calendar day when the user
 *    opens the app (after the main screen loads).
 *
 * 2. THINKING OF YOU — fires every 20 minutes with a 15% chance,
 *    using admin "moments" if available, otherwise a mood message.
 *    Only fires when the tab is visible.
 *
 * Public API
 *   DailyEngine.init()   — call once from _initMain()
 *   DailyEngine.stop()   — cancel intervals (cleanup)
 */

const DailyEngine = (() => {
  const KEY_DAILY    = 'lb_last_daily';
  const INTERVAL_MS  = 20 * 60 * 1000;  // 20 minutes
  const FIRE_CHANCE  = 0.15;             // 15% per tick

  let _interval = null;

  function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* ── Daily greeting ────────────────────────── */
  function _checkDaily() {
    const today = new Date().toDateString();
    const last  = localStorage.getItem(KEY_DAILY);
    if (last === today) return;

    localStorage.setItem(KEY_DAILY, today);

    // Prefer an admin message; fall back to mood message
    const adminMsg = AdminEngine.getRandomAdminMsg();
    const msg = adminMsg || MoodEngine.getMessage();

    // Small delay so the main screen has settled
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('lb:showMessage', {
        detail: { message: msg, source: 'daily' }
      }));
    }, 2500);
  }

  /* ── Thinking of you interval ──────────────── */
  function _startInterval() {
    if (_interval) return;

    _interval = setInterval(() => {
      if (document.hidden) return;
      if (Math.random() > FIRE_CHANCE) return;

      // 25% chance: play an admin voice clip as a "I saved something for you" surprise
      const adminClip = AdminEngine.getRandomAdminClip();
      if (adminClip && Math.random() < 0.25) {
        try { new Audio(adminClip.data).play(); } catch {}
        window.dispatchEvent(new CustomEvent('lb:showMessage', {
          detail: { message: { t: '🎙 I saved something for you ✦', c: 'voice memory', _isClip: true }, source: 'interval' }
        }));
        return;
      }

      // Otherwise: admin moment → admin text message → mood message
      const moment   = AdminEngine.getRandomMoment();
      const adminMsg = AdminEngine.getRandomAdminMsg();
      const msg = moment
        ? { t: moment.t, c: 'thinking of you ✦' }
        : (adminMsg || MoodEngine.getMessage());

      window.dispatchEvent(new CustomEvent('lb:showMessage', {
        detail: { message: msg, source: 'interval' }
      }));
    }, INTERVAL_MS);
  }

  /* ── Public ────────────────────────────────── */
  function init() {
    _checkDaily();
    _startInterval();
  }

  function stop() {
    if (_interval) { clearInterval(_interval); _interval = null; }
  }

  return { init, stop };
})();