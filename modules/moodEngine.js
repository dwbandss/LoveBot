/**
 * modules/moodEngine.js
 * Manages current mood, history, and picks adapted messages.
 *
 * Public API
 *   MoodEngine.set(mood)
 *   MoodEngine.get()          → string
 *   MoodEngine.getMessage()   → { t, c }
 *   MoodEngine.emoji(mood)    → string
 *   MoodEngine.statusLine()   → string
 *   MoodEngine.isNight()      → bool
 */
const MoodEngine = (() => {
  const KEY      = 'lb_mood';
  const KEY_SET  = 'lb_mood_set';

  function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function set(mood) {
    localStorage.setItem(KEY,     mood);
    localStorage.setItem(KEY_SET, 'true');
  }

  function get() {
    return localStorage.getItem(KEY) || 'happy';
  }

  function isNight() {
    const h = new Date().getHours();
    return h >= 21 || h < 6;
  }

  function emoji(mood) {
    return (window.LB.moodEmojis || {})[mood] || '🌸';
  }

  function statusLine() {
    const lines = (window.LB.statusLines || {})[get()] || ["Here for you ✦"];
    return _pick(lines);
  }

  function getMessage() {
    const msgs = window.LB.messages;
    const mood = get();

    if (isNight() && Math.random() < 0.3)   return _pick(msgs.night);
    if (mood === 'sad')                       return _pick(msgs.sad);
    if (mood === 'stressed')                  return _pick(msgs.stressed);
    return _pick(msgs.happy);
  }

  return { set, get, getMessage, emoji, statusLine, isNight };
})();
