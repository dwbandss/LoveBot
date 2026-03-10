/**
 * modules/adminEngine.js
 * ─────────────────────────────────────────────────────
 * Private creator panel — only YOU can access it.
 *
 * ACCESS:  Tap the LoveBot logo/title on the splash screen 5× rapidly
 *          → password prompt appears → enter your secret code.
 *
 * What you can do inside:
 *   • Add private custom text messages (injected into the message pool)
 *   • Upload your own voice clips (base64, same as voiceManager but private)
 *   • Write private "thinking of you" moments
 *   • Set / change the admin password
 *
 * The recipient NEVER sees this panel — there is no button visible to them.
 *
 * Public API
 *   AdminEngine.init(triggerEl)   — attach the 5-tap listener to triggerEl
 *   AdminEngine.isUnlocked()      — bool, true after correct password
 */

const AdminEngine = (() => {
  const PASS_KEY     = 'lb_admin_pass';
  const MSGS_KEY     = 'lb_admin_msgs';
  const CLIPS_KEY    = 'lb_admin_clips';
  const MOMENTS_KEY  = 'lb_admin_moments';
  const DEFAULT_PASS = 'loveyou';   // change this first thing in the panel

  let _unlocked = false;
  let _tapCount = 0;
  let _tapTimer = null;

  /* ══════════════════════════════════════════════
     STORAGE HELPERS
  ══════════════════════════════════════════════ */
  function _get(k, fb) { try { const r=localStorage.getItem(k); return r!=null?JSON.parse(r):fb; } catch { return fb; } }
  function _set(k, v)  { try { localStorage.setItem(k,JSON.stringify(v)); } catch { alert('Storage full — remove some clips.'); } }

  function getPassword()  { return localStorage.getItem(PASS_KEY) || DEFAULT_PASS; }
  function getMsgs()      { return _get(MSGS_KEY, []); }
  function getClips()     { return _get(CLIPS_KEY, []); }
  function getMoments()   { return _get(MOMENTS_KEY, []); }

  /* ══════════════════════════════════════════════
     PUBLIC ACCESSORS (used by other modules)
  ══════════════════════════════════════════════ */
  function isUnlocked() { return _unlocked; }

  /** Returns a random admin message if any exist, else null */
  function getRandomAdminMsg() {
    const msgs = getMsgs();
    if (!msgs.length) return null;
    return msgs[Math.floor(Math.random() * msgs.length)];
  }

  /** Returns a random admin voice clip if any exist, else null */
  function getRandomAdminClip() {
    const clips = getClips();
    if (!clips.length) return null;
    return clips[Math.floor(Math.random() * clips.length)];
  }

  /** Returns a random "thinking of you" moment if any exist, else null */
  function getRandomMoment() {
    const moments = getMoments();
    if (!moments.length) return null;
    return moments[Math.floor(Math.random() * moments.length)];
  }

  /* ══════════════════════════════════════════════
     PANEL HTML  (injected into body on demand)
  ══════════════════════════════════════════════ */
  function _buildPanel() {
    if (document.getElementById('admin-overlay')) return; // already built

    const html = `
    <div id="admin-overlay" class="overlay hidden">
      <div class="panel admin-panel">
        <div class="admin-header">
          <span class="admin-badge">🔐 Creator Panel</span>
          <button class="card-x" id="admin-close">✕</button>
        </div>

        <!-- TABS -->
        <div class="admin-tabs">
          <button class="atab active" data-tab="msgs">💌 Messages</button>
          <button class="atab" data-tab="voice">🎙 Voice</button>
          <button class="atab" data-tab="moments">✨ Moments</button>
          <button class="atab" data-tab="pass">🔑 Password</button>
        </div>

        <!-- TAB: MESSAGES -->
        <div class="atab-body" id="atab-msgs">
          <p class="admin-hint">Write private messages only you compose. They mix into the message pool randomly.</p>
          <div class="admin-input-row">
            <textarea id="admin-msg-input" class="admin-textarea" placeholder="Write something from the heart…" rows="3"></textarea>
          </div>
          <div class="admin-input-row" style="gap:.5rem">
            <select id="admin-msg-cat" class="admin-select">
              <option value="from you">from you 💌</option>
              <option value="affirmation">affirmation</option>
              <option value="comfort">comfort</option>
              <option value="wonder">wonder</option>
              <option value="night">night</option>
            </select>
            <button class="mbtn" id="admin-msg-add" style="flex-shrink:0">Add ✦</button>
          </div>
          <div class="admin-list" id="admin-msg-list"></div>
        </div>

        <!-- TAB: VOICE CLIPS -->
        <div class="atab-body hidden" id="atab-voice">
          <p class="admin-hint">Upload your private voice clips. These play as special "I saved something for you" moments.</p>
          <div class="vm-drop" id="admin-drop">
            <input type="file" id="admin-clip-file" accept="audio/*" multiple>
            <div class="vm-drop-icon">🎤</div>
            <div class="vm-drop-txt">Drop your voice recordings here</div>
            <div class="vm-drop-sub">.mp3 · .wav · .ogg · .m4a (max 5 MB)</div>
          </div>
          <div class="admin-list" id="admin-clip-list"></div>
        </div>

        <!-- TAB: THINKING OF YOU MOMENTS -->
        <div class="atab-body hidden" id="atab-moments">
          <p class="admin-hint">Special "thinking of you" surprises — sent automatically at random intervals. Make them feel like you're always near.</p>
          <div class="admin-input-row">
            <textarea id="admin-moment-input" class="admin-textarea" placeholder="e.g. "I was just thinking about you 🌙"" rows="2"></textarea>
            <button class="mbtn" id="admin-moment-add" style="flex-shrink:0;align-self:flex-end">Add ✦</button>
          </div>
          <div class="admin-list" id="admin-moment-list"></div>
        </div>

        <!-- TAB: PASSWORD -->
        <div class="atab-body hidden" id="atab-pass">
          <p class="admin-hint">Change the creator panel password. Keep it something only you know.</p>
          <div class="admin-input-row" style="flex-direction:column;gap:.7rem">
            <input type="password" id="admin-pass-new" class="admin-input" placeholder="New password…" autocomplete="new-password">
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

  /* ══════════════════════════════════════════════
     PANEL LOGIC
  ══════════════════════════════════════════════ */
  function _wirePanel() {
    const ov = document.getElementById('admin-overlay');

    // Close buttons
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

    // ── Messages tab ──────────────────────────────
    document.getElementById('admin-msg-add').addEventListener('click', () => {
      const txt = document.getElementById('admin-msg-input').value.trim();
      const cat = document.getElementById('admin-msg-cat').value;
      if (!txt) return;
      const msgs = getMsgs();
      msgs.push({ id: Date.now(), t: txt, c: cat, admin: true });
      _set(MSGS_KEY, msgs);
      document.getElementById('admin-msg-input').value = '';
      _renderMsgList();
    });
    _renderMsgList();

    // ── Voice tab ─────────────────────────────────
    const dropEl = document.getElementById('admin-drop');
    const fileEl = document.getElementById('admin-clip-file');

    dropEl.addEventListener('dragover',  e => { e.preventDefault(); dropEl.classList.add('over'); });
    dropEl.addEventListener('dragleave', ()  => dropEl.classList.remove('over'));
    dropEl.addEventListener('drop', e => {
      e.preventDefault(); dropEl.classList.remove('over');
      _addClipFiles(e.dataTransfer.files);
    });
    fileEl.addEventListener('change', e => { _addClipFiles(e.target.files); e.target.value = ''; });
    _renderClipList();

    // ── Moments tab ───────────────────────────────
    document.getElementById('admin-moment-add').addEventListener('click', () => {
      const txt = document.getElementById('admin-moment-input').value.trim();
      if (!txt) return;
      const moments = getMoments();
      moments.push({ id: Date.now(), t: txt });
      _set(MOMENTS_KEY, moments);
      document.getElementById('admin-moment-input').value = '';
      _renderMomentList();
    });
    _renderMomentList();

    // ── Password tab ──────────────────────────────
    document.getElementById('admin-pass-save').addEventListener('click', () => {
      const a = document.getElementById('admin-pass-new').value;
      const b = document.getElementById('admin-pass-confirm').value;
      const msg = document.getElementById('admin-pass-msg');
      if (!a) { _showPassMsg(msg, 'Password cannot be empty.', false); return; }
      if (a !== b) { _showPassMsg(msg, 'Passwords do not match.', false); return; }
      localStorage.setItem(PASS_KEY, a);
      document.getElementById('admin-pass-new').value = '';
      document.getElementById('admin-pass-confirm').value = '';
      _showPassMsg(msg, 'Password updated ✦', true);
    });
  }

  function _showPassMsg(el, txt, ok) {
    el.textContent = txt;
    el.style.color = ok ? 'var(--violet)' : '#ff9090';
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
  }

  /* list renderers */
  function _renderMsgList() {
    const el = document.getElementById('admin-msg-list');
    if (!el) return;
    const msgs = getMsgs();
    el.innerHTML = '';
    if (!msgs.length) { el.innerHTML = '<p class="admin-empty">No messages yet.</p>'; return; }
    msgs.forEach(m => {
      const row = document.createElement('div');
      row.className = 'admin-item';
      row.innerHTML = `
        <div class="admin-item-txt">
          <span class="admin-item-cat">— ${m.c} —</span>
          <span>${m.t}</span>
        </div>
        <button class="vm-del" data-id="${m.id}">✕</button>
      `;
      row.querySelector('.vm-del').addEventListener('click', () => {
        _set(MSGS_KEY, getMsgs().filter(x => x.id !== m.id));
        _renderMsgList();
      });
      el.appendChild(row);
    });
  }

  function _addClipFiles(files) {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('audio/')) { alert(`"${file.name}" is not an audio file.`); return; }
      if (file.size > 5*1024*1024) { alert(`"${file.name}" exceeds 5 MB.`); return; }
      const reader = new FileReader();
      reader.onload = e => {
        const clips = getClips();
        clips.push({ id: Date.now()+Math.random(), name: file.name.replace(/\.[^.]+$/,''), data: e.target.result, size: file.size, type: file.type });
        _set(CLIPS_KEY, clips);
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
    if (!clips.length) { el.innerHTML = '<p class="admin-empty">No private clips yet.</p>'; return; }
    clips.forEach(clip => {
      const row = document.createElement('div');
      row.className = 'admin-item';
      row.innerHTML = `
        <div class="admin-item-txt"><span>🎤 ${clip.name}</span></div>
        <button class="vm-play" data-id="${clip.id}" title="Preview">▶</button>
        <button class="vm-del" data-id="${clip.id}">✕</button>
      `;
      row.querySelector('.vm-play').addEventListener('click', () => {
        try { new Audio(clip.data).play(); } catch {}
      });
      row.querySelector('.vm-del').addEventListener('click', () => {
        _set(CLIPS_KEY, getClips().filter(x => x.id !== clip.id));
        _renderClipList();
      });
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
      row.innerHTML = `
        <div class="admin-item-txt"><span>${m.t}</span></div>
        <button class="vm-del" data-id="${m.id}">✕</button>
      `;
      row.querySelector('.vm-del').addEventListener('click', () => {
        _set(MOMENTS_KEY, getMoments().filter(x => x.id !== m.id));
        _renderMomentList();
      });
      el.appendChild(row);
    });
  }

  /* ══════════════════════════════════════════════
     SHOW / HIDE
  ══════════════════════════════════════════════ */
  function _showPanel() {
    _buildPanel();
    // Re-render lists in case data changed
    _renderMsgList();
    _renderClipList();
    _renderMomentList();
    document.getElementById('admin-overlay').classList.remove('hidden');
  }

  function _hidePanel() {
    const ov = document.getElementById('admin-overlay');
    if (ov) ov.classList.add('hidden');
    _unlocked = false; // require re-auth each visit
  }

  /* ══════════════════════════════════════════════
     INIT — attach 5-tap trigger to one or more elements
     Call: AdminEngine.init(el1, el2, ...)
  ══════════════════════════════════════════════ */
  function init(...triggerEls) {
    triggerEls.forEach(triggerEl => {
      if (!triggerEl) return;

      triggerEl.addEventListener('click', () => {
        _tapCount++;
        clearTimeout(_tapTimer);
        // reset tap count if too slow (2 seconds between taps)
        _tapTimer = setTimeout(() => { _tapCount = 0; }, 2000);

        if (_tapCount >= 5) {
          _tapCount = 0;
          clearTimeout(_tapTimer);
          _promptPassword();
        }
      });
    });
  }

  function _promptPassword() {
    // Use a styled inline prompt instead of window.prompt (which is blocked on some browsers)
    _buildPrompt();
  }

  function _buildPrompt() {
    // Remove any existing prompt
    const existing = document.getElementById('admin-prompt-overlay');
    if (existing) existing.remove();

    const html = `
    <div id="admin-prompt-overlay" style="
      position:fixed;inset:0;z-index:9999;
      display:flex;align-items:center;justify-content:center;
      background:rgba(5,2,14,.88);backdrop-filter:blur(10px);
    ">
      <div style="
        background:rgba(28,8,58,.97);border:1px solid rgba(192,132,252,.3);
        border-radius:24px;padding:2rem 1.8rem;width:90%;max-width:320px;
        text-align:center;box-shadow:0 0 50px rgba(192,132,252,.15);
      ">
        <div style="font-size:1.8rem;margin-bottom:.8rem">🔐</div>
        <p style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:1.1rem;color:#f5e6ff;margin-bottom:1.4rem">Creator access</p>
        <input type="password" id="admin-prompt-input" placeholder="Enter your password…"
          style="width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(192,132,252,.3);
          border-radius:12px;padding:.75rem 1rem;color:#f5e6ff;font-size:.9rem;
          font-family:'DM Sans',sans-serif;outline:none;margin-bottom:1rem;box-sizing:border-box;"
          autocomplete="current-password">
        <p id="admin-prompt-err" style="color:#ff9090;font-size:.78rem;margin-bottom:.8rem;display:none">Incorrect password.</p>
        <div style="display:flex;gap:.7rem;justify-content:center">
          <button id="admin-prompt-cancel" style="
            padding:.55rem 1.2rem;border-radius:100px;border:1px solid rgba(192,132,252,.2);
            background:transparent;color:#a78bca;font-size:.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;
          ">Cancel</button>
          <button id="admin-prompt-ok" style="
            padding:.55rem 1.4rem;border-radius:100px;
            border:1px solid rgba(192,132,252,.5);
            background:rgba(192,132,252,.14);color:#f5e6ff;
            font-size:.8rem;cursor:pointer;font-family:'DM Sans',sans-serif;
          ">Enter ✦</button>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    const overlay = document.getElementById('admin-prompt-overlay');
    const input   = document.getElementById('admin-prompt-input');
    const err     = document.getElementById('admin-prompt-err');

    // Focus input
    setTimeout(() => input.focus(), 100);

    function tryLogin() {
      if (input.value === getPassword()) {
        overlay.remove();
        _unlocked = true;
        _showPanel();
      } else {
        err.style.display = 'block';
        input.value = '';
        input.focus();
        setTimeout(() => { err.style.display = 'none'; }, 2500);
      }
    }

    document.getElementById('admin-prompt-ok').addEventListener('click', tryLogin);
    document.getElementById('admin-prompt-cancel').addEventListener('click', () => overlay.remove());
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') tryLogin();
      if (e.key === 'Escape') overlay.remove();
    });
    // Close on backdrop click
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
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
