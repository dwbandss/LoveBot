/**
 * modules/voiceManager.js
 * Manages user-uploaded audio clips stored as base64 in localStorage.
 * Files are dropped / selected, stored, and played back via Audio().
 *
 * Public API
 *   VoiceManager.init(dropEl, fileEl, listEl, emptyEl, countEl, chanceEl, chanceValEl)
 *   VoiceManager.playRandom()   → bool  (true if a clip was played)
 *   VoiceManager.stopCurrent()
 *   VoiceManager.getChance()    → 0–100
 *   VoiceManager.count()        → number
 *   VoiceManager.render()
 */
const VoiceManager = (() => {
  const CLIPS_KEY  = 'lb_clips';
  const CHANCE_KEY = 'lb_clip_chance';
  const MAX_BYTES  = 5 * 1024 * 1024; // 5 MB per file

  let clips      = [];
  let chance     = 30;
  let audio      = null;
  let playingId  = null;

  /* ── storage ─────────────────────────────────── */
  function _load() {
    try { clips  = JSON.parse(localStorage.getItem(CLIPS_KEY)  || '[]'); } catch { clips  = []; }
    try { chance = parseInt(localStorage.getItem(CHANCE_KEY) || '30', 10); } catch { chance = 30; }
  }
  function _save() {
    try { localStorage.setItem(CLIPS_KEY,  JSON.stringify(clips));  } catch { alert('Storage full — remove some clips first.'); }
    try { localStorage.setItem(CHANCE_KEY, String(chance)); } catch {}
  }

  /* ── helpers ─────────────────────────────────── */
  function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function _fmt(b)    { return b < 1048576 ? (b/1024).toFixed(0)+' KB' : (b/1048576).toFixed(1)+' MB'; }

  function stopCurrent() {
    if (audio) { audio.pause(); audio.currentTime = 0; audio = null; }
    if (playingId) {
      const btn = document.querySelector(`.vm-play[data-id="${playingId}"]`);
      if (btn) { btn.textContent = '▶'; btn.classList.remove('playing'); }
      playingId = null;
    }
  }

  function _playClip(clip) {
    stopCurrent();
    VoiceEngine.stop();
    try {
      audio = new Audio(clip.data);
      audio.onended  = () => { playingId = null; _setPlayBtn(clip.id, false); };
      audio.onerror  = () => stopCurrent();
      audio.play();
      playingId = clip.id;
      _setPlayBtn(clip.id, true);
    } catch(e) { console.warn('Clip playback error', e); }
  }

  function _setPlayBtn(id, playing) {
    const btn = document.querySelector(`.vm-play[data-id="${id}"]`);
    if (!btn) return;
    btn.textContent = playing ? '■' : '▶';
    btn.classList.toggle('playing', playing);
  }

  /* ── public: play random clip ────────────────── */
  function playRandom() {
    if (!clips.length) return false;
    _playClip(_pick(clips));
    return true;
  }

  function getChance() { return chance; }
  function count()     { return clips.length; }

  /* ── add files ───────────────────────────────── */
  function addFiles(files) {
    let added = 0;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('audio/')) {
        alert(`"${file.name}" doesn't look like an audio file.`); return;
      }
      if (file.size > MAX_BYTES) {
        alert(`"${file.name}" exceeds 5 MB. Please trim it first.`); return;
      }
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
      added++;
    });
    return added;
  }

  /* ── render list ─────────────────────────────── */
  function render() {
    if (!_els.list) return;
    const { list, empty, count: countEl } = _els;
    list.innerHTML = '';

    const n = clips.length;
    if (_els.badge) _els.badge.textContent = n ? `(${n})` : '';
    if (countEl) countEl.textContent = n ? `${n} clip${n!==1?'s':''} stored in browser` : '';

    if (!n) {
      empty.classList.remove('hidden');
      list.classList.add('hidden');
      return;
    }
    empty.classList.add('hidden');
    list.classList.remove('hidden');

    clips.forEach(clip => {
      const item = document.createElement('div');
      item.className = 'vm-item';
      item.innerHTML = `
        <button class="vm-play" data-id="${clip.id}" title="Preview">▶</button>
        <div class="vm-info">
          <input class="vm-name-input" value="${clip.name.replace(/"/g,'&quot;')}"
                 placeholder="Label this clip…" data-id="${clip.id}">
          <div class="vm-meta">${_fmt(clip.size)} · ${clip.type.replace('audio/','')}</div>
        </div>
        <button class="vm-del" data-id="${clip.id}" title="Remove">✕</button>
      `;

      item.querySelector('.vm-play').addEventListener('click', () => {
        if (playingId === clip.id) stopCurrent();
        else _playClip(clip);
      });

      item.querySelector('.vm-name-input').addEventListener('change', e => {
        const c = clips.find(x => x.id === clip.id);
        if (c) { c.name = e.target.value.trim() || clip.name; _save(); }
      });

      item.querySelector('.vm-del').addEventListener('click', () => {
        if (playingId === clip.id) stopCurrent();
        clips = clips.filter(x => x.id !== clip.id);
        _save(); render();
      });

      list.appendChild(item);
    });
  }

  /* ── init: wire all UI elements ──────────────── */
  let _els = {};

  function init({ dropEl, fileEl, listEl, emptyEl, countEl, chanceEl, chanceValEl, badgeEl }) {
    _load();
    _els = { list: listEl, empty: emptyEl, count: countEl, badge: badgeEl };

    // drag & drop
    if (dropEl) {
      dropEl.addEventListener('dragover',  e => { e.preventDefault(); dropEl.classList.add('over'); });
      dropEl.addEventListener('dragleave', ()  => dropEl.classList.remove('over'));
      dropEl.addEventListener('drop', e => {
        e.preventDefault(); dropEl.classList.remove('over');
        addFiles(e.dataTransfer.files);
      });
    }

    // file input
    if (fileEl) {
      fileEl.addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
    }

    // chance slider
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
