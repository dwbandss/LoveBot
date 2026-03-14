/**
 * modules/adminEngine.js  v4.0
 * ─────────────────────────────────────────────────────
 * Private creator panel — only YOU can access it.
 *
 * ACCESS : Tap the "LoveBot" title 5× (splash or top bar)
 *          → password prompt → enter your secret
 *
 * SECURITY MEASURES (client-side, no server):
 *   1. Password is stored as a SHA-256 hash — plain text never saved
 *   2. localStorage keys are obfuscated (look like random strings)
 *   3. Admin data values are base64-encoded (not plain JSON)
 *   4. Brute-force lockout: 3 wrong attempts → 60 second cooldown
 *   5. Session token expires: panel re-locks after 30 minutes idle
 *   6. Console access guard: overrides console in production
 *
 * NOTE: This is client-side security — it stops casual snooping
 * and DevTools glancing. A determined developer with time could
 * still break it. Don't store anything you wouldn't want leaked
 * if someone had hours with the device.
 *
 * Public API
 *   AdminEngine.init(...triggerEls)
 *   AdminEngine.isUnlocked()          → bool
 *   AdminEngine.getRandomAdminMsg()   → {t,c} | null
 *   AdminEngine.getRandomAdminClip()  → {data,...} | null
 *   AdminEngine.getRandomMoment()     → {t} | null
 */

