/**
 * app.js — LoveBot Orchestrator v3
 *
 * Wires all modules:
 *   MoodEngine · VoiceEngine · EmotionEngine · VoiceManager
 *   UnlockEngine · ConstellationEngine · SurpriseEngine
 *   AdminEngine · MemoryAI · DailyEngine
 *
 * Theme:
 *   Default      → dark cosmic  (:root in style.css)
 *   body.light   → warm daylight (toggled via Settings)
 */

(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  /* ══════════════════════════════════════════════
     DOM REFS
  ══════════════════════════════════════════════ */
  const splashScreen    = $('splash');
  const moodScreen      = $('mood');
  const mainScreen      = $('main');

  const botStatus       = $('bot-status');
  const moodIcon        = $('mood-icon');
  const statCount       = $('stat-count');
  const statUnlock      = $('stat-unlock');

  const msgOverlay      = $('msg-overlay');
  const typingEl        = $('typing');
  const msgBodyEl       = $('msg-body');
  const msgStickerEl    = $('msg-sticker');
  const msgCatEl        = $('msg-cat');
  const msgTxtEl        = $('msg-txt');
  const btnVoice        = $('btn-voice');
  const btnSave         = $('btn-save');
  const msgClose        = $('msg-close');

  const memOverlay      = $('mem-overlay');
  const memGrid         = $('mem-grid');
  const memEmpty        = $('mem-empty');

  const setOverlay      = $('set-overlay');
  const togVoice        = $('tog-voice');
  const togNight        = $('tog-night');
  const vmBadge         = $('vm-badge');

  const vmOverlay       = $('vm-overlay');
  const vmDrop          = $('vm-drop');
  const vmFileInput     = $('vm-file');
  const vmList          = $('vm-list');
  const vmEmpty         = $('vm-empty');
  const vmCount         = $('vm-count');
  const vmChance        = $('vm-chance');
  const vmChanceVal     = $('vm-chance-val');

  const ulOverlay       = $('ul-overlay');
  const ulGlyph         = $('ul-glyph');
  const ulTitle         = $('ul-title');
  const ulMsg           = $('ul-msg');
  const confettiBox     = $('confetti-box');

  const gratOverlay     = $('gratitude-overlay');
  const gratInput       = $('gratitude-input');

  const canvas          = $('cvs');
  const nodeField       = $('nodes');

  /* ══════════════════════════════════════════════
     STATE
  ══════════════════════════════════════════════ */
  let currentMsg    = null;
  let activeOverlay = null;
  let ttsEnabled    = true;
  let mainReady     = false;

  /* ══════════════════════════════════════════════
     SCREEN
  ══════════════════════════════════════════════ */
  function showScreen(el) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
  }

  /* ══════════════════════════════════════════════
     OVERLAYS
  ══════════════════════════════════════════════ */
  function openOverlay(el) {
    if (activeOverlay && activeOverlay !== el) _doClose(activeOverlay);
    el.classList.remove('hidden');
    activeOverlay = el;
  }
  function closeOverlay(el) {
    if (!el) return;
    el.classList.add('hidden');
    if (activeOverlay === el) activeOverlay = null;
    EmotionEngine.stop();
    VoiceEngine.stop();
    VoiceManager.stopCurrent();
    EmotionEngine.clearGlow();
  }
  function _doClose(el) {
    el.classList.add('hidden');
    if (activeOverlay === el) activeOverlay = null;
  }

  [msgOverlay, memOverlay, setOverlay, vmOverlay, ulOverlay, gratOverlay].forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov) closeOverlay(ov); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeOverlay(activeOverlay);
  });

  /* ══════════════════════════════════════════════
     EMOTION MAP — category → lead sticker emoji
  ══════════════════════════════════════════════ */
  const STICKER_MAP = {
    'affirmation':       '💖',
    'compliment':        '🌸',
    'wonder':            '✨',
    'connection':        '💞',
    'breathe':           '🍃',
    'validation':        '🫶',
    'comfort':           '💜',
    'hope':              '🌈',
    'night':             '🌙',
    'memory':            '💭',
    'from you 💌':       '💌',
    'time capsule 💌':   '🎁',
    'voice clip':        '🎙️',
    'voice memory':      '🎤',
    'thinking of you ✦': '🌙',
    'voice note':        '🔊',
  };

  /* ══════════════════════════════════════════════
     MESSAGE DISPLAY
  ══════════════════════════════════════════════ */
  function showMessage(msg) {
    currentMsg = msg;

    typingEl.style.display  = 'flex';
    msgBodyEl.classList.add('hidden');
    msgClose.style.display  = 'none';
    btnSave.textContent     = '💾 Save';
    btnSave.disabled        = false;
    btnVoice.textContent    = '🔊 Listen';

    // Screen glow immediately
    EmotionEngine.glowScreen(msg.c);
    openOverlay(msgOverlay);

    const delay = 1300 + Math.random() * 800;
    setTimeout(() => {
      typingEl.style.display = 'none';

      // Sticker
      const sticker = STICKER_MAP[msg.c] || null;
      if (sticker && !msg._isClip) {
        msgStickerEl.textContent = sticker;
        msgStickerEl.classList.remove('hidden');
      } else {
        msgStickerEl.classList.add('hidden');
      }

      msgCatEl.textContent = msg.c ? `— ${msg.c} —` : '';
      msgTxtEl.textContent = msg.t;
      msgBodyEl.classList.remove('hidden');
      msgClose.style.display = '';

      // Emoji burst
      if (!msg._isClip) EmotionEngine.burstEmoji(msg.c);

      // Auto emotional TTS (25% chance)
      if (!msg._isClip && ttsEnabled && Math.random() < 0.25) {
        setTimeout(() => EmotionEngine.speakEmotional(msg.t, msg.c), 400);
      }
    }, delay);
  }

  /* ══════════════════════════════════════════════
     TAP HANDLER (orb + nodes)
  ══════════════════════════════════════════════ */
  function handleTap() {
    const result = UnlockEngine.increment();
    _updateStats();

    // 1. Memory callback (30% if memories exist)
    const memMsg = MemoryAI.getCallbackMessage();
    if (memMsg) { showMessage(memMsg); _checkMilestone(result); return; }

    // 2. Admin private message (40% if any exist)
    const adminMsg = AdminEngine.getRandomAdminMsg();
    if (adminMsg && Math.random() < 0.4) {
      showMessage({ t: adminMsg.t, c: adminMsg.c });
      _checkMilestone(result);
      return;
    }

    // 3. Admin voice clip (feels like "I saved something for you")
    const adminClip = AdminEngine.getRandomAdminClip();
    if (adminClip && Math.random() < 0.25) {
      try { new Audio(adminClip.data).play(); } catch {}
      showMessage({ t: '🎙 I saved something for you ✦', c: 'voice memory', _isClip: true });
      _checkMilestone(result);
      return;
    }

    // 4. User voice clip (from voiceManager)
    const hasClips   = VoiceManager.count() > 0;
    const rollClip   = hasClips && (Math.random() * 100 < VoiceManager.getChance());
    if (rollClip) {
      VoiceManager.playRandom();
      showMessage({ t: '🎙 Playing your voice clip…', c: 'voice clip', _isClip: true });
      _checkMilestone(result);
      return;
    }

    // 5. TTS-only line (20% when no clips loaded)
    if (ttsEnabled && VoiceEngine.isSupported() && !hasClips && Math.random() < 0.2) {
      const line = VoiceEngine.randomTTS();
      if (line) { showMessage({ t: line, c: 'voice note' }); _checkMilestone(result); return; }
    }

    // 6. Default mood message
    showMessage(MoodEngine.getMessage());
    _checkMilestone(result);
  }

  function _checkMilestone(result) {
    if (result.unlocked && result.milestone) {
      setTimeout(() => {
        closeOverlay(msgOverlay);
        setTimeout(() => {
          ulGlyph.textContent = result.milestone.g;
          ulTitle.textContent = result.milestone.title;
          ulMsg.textContent   = result.milestone.msg;
          openOverlay(ulOverlay);
          UnlockEngine.spawnConfetti(confettiBox);
        }, 300);
      }, 5000);
    }
  }

  /* ══════════════════════════════════════════════
     STATS
  ══════════════════════════════════════════════ */
  function _updateStats() {
    const n    = UnlockEngine.getCount();
    const next = UnlockEngine.getNextMilestone();
    statCount.textContent  = `✦ ${n} moment${n!==1?'s':''}`;
    statUnlock.textContent = next ? `🔓 next unlock: ${next.n}` : '🔓 all unlocked ✦';
  }

  /* ══════════════════════════════════════════════
     GRATITUDE PROMPT
  ══════════════════════════════════════════════ */
  function showGratitudePrompt() {
    gratInput.value = '';
    openOverlay(gratOverlay);
  }

  $('gratitude-save').addEventListener('click', () => {
    const txt = gratInput.value.trim();
    if (txt) { MemoryAI.saveGratitude(txt); }
    closeOverlay(gratOverlay);
  });
  $('gratitude-skip').addEventListener('click', () => {
    // Mark today as asked even if skipped so it doesn't re-prompt
    localStorage.setItem('lb_ai_last_q', new Date().toDateString());
    closeOverlay(gratOverlay);
  });

  /* ══════════════════════════════════════════════
     MEMORIES PANEL
  ══════════════════════════════════════════════ */
  const MEM_KEY = 'lb_memories';
  function _getMems()       { try { return JSON.parse(localStorage.getItem(MEM_KEY)||'[]'); } catch { return []; } }
  function _saveMem(text)   {
    const m = _getMems();
    m.unshift({ text, date: new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}), id:Date.now() });
    localStorage.setItem(MEM_KEY, JSON.stringify(m));
  }
  function _renderMems() {
    const mems = _getMems();
    memGrid.innerHTML = '';
    if (!mems.length) { memEmpty.classList.remove('hidden'); return; }
    memEmpty.classList.add('hidden');
    mems.forEach(m => {
      const card = document.createElement('div');
      card.className = 'mem-card';
      card.innerHTML = `<p class="mem-txt">"${m.text}"</p><p class="mem-date">${m.date}</p><button class="mem-del">✕</button>`;
      card.querySelector('.mem-del').addEventListener('click', () => {
        localStorage.setItem(MEM_KEY, JSON.stringify(_getMems().filter(x=>x.id!==m.id)));
        _renderMems();
      });
      memGrid.appendChild(card);
    });
  }

  /* ══════════════════════════════════════════════
     SETTINGS
  ══════════════════════════════════════════════ */
  const SETTINGS_KEY = 'lb_settings';
  function _loadSettings() { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'); } catch { return {}; } }
  function _saveSettings(s){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }
  function _applySettings(s) {
    ttsEnabled = s.tts !== false;
    togVoice.checked = ttsEnabled;
    VoiceEngine.setEnabled(ttsEnabled);
    const isLight = Boolean(s.light);
    togNight.checked = isLight;
    document.body.classList.toggle('light', isLight);
  }

  /* ══════════════════════════════════════════════
     EVENT WIRING
  ══════════════════════════════════════════════ */

  // Splash
  $('btn-start').addEventListener('click', () => {
    if (localStorage.getItem('lb_mood_set') === 'true') {
      _initMain(); showScreen(mainScreen);
    } else {
      showScreen(moodScreen);
    }
  });

  // Admin: tap splash title 5×
  $('splash-title').addEventListener('click', () => {
    // handled by AdminEngine.init()
  });

  // Mood
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      MoodEngine.set(btn.dataset.mood);
      _initMain();
      showScreen(mainScreen);
    });
  });

  // Orb
  $('orb').addEventListener('click', handleTap);

  // Top bar
  $('btn-mood-change').addEventListener('click', () => showScreen(moodScreen));
  $('btn-memories').addEventListener('click',    () => { _renderMems(); openOverlay(memOverlay); });
  $('btn-settings').addEventListener('click',    () => {
    _applySettings(_loadSettings());
    vmBadge.textContent = VoiceManager.count() ? `(${VoiceManager.count()})` : '';
    openOverlay(setOverlay);
  });

  // Message card
  msgClose.addEventListener('click', () => closeOverlay(msgOverlay));

  btnVoice.addEventListener('click', () => {
    if (!currentMsg) return;
    if (currentMsg._isClip) {
      // replay admin clip or user clip
      const adminClip = AdminEngine.getRandomAdminClip();
      if (adminClip) { try { new Audio(adminClip.data).play(); } catch {} return; }
      if (VoiceManager.count()) VoiceManager.playRandom();
      return;
    }
    if (EmotionEngine.stop(), VoiceEngine.isSpeaking()) { VoiceEngine.stop(); }
    else { EmotionEngine.speakEmotional(currentMsg.t, currentMsg.c); }
  });

  window.addEventListener('lb:voice-start', () => { btnVoice.textContent = '⏹ Stop'; });
  window.addEventListener('lb:voice-end',   () => { btnVoice.textContent = '🔊 Listen'; });

  btnSave.addEventListener('click', () => {
    if (!currentMsg || currentMsg._isClip) return;
    _saveMem(currentMsg.t);
    btnSave.textContent = '✓ Saved!';
    btnSave.disabled    = true;
  });

  // Memory
  $('mem-close').addEventListener('click', () => closeOverlay(memOverlay));

  // Settings save
  $('set-close').addEventListener('click', () => {
    const s = { tts: togVoice.checked, light: togNight.checked };
    _applySettings(s); _saveSettings(s); closeOverlay(setOverlay);
  });
  togNight.addEventListener('change', () => {
    document.body.classList.toggle('light', togNight.checked);
  });

  // Open voice manager
  $('btn-open-vm').addEventListener('click', () => {
    closeOverlay(setOverlay); VoiceManager.render(); openOverlay(vmOverlay);
  });
  $('vm-close').addEventListener('click', () => {
    VoiceManager.stopCurrent(); closeOverlay(vmOverlay);
    _applySettings(_loadSettings());
    vmBadge.textContent = VoiceManager.count() ? `(${VoiceManager.count()})` : '';
    openOverlay(setOverlay);
  });

  // Unlock
  $('ul-close').addEventListener('click', () => closeOverlay(ulOverlay));

  // Reset
  $('btn-reset').addEventListener('click', () => {
    if (!confirm('Reset all LoveBot data? This cannot be undone.')) return;
    localStorage.clear(); location.reload();
  });

  // Surprise engine events (2–8 hr timer)
  window.addEventListener('lb:surprise', e => {
    if (e.detail && e.detail.message) showMessage(e.detail.message);
  });

  // Daily + interval engine
  window.addEventListener('lb:showMessage', e => {
    if (e.detail && e.detail.message) showMessage(e.detail.message);
  });

  /* ══════════════════════════════════════════════
     MAIN INIT
  ══════════════════════════════════════════════ */
  function _initMain() {
    if (mainReady) return;
    mainReady = true;

    const mood = MoodEngine.get();
    moodIcon.textContent  = MoodEngine.emoji(mood);
    botStatus.textContent = MoodEngine.statusLine();

    _updateStats();
    _applySettings(_loadSettings());

    // Build constellation
    ConstellationEngine.build(nodeField, canvas, handleTap);

    // Init engines
    SurpriseEngine.init();
    DailyEngine.init();
    MemoryAI.init();

    // Admin: tap splash title OR "LoveBot" name in top bar 5×
    AdminEngine.init($('splash-title'), $('bot-name'));

    // Voice manager
    VoiceManager.init({
      dropEl:      vmDrop,
      fileEl:      vmFileInput,
      listEl:      vmList,
      emptyEl:     vmEmpty,
      countEl:     vmCount,
      chanceEl:    vmChance,
      chanceValEl: vmChanceVal,
      badgeEl:     vmBadge,
    });

    // Daily gratitude prompt — delay 10s so main screen settles
    if (MemoryAI.shouldAskGratitude()) {
      setTimeout(showGratitudePrompt, 10000);
    }
  }

  /* ══════════════════════════════════════════════
     BOOT
  ══════════════════════════════════════════════ */
  function boot() {
    _applySettings(_loadSettings());
    showScreen(splashScreen);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('pwa/service-worker.js').catch(() => {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
