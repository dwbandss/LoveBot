/**
 * modules/emotionEngine.js
 * ─────────────────────────────────────────────────────
 * Handles all emotional presentation:
 *
 *   1. EMOTIONAL TTS VOICE — warm, expressive girlish voice
 *      with pitch/rate/pause tuned per message category.
 *      Uses SSML-style pauses via utterance chunking where supported.
 *
 *   2. EMOJI STICKER BURST — category-mapped emoji float up
 *      from the bottom of the screen when a message appears.
 *
 *   3. SCREEN GLOW — a soft colour wash pulses behind the
 *      message card, colour-matched to the message emotion.
 *
 * Public API
 *   EmotionEngine.speakEmotional(text, category)
 *   EmotionEngine.burstEmoji(category, targetEl)
 *   EmotionEngine.glowScreen(category)
 *   EmotionEngine.clearGlow()
 *   EmotionEngine.stop()
 */

const EmotionEngine = (() => {
  /* ══════════════════════════════════════════════
     EMOTION MAP — per category config
  ══════════════════════════════════════════════ */
  const EMOTION = {
    // category       → { rate, pitch, volume, emojis, glowColor }
    'affirmation':    { rate:0.82, pitch:1.10, volume:1,   emojis:['💖','✨','🌸','💫','🌟'], glow:'rgba(255,179,198,0.22)' },
    'compliment':     { rate:0.85, pitch:1.08, volume:1,   emojis:['💗','🌸','✨','💝','🥺'], glow:'rgba(255,179,198,0.20)' },
    'wonder':         { rate:0.78, pitch:1.12, volume:0.95,emojis:['🌌','✨','💫','🌠','🪐'], glow:'rgba(192,132,252,0.22)' },
    'connection':     { rate:0.80, pitch:1.06, volume:1,   emojis:['💞','🫂','💌','🌷','💓'], glow:'rgba(255,179,198,0.25)' },
    'breathe':        { rate:0.72, pitch:0.98, volume:0.9, emojis:['🌬️','🌿','🍃','💚','🕊️'], glow:'rgba(134,239,172,0.18)' },
    'validation':     { rate:0.78, pitch:1.02, volume:0.95,emojis:['🫶','💛','🌻','✊','💪'], glow:'rgba(253,211,77,0.18)'  },
    'comfort':        { rate:0.74, pitch:1.00, volume:0.92,emojis:['🤗','💜','🌙','🫂','💝'], glow:'rgba(192,132,252,0.20)' },
    'hope':           { rate:0.80, pitch:1.08, volume:1,   emojis:['🌅','🌈','🕊️','🌱','⭐'], glow:'rgba(253,211,77,0.20)'  },
    'night':          { rate:0.70, pitch:0.95, volume:0.88,emojis:['🌙','⭐','🌌','💤','🌛'], glow:'rgba(100,80,160,0.22)'  },
    'memory':         { rate:0.76, pitch:1.04, volume:0.95,emojis:['💭','📖','🌸','💫','🫶'], glow:'rgba(192,132,252,0.18)' },
    'time capsule 💌':{ rate:0.75, pitch:1.06, volume:0.95,emojis:['💌','🎁','⏳','💖','✨'], glow:'rgba(255,179,198,0.28)' },
    'from you 💌':    { rate:0.78, pitch:1.10, volume:1,   emojis:['💌','💖','🌸','💗','✨'], glow:'rgba(255,100,150,0.28)' },
    'voice clip':     { rate:0.82, pitch:1.05, volume:1,   emojis:['🎙️','💬','💖','🎵','✨'], glow:'rgba(192,132,252,0.20)' },
    'voice memory':   { rate:0.78, pitch:1.08, volume:1,   emojis:['🎤','💌','💝','🌸','✨'], glow:'rgba(255,100,150,0.25)' },
    'thinking of you ✦':{ rate:0.80, pitch:1.06, volume:1,emojis:['🌙','💭','💖','✨','🌸'], glow:'rgba(192,132,252,0.22)' },
    'voice note':     { rate:0.82, pitch:1.05, volume:1,   emojis:['🔊','💬','✨','💖','🌸'], glow:'rgba(192,132,252,0.18)' },
    'default':        { rate:0.82, pitch:1.06, volume:1,   emojis:['💖','✨','🌸','💫','🌟'], glow:'rgba(192,132,252,0.20)' },
  };

  function _cfg(category) {
    return EMOTION[category] || EMOTION['default'];
  }

  /* ══════════════════════════════════════════════
     PREFERRED VOICE SELECTION
     Targets warm, feminine English voices.
  ══════════════════════════════════════════════ */
  let _voice = null;

  function _loadVoice() {
    const synth  = window.speechSynthesis;
    if (!synth) return;
    const voices = synth.getVoices();
    if (!voices.length) return;

    // Priority list — softest, most expressive English voices
    const prefs = [
      'samantha','karen','moira','fiona','victoria',
      'zira','susan','hazel','tessa','amelie',
    ];
    for (const p of prefs) {
      const v = voices.find(v => v.name.toLowerCase().includes(p));
      if (v) { _voice = v; return; }
    }
    // Fallback: any female-named en voice
    _voice = voices.find(v => /en[-_]/.test(v.lang) && /female|woman|girl/i.test(v.name))
          || voices.find(v => v.lang.startsWith('en'))
          || voices[0];
  }

  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = _loadVoice;
    _loadVoice();
  }

  /* ══════════════════════════════════════════════
     EMOTIONAL TTS
  ══════════════════════════════════════════════ */
  function speakEmotional(text, category) {
    const synth = window.speechSynthesis;
    if (!synth || !text) return;

    synth.cancel();

    const cfg = _cfg(category);

    // Split on punctuation to allow natural pacing pauses between chunks
    // Each chunk becomes its own utterance so we can vary emphasis
    const chunks = text.match(/[^.!?,;…]+[.!?,;…]*/g) || [text];

    let i = 0;
    function speakNext() {
      if (i >= chunks.length) {
        window.dispatchEvent(new Event('lb:voice-end'));
        return;
      }
      const chunk = chunks[i].trim();
      if (!chunk) { i++; speakNext(); return; }

      const utt    = new SpeechSynthesisUtterance(chunk);
      utt.voice    = _voice;
      utt.rate     = cfg.rate + (Math.random() * 0.04 - 0.02); // tiny variation
      utt.pitch    = cfg.pitch + (Math.random() * 0.06 - 0.03);
      utt.volume   = cfg.volume;

      // Slightly slower + lower pitch for ellipsis/sad punctuation
      if (/…|—/.test(chunk)) { utt.rate *= 0.88; utt.pitch *= 0.96; }

      utt.onend   = () => { i++; speakNext(); };
      utt.onerror = () => { i++; speakNext(); };
      if (i === 0) utt.onstart = () => window.dispatchEvent(new Event('lb:voice-start'));

      synth.speak(utt);
    }

    speakNext();
  }

  function stop() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  /* ══════════════════════════════════════════════
     EMOJI BURST STICKERS
  ══════════════════════════════════════════════ */
  function burstEmoji(category) {
    const cfg    = _cfg(category);
    const emojis = cfg.emojis;
    const count  = 8 + Math.floor(Math.random() * 5); // 8–12 emojis

    for (let i = 0; i < count; i++) {
      const el    = document.createElement('div');
      el.className = 'emoji-burst';
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];

      // Random horizontal spread
      const startX = 20 + Math.random() * 60;   // 20–80% width
      const angle  = -20 + Math.random() * 40;  // drift angle
      const size   = 1.4 + Math.random() * 1.4; // 1.4–2.8rem
      const dur    = 1.8 + Math.random() * 1.4; // 1.8–3.2s
      const delay  = Math.random() * 0.6;

      el.style.cssText = `
        left: ${startX}%;
        font-size: ${size}rem;
        animation-duration: ${dur}s;
        animation-delay: ${delay}s;
        --drift: ${angle}deg;
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), (dur + delay + 0.5) * 1000);
    }
  }

  /* ══════════════════════════════════════════════
     SCREEN GLOW
  ══════════════════════════════════════════════ */
  let _glowEl = null;

  function glowScreen(category) {
    clearGlow();
    const cfg = _cfg(category);
    _glowEl   = document.createElement('div');
    _glowEl.id = 'emotion-glow';
    _glowEl.style.cssText = `
      position:fixed;inset:0;z-index:99;pointer-events:none;
      background:radial-gradient(ellipse at 50% 60%, ${cfg.glow}, transparent 70%);
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