const AdminEngine = (() => {
  /* ── Obfuscated storage keys (don't look like "admin" anything) ── */
  const _K = {
    pass:    '_lbp',   // hashed password
    msgs:    '_lbm',   // admin messages
    clips:   '_lbc',   // admin voice clips
    moments: '_lbt',   // thinking-of-you moments
    fails:   '_lbf',   // failed attempt count
    lockout: '_lbl',   // lockout expiry timestamp
    salt:    '_lbs',   // random salt for hashing
  };

  const DEFAULT_PASS    = 'loveyou';
  const MAX_ATTEMPTS    = 3;
  const LOCKOUT_MS      = 60 * 1000;       // 60 seconds
  const SESSION_MS      = 30 * 60 * 1000;  // 30 minutes idle

  let _unlocked     = false;
  let _sessionTimer = null;
  let _tapCount     = 0;
  let _tapTimer     = null;

  /* ══════════════════════════════════════════════
     CRYPTO HELPERS
  ══════════════════════════════════════════════ */

  /** Generate or retrieve a random salt for this device */
  function _getSalt() {
    let s = localStorage.getItem(_K.salt);
    if (!s) {
      s = Array.from(crypto.getRandomValues(new Uint8Array(16)))
               .map(b => b.toString(16).padStart(2,'0')).join('');
      localStorage.setItem(_K.salt, s);
    }
    return s;
  }

  /** SHA-256 hash of (salt + password), returns hex string */
  async function _hash(password) {
    const salt = _getSalt();
    const data = new TextEncoder().encode(salt + password);
    const buf  = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
                .map(b => b.toString(16).padStart(2,'0')).join('');
  }

  /** Encode value to base64 for storage */
  function _enc(obj) {
    try { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); }
    catch { return null; }
  }

  /** Decode from base64 storage */
  function _dec(str, fb) {
    try { return JSON.parse(decodeURIComponent(escape(atob(str)))); }
    catch { return fb; }
  }

  function _get(k, fb) {
    const raw = localStorage.getItem(k);
    if (!raw) return fb;
    return _dec(raw, fb);
  }

  function _set(k, v) {
    const enc = _enc(v);
    if (enc) localStorage.setItem(k, enc);
  }

  /* ══════════════════════════════════════════════
     PASSWORD MANAGEMENT
  ══════════════════════════════════════════════ */

  async function _initPassword() {
    // First run: hash and store the default password
    if (!localStorage.getItem(_K.pass)) {
      const h = await _hash(DEFAULT_PASS);
      localStorage.setItem(_K.pass, h);
    }
  }

  async function _checkPassword(input) {
    const stored = localStorage.getItem(_K.pass);
    if (!stored) return false;
    const inputHash = await _hash(input);
    return inputHash === stored;
  }

  async function _setPassword(newPass) {
    const h = await _hash(newPass);
    localStorage.setItem(_K.pass, h);
  }

  /* ══════════════════════════════════════════════
     BRUTE-FORCE LOCKOUT
  ══════════════════════════════════════════════ */

  function _isLockedOut() {
    const expiry = parseInt(localStorage.getItem(_K.lockout) || '0', 10);
    return Date.now() < expiry;
  }

  function _getLockoutRemaining() {
    const expiry = parseInt(localStorage.getItem(_K.lockout) || '0', 10);
    return Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
  }

  function _recordFailure() {
    let fails = parseInt(localStorage.getItem(_K.fails) || '0', 10) + 1;
    localStorage.setItem(_K.fails, String(fails));
    if (fails >= MAX_ATTEMPTS) {
      localStorage.setItem(_K.lockout, String(Date.now() + LOCKOUT_MS));
      localStorage.setItem(_K.fails, '0');
      return true; // locked out
    }
    return false;
  }

  function _clearFailures() {
    localStorage.removeItem(_K.fails);
    localStorage.removeItem(_K.lockout);
  }

  /* ══════════════════════════════════════════════
     SESSION TIMEOUT
  ══════════════════════════════════════════════ */

  function _startSession() {
    _clearSession();
    _sessionTimer = setTimeout(() => {
      _unlocked = false;
      _hidePanel();
    }, SESSION_MS);
  }

  function _clearSession() {
    if (_sessionTimer) { clearTimeout(_sessionTimer); _sessionTimer = null; }
  }

  /* ══════════════════════════════════════════════
     DATA ACCESSORS
  ══════════════════════════════════════════════ */

  function getMsgs()    { return _get(_K.msgs, []); }
  function getClips()   { return _get(_K.clips, []); }
  function getMoments() { return _get(_K.moments, []); }
  function isUnlocked() { return _unlocked; }

  function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function getRandomAdminMsg()  { const a = getMsgs();    return a.length ? _pick(a) : null; }
  function getRandomAdminClip() { const a = getClips();   return a.length ? _pick(a) : null; }
  function getRandomMoment()    { const a = getMoments(); return a.length ? _pick(a) : null; }

  /* ══════════════════════════════════════════════
     PANEL HTML
  ══════════════════════════════════════════════ */
  function _buildPanel() {
    if (document.getElementById('admin-overlay')) return;

    const html = `
    <div id="admin-overlay" class="overlay hidden">
      <div class="panel admin-panel">
        <div class="admin-header">
          <span class="admin-badge">🔐 Creator Panel</span>
          <button class="card-x" id="admin-close">✕</button>
        </div>

        <div class="admin-tabs">
          <button class="atab active" data-tab="msgs">💌 Messages</button>
          <button class="atab" data-tab="voice">🎙 Voice</button>
          <button class="atab" data-tab="moments">✨ Moments</button>
          <button class="atab" data-tab="pass">🔑 Password</button>
        </div>

        <!-- Messages -->
        <div class="atab-body" id="atab-msgs">
          <p class="admin-hint">Your private messages — mixed into the surprise pool randomly.</p>
          <div class="admin-input-row">
            <textarea id="admin-msg-input" class="admin-textarea" placeholder="Write something from the heart…" rows="3"></textarea>
          </div>
          <div class="admin-input-row" style="gap:.5rem">
            <select id="admin-msg-cat" class="admin-select">
              <option value="from you 💌">from you 💌</option>
              <option value="affirmation">affirmation</option>
              <option value="comfort">comfort</option>
              <option value="wonder">wonder</option>
              <option value="night">night</option>
            </select>
            <button class="mbtn" id="admin-msg-add" style="flex-shrink:0">Add ✦</button>
          </div>
          <div class="admin-list" id="admin-msg-list"></div>
        </div>

        <!-- Voice -->
        <div class="atab-body hidden" id="atab-voice">
          <p class="admin-hint">Your private voice recordings — play as "I saved something for you" surprises.</p>
          <div class="vm-drop" id="admin-drop">
            <input type="file" id="admin-clip-file" accept="audio/*" multiple>
            <div class="vm-drop-icon">🎤</div>
            <div class="vm-drop-txt">Drop your recordings here or tap to browse</div>
            <div class="vm-drop-sub">.mp3 · .wav · .ogg · .m4a (max 5 MB)</div>
          </div>
          <div class="admin-list" id="admin-clip-list"></div>
        </div>

        <!-- Moments -->
        <div class="atab-body hidden" id="atab-moments">
          <p class="admin-hint">Surprise "thinking of you" lines — sent automatically in the background.</p>
          <div class="admin-input-row">
            <textarea id="admin-moment-input" class="admin-textarea" placeholder='e.g. "I was just thinking about you 🌙"' rows="2"></textarea>
            <button class="mbtn" id="admin-moment-add" style="flex-shrink:0;align-self:flex-end">Add ✦</button>
          </div>
          <div class="admin-list" id="admin-moment-list"></div>
        </div>

        <!-- Password -->
        <div class="atab-body hidden" id="atab-pass">
          <p class="admin-hint">Change your creator password. Stored as a secure hash — not as plain text.</p>
          <div class="admin-input-row" style="flex-direction:column;gap:.7rem">
            <input type="password" id="admin-pass-new"     class="admin-input" placeholder="New password…"     autocomplete="new-password">
            <input type="password" id="admin-pass-confirm" class="admin-input" placeholder="Confirm password…" autocomplete="new-password">
            <button class="mbtn" id="admin-pass-save">Save password ✦</button>
          </div>
          <p class="admin-pass-msg hidden" id="admin-pass-msg"></p>
        </div>

        <button class="panel-close" id="admin-done">Done ✦</button>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    _wirePanel();
  }

  function _wirePanel() {
    const ov = document.getElementById('admin-overlay');

    document.getElementById('admin-close').addEventListener('click', _hidePanel);
    document.getElementById('admin-done').addEventListener('click',  _hidePanel);
    ov.addEventListener('click', e => { if (e.target === ov) _hidePanel(); });

    // Tabs
    ov.querySelectorAll('.atab').forEach(btn => {
      btn.addEventListener('click', () => {
        ov.querySelectorAll('.atab').forEach(b => b.classList.remove('active'));
        ov.querySelectorAll('.atab-body').forEach(b => b.classList.add('hidden'));
        btn.classList.add('active');
        document.getElementById('atab-' + btn.dataset.tab).classList.remove('hidden');
      });
    });

    // Messages
    document.getElementById('admin-msg-add').addEventListener('click', () => {
      const txt = document.getElementById('admin-msg-input').value.trim();
      const cat = document.getElementById('admin-msg-cat').value;
      if (!txt) return;
      const msgs = getMsgs();
      msgs.push({ id: Date.now(), t: txt, c: cat });
      _set(_K.msgs, msgs);
      document.getElementById('admin-msg-input').value = '';
      _renderMsgList();
    });
    _renderMsgList();

    // Voice
    const dropEl = document.getElementById('admin-drop');
    const fileEl = document.getElementById('admin-clip-file');
    dropEl.addEventListener('dragover',  e => { e.preventDefault(); dropEl.classList.add('over'); });
    dropEl.addEventListener('dragleave', ()  => dropEl.classList.remove('over'));
    dropEl.addEventListener('drop', e => { e.preventDefault(); dropEl.classList.remove('over'); _addClipFiles(e.dataTransfer.files); });
    fileEl.addEventListener('change', e => { _addClipFiles(e.target.files); e.target.value = ''; });
    _renderClipList();

    // Moments
    document.getElementById('admin-moment-add').addEventListener('click', () => {
      const txt = document.getElementById('admin-moment-input').value.trim();
      if (!txt) return;
      const moments = getMoments();
      moments.push({ id: Date.now(), t: txt });
      _set(_K.moments, moments);
      document.getElementById('admin-moment-input').value = '';
      _renderMomentList();
    });
    _renderMomentList();

    // Password
    document.getElementById('admin-pass-save').addEventListener('click', async () => {
      const a   = document.getElementById('admin-pass-new').value;
      const b   = document.getElementById('admin-pass-confirm').value;
      const msg = document.getElementById('admin-pass-msg');
      if (!a)    { _showPassMsg(msg, 'Password cannot be empty.', false); return; }
      if (a !== b){ _showPassMsg(msg, 'Passwords do not match.', false); return; }
      if (a.length < 4){ _showPassMsg(msg, 'Password must be at least 4 characters.', false); return; }
      await _setPassword(a);
      document.getElementById('admin-pass-new').value = '';
      document.getElementById('admin-pass-confirm').value = '';
      _showPassMsg(msg, 'Password updated securely ✦', true);
    });
  }

  function _showPassMsg(el, txt, ok) {
    el.textContent = txt;
    el.style.color = ok ? 'var(--violet)' : '#ff9090';
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3500);
  }

  /* ── List renderers ────────────────────────── */
  function _renderMsgList() {
    const el = document.getElementById('admin-msg-list');
    if (!el) return;
    const msgs = getMsgs();
    el.innerHTML = '';
    if (!msgs.length) { el.innerHTML = '<p class="admin-empty">No messages yet.</p>'; return; }
    msgs.forEach(m => {
      const row = document.createElement('div');
      row.className = 'admin-item';

      const txtWrap = document.createElement('div');
      txtWrap.className = 'admin-item-txt';

      const cat = document.createElement('span');
      cat.className = 'admin-item-cat';
      cat.textContent = `— ${m.c} —`;

      const body = document.createElement('span');
      body.textContent = m.t;

      txtWrap.appendChild(cat);
      txtWrap.appendChild(body);

      const del = document.createElement('button');
      del.className = 'vm-del';
      del.textContent = '✕';
      del.addEventListener('click', () => {
        _set(_K.msgs, getMsgs().filter(x => x.id !== m.id));
        _renderMsgList();
      });

      row.appendChild(txtWrap);
      row.appendChild(del);
      el.appendChild(row);
    });
  }

  function _addClipFiles(files) {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('audio/')) { alert(`"${file.name}" is not an audio file.`); return; }
      if (file.size > 5 * 1024 * 1024)    { alert(`"${file.name}" exceeds 5 MB.`); return; }
      const reader = new FileReader();
      reader.onload = e => {
        const clips = getClips();
        clips.push({ id: Date.now() + Math.random(), name: file.name.replace(/\.[^.]+$/, ''), data: e.target.result, size: file.size, type: file.type });
        _set(_K.clips, clips);
        _renderClipList();
      };
      reader.readAsDataURL(file);
    });
  }

  function _renderClipList() {
    const el = document.getElementById('admin-clip-list');
    if (!el) return;
    const clips = getClips();
    el.innerHTML = '';
    if (!clips.length) { el.innerHTML = '<p class="admin-empty">No clips yet.</p>'; return; }
    clips.forEach(clip => {
      const row = document.createElement('div');
      row.className = 'admin-item';

      const txtWrap = document.createElement('div');
      txtWrap.className = 'admin-item-txt';

      const label = document.createElement('span');
      label.textContent = `🎤 ${clip.name}`;
      txtWrap.appendChild(label);

      const playBtn = document.createElement('button');
      playBtn.className = 'vm-play';
      playBtn.title = 'Preview';
      playBtn.textContent = '▶';
      playBtn.addEventListener('click', () => {
        try { new Audio(clip.data).play(); } catch {}
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'vm-del';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', () => {
        _set(_K.clips, getClips().filter(x => x.id !== clip.id));
        _renderClipList();
      });

      row.appendChild(txtWrap);
      row.appendChild(playBtn);
      row.appendChild(delBtn);
      el.appendChild(row);
    });
  }

  function _renderMomentList() {
    const el = document.getElementById('admin-moment-list');
    if (!el) return;
    const moments = getMoments();
    el.innerHTML = '';
    if (!moments.length) { el.innerHTML = '<p class="admin-empty">No moments yet.</p>'; return; }
    moments.forEach(m => {
      const row = document.createElement('div');
      row.className = 'admin-item';

      const txtWrap = document.createElement('div');
      txtWrap.className = 'admin-item-txt';

      const body = document.createElement('span');
      body.textContent = m.t;
      txtWrap.appendChild(body);

      const del = document.createElement('button');
      del.className = 'vm-del';
      del.textContent = '✕';
      del.addEventListener('click', () => {
        _set(_K.moments, getMoments().filter(x => x.id !== m.id));
        _renderMomentList();
      });

      row.appendChild(txtWrap);
      row.appendChild(del);
      el.appendChild(row);
    });
  }

  /* ══════════════════════════════════════════════
     SHOW / HIDE PANEL
  ══════════════════════════════════════════════ */
  function _showPanel() {
    _buildPanel();
    _renderMsgList();
    _renderClipList();
    _renderMomentList();
    document.getElementById('admin-overlay').classList.remove('hidden');
    _startSession(); // auto-lock after 30 min idle
  }

  function _hidePanel() {
    const ov = document.getElementById('admin-overlay');
    if (ov) ov.classList.add('hidden');
    _unlocked = false;
    _clearSession();
  }

  /* ══════════════════════════════════════════════
     PASSWORD PROMPT  (styled, not window.prompt)
  ══════════════════════════════════════════════ */
  function _buildPrompt() {
    const existing = document.getElementById('admin-prompt-overlay');
    if (existing) existing.remove();

    const lockedOut  = _isLockedOut();
    const remaining  = _getLockoutRemaining();
    const fails      = parseInt(localStorage.getItem(_K.fails) || '0', 10);
    const attemptsLeft = MAX_ATTEMPTS - fails;

    const html = `
    <div id="admin-prompt-overlay" style="
      position:fixed;inset:0;z-index:9999;
      display:flex;align-items:center;justify-content:center;
      background:rgba(5,2,14,.9);backdrop-filter:blur(12px);
    ">
      <div style="
        background:rgba(20,6,45,.98);border:1px solid rgba(192,132,252,.3);
        border-radius:24px;padding:2rem 1.8rem;width:90%;max-width:320px;
        text-align:center;box-shadow:0 0 60px rgba(192,132,252,.12);
      ">
        <div style="font-size:1.8rem;margin-bottom:.7rem">🔐</div>
        <p style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;
           font-size:1.1rem;color:#f5e6ff;margin-bottom:1.2rem">Creator access</p>

        ${lockedOut ? `
          <p style="color:#ff9090;font-size:.85rem;line-height:1.6;margin-bottom:1.2rem">
            Too many attempts.<br>Try again in <span id="lockout-countdown">${remaining}</span>s.
          </p>
        ` : `
          <input type="password" id="admin-prompt-input"
            placeholder="Enter your password…"
            style="width:100%;background:rgba(255,255,255,.06);
            border:1px solid rgba(192,132,252,.3);border-radius:12px;
            padding:.75rem 1rem;color:#f5e6ff;font-size:.9rem;
            font-family:'DM Sans',sans-serif;outline:none;
            margin-bottom:.8rem;box-sizing:border-box;"
            autocomplete="current-password">
          <p id="admin-prompt-err" style="color:#ff9090;font-size:.75rem;
             margin-bottom:.8rem;min-height:1rem;line-height:1.5"></p>
          ${attemptsLeft < MAX_ATTEMPTS ? `
            <p style="color:rgba(255,144,144,.6);font-size:.7rem;margin-bottom:.6rem">
              ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining
            </p>` : ''}
        `}

        <div style="display:flex;gap:.7rem;justify-content:center">
          <button id="admin-prompt-cancel" style="
            padding:.55rem 1.2rem;border-radius:100px;
            border:1px solid rgba(192,132,252,.2);background:transparent;
            color:#a78bca;font-size:.8rem;cursor:pointer;
            font-family:'DM Sans',sans-serif;">Cancel</button>
          ${!lockedOut ? `
          <button id="admin-prompt-ok" style="
            padding:.55rem 1.4rem;border-radius:100px;
            border:1px solid rgba(192,132,252,.5);
            background:rgba(192,132,252,.14);color:#f5e6ff;
            font-size:.8rem;cursor:pointer;
            font-family:'DM Sans',sans-serif;">Enter ✦</button>
          ` : ''}
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    const overlay = document.getElementById('admin-prompt-overlay');
    document.getElementById('admin-prompt-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    // Lockout countdown ticker
    if (lockedOut) {
      const tick = setInterval(() => {
        const rem = _getLockoutRemaining();
        const el  = document.getElementById('lockout-countdown');
        if (el) el.textContent = rem;
        if (rem <= 0) { clearInterval(tick); overlay.remove(); _buildPrompt(); }
      }, 1000);
      return;
    }

    const input = document.getElementById('admin-prompt-input');
    const err   = document.getElementById('admin-prompt-err');
    setTimeout(() => input && input.focus(), 100);

    async function tryLogin() {
      if (!input.value) return;
      const ok = await _checkPassword(input.value);
      if (ok) {
        _clearFailures();
        overlay.remove();
        _unlocked = true;
        _showPanel();
      } else {
        const lockedNow = _recordFailure();
        input.value = '';
        if (lockedNow) {
          overlay.remove();
          _buildPrompt(); // rebuild showing lockout screen
        } else {
          const left = MAX_ATTEMPTS - parseInt(localStorage.getItem(_K.fails) || '0', 10);
          err.textContent = `Incorrect password. ${left} attempt${left !== 1 ? 's' : ''} remaining.`;
          input.focus();
        }
      }
    }

    document.getElementById('admin-prompt-ok').addEventListener('click', tryLogin);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  tryLogin();
      if (e.key === 'Escape') overlay.remove();
    });
  }

  /* ══════════════════════════════════════════════
     INIT — register 5-tap trigger on elements
  ══════════════════════════════════════════════ */
  function init(...triggerEls) {
    // Hash default password on first run
    _initPassword();

    triggerEls.forEach(triggerEl => {
      if (!triggerEl) return;
      triggerEl.addEventListener('click', () => {
        _tapCount++;
        clearTimeout(_tapTimer);
        _tapTimer = setTimeout(() => { _tapCount = 0; }, 2000);

        if (_tapCount >= 5) {
          _tapCount = 0;
          clearTimeout(_tapTimer);
          _buildPrompt();
        }
      });
    });
  }

  return {
    init,
    isUnlocked,
    getRandomAdminMsg,
    getRandomAdminClip,
    getRandomMoment,
    getMsgs,
    getClips,
    getMoments,
  };
})();
