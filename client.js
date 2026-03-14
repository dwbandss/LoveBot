/**
 * client.js — LoveBot Frontend
 * Talks to the Express backend via fetch().
 * No message data, no admin logic, no passwords here.
 * The browser downloads this file but there is nothing sensitive in it.
 */
(function () {
  'use strict';

  /* ── API helper ──────────────────────────────── */
  const API = {
    token: localStorage.getItem('_lbt') || null,

    async get(path) {
      const r = await fetch(path, { headers: this._h() });
      return r.json();
    },
    async post(path, body) {
      const r = await fetch(path, { method:'POST', headers: this._h(), body: JSON.stringify(body) });
      return r.json();
    },
    async del(path) {
      const r = await fetch(path, { method:'DELETE', headers: this._h() });
      return r.json();
    },
    async put(path, body) {
      const r = await fetch(path, { method:'PUT', headers: this._h(), body: JSON.stringify(body) });
      return r.json();
    },
    async uploadAudio(file) {
      const fd = new FormData();
      fd.append('audio', file);
      const r = await fetch('/api/admin/clips', { method:'POST', headers:{ Authorization:`Bearer ${this.token}` }, body: fd });
      return r.json();
    },
    _h() {
      const h = { 'Content-Type': 'application/json' };
      if (this.token) h['Authorization'] = `Bearer ${this.token}`;
      return h;
    },
    saveToken(t) { this.token = t; localStorage.setItem('_lbt', t); },
    clearToken()  { this.token = null; localStorage.removeItem('_lbt'); },
  };

  /* ── DOM refs ────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const splashScreen = $('splash'), moodScreen = $('mood'), mainScreen = $('main');
  const botStatus = $('bot-status'), moodIcon = $('mood-icon');
  const statCount = $('stat-count'), statUnlock = $('stat-unlock');
  const msgOverlay = $('msg-overlay'), typingEl = $('typing'), msgBodyEl = $('msg-body');
  const msgStickerEl = $('msg-sticker'), msgCatEl = $('msg-cat'), msgTxtEl = $('msg-txt');
  const btnVoice = $('btn-voice'), btnSave = $('btn-save'), msgClose = $('msg-close');
  const memOverlay = $('mem-overlay'), memGrid = $('mem-grid'), memEmpty = $('mem-empty');
  const setOverlay = $('set-overlay'), togVoice = $('tog-voice'), togNight = $('tog-night'), togNotif = $('tog-notif');
  const ulOverlay = $('ul-overlay'), ulGlyph = $('ul-glyph'), ulTitle = $('ul-title'), ulMsg = $('ul-msg'), confettiBox = $('confetti-box');
  const gratOverlay = $('gratitude-overlay'), gratInput = $('gratitude-input');
  const canvas = $('cvs'), nodeField = $('nodes');

  /* ── State ───────────────────────────────────── */
  let currentMsg = null, activeOverlay = null, ttsEnabled = true, mainReady = false;
  let currentMood = localStorage.getItem('lb_mood') || 'happy';

  /* ── Screens ─────────────────────────────────── */
  function showScreen(el) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
  }

  /* ── Overlays ────────────────────────────────── */
  function openOverlay(el)  { if (activeOverlay && activeOverlay !== el) { activeOverlay.classList.add('hidden'); } el.classList.remove('hidden'); activeOverlay = el; }
  function closeOverlay(el) { if (!el) return; el.classList.add('hidden'); if (activeOverlay === el) activeOverlay = null; stopVoice(); clearGlow(); }
  [msgOverlay, memOverlay, setOverlay, ulOverlay, gratOverlay].forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov) closeOverlay(ov); });
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlay(activeOverlay); });

  /* ── TTS voice (browser Web Speech API) ─────── */
  const EMOTION_CFG = {
    'affirmation':{r:.82,p:1.10},'compliment':{r:.85,p:1.08},'wonder':{r:.78,p:1.12},
    'connection':{r:.80,p:1.06},'breathe':{r:.70,p:.97},'validation':{r:.77,p:1.02},
    'comfort':{r:.73,p:1.00},'hope':{r:.80,p:1.08},'night':{r:.68,p:.94},
    'from you 💌':{r:.78,p:1.10},'thinking of you ✦':{r:.80,p:1.06},
    'default':{r:.82,p:1.06},
  };
  let _voice = null;
  function _loadVoice() {
    const voices = window.speechSynthesis?.getVoices() || [];
    const prefs = ['google uk english female','samantha','karen','microsoft zira','tessa'];
    for (const p of prefs) { const v = voices.find(v => v.name.toLowerCase().includes(p)); if (v) { _voice = v; return; } }
    _voice = voices.find(v => v.lang.startsWith('en')) || voices[0] || null;
  }
  if (window.speechSynthesis) { window.speechSynthesis.onvoiceschanged = _loadVoice; _loadVoice(); }

  function speakText(text, category) {
    if (!ttsEnabled || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const cfg    = EMOTION_CFG[category] || EMOTION_CFG.default;
    const chunks = text.match(/[^.!?…]+[.!?…]*/g) || [text];
    let i = 0;
    function next() {
      if (i >= chunks.length) { btnVoice.textContent = '🔊 Listen'; return; }
      const utt  = new SpeechSynthesisUtterance(chunks[i].trim());
      utt.voice  = _voice; utt.rate = cfg.r; utt.pitch = cfg.p; utt.volume = 1;
      if (i === 0) utt.onstart = () => { btnVoice.textContent = '⏹ Stop'; };
      utt.onend = () => { i++; next(); };
      utt.onerror = () => { i++; next(); };
      window.speechSynthesis.speak(utt);
    }
    next();
  }
  function stopVoice() { window.speechSynthesis?.cancel(); btnVoice.textContent = '🔊 Listen'; }

  /* ── Emoji burst ─────────────────────────────── */
  const STICKER_MAP = {
    'affirmation':'💖','compliment':'🌸','wonder':'✨','connection':'💞','breathe':'🍃',
    'validation':'🫶','comfort':'💜','hope':'🌈','night':'🌙','memory':'💭',
    'from you 💌':'💌','voice memory':'🎤','thinking of you ✦':'🌙',
  };
  const EMOJI_MAP = {
    'affirmation':['💖','✨','🌸','💫'],'compliment':['💗','🌸','✨','💝'],
    'wonder':['🌌','✨','💫','🌠'],'connection':['💞','🫂','💌','🌷'],
    'breathe':['🌿','🍃','💚','🕊️'],'validation':['🫶','💛','🌻'],
    'comfort':['💜','🌙','🫂','💝'],'hope':['🌈','🕊️','🌱','⭐'],
    'night':['🌙','⭐','🌌','💤'],'from you 💌':['💌','💖','🌸'],
    'thinking of you ✦':['🌙','💭','💖','✨'],'default':['💖','✨','🌸','💫'],
  };
  function burstEmoji(category) {
    const emojis = EMOJI_MAP[category] || EMOJI_MAP.default;
    for (let i = 0; i < 9; i++) {
      const el = document.createElement('div');
      el.className = 'emoji-burst';
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      const startX = 15 + Math.random() * 70, angle = -25 + Math.random() * 50;
      el.style.cssText = `left:${startX}%;font-size:${1.3+Math.random()*1.5}rem;animation-duration:${1.8+Math.random()*1.4}s;animation-delay:${Math.random()*.7}s;--drift:${angle}deg;`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 4000);
    }
  }

  /* ── Screen glow ─────────────────────────────── */
  const GLOW_MAP = {
    'affirmation':'rgba(255,179,198,.22)','comfort':'rgba(192,132,252,.20)',
    'hope':'rgba(253,211,77,.20)','breathe':'rgba(134,239,172,.18)',
    'night':'rgba(100,80,160,.22)','from you 💌':'rgba(255,100,150,.28)',
    'default':'rgba(192,132,252,.20)',
  };
  let _glowEl = null;
  function glowScreen(category) {
    clearGlow();
    const col = GLOW_MAP[category] || GLOW_MAP.default;
    _glowEl = document.createElement('div');
    _glowEl.style.cssText = `position:fixed;inset:0;z-index:99;pointer-events:none;background:radial-gradient(ellipse at 50% 60%,${col},transparent 70%);animation:emotionGlowIn .6s ease both;`;
    document.body.appendChild(_glowEl);
  }
  function clearGlow() { if (_glowEl) { _glowEl.remove(); _glowEl = null; } }

  /* ── Show message card ───────────────────────── */
  function showMessage(msg) {
    currentMsg = msg;
    typingEl.style.display = 'flex';
    msgBodyEl.classList.add('hidden');
    msgClose.style.display = 'none';
    btnSave.textContent = '💾 Save'; btnSave.disabled = false;
    btnVoice.textContent = '🔊 Listen';
    glowScreen(msg.c);
    openOverlay(msgOverlay);

    setTimeout(() => {
      typingEl.style.display = 'none';
      const sticker = STICKER_MAP[msg.c];
      if (sticker) { msgStickerEl.textContent = sticker; msgStickerEl.classList.remove('hidden'); }
      else msgStickerEl.classList.add('hidden');
      msgCatEl.textContent = msg.c ? `— ${msg.c} —` : '';
      msgTxtEl.textContent = msg.t;
      msgBodyEl.classList.remove('hidden');
      msgClose.style.display = '';
      burstEmoji(msg.c);
      if (ttsEnabled && Math.random() < 0.25) setTimeout(() => speakText(msg.t, msg.c), 400);
    }, 1300 + Math.random() * 800);
  }

  /* ── Fetch message from server ───────────────── */
  async function fetchAndShowMessage() {
    try {
      const msg = await API.get(`/api/message?mood=${currentMood}`);
      if (msg && msg.t) showMessage(msg);
    } catch { showMessage({ t: "You are more loved than you know.", c: "affirmation" }); }
  }

  /* ── Tap handler ─────────────────────────────── */
  async function handleTap() {
    const result = unlockIncrement();
    _updateStats();
    _checkMilestone(result);

    // 30% chance: reference a saved memory
    const mems = _getMems();
    if (mems.length && Math.random() < 0.30) {
      const m    = mems[Math.floor(Math.random() * mems.length)];
      const refs = [
        `You once told me: "${m.text}". I hope today holds something like that too.`,
        `I remembered something you shared — "${m.text}". It stayed with me.`,
        `"${m.text}" — you said that once. I think about it sometimes.`,
      ];
      showMessage({ t: refs[Math.floor(Math.random() * refs.length)], c: 'memory' });
      return;
    }

    // Otherwise fetch from server
    await fetchAndShowMessage();
  }

  /* ── Unlock system ───────────────────────────── */
  const MILESTONES = [
    { n:5,  g:'🌸', title:'A gentle beginning',   msg:'You\'ve taken your first steps with LoveBot. The universe noticed.', feature:null },
    { n:10, g:'🎙', title:'Voice memories unlocked', msg:'From now on, LoveBot will sometimes play a special voice memory just for you.', feature:'voice_memories' },
    { n:25, g:'✨', title:'Golden constellation',  msg:'25 moments in. The stars around you have turned to gold — just like you.', feature:'gold_nodes' },
    { n:50, g:'🌙', title:'The moon is yours',     msg:'Fifty moments together. The orb has become the moon — a light that stays.', feature:'moon_orb' },
    { n:100,g:'💌', title:'A secret revealed',     msg:'One hundred moments. Someone left you something special.', feature:'secret_message' },
    { n:150,g:'🌌', title:'Full constellation',    msg:'The sky has expanded. Every star is a moment we\'ve shared.', feature:'full_constellation' },
  ];
  const CONFETTI = ['#ffb3c6','#c084fc','#fcd34d','#86efac','#93c5fd'];

  function _getCount()    { return parseInt(localStorage.getItem('lb_count')||'0',10); }
  function _getUnlocked() { try { return JSON.parse(localStorage.getItem('lb_unlocked')||'[]'); } catch { return []; } }
  function hasFeature(f)  { return _getUnlocked().includes(f); }

  function unlockIncrement() {
    const n = _getCount() + 1;
    const u = _getUnlocked();
    localStorage.setItem('lb_count', n);
    const hit = MILESTONES.find(m => m.n === n && !u.includes(m.feature || m.n));
    if (hit) { u.push(hit.feature || hit.n); localStorage.setItem('lb_unlocked', JSON.stringify(u)); return { unlocked:true, milestone:hit }; }
    return { unlocked:false, milestone:null };
  }

  function _updateStats() {
    const n    = _getCount();
    const next = MILESTONES.find(m => m.n > n && !_getUnlocked().includes(m.feature || m.n));
    statCount.textContent  = `✦ ${n} moment${n!==1?'s':''}`;
    statUnlock.textContent = next ? `🔓 next: ${next.n} taps` : '🌌 all unlocked ✦';
  }

  function _checkMilestone(result) {
    if (!result.unlocked || !result.milestone) return;
    const m = result.milestone;
    setTimeout(() => {
      closeOverlay(msgOverlay);
      setTimeout(() => {
        ulGlyph.textContent = m.g; ulTitle.textContent = m.title; ulMsg.textContent = m.msg;
        openOverlay(ulOverlay);
        _spawnConfetti();
        _applyFeature(m.feature);
      }, 300);
    }, 5000);
  }

  function _applyFeature(f) {
    if (f === 'gold_nodes') {
      document.querySelectorAll('.node').forEach(n => { n.classList.remove('rose'); n.classList.add('gold'); });
      _drawConstellation(true);
    }
    if (f === 'moon_orb') {
      const g = document.querySelector('.orb-glyph');
      if (g) { g.textContent = '🌙'; g.style.fontSize = '1.6rem'; }
    }
    if (f === 'full_constellation') _addExtraNodes();
    if (f === 'secret_message') {
      setTimeout(async () => {
        try {
          const clip = await API.get('/api/clip/random');
          if (clip && clip.id) {
            const a = new Audio(`/api/clip/${clip.id}/audio`);
            a.play().catch(()=>{});
            showMessage({ t: '💌 A secret kept just for you ✦', c: 'from you 💌' });
          }
        } catch {}
      }, 6000);
    }
  }

  function _applyAllUnlocks() {
    if (hasFeature('gold_nodes'))  { document.querySelectorAll('.node').forEach(n => { n.classList.remove('rose'); n.classList.add('gold'); }); }
    if (hasFeature('moon_orb'))    { const g = document.querySelector('.orb-glyph'); if (g) { g.textContent = '🌙'; g.style.fontSize = '1.6rem'; } }
    if (hasFeature('full_constellation')) _addExtraNodes();
  }

  function _spawnConfetti() {
    confettiBox.innerHTML = '';
    for (let i = 0; i < 45; i++) {
      const el = document.createElement('div'); el.className = 'cp';
      const sz = 5 + Math.random()*9, col = CONFETTI[Math.floor(Math.random()*CONFETTI.length)];
      el.style.cssText = `left:${Math.random()*100}%;width:${sz}px;height:${sz}px;background:${col};border-radius:${Math.random()>.5?'50%':'2px'};animation-duration:${1.2+Math.random()*1.6}s;animation-delay:${Math.random()*.8}s`;
      confettiBox.appendChild(el);
    }
  }

  /* ── Constellation ───────────────────────────── */
  const BASE_POS = [
    {x:14,y:18,t:''},{x:73,y:13,t:'rose'},{x:87,y:40,t:''},
    {x:80,y:70,t:'gold'},{x:54,y:82,t:'rose'},{x:22,y:76,t:''},
    {x:7,y:54,t:'gold'},{x:41,y:16,t:''},{x:62,y:47,t:'rose'},
  ];
  const EXTRA_POS = [
    {x:32,y:35,t:'gold'},{x:68,y:28,t:''},{x:90,y:60,t:'gold'},
    {x:48,y:65,t:''},{x:18,y:40,t:'rose'},{x:75,y:85,t:'gold'},
  ];
  let _nodes = [], _goldMode = false;

  function _buildConstellation() {
    nodeField.innerHTML = ''; _nodes = [];
    BASE_POS.forEach(p => _addNode(p));
    if (hasFeature('gold_nodes')) { _goldMode = true; document.querySelectorAll('.node').forEach(n => { n.classList.remove('rose'); n.classList.add('gold'); }); }
    if (hasFeature('full_constellation')) _addExtraNodes();
    setTimeout(() => _drawConstellation(_goldMode), 120);
    window.addEventListener('resize', () => _drawConstellation(_goldMode), { passive:true });
  }

  function _addNode(pos) {
    const btn = document.createElement('button');
    const t   = _goldMode ? 'gold' : (pos.t || '');
    btn.className = 'node' + (t ? ' '+t : '');
    btn.setAttribute('aria-label', 'Tap for a message');
    const fy = -(6+Math.random()*13), fd = 4+Math.random()*4;
    btn.style.cssText = `left:${pos.x}%;top:${pos.y}%;--fd:${fd}s;--fy:${fy}px;animation-delay:${Math.random()*fd}s`;
    btn.addEventListener('click', handleTap);
    nodeField.appendChild(btn); _nodes.push(btn);
    return btn;
  }

  function _addExtraNodes() {
    EXTRA_POS.forEach(p => {
      const btn = _addNode(p);
      btn.style.opacity = '0'; btn.style.transition = 'opacity 1.2s ease';
      setTimeout(() => { btn.style.opacity = ''; }, 100 + Math.random()*800);
    });
    setTimeout(() => _drawConstellation(_goldMode), 1200);
  }

  function _drawConstellation(gold) {
    if (!canvas || !_nodes.length) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.offsetWidth, H = canvas.height = canvas.offsetHeight;
    ctx.clearRect(0,0,W,H);
    const cr = canvas.getBoundingClientRect();
    const pts = _nodes.map(n => { const r = n.getBoundingClientRect(); return { x:r.left+r.width/2-cr.left, y:r.top+r.height/2-cr.top }; });
    const MAX = Math.min(W,H)*0.44;
    for (let i=0;i<pts.length;i++) for (let j=i+1;j<pts.length;j++) {
      const d = Math.hypot(pts[i].x-pts[j].x, pts[i].y-pts[j].y);
      if (d>MAX) continue;
      ctx.strokeStyle = gold ? `rgba(253,211,77,${(1-d/MAX)*.18})` : `rgba(192,132,252,${(1-d/MAX)*.17})`;
      ctx.lineWidth = .8; ctx.setLineDash([3,6]);
      ctx.beginPath(); ctx.moveTo(pts[i].x,pts[i].y); ctx.lineTo(pts[j].x,pts[j].y); ctx.stroke();
    }
  }

  /* ── Background surprises ────────────────────── */
  function _startSurprises() {
    // Every 20 min, 15% chance — fetch a moment or message from server
    setInterval(async () => {
      if (document.hidden) return;
      if (Math.random() > 0.15) return;
      try {
        const moment = await API.get('/api/moment');
        if (moment) { showMessage(moment); return; }
        await fetchAndShowMessage();
      } catch {}
    }, 20 * 60 * 1000);

    // Voice clip surprise — if voice_memories unlocked, play every ~2hrs
    if (hasFeature('voice_memories')) {
      setInterval(async () => {
        if (document.hidden) return;
        if (Math.random() > 0.20) return;
        try {
          const clip = await API.get('/api/clip/random');
          if (clip && clip.id) {
            const a = new Audio(`/api/clip/${clip.id}/audio`);
            a.play().catch(()=>{});
            showMessage({ t: '🎙 I saved something for you ✦', c: 'voice memory' });
          }
        } catch {}
      }, 2 * 60 * 60 * 1000);
    }
  }

  /* ── Memories (stored locally — private to user) */
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
      const card = document.createElement('div'); card.className = 'mem-card';
      const t = document.createElement('p'); t.className = 'mem-txt'; t.textContent = `"${m.text}"`;
      const d = document.createElement('p'); d.className = 'mem-date'; d.textContent = m.date;
      const x = document.createElement('button'); x.className = 'mem-del'; x.textContent = '✕';
      x.addEventListener('click', () => { localStorage.setItem(MEM_KEY, JSON.stringify(_getMems().filter(i=>i.id!==m.id))); _renderMems(); });
      card.appendChild(t); card.appendChild(d); card.appendChild(x);
      memGrid.appendChild(card);
    });
  }

  /* ── Settings ────────────────────────────────── */
  const SK = 'lb_settings';
  function _loadSettings() { try { return JSON.parse(localStorage.getItem(SK)||'{}'); } catch { return {}; } }
  function _saveSettings(s){ localStorage.setItem(SK, JSON.stringify(s)); }
  function _applySettings(s) {
    ttsEnabled = s.tts !== false;
    if (togVoice) togVoice.checked = ttsEnabled;
    document.body.classList.toggle('light', Boolean(s.light));
    if (togNight) togNight.checked = Boolean(s.light);
    if (togNotif) togNotif.checked = s.notif !== false;
  }

  /* ── Gratitude prompt ────────────────────────── */
  function _showGratitude() { gratInput.value = ''; openOverlay(gratOverlay); }
  $('gratitude-save').addEventListener('click', () => {
    const t = gratInput.value.trim();
    if (t) _saveMem(t);
    localStorage.setItem('lb_ai_last_q', new Date().toDateString());
    closeOverlay(gratOverlay);
  });
  $('gratitude-skip').addEventListener('click', () => {
    localStorage.setItem('lb_ai_last_q', new Date().toDateString());
    closeOverlay(gratOverlay);
  });

  /* ── Admin panel (5-tap trigger) ─────────────── */
  let _tapCount = 0, _tapTimer = null;

  function _attachAdminTrigger(...els) {
    els.forEach(el => {
      if (!el) return;
      el.addEventListener('click', () => {
        _tapCount++;
        clearTimeout(_tapTimer);
        _tapTimer = setTimeout(() => { _tapCount = 0; }, 2000);
        if (_tapCount >= 5) { _tapCount = 0; clearTimeout(_tapTimer); _showAdminPrompt(); }
      });
    });
  }

  function _showAdminPrompt() {
    const existing = document.getElementById('_ap');
    if (existing) existing.remove();
    const wrap = document.createElement('div');
    wrap.id = '_ap';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(5,2,14,.9);backdrop-filter:blur(12px);';
    wrap.innerHTML = `<div style="background:rgba(20,6,45,.98);border:1px solid rgba(192,132,252,.3);border-radius:24px;padding:2rem 1.8rem;width:90%;max-width:320px;text-align:center;box-shadow:0 0 60px rgba(192,132,252,.12);">
      <div style="font-size:1.8rem;margin-bottom:.7rem">🔐</div>
      <p style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:1.1rem;color:#f5e6ff;margin-bottom:1.2rem">Creator access</p>
      <input type="password" id="_apw" placeholder="Enter your password…" style="width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(192,132,252,.3);border-radius:12px;padding:.75rem 1rem;color:#f5e6ff;font-size:.9rem;font-family:'DM Sans',sans-serif;outline:none;margin-bottom:.8rem;box-sizing:border-box;" autocomplete="current-password">
      <p id="_ape" style="color:#ff9090;font-size:.75rem;min-height:1rem;margin-bottom:.6rem"></p>
      <div style="display:flex;gap:.7rem;justify-content:center">
        <button id="_apc" style="padding:.55rem 1.2rem;border-radius:100px;border:1px solid rgba(192,132,252,.2);background:transparent;color:#a78bca;font-size:.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;">Cancel</button>
        <button id="_apo" style="padding:.55rem 1.4rem;border-radius:100px;border:1px solid rgba(192,132,252,.5);background:rgba(192,132,252,.14);color:#f5e6ff;font-size:.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;">Enter ✦</button>
      </div>
    </div>`;
    document.body.appendChild(wrap);
    const input = document.getElementById('_apw');
    setTimeout(() => input.focus(), 100);
    document.getElementById('_apc').addEventListener('click', () => wrap.remove());
    wrap.addEventListener('click', e => { if (e.target === wrap) wrap.remove(); });
    async function tryLogin() {
      if (!input.value) return;
      const err = document.getElementById('_ape');
      try {
        const res = await API.post('/api/admin/login', { password: input.value });
        if (res.token) { API.saveToken(res.token); wrap.remove(); _showAdminPanel(); }
        else { err.textContent = res.error || 'Incorrect password.'; input.value = ''; input.focus(); }
      } catch { err.textContent = 'Server error. Try again.'; }
    }
    document.getElementById('_apo').addEventListener('click', tryLogin);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); if (e.key === 'Escape') wrap.remove(); });
  }

  async function _showAdminPanel() {
    const existing = document.getElementById('_adminPanel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = '_adminPanel';
    panel.className = 'overlay';
    panel.style.cssText = 'z-index:9998;';
    panel.innerHTML = `
    <div class="panel admin-panel">
      <div class="admin-header">
        <span class="admin-badge">🔐 Creator Panel</span>
        <button class="card-x" id="_ac">✕</button>
      </div>
      <div class="admin-tabs">
        <button class="atab active" data-tab="msgs">💌 Messages</button>
        <button class="atab" data-tab="voice">🎙 Voice</button>
        <button class="atab" data-tab="moments">✨ Moments</button>
        <button class="atab" data-tab="pass">🔑 Password</button>
      </div>
      <div class="atab-body" id="_at-msgs">
        <p class="admin-hint">Your private messages — mixed into the surprise pool on the server.</p>
        <div class="admin-input-row">
          <textarea id="_amsg" class="admin-textarea" placeholder="Write something from the heart…" rows="3"></textarea>
        </div>
        <div class="admin-input-row" style="gap:.5rem">
          <select id="_acat" class="admin-select">
            <option value="from you 💌">from you 💌</option>
            <option value="affirmation">affirmation</option>
            <option value="comfort">comfort</option>
            <option value="wonder">wonder</option>
            <option value="night">night</option>
          </select>
          <button class="mbtn" id="_amadd">Add ✦</button>
        </div>
        <div class="admin-list" id="_amlist"></div>
      </div>
      <div class="atab-body hidden" id="_at-voice">
        <p class="admin-hint">Your private voice recordings — stored on the server, never exposed to the browser.</p>
        <div class="vm-drop" id="_adrop">
          <input type="file" id="_afile" accept="audio/*" multiple>
          <div class="vm-drop-icon">🎤</div>
          <div class="vm-drop-txt">Drop recordings here or tap to browse</div>
          <div class="vm-drop-sub">.mp3 · .wav · .ogg (max 5 MB)</div>
        </div>
        <div class="admin-list" id="_aclist"></div>
      </div>
      <div class="atab-body hidden" id="_at-moments">
        <p class="admin-hint">Surprise "thinking of you" lines — appear automatically in the background.</p>
        <div class="admin-input-row">
          <textarea id="_amom" class="admin-textarea" placeholder='e.g. "I was just thinking about you 🌙"' rows="2"></textarea>
          <button class="mbtn" id="_amomadd" style="align-self:flex-end">Add ✦</button>
        </div>
        <div class="admin-list" id="_amomlist"></div>
      </div>
      <div class="atab-body hidden" id="_at-pass">
        <p class="admin-hint">Change your password. Stored as bcrypt hash on the server — completely unreadable.</p>
        <div class="admin-input-row" style="flex-direction:column;gap:.7rem">
          <input type="password" id="_apnew" class="admin-input" placeholder="New password…" autocomplete="new-password">
          <input type="password" id="_apcon" class="admin-input" placeholder="Confirm…" autocomplete="new-password">
          <button class="mbtn" id="_apsave">Save password ✦</button>
        </div>
        <p class="admin-pass-msg hidden" id="_apmsg"></p>
      </div>
      <button class="panel-close" id="_adone">Done ✦</button>
    </div>`;

    document.body.appendChild(panel);
    panel.addEventListener('click', e => { if (e.target === panel) panel.remove(); });
    document.getElementById('_ac').addEventListener('click',    () => panel.remove());
    document.getElementById('_adone').addEventListener('click', () => panel.remove());

    // Tabs
    panel.querySelectorAll('.atab').forEach(btn => {
      btn.addEventListener('click', () => {
        panel.querySelectorAll('.atab').forEach(b => b.classList.remove('active'));
        panel.querySelectorAll('.atab-body').forEach(b => b.classList.add('hidden'));
        btn.classList.add('active');
        document.getElementById('_at-' + btn.dataset.tab).classList.remove('hidden');
      });
    });

    // Load and render data
    await _loadAdminMsgs();
    await _loadAdminClips();
    await _loadAdminMoments();

    // Add message
    document.getElementById('_amadd').addEventListener('click', async () => {
      const t = document.getElementById('_amsg').value.trim();
      const c = document.getElementById('_acat').value;
      if (!t) return;
      await API.post('/api/admin/messages', { text: t, category: c });
      document.getElementById('_amsg').value = '';
      await _loadAdminMsgs();
    });

    // Voice drop
    const dropEl = document.getElementById('_adrop');
    const fileEl = document.getElementById('_afile');
    dropEl.addEventListener('dragover', e => { e.preventDefault(); dropEl.classList.add('over'); });
    dropEl.addEventListener('dragleave', () => dropEl.classList.remove('over'));
    dropEl.addEventListener('drop', async e => { e.preventDefault(); dropEl.classList.remove('over'); await _uploadClips(e.dataTransfer.files); });
    fileEl.addEventListener('change', async e => { await _uploadClips(e.target.files); e.target.value = ''; });

    // Add moment
    document.getElementById('_amomadd').addEventListener('click', async () => {
      const t = document.getElementById('_amom').value.trim();
      if (!t) return;
      await API.post('/api/admin/moments', { text: t });
      document.getElementById('_amom').value = '';
      await _loadAdminMoments();
    });

    // Password
    document.getElementById('_apsave').addEventListener('click', async () => {
      const a = document.getElementById('_apnew').value;
      const b = document.getElementById('_apcon').value;
      const m = document.getElementById('_apmsg');
      m.classList.remove('hidden');
      if (!a || a.length < 4) { m.textContent = 'Min 4 characters.'; m.style.color='#ff9090'; return; }
      if (a !== b)             { m.textContent = 'Passwords don\'t match.'; m.style.color='#ff9090'; return; }
      const res = await API.put('/api/admin/password', { newPassword: a });
      if (res.ok) { m.textContent = 'Password updated ✦'; m.style.color='var(--violet)'; document.getElementById('_apnew').value=''; document.getElementById('_apcon').value=''; }
      else        { m.textContent = res.error || 'Error.'; m.style.color='#ff9090'; }
    });
  }

  async function _loadAdminMsgs() {
    const msgs = await API.get('/api/admin/messages').catch(()=>[]);
    const el   = document.getElementById('_amlist');
    if (!el) return;
    el.innerHTML = '';
    if (!msgs.length) { el.innerHTML = '<p class="admin-empty">No messages yet.</p>'; return; }
    msgs.forEach(m => {
      const row = document.createElement('div'); row.className = 'admin-item';
      const w   = document.createElement('div'); w.className = 'admin-item-txt';
      const cat = document.createElement('span'); cat.className = 'admin-item-cat'; cat.textContent = `— ${m.category} —`;
      const txt = document.createElement('span'); txt.textContent = m.text;
      w.appendChild(cat); w.appendChild(txt);
      const del = document.createElement('button'); del.className = 'vm-del'; del.textContent = '✕';
      del.addEventListener('click', async () => { await API.del(`/api/admin/messages/${m.id}`); await _loadAdminMsgs(); });
      row.appendChild(w); row.appendChild(del); el.appendChild(row);
    });
  }

  async function _uploadClips(files) {
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('audio/')) { alert(`"${f.name}" is not an audio file.`); continue; }
      if (f.size > 5*1024*1024)         { alert(`"${f.name}" exceeds 5 MB.`); continue; }
      await API.uploadAudio(f);
    }
    await _loadAdminClips();
  }

  async function _loadAdminClips() {
    const clips = await API.get('/api/admin/clips').catch(()=>[]);
    const el    = document.getElementById('_aclist');
    if (!el) return;
    el.innerHTML = '';
    if (!clips.length) { el.innerHTML = '<p class="admin-empty">No clips yet.</p>'; return; }
    clips.forEach(c => {
      const row = document.createElement('div'); row.className = 'admin-item';
      const w   = document.createElement('div'); w.className = 'admin-item-txt';
      const n   = document.createElement('span'); n.textContent = `🎤 ${c.originalName}`;
      w.appendChild(n);
      const play = document.createElement('button'); play.className = 'vm-play'; play.textContent = '▶'; play.title = 'Preview';
      play.addEventListener('click', () => { const a = new Audio(`/api/clip/${c.id}/audio`); a.play().catch(()=>{}); });
      const del = document.createElement('button'); del.className = 'vm-del'; del.textContent = '✕';
      del.addEventListener('click', async () => { await API.del(`/api/admin/clips/${c.id}`); await _loadAdminClips(); });
      row.appendChild(w); row.appendChild(play); row.appendChild(del); el.appendChild(row);
    });
  }

  async function _loadAdminMoments() {
    const moments = await API.get('/api/admin/moments').catch(()=>[]);
    const el      = document.getElementById('_amomlist');
    if (!el) return;
    el.innerHTML = '';
    if (!moments.length) { el.innerHTML = '<p class="admin-empty">No moments yet.</p>'; return; }
    moments.forEach(m => {
      const row = document.createElement('div'); row.className = 'admin-item';
      const w   = document.createElement('div'); w.className = 'admin-item-txt';
      const t   = document.createElement('span'); t.textContent = m.text;
      w.appendChild(t);
      const del = document.createElement('button'); del.className = 'vm-del'; del.textContent = '✕';
      del.addEventListener('click', async () => { await API.del(`/api/admin/moments/${m.id}`); await _loadAdminMoments(); });
      row.appendChild(w); row.appendChild(del); el.appendChild(row);
    });
  }

  /* ── Boot ────────────────────────────────────── */
  function boot() {
    _applySettings(_loadSettings());
    showScreen(splashScreen);
    _attachAdminTrigger($('splash-title'), $('bot-name'));
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./pwa/service-worker.js').catch(()=>{});
  }

  $('btn-start').addEventListener('click', () => {
    if (localStorage.getItem('lb_mood_set') === 'true') { _initMain(); showScreen(mainScreen); }
    else showScreen(moodScreen);
  });

  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentMood = btn.dataset.mood;
      localStorage.setItem('lb_mood', currentMood);
      localStorage.setItem('lb_mood_set', 'true');
      _initMain(); showScreen(mainScreen);
    });
  });

  function _initMain() {
    if (mainReady) return;
    mainReady = true;
    const MOOD_EMOJI = { happy:'🌸', neutral:'🌙', sad:'🌧', stressed:'🌀' };
    const STATUS     = { happy:['Feeling your energy ✦','Glowing with you 🌸'], neutral:['Here for you ✦','Always beside you 🌙'], sad:['Sitting with you 🌧','Holding space for you'], stressed:['Breathe with me 🌀','One step at a time ✦'] };
    moodIcon.textContent  = MOOD_EMOJI[currentMood] || '🌸';
    botStatus.textContent = (STATUS[currentMood]||STATUS.neutral)[Math.floor(Math.random()*2)];
    _updateStats();
    _applySettings(_loadSettings());
    _buildConstellation();
    _applyAllUnlocks();
    _startSurprises();
    if (localStorage.getItem('lb_ai_last_q') !== new Date().toDateString()) setTimeout(() => _showGratitude(), 10000);
  }

  $('orb').addEventListener('click', handleTap);
  $('btn-mood-change').addEventListener('click', () => showScreen(moodScreen));
  $('btn-memories').addEventListener('click', () => { _renderMems(); openOverlay(memOverlay); });
  $('btn-settings').addEventListener('click', () => { _applySettings(_loadSettings()); openOverlay(setOverlay); });
  $('msg-close').addEventListener('click', () => closeOverlay(msgOverlay));
  $('mem-close').addEventListener('click', () => closeOverlay(memOverlay));
  $('ul-close').addEventListener('click',  () => closeOverlay(ulOverlay));

  btnVoice.addEventListener('click', () => {
    if (!currentMsg) return;
    if (window.speechSynthesis?.speaking) stopVoice();
    else speakText(currentMsg.t, currentMsg.c);
  });
  btnSave.addEventListener('click', () => {
    if (!currentMsg) return;
    _saveMem(currentMsg.t); btnSave.textContent = '✓ Saved!'; btnSave.disabled = true;
  });

  $('set-close').addEventListener('click', () => {
    const s = { tts: togVoice.checked, light: togNight.checked, notif: togNotif.checked };
    _applySettings(s); _saveSettings(s); closeOverlay(setOverlay);
  });
  togNight.addEventListener('change', () => document.body.classList.toggle('light', togNight.checked));
  $('btn-reset').addEventListener('click', () => { if (!confirm('Reset all data?')) return; localStorage.clear(); location.reload(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
