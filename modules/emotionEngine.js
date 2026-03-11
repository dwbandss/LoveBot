/**
 * modules/emotionEngine.js  v3.0
 *
 * Changes from v2:
 *  - New voice selection: targets Google UK English Female, Microsoft Zira,
 *    Apple Samantha — the most natural non-robotic voices available in browsers.
 *    Falls back gracefully on Android (uses Google US English which is the
 *    least robotic available on Chrome Android).
 *  - Chunk-based speaking with natural pauses between sentences
 *  - Emotional pitch/rate per category unchanged
 *  - Emoji burst + screen glow unchanged
 *
 * Public API (unchanged):
 *   EmotionEngine.speakEmotional(text, category)
 *   EmotionEngine.burstEmoji(category)
 *   EmotionEngine.glowScreen(category)
 *   EmotionEngine.clearGlow()
 *   EmotionEngine.stop()
 */
const EmotionEngine = (() => {

  /* ── Emotion config per message category ─────── */
  const EMOTION = {
    'affirmation':       { rate:0.82, pitch:1.10, volume:1,    emojis:['💖','✨','🌸','💫','🌟'], glow:'rgba(255,179,198,0.22)' },
    'compliment':        { rate:0.85, pitch:1.08, volume:1,    emojis:['💗','🌸','✨','💝','🥺'], glow:'rgba(255,179,198,0.20)' },
    'wonder':            { rate:0.78, pitch:1.12, volume:0.95, emojis:['🌌','✨','💫','🌠','🪐'], glow:'rgba(192,132,252,0.22)' },
    'connection':        { rate:0.80, pitch:1.06, volume:1,    emojis:['💞','🫂','💌','🌷','💓'], glow:'rgba(255,179,198,0.25)' },
    'breathe':           { rate:0.70, pitch:0.97, volume:0.88, emojis:['🌬️','🌿','🍃','💚','🕊️'], glow:'rgba(134,239,172,0.18)' },
    'validation':        { rate:0.77, pitch:1.02, volume:0.95, emojis:['🫶','💛','🌻','✊','💪'], glow:'rgba(253,211,77,0.18)'  },
    'comfort':           { rate:0.73, pitch:1.00, volume:0.90, emojis:['🤗','💜','🌙','🫂','💝'], glow:'rgba(192,132,252,0.20)' },
    'hope':              { rate:0.80, pitch:1.08, volume:1,    emojis:['🌅','🌈','🕊️','🌱','⭐'], glow:'rgba(253,211,77,0.20)'  },
    'night':             { rate:0.68, pitch:0.94, volume:0.85, emojis:['🌙','⭐','🌌','💤','🌛'], glow:'rgba(100,80,160,0.22)'  },
    'memory':            { rate:0.76, pitch:1.04, volume:0.95, emojis:['💭','📖','🌸','💫','🫶'], glow:'rgba(192,132,252,0.18)' },
    'time capsule 💌':   { rate:0.75, pitch:1.06, volume:0.95, emojis:['💌','🎁','⏳','💖','✨'], glow:'rgba(255,179,198,0.28)' },
    'from you 💌':       { rate:0.78, pitch:1.10, volume:1,    emojis:['💌','💖','🌸','💗','✨'], glow:'rgba(255,100,150,0.28)' },
    'voice clip':        { rate:0.82, pitch:1.05, volume:1,    emojis:['🎙️','💬','💖','🎵','✨'], glow:'rgba(192,132,252,0.20)' },
    'voice memory':      { rate:0.78, pitch:1.08, volume:1,    emojis:['🎤','💌','💝','🌸','✨'], glow:'rgba(255,100,150,0.25)' },
    'thinking of you ✦': { rate:0.80, pitch:1.06, volume:1,   emojis:['🌙','💭','💖','✨','🌸'], glow:'rgba(192,132,252,0.22)' },
    'voice note':        { rate:0.82, pitch:1.05, volume:1,    emojis:['🔊','💬','✨','💖','🌸'], glow:'rgba(192,132,252,0.18)' },
    'default':           { rate:0.82, pitch:1.06, volume:1,    emojis:['💖','✨','🌸','💫','🌟'], glow:'rgba(192,132,252,0.20)' },
  };

  function _cfg(c) { return EMOTION[c] || EMOTION['default']; }

  /* ── Voice selection ─────────────────────────────────────
     Priority order — most natural / least robotic voices.
     These are the best voices actually available in browsers:

     Desktop Chrome/Edge: Google UK English Female
     macOS/iOS Safari:    Samantha, Karen, Moira, Tessa
     Windows:             Microsoft Zira, Microsoft Hazel
     Android Chrome:      Google US English (best available)
  ─────────────────────────────────────────────────────── */
  let _voice = null;
  let _voiceReady = false;

  const VOICE_PRIORITY = [
    // Exact names (case-insensitive substring match)
    'google uk english female',
    'samantha',
    'karen',
    'moira',
    'tessa',
    'microsoft zira',
    'microsoft hazel',
    'fiona',
    'victoria',
    'google us english',
    'google 日本語',     // skip — wrong language placeholder
  ];

  function _pickVoice(voices) {
    for (const pref of VOICE_PRIORITY) {
      const v = voices.find(v => v.name.toLowerCase().includes(pref));
      if (v && v.lang.startsWith('en')) return v;
    }
    // Fallback: any English voice
    return voices.find(v => v.lang.startsWith('en-')) || voices[0] || null;
  }

  function _loadVoice() {
    const synth  = window.speechSynthesis;
    if (!synth) return;
    const voices = synth.getVoices();
    if (!voices.length) return;
    _voice      = _pickVoice(voices);
    _voiceReady = true;
  }

  if (window.speechSynthesis) {
    // Chrome loads voices async; Safari loads them sync
    if (window.speechSynthesis.getVoices().length) {
      _loadVoice();
    }
    window.speechSynthesis.onvoiceschanged = _loadVoice;
  }

  /* ── Emotional TTS — chunk-based for natural pauses ─── */
  function speakEmotional(text, category) {
    const synth = window.speechSynthesis;
    if (!synth || !text) return;

    synth.cancel();

    // Reload voice if not ready (Android fix)
    if (!_voiceReady) _loadVoice();

    const cfg = _cfg(category);

    // Split into sentence chunks — each gets its own utterance
    // This creates natural breathing room between sentences
    const chunks = text.match(/[^.!?…]+[.!?…]*/g) || [text];

    let idx = 0;

    function next() {
      if (idx >= chunks.length) {
        window.dispatchEvent(new Event('lb:voice-end'));
        return;
      }
      const chunk = chunks[idx].trim();
      if (!chunk) { idx++; next(); return; }

      const utt    = new SpeechSynthesisUtterance(chunk);
      utt.voice    = _voice;

      // Tiny natural variation per chunk
      utt.rate   = cfg.rate  + (Math.random() * 0.06 - 0.03);
      utt.pitch  = cfg.pitch + (Math.random() * 0.08 - 0.04);
      utt.volume = cfg.volume;

      // Emotional inflections by punctuation
      if (/…|—/.test(chunk)) { utt.rate *= 0.86; utt.pitch *= 0.95; } // pause/sadness
      if (/!/.test(chunk))   { utt.rate *= 1.04; utt.pitch *= 1.04; } // emphasis
      if (/\?/.test(chunk))  { utt.pitch *= 1.06; }                    // question rise

      if (idx === 0) {
        utt.onstart = () => window.dispatchEvent(new Event('lb:voice-start'));
      }
      utt.onend   = () => { idx++; next(); };
      utt.onerror = () => { idx++; next(); };

      synth.speak(utt);
    }

    next();
  }

  function stop() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    window.dispatchEvent(new Event('lb:voice-end'));
  }

  /* ── Emoji burst ─────────────────────────────── */
  function burstEmoji(category) {
    const cfg    = _cfg(category);
    const emojis = cfg.emojis;
    const count  = 8 + Math.floor(Math.random() * 6);

    for (let i = 0; i < count; i++) {
      const el     = document.createElement('div');
      el.className = 'emoji-burst';
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];

      const startX = 15 + Math.random() * 70;
      const angle  = -25 + Math.random() * 50;
      const size   = 1.3 + Math.random() * 1.5;
      const dur    = 1.8 + Math.random() * 1.4;
      const delay  = Math.random() * 0.7;

      el.style.cssText = `
        left:${startX}%;font-size:${size}rem;
        animation-duration:${dur}s;animation-delay:${delay}s;
        --drift:${angle}deg;
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), (dur + delay + 0.5) * 1000);
    }
  }

  /* ── Screen glow ─────────────────────────────── */
  let _glowEl = null;

  function glowScreen(category) {
    clearGlow();
    const cfg = _cfg(category);
    _glowEl   = document.createElement('div');
    _glowEl.id = 'emotion-glow';
    _glowEl.style.cssText = `
      position:fixed;inset:0;z-index:99;pointer-events:none;
      background:radial-gradient(ellipse at 50% 60%,${cfg.glow},transparent 70%);
      animation:emotionGlowIn 0.6s ease both;
    `;
    document.body.appendChild(_glowEl);
  }

  function clearGlow() {
    if (_glowEl) { _glowEl.remove(); _glowEl = null; }
    const old = document.getElementById('emotion-glow');
    if (old) old.remove();
  }

  return { speakEmotional, burstEmoji, glowScreen, clearGlow, stop };
})();
