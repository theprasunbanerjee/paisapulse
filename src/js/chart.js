/* ── chart.js — daily spend chart + rolling 12-month analysis chart ── */

class Chart {
  constructor(app) {
    this.app = app;
  }

  renderDaily(D) {
    const W=760, H=250, L=10, R=10, T=20, Bm=28, iw=W-L-R, ih=H-T-Bm;
    const maxDay = Math.max(...D.perDay, 1);
    const cumMax = Math.max(D.cum[D.days], D.isCur ? D.proj : 0, 1);
    const xd  = d  => L + (d - 0.5) * (iw / D.days);
    const bw  = Math.max(3, (iw / D.days) * 0.6);
    let bars = "", line = "", dots = "", labels = "", todayMark = "";
    const lastDay = D.isCur ? D.elapsed : D.days;

    for (let d = 1; d <= D.days; d++) {
      const v = D.perDay[d];
      if (v > 0) {
        const h = Math.max(2, v / maxDay * ih);
        bars += '<rect x="' + (xd(d)-bw/2) + '" y="' + (T+ih-h) + '" width="' + bw + '" height="' + h + '" rx="2.5" fill="url(#bar)">' +
          '<title>' + MONTHS[D.m].slice(0,3) + " " + d + " — " + fmt(v) + " spent · running " + fmt(D.cum[d]) + '</title></rect>';
      }
      if (d % 5 === 0 || d === 1 || d === D.days)
        labels += '<text x="' + xd(d) + '" y="' + (H-8) + '" text-anchor="middle" class="ax">' + d + '</text>';
    }

    const pts = [];
    for (let d = 1; d <= lastDay; d++)
      pts.push(xd(d).toFixed(1) + "," + (T + ih - D.cum[d] / cumMax * ih).toFixed(1));
    if (pts.length > 1)
      line = '<polyline points="' + pts.join(" ") + '" fill="none" stroke="#f472b6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>';
    if (pts.length) {
      const last = pts[pts.length-1].split(",");
      dots = '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="4.5" fill="#f472b6" filter="url(#glow)"/>';
    }
    if (D.isCur) {
      const x = xd(NOW.getDate());
      todayMark = '<line x1="' + x + '" y1="' + T + '" x2="' + x + '" y2="' + (T+ih) + '" stroke="rgba(236,243,255,.3)" stroke-dasharray="3 4"/>';
    }

    $("dailyChart").innerHTML =
      '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Daily spend and running total">' +
      '<defs><linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#b06bff"/><stop offset="1" stop-color="#6d28d9"/></linearGradient>' +
      '<filter id="glow" x="-50%" y="-50%" width="200%" height="200%">' +
      '<feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<style>.ax{font:600 10px "JetBrains Mono",monospace;fill:rgba(236,243,255,.35)}</style>' +
      '<line x1="' + L + '" y1="' + (T+ih) + '" x2="' + (W-R) + '" y2="' + (T+ih) + '" stroke="rgba(255,255,255,.12)"/>' +
      bars + todayMark + line + dots + labels + '</svg>';
  }

  /* Rolling 12-month bar chart, ending at the currently viewed month */
  renderMonthly() {
    const byM = {};
    for (const e of this.app.expenses) { const k = e.date.slice(0,7); byM[k] = (byM[k]||0) + e.amount; }
    const months = []; let y = this.app.view.y, m = this.app.view.m;
    for (let i = 0; i < 12; i++) {
      const key = y + "-" + pad(m+1);
      months.unshift({y, m, key, total: byM[key]||0});
      m--; if (m < 0) { m = 11; y--; }
    }

    const W=760, H=250, L=10, R=10, T=20, Bm=28, iw=W-L-R, ih=H-T-Bm;
    const maxT = Math.max(...months.map(x => x.total), 1);
    const slot  = iw / months.length, bw = Math.max(8, slot * 0.62);
    const withVals = months.filter(x => x.total > 0);
    const avg = withVals.length ? withVals.reduce((s, x) => s + x.total, 0) / withVals.length : 0;
    let bars = "", labels = "", avgLine = "";

    months.forEach((mo, i) => {
      const cx = L + slot * (i + 0.5), h = Math.max(2, mo.total / maxT * ih);
      const isView = (mo.y === this.app.view.y && mo.m === this.app.view.m);
      bars += '<rect x="' + (cx-bw/2) + '" y="' + (T+ih-h) + '" width="' + bw + '" height="' + h + '" rx="3" fill="url(#bar)" opacity="' + (isView ? 1 : .62) + '" style="cursor:pointer" data-ym="' + mo.y + "-" + mo.m + '">' +
        '<title>' + MONTHS[mo.m].slice(0,3) + " " + mo.y + " — " + fmt(mo.total) + '</title></rect>';
      if (isView)
        bars += '<rect x="' + (cx-bw/2-2) + '" y="' + (T+ih-h-2) + '" width="' + (bw+4) + '" height="' + (h+2) + '" rx="4" fill="none" stroke="#f472b6" stroke-width="1.5" pointer-events="none"/>';
      labels += '<text x="' + cx + '" y="' + (H-8) + '" text-anchor="middle" class="ax">' +
        MONTHS[mo.m].slice(0,3) + (mo.m === 0 ? " '" + String(mo.y).slice(2) : "") + '</text>';
    });

    if (avg > 0) {
      const ay = T + ih - avg / maxT * ih;
      avgLine = '<line x1="' + L + '" y1="' + ay + '" x2="' + (W-R) + '" y2="' + ay + '" stroke="#fcd34d" stroke-width="1.3" stroke-dasharray="4 5" opacity=".7"/>' +
        '<text x="' + (W-R) + '" y="' + (ay-5) + '" text-anchor="end" class="ax" fill="#fcd34d">avg ' + fmt(avg) + '</text>';
    }

    $("dailyChart").innerHTML =
      '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Monthly spend">' +
      '<defs><linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#b06bff"/><stop offset="1" stop-color="#6d28d9"/></linearGradient></defs>' +
      '<style>.ax{font:600 10px "JetBrains Mono",monospace;fill:rgba(236,243,255,.35)}</style>' +
      '<line x1="' + L + '" y1="' + (T+ih) + '" x2="' + (W-R) + '" y2="' + (T+ih) + '" stroke="rgba(255,255,255,.12)"/>' +
      bars + avgLine + labels + '</svg>';
  }

  wire() {
    /* Chart mode toggle (Daily / Monthly) */
    $("chartToggle").addEventListener("click", e => {
      const b = e.target.closest("[data-mode]"); if (!b) return;
      this.app.chartMode = b.dataset.mode;
      document.querySelectorAll("#chartToggle .seg-btn").forEach(x => x.classList.toggle("on", x === b));
      $("chartTitle").innerHTML = this.app.chartMode === "monthly" ? "Monthly spend (last 12 months)" : "Daily spend &amp; running total";
      $("chartLegend").style.display = this.app.chartMode === "monthly" ? "none" : "";
      this.app.render();
    });

    /* Click a monthly bar → drill into that month */
    $("dailyChart").addEventListener("click", e => {
      const r = e.target.closest("[data-ym]"); if (!r) return;
      const [yy, mm] = r.dataset.ym.split("-").map(Number);
      this.app.view = {y:yy, m:mm};
      this.app.chartMode = "daily";
      document.querySelectorAll("#chartToggle .seg-btn").forEach(x => x.classList.toggle("on", x.dataset.mode === "daily"));
      $("chartTitle").innerHTML = "Daily spend &amp; running total";
      $("chartLegend").style.display = "";
      this.app.render();
    });
  }
}
