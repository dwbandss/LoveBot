/**
 * modules/constellationEngine.js  v3.0
 *
 * Changes from v2:
 *  - Supports lb:goldNodes event → redraws lines in gold
 *  - Supports lb:expandConstellation → adds 6 more nodes (150-tap unlock)
 *  - applyCurrentUnlocks() called on build so state is restored on reload
 */
const ConstellationEngine = (() => {
  const BASE_POSITIONS = [
    {x:14,y:18,t:''},     {x:73,y:13,t:'rose'}, {x:87,y:40,t:''},
    {x:80,y:70,t:'gold'}, {x:54,y:82,t:'rose'}, {x:22,y:76,t:''},
    {x:7, y:54,t:'gold'}, {x:41,y:16,t:''},     {x:62,y:47,t:'rose'},
  ];

  // Extra nodes unlocked at 150 taps
  const EXTRA_POSITIONS = [
    {x:32,y:35,t:'gold'}, {x:68,y:28,t:''},     {x:90,y:60,t:'gold'},
    {x:48,y:65,t:''},     {x:18,y:40,t:'rose'},  {x:75,y:85,t:'gold'},
  ];

  let _canvas    = null;
  let _nodes     = [];
  let _fieldEl   = null;
  let _onTap     = null;
  let _goldMode  = false;

  /* ── Build initial node set ──────────────────── */
  function build(fieldEl, canvasEl, onTap) {
    _canvas  = canvasEl;
    _fieldEl = fieldEl;
    _onTap   = onTap;
    fieldEl.innerHTML = '';
    _nodes = [];

    BASE_POSITIONS.forEach(pos => _addNode(pos));

    // Restore unlock states without re-triggering celebrations
    if (typeof UnlockEngine !== 'undefined') {
      if (UnlockEngine.hasFeature('gold_nodes'))         _setGoldMode(true);
      if (UnlockEngine.hasFeature('full_constellation')) _addExtraNodes();
    }

    setTimeout(redraw, 120);
    window.addEventListener('resize', redraw, { passive: true });

    // Listen for unlock events
    window.addEventListener('lb:goldNodes',           () => _setGoldMode(true));
    window.addEventListener('lb:expandConstellation', _addExtraNodes);
  }

  function _addNode(pos) {
    const btn = document.createElement('button');
    const type = _goldMode ? 'gold' : (pos.t || '');
    btn.className = 'node' + (type ? ' ' + type : '');
    btn.setAttribute('aria-label', 'Tap for a message');
    const fy = -(6 + Math.random() * 13);
    const fd = 4  + Math.random() * 4;
    btn.style.cssText = `left:${pos.x}%;top:${pos.y}%;--fd:${fd}s;--fy:${fy}px;animation-delay:${Math.random()*fd}s`;
    btn.addEventListener('click', _onTap);
    _fieldEl.appendChild(btn);
    _nodes.push(btn);
    return btn;
  }

  function _addExtraNodes() {
    EXTRA_POSITIONS.forEach(pos => {
      // Animate in
      const btn = _addNode(pos);
      btn.style.opacity = '0';
      btn.style.transition = 'opacity 1.2s ease';
      setTimeout(() => { btn.style.opacity = ''; }, 100 + Math.random() * 800);
    });
    setTimeout(redraw, 1200);
  }

  function _setGoldMode(val) {
    _goldMode = val;
    _nodes.forEach(n => {
      n.classList.remove('rose');
      n.classList.add('gold');
    });
    redraw();
  }

  /* ── Canvas line drawing ─────────────────────── */
  function redraw() {
    if (!_canvas || !_nodes.length) return;
    const ctx = _canvas.getContext('2d');
    const W   = _canvas.width  = _canvas.offsetWidth;
    const H   = _canvas.height = _canvas.offsetHeight;
    ctx.clearRect(0, 0, W, H);

    const cr  = _canvas.getBoundingClientRect();
    const pts = _nodes.map(n => {
      const r = n.getBoundingClientRect();
      return { x: r.left + r.width/2 - cr.left, y: r.top + r.height/2 - cr.top };
    });

    const MAX = Math.min(W, H) * 0.44;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d > MAX) continue;
        const alpha = (1 - d / MAX) * 0.18;
        // Gold mode: draw warm gold lines; default: violet
        ctx.strokeStyle = _goldMode
          ? `rgba(253,211,77,${alpha})`
          : `rgba(192,132,252,${alpha})`;
        ctx.lineWidth   = 0.8;
        ctx.setLineDash([3, 6]);
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[j].x, pts[j].y);
        ctx.stroke();
      }
    }
  }

  return { build, redraw };
})();
