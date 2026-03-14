/**
 * app.js — LoveBot Orchestrator v3.0
 *
 * Changes from v2:
 *  - UnlockEngine.applyAllUnlocks() called on _initMain() to restore UI
 *  - UnlockEngine.triggerFeature() called when milestone hit
 *  - NotificationEngine wired to settings toggle
 *  - voiceManager hidden from user (admin-only uploads)
 *  - lb:showMessage + lb:surprise both handled
 *  - Settings saves/loads notification preference
 */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  /* ── DOM refs ────────────────────────────────── */
  const splashScreen = $('splash');
  const moodScreen   = $('mood');
  const mainScreen   = $('main');

  const botStatus    = $('bot-status');
  const moodIcon     = $('mood-icon');
  const statCount    = $('stat-count');
  const statUnlock   = $('stat-unlock');

  const msgOverlay   = $('msg-overlay');
  const typingEl     = $('typing');
  const msgBodyEl    = $('msg-body');
  const msgStickerEl = $('msg-sticker');
  const msgCatEl     = $('msg-cat');
  const msgTxtEl     = $('msg-txt');
  const btnVoice     = $('btn-voice');
  const btnSave      = $('btn-save');
  const msgClose     = $('msg-close');

  const memOverlay   = $('mem-overlay');
  const memGrid      = $('mem-grid');
  const memEmpty     = $('mem-empty');

  const setOverlay   = $('set-overlay');
  const togVoice     = $('tog-voice');
  const togNight     = $('tog-night');
  const togNotif     = $('tog-notif');
  const vmBadge      = $('vm-badge');

  const vmOverlay    = $('vm-overlay');
  const vmDrop       = $('vm-drop');
  const vmFileInput  = $('vm-file');
  const vmList       = $('vm-list');
  const vmEmpty      = $('vm-empty');
  const vmCount      = $('vm-count');
  const vmChance     = $('vm-chance');
  const vmChanceVal  = $('vm-chance-val');

  const ulOverlay    = $('ul-overlay');
  const ulGlyph      = $('ul-glyph');
  const ulTitle      = $('ul-title');
  const ulMsg        = $('ul-msg');
  const confettiBox  = $('confetti-box');

  const gratOverlay  = $('gratitude-overlay');
  const gratInput    = $('gratitude-input');

  const canvas       = $('cvs');
  const nodeField    = $('nodes');

  /* ── State ───────────────────────────────────── */
  let currentMsg    = null;
  let activeOverlay = null;
  let ttsEnabled    = true;
  let mainReady     = false;

  /* ── Screens ─────────────────────────────────── */
  function showScreen(el) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
  }

  /* ── Overlays ────────────────────────────────── */
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
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlay(activeOverlay); });

  /* ── Sticker map ─────────────────────────────── */
  const STICKER = {
    'affirmation':'💖','compliment':'🌸','wonder':'✨','connection':'💞',
    'breathe':'🍃','validation':'🫶','comfort':'💜','hope':'🌈',
    'night':'🌙','memory':'💭','from you 💌':'💌','time capsule 💌':'🎁',
    'voice clip':'🎙️','voice memory':'🎤','thinking of you ✦':'🌙','voice note':'🔊',
  };

  /* ── Show message card ───────────────────────── */
  function showMessage(msg) {
    currentMsg = msg;
    typingEl.style.display  = 'flex';
    msgBodyEl.classList.add('hidden');
    msgClose.style.display  = 'none';
    btnSave.textContent     = '💾 Save';
    btnSave.disabled        = false;
    btnVoice.textContent    = '🔊 Listen';

    EmotionEngine.glowScreen(msg.c);
    openOverlay(msgOverlay);

    setTimeout(() => {
      typingEl.style.display = 'none';

      const sticker = STICKER[msg.c] || null;
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

      if (!msg._isClip) EmotionEngine.burstEmoji(msg.c);

      // Auto-speak 25% of the time
      if (!msg._isClip && ttsEnabled && Math.random() < 0.25) {
        setTimeout(() => EmotionEngine.speakEmotional(msg.t, msg.c), 400);
      }
    }, 1300 + Math.random() * 800);
  }

  /* ── Tap handler ─────────────────────────────── */
  function handleTap() {
    const result = UnlockEngine.increment();
    _updateStats();

    // 1. Memory callback (30% if memories exist)
    const memMsg = MemoryAI.getCallbackMessage();
    if (memMsg) { showMessage(memMsg); _checkMilestone(result); return; }

    // 2. Admin private text message (40% if any exist)
    const adminMsg = AdminEngine.getRandomAdminMsg();
    if (adminMsg && Math.random() < 0.4) {
      showMessage({ t: adminMsg.t, c: adminMsg.c });
      _checkMilestone(result); return;
    }

    // 3. Default mood message
    showMessage(MoodEngine.getMessage());
    _checkMilestone(result);
  }

  function _checkMilestone(result) {
    if (!result.unlocked || !result.milestone) return;
    const m = result.milestone;

    // Show unlock overlay after 5s (let user read the message first)
    setTimeout(() => {
      closeOverlay(msgOverlay);
      setTimeout(() => {
        ulGlyph.textContent = m.g;
        ulTitle.textContent = m.title;
        ulMsg.textContent   = m.msg;
        openOverlay(ulOverlay);
        UnlockEngine.spawnConfetti(confettiBox);
        // Apply real UI feature
        if (m.feature) UnlockEngine.triggerFeature(m.feature, m);
      }, 300);
    }, 5000);
  }

  /* ── Stats bar ───────────────────────────────── */
  function _updateStats() {
    const n    = UnlockEngine.getCount();
    const next = UnlockEngine.getNextMilestone();
    statCount.textContent  = `✦ ${n} moment${n !== 1 ? 's' : ''}`;
    statUnlock.textContent = next ? `🔓 next: ${next.n} taps` : '🌌 all unlocked ✦';
  }

  /* ── Gratitude prompt ────────────────────────── */
  function showGratitudePrompt() {
    gratInput.value = '';
    openOverlay(gratOverlay);
  }
  $('gratitude-save').addEventListener('click', () => {
    const txt = gratInput.value.trim();
    if (txt) MemoryAI.saveGratitude(txt);
    localStorage.setItem('lb_ai_last_q', new Date().toDateString());
    closeOverlay(gratOverlay);
  });
  $('gratitude-skip').addEventListener('click', () => {
    localStorage.setItem('lb_ai_last_q', new Date().toDateString());
    closeOverlay(gratOverlay);
  });

  /* ── Memories panel ──────────────────────────── */
  const MEM_KEY = 'lb_memories';
  function _getMems() { try { return JSON.parse(localStorage.getItem(MEM_KEY)||'[]'); } catch { return []; } }
  function _saveMem(text) {
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

      const txt = document.createElement('p');
      txt.className = 'mem-txt';
      txt.textContent = `"${m.text}"`;

      const date = document.createElement('p');
      date.className = 'mem-date';
      date.textContent = m.date;

      const del = document.createElement('button');
      del.className = 'mem-del';
      del.textContent = '✕';
      del.addEventListener('click', () => {
        localStorage.setItem(MEM_KEY, JSON.stringify(_getMems().filter(x=>x.id!==m.id)));
        _renderMems();
      });

      card.appendChild(txt);
      card.appendChild(date);
      card.appendChild(del);
      memGrid.appendChild(card);
    });
  }

  /* ── Settings ────────────────────────────────── */
  const SETTINGS_KEY = 'lb_settings';
  function _loadSettings() { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'); } catch { return {}; } }
  function _saveSettings(s){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }
  function _applySettings(s) {
    ttsEnabled = s.tts !== false;
    if (togVoice) togVoice.checked = ttsEnabled;
    VoiceEngine.setEnabled(ttsEnabled);

    const isLight = Boolean(s.light);
    if (togNight) togNight.checked = isLight;
    document.body.classList.toggle('light', isLight);

    const notifOn = s.notif !== false;
    if (togNotif) togNotif.checked = notifOn;
  }

  /* ── Events ──────────────────────────────────── */

  // Splash
  $('btn-start').addEventListener('click', () => {
    if (localStorage.getItem('lb_mood_set') === 'true') {
      _initMain(); showScreen(mainScreen);
    } else {
      showScreen(moodScreen);
    }
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
  $('btn-memories').addEventListener('click', () => { _renderMems(); openOverlay(memOverlay); });
  $('btn-settings').addEventListener('click', () => {
    _applySettings(_loadSettings());
    openOverlay(setOverlay);
  });

  // Message card
  msgClose.addEventListener('click', () => closeOverlay(msgOverlay));

  btnVoice.addEventListener('click', () => {
    if (!currentMsg) return;
    if (currentMsg._isClip) {
      const clip = AdminEngine.getRandomAdminClip();
      if (clip) { try { new Audio(clip.data).play(); } catch {} }
      return;
    }
    if (VoiceEngine.isSpeaking() || window.speechSynthesis?.speaking) {
      EmotionEngine.stop();
    } else {
      EmotionEngine.speakEmotional(currentMsg.t, currentMsg.c);
    }
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
    const s = { tts: togVoice.checked, light: togNight.checked, notif: togNotif.checked };
    _applySettings(s); _saveSettings(s);
    NotificationEngine.setEnabled(togNotif.checked);
    closeOverlay(setOverlay);
  });
  togNight.addEventListener('change', () => {
    document.body.classList.toggle('light', togNight.checked);
  });

  // Voice manager (admin only — button hidden from user UI but still functional)
  const btnVm = $('btn-open-vm');
  if (btnVm) {
    btnVm.addEventListener('click', () => {
      closeOverlay(setOverlay); VoiceManager.render(); openOverlay(vmOverlay);
    });
  }
  const vmCloseBtn = $('vm-close');
  if (vmCloseBtn) {
    vmCloseBtn.addEventListener('click', () => {
      VoiceManager.stopCurrent(); closeOverlay(vmOverlay);
      _applySettings(_loadSettings()); openOverlay(setOverlay);
    });
  }

  // Unlock
  $('ul-close').addEventListener('click', () => closeOverlay(ulOverlay));

  // Reset
  $('btn-reset').addEventListener('click', () => {
    if (!confirm('Reset all LoveBot data? This cannot be undone.')) return;
    localStorage.clear(); location.reload();
  });

  // Global message events (from DailyEngine, SurpriseEngine, NotificationEngine)
  window.addEventListener('lb:showMessage', e => {
    if (e.detail && e.detail.message) showMessage(e.detail.message);
  });
  window.addEventListener('lb:surprise', e => {
    if (e.detail && e.detail.message) showMessage(e.detail.message);
  });

  /* ── Main init ───────────────────────────────── */
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

    // Restore all visual unlock states (gold nodes, moon orb, etc.)
    UnlockEngine.applyAllUnlocks();

    // Start engines
    SurpriseEngine.init();
    DailyEngine.init();
    MemoryAI.init();
    NotificationEngine.init();

    // Voice manager (admin uploads only — user doesn't see this button)
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

    // Daily gratitude prompt — 10s after main screen settles
    if (MemoryAI.shouldAskGratitude()) {
      setTimeout(showGratitudePrompt, 10000);
    }
  }

  /* ── Boot ────────────────────────────────────── */
  function boot() {
    _applySettings(_loadSettings());
    showScreen(splashScreen);

    // Admin trigger registered immediately at boot so it works on
    // BOTH the splash screen (splash-title) AND main screen (bot-name)
    // regardless of which screen the user is currently on.
    AdminEngine.init($('splash-title'), $('bot-name'));

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./pwa/service-worker.js').catch(() => {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
