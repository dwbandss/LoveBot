/**
 * modules/voiceManager.js  v3.1
 * SECURITY FIX: Replaced all innerHTML string interpolation with
 * safe DOM element creation (fixes CWE-79 XSS / GitHub CodeQL alert).
 * clip.name, clip.type, clip.size are now set via textContent only.
 */
const VoiceManager = (() => {
  const CLIPS_KEY  = 'lb_clips';
  const CHANCE_KEY = 'lb_clip_chance';
  const MAX_BYTES  = 5 * 1024 * 1024;

  let clips     = [];
  let chance    = 30;
  let audio     = null;
  let playingId = null;

  function _load() {
    try { clips  = JSON.parse(localStorage.getItem(CLIPS_KEY)  || '[]'); } catch { clips  = []; }
    try { chance = parseInt(localStorage.getItem(CHANCE_KEY) || '30', 10); } catch { chance = 30; }
  }
  function _save() {
    try { localStorage.setItem(CLIPS_KEY,  JSON.stringify(clips));  } catch { alert('Storage full — remove some clips first.'); }
    try { localStorage.setItem(CHANCE_KEY, String(chance)); } catch {}
  }

  function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function _fmt(b)    { return b < 1048576 ? (b/1024).toFixed(0)+' KB' : (b/1048576).toFixed(1)+' MB'; }

  function stopCurrent() {
    if (audio) { audio.pause(); audio.currentTime = 0; audio = null; }
    if (playingId) {
      const btn = document.querySelector(`.vm-play[data-id="${CSS.escape(String(playingId))}"]`);
      if (btn) { btn.textContent = '▶'; btn.classList.remove('playing'); }
      playingId = null;
    }
  }

  function _playClip(clip) {
    stopCurrent();
    VoiceEngine.stop();
    try {
      audio = new Audio(clip.data);
      audio.onended = () => { playingId = null; _setPlayBtn(clip.id, false); };
      audio.onerror = () => stopCurrent();
      audio.play();
      playingId = clip.id;
      _setPlayBtn(clip.id, true);
    } catch {}
  }

  function _setPlayBtn(id, playing) {
    const btn = document.querySelector(`.vm-play[data-id="${CSS.escape(String(id))}"]`);
    if (!btn) return;
    btn.textContent = playing ? '■' : '▶';
    btn.classList.toggle('playing', playing);
  }

  function playRandom() {
    if (!clips.length) return false;
    _playClip(_pick(clips));
    return true;
  }

  function getChance() { return chance; }
  function count()     { return clips.length; }

  function addFiles(files) {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('audio/')) { alert(`"${file.name}" doesn't look like an audio file.`); return; }
      if (file.size > MAX_BYTES)           { alert(`"${file.name}" exceeds 5 MB. Please trim it first.`); return; }
      const reader = new FileReader();
      reader.onload = e => {
        clips.push({
          id:   Date.now() + Math.random(),
          name: file.name.replace(/\.[^.]+$/, ''),
          data: e.target.result,
          size: file.size,
          type: file.type || 'audio/mpeg',
        });
        _save();
        render();
      };
      reader.readAsDataURL(file);
    });
  }

  /* ── render — all DOM via createElement, NO innerHTML with user data ── */
  function render() {
    if (!_els.list) return;
    const { list, empty, count: countEl } = _els;
    list.innerHTML = '';  // safe — clears own children, no user data

    const n = clips.length;
    if (_els.badge)  _els.badge.textContent = n ? `(${n})` : '';
    if (countEl)     countEl.textContent    = n ? `${n} clip${n!==1?'s':''} stored in browser` : '';

    if (!n) {
      empty.classList.remove('hidden');
      list.classList.add('hidden');
      return;
    }
    empty.classList.add('hidden');
    list.classList.remove('hidden');

    clips.forEach(clip => {
      // ── play button ──────────────────────────────
      const playBtn = document.createElement('button');
      playBtn.className = 'vm-play';
      playBtn.dataset.id = clip.id;
      playBtn.title = 'Preview';
      playBtn.textContent = '▶';

      // ── name input ───────────────────────────────
      const nameInput = document.createElement('input');
      nameInput.className = 'vm-name-input';
      nameInput.placeholder = 'Label this clip…';
      nameInput.dataset.id = clip.id;
      nameInput.value = clip.name;          // .value is safe (not innerHTML)

      // ── meta ─────────────────────────────────────
      const meta = document.createElement('div');
      meta.className = 'vm-meta';
      // textContent is always safe — no HTML injection possible
      meta.textContent = `${_fmt(clip.size)} · ${clip.type.replace('audio/','')}`;

      // ── info wrapper ─────────────────────────────
      const info = document.createElement('div');
      info.className = 'vm-info';
      info.appendChild(nameInput);
      info.appendChild(meta);

      // ── delete button ─────────────────────────────
      const delBtn = document.createElement('button');
      delBtn.className = 'vm-del';
      delBtn.dataset.id = clip.id;
      delBtn.title = 'Remove';
      delBtn.textContent = '✕';

      // ── item wrapper ─────────────────────────────
      const item = document.createElement('div');
      item.className = 'vm-item';
      item.appendChild(playBtn);
      item.appendChild(info);
      item.appendChild(delBtn);

      // ── events ────────────────────────────────────
      playBtn.addEventListener('click', () => {
        if (playingId === clip.id) stopCurrent();
        else _playClip(clip);
      });

      nameInput.addEventListener('change', e => {
        const c = clips.find(x => x.id === clip.id);
        if (c) { c.name = e.target.value.trim() || clip.name; _save(); }
      });

      delBtn.addEventListener('click', () => {
        if (playingId === clip.id) stopCurrent();
        clips = clips.filter(x => x.id !== clip.id);
        _save(); render();
      });

      list.appendChild(item);
    });
  }

  let _els = {};

  function init({ dropEl, fileEl, listEl, emptyEl, countEl, chanceEl, chanceValEl, badgeEl }) {
    _load();
    _els = { list: listEl, empty: emptyEl, count: countEl, badge: badgeEl };

    if (dropEl) {
      dropEl.addEventListener('dragover',  e => { e.preventDefault(); dropEl.classList.add('over'); });
      dropEl.addEventListener('dragleave', ()  => dropEl.classList.remove('over'));
      dropEl.addEventListener('drop', e => { e.preventDefault(); dropEl.classList.remove('over'); addFiles(e.dataTransfer.files); });
    }
    if (fileEl) {
      fileEl.addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
    }
    if (chanceEl) {
      chanceEl.value = chance;
      if (chanceValEl) chanceValEl.textContent = chance + '%';
      chanceEl.addEventListener('input', e => {
        chance = parseInt(e.target.value, 10);
        if (chanceValEl) chanceValEl.textContent = chance + '%';
        localStorage.setItem(CHANCE_KEY, String(chance));
      });
    }

    render();
  }

  return { init, playRandom, stopCurrent, getChance, count, render };
})();
