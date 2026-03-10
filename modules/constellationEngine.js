/**
 * modules/constellationEngine.js
 * Builds the floating node field and draws constellation lines on a canvas.
 *
 * Public API
 *   ConstellationEngine.build(fieldEl, canvasEl, onTap)
 *   ConstellationEngine.redraw()
 */
const ConstellationEngine = (() => {
  const POSITIONS = [
    {x:14,y:18,t:''},     {x:73,y:13,t:'rose'}, {x:87,y:40,t:''},
    {x:80,y:70,t:'gold'}, {x:54,y:82,t:'rose'}, {x:22,y:76,t:''},
    {x:7, y:54,t:'gold'}, {x:41,y:16,t:''},     {x:62,y:47,t:'rose'},
  ];

  let _canvas = null;
  let _nodes  = [];

  function build(fieldEl, canvasEl, onTap) {
    _canvas = canvasEl;
    fieldEl.innerHTML = '';
    _nodes = [];

    POSITIONS.forEach(pos => {
      const btn = document.createElement('button');
      btn.className = 'node' + (pos.t ? ' ' + pos.t : '');
      btn.setAttribute('aria-label', 'Tap for a message');

      const fy = -(6 + Math.random() * 13);
      const fd = 4  + Math.random() * 4;
      btn.style.cssText = `left:${pos.x}%;top:${pos.y}%;--fd:${fd}s;--fy:${fy}px;animation-delay:${Math.random()*fd}s`;
      btn.addEventListener('click', onTap);

      fieldEl.appendChild(btn);
      _nodes.push(btn);
    });

    setTimeout(redraw, 120);
    window.addEventListener('resize', redraw, { passive: true });
  }

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
        ctx.strokeStyle = `rgba(192,132,252,${(1 - d/MAX) * 0.17})`;
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
