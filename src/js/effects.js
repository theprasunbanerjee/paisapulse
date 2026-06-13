/* ── effects.js — cursor particle trail + entrance card animations ── */

function initCursorFx() {
  const cv = $("cursorFx"); if (!cv) return;
  const mm = window.matchMedia;
  if ((mm && mm("(prefers-reduced-motion: reduce)").matches) || !(mm && mm("(pointer: fine)").matches)) {
    cv.remove(); return;
  }
  const ctx = cv.getContext("2d"); let dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio||1, 2);
    cv.width  = Math.floor(innerWidth  * dpr);
    cv.height = Math.floor(innerHeight * dpr);
    cv.style.width  = innerWidth  + "px";
    cv.style.height = innerHeight + "px";
  }
  resize();
  addEventListener("resize", resize, {passive:true});

  const COLORS = [[176,107,255],[244,114,182],[252,211,77]]; // violet · pink · gold
  let parts = [], mx = innerWidth/2*dpr, my = innerHeight/2*dpr, px = mx, py = my, moved = false, ci = 0;
  addEventListener("mousemove", e => { mx = e.clientX*dpr; my = e.clientY*dpr; moved = true; }, {passive:true});

  function spawn(x, y, boost) {
    const c = COLORS[(ci++) % COLORS.length];
    parts.push({x, y, vx:(Math.random()-.5)*0.5*dpr, vy:((Math.random()-.5)*0.5-.25)*dpr, r:(4+Math.random()*6+boost)*dpr, life:1, c});
  }

  (function loop() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (moved) {
      const dx = mx-px, dy = my-py, dist = Math.hypot(dx, dy), steps = Math.min(10, Math.max(1, dist/(5*dpr)));
      for (let i = 0; i < steps; i++) spawn(px + dx*i/steps, py + dy*i/steps, Math.min(4, dist/(40*dpr)));
      px = mx; py = my; moved = false;
    }
    ctx.globalCompositeOperation = "lighter";
    for (let i = parts.length-1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.012*dpr; p.life -= 0.04;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      const rr = p.r * p.life, a = p.life * p.life * 0.55;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
      g.addColorStop(0, "rgba(" + p.c[0] + "," + p.c[1] + "," + p.c[2] + "," + a + ")");
      g.addColorStop(1, "rgba(" + p.c[0] + "," + p.c[1] + "," + p.c[2] + ",0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.2832); ctx.fill();
    }
    if (parts.length > 260) parts.splice(0, parts.length - 260);
    requestAnimationFrame(loop);
  })();
}

function initEntranceAnims() {
  const mm = window.matchMedia;
  if ((mm && mm("(prefers-reduced-motion: reduce)").matches) || !("IntersectionObserver" in window)) return;
  const els = [...document.querySelectorAll(".hero,.card")];
  els.forEach((el, i) => { el.classList.add("reveal"); el.style.setProperty("--d", ((i % 5) * 0.06).toFixed(2) + "s"); });
  const io = new IntersectionObserver(ents => ents.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
  }), {threshold: 0.06});
  els.forEach(el => io.observe(el));
}
