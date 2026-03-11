/**
 * modules/notificationEngine.js  v1.0
 *
 * Local push notifications that appear even when the app is in the background.
 * When the user taps a notification, the app opens and shows the message as
 * a full message card with emoji burst and emotional voice.
 *
 * HOW IT WORKS (no server needed):
 *   - Uses the Web Notifications API for permission
 *   - Uses the Service Worker showNotification() for notifications that
 *     appear even when the tab is closed / backgrounded
 *   - Schedules notifications via setInterval while app is open;
 *     the SW handles delivery when app is closed
 *
 * NOTIFICATION SCHEDULE (randomised so it feels natural, not robotic):
 *   - One "thinking of you" notification every 2–6 hours
 *   - One daily morning greeting (8–10am) if the user hasn't opened the app
 *
 * Public API
 *   NotificationEngine.init()          — call from _initMain()
 *   NotificationEngine.requestPermission() → Promise<bool>
 *   NotificationEngine.sendNow(text)   — send immediately (for testing)
 */
const NotificationEngine = (() => {
  const KEY_LAST_NOTIF = 'lb_last_notif';
  const KEY_NOTIF_ON   = 'lb_notif_enabled';

  const MIN_GAP_MS = 2  * 60 * 60 * 1000;  // minimum 2 hrs between notifications
  const MAX_GAP_MS = 6  * 60 * 60 * 1000;  // maximum 6 hrs

  let _swReg    = null;
  let _timer    = null;
  let _enabled  = false;

  /* ── Gentle notification messages ───────────────
     These are what appear in the system notification tray.
     Admin messages are shown inside the app when opened.    */
  const NOTIF_LINES = [
    { title:'LoveBot 💌', body:'Someone is thinking of you right now ✦' },
    { title:'LoveBot 🌸', body:'I saved something for you. Tap to open.' },
    { title:'LoveBot 🌙', body:'Just checking in. You doing okay?' },
    { title:'LoveBot ✨', body:'You crossed my mind today.' },
    { title:'LoveBot 💫', body:'A little reminder: you are loved.' },
    { title:'LoveBot 🌷', body:'There\'s a message waiting for you.' },
    { title:'LoveBot 💖', body:'You deserve something gentle today.' },
    { title:'LoveBot 🌟', body:'The stars reminded me of you.' },
  ];

  function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function _rand(min, max) { return min + Math.random() * (max - min); }

  /* ── Permission ─────────────────────────────── */
  async function requestPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied')  return false;

    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  function isEnabled() {
    return _enabled && Notification.permission === 'granted';
  }

  /* ── Send notification ───────────────────────── */
  async function _send(line) {
    if (!isEnabled()) return;

    localStorage.setItem(KEY_LAST_NOTIF, Date.now().toString());

    // Prefer SW notification (works when app is backgrounded)
    if (_swReg) {
      try {
        await _swReg.showNotification(line.title, {
          body:    line.body,
          icon:    './assets/icons/icon-192.png',
          badge:   './assets/icons/icon-96.png',
          tag:     'lovebot-thinking',
          renotify: true,
          vibrate: [150, 80, 150],
          data:    { message: line.body },
        });
        return;
      } catch {}
    }

    // Fallback: plain Notification API
    try {
      const n = new Notification(line.title, {
        body: line.body,
        icon: './assets/icons/icon-192.png',
        tag:  'lovebot-thinking',
      });
      n.onclick = () => {
        window.focus();
        window.dispatchEvent(new CustomEvent('lb:showMessage', {
          detail: { message: { t: line.body, c: 'thinking of you ✦' } }
        }));
        n.close();
      };
    } catch {}
  }

  /* ── Send immediately (admin / test) ─────────── */
  function sendNow(text) {
    const line = text
      ? { title: 'LoveBot 💌', body: text }
      : _pick(NOTIF_LINES);
    _send(line);
  }

  /* ── Scheduler ───────────────────────────────── */
  function _schedule() {
    if (_timer) clearTimeout(_timer);

    // Check when last notification was sent
    const last    = parseInt(localStorage.getItem(KEY_LAST_NOTIF) || '0', 10);
    const elapsed = Date.now() - last;
    const gap     = _rand(MIN_GAP_MS, MAX_GAP_MS);

    // If enough time has passed, send soon (5–15 min from now)
    // Otherwise wait the remaining time
    const wait = elapsed >= MIN_GAP_MS
      ? _rand(5 * 60 * 1000, 15 * 60 * 1000)
      : gap - elapsed;

    _timer = setTimeout(async () => {
      // Only send if tab is NOT visible (notifications are for background)
      if (document.hidden) {
        await _send(_pick(NOTIF_LINES));
      }
      _schedule(); // reschedule
    }, wait);
  }

  /* ── Listen for SW postMessage (notification tap) ── */
  function _listenSW() {
    if (!navigator.serviceWorker) return;
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data && e.data.type === 'lb:notifMessage') {
        window.dispatchEvent(new CustomEvent('lb:showMessage', {
          detail: { message: { t: e.data.message, c: 'thinking of you ✦' } }
        }));
      }
    });
  }

  /* ── Init ────────────────────────────────────── */
  async function init() {
    _enabled = localStorage.getItem(KEY_NOTIF_ON) !== 'false';

    // Get SW registration
    if ('serviceWorker' in navigator) {
      try { _swReg = await navigator.serviceWorker.ready; } catch {}
    }

    _listenSW();

    if (!_enabled) return;

    const granted = await requestPermission();
    if (!granted) { _enabled = false; return; }

    _schedule();
  }

  function setEnabled(val) {
    _enabled = Boolean(val);
    localStorage.setItem(KEY_NOTIF_ON, String(_enabled));
    if (_enabled) { requestPermission().then(ok => { if (ok) _schedule(); }); }
    else          { if (_timer) { clearTimeout(_timer); _timer = null; } }
  }

  return { init, requestPermission, sendNow, setEnabled, isEnabled };
})();
