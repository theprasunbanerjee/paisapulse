/* ── ui.js — toast, modals, onboarding, greeting, month picker, settings, data modal ── */

const GREET = {
  morning:   ["Good morning","Morning","Rise & shine","Bright and early","Top of the morning"],
  afternoon: ["Good afternoon","Afternoon","Hey there","Hope your day's going well"],
  evening:   ["Good evening","Evening","Winding down","Hey"],
  night:     ["Still up","Late one","Burning the midnight oil","Night owl mode"]
};
const TAGLINES = [
  "Awareness is the whole game — and you're playing it.",
  "Every entry is a small act of self-respect.",
  "Money respects attention. You're paying it.",
  "You can't improve what you don't measure.",
  "Clarity beats willpower — and you've got clarity.",
  "Small leaks sink big ships. You're plugging them.",
  "Future-you is already grateful.",
  "Track it, see it, own it.",
  "Spending with eyes open beats spending on autopilot.",
  "The numbers don't judge — they just show the way.",
  "Tiny habit, big leverage. Keep logging.",
  "The budget you keep is the freedom you build.",
  "Knowing where it goes is half of getting it back.",
  "One honest entry at a time. That's how it's done."
];
const partOfDay = h => h < 5 ? "night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night";
const pickOne   = a => a[Math.floor(Math.random() * a.length)];

class UI {
  constructor(app) {
    this.app         = app;
    this.toastTimer  = null;
    this.mpYearShown = NOW.getFullYear();
  }

  /* ── toast ── */

  toast(msg, actLabel, actFn) {
    $("toastMsg").textContent = msg;
    const b = $("toastAct");
    if (actLabel) { b.hidden = false; b.textContent = actLabel; b.onclick = () => { actFn(); this.hideToast(); }; }
    else b.hidden = true;
    $("toast").classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.hideToast(), 4500);
  }
  hideToast() { $("toast").classList.remove("show"); }

  /* ── greeting ── */

  renderGreeting() {
    const line = $("greetLine"); if (!line) return;
    line.textContent = pickOne(GREET[partOfDay(new Date().getHours())]) + ", " + (this.app.userName || "there");
    $("greetTag").textContent = pickOne(TAGLINES);
  }

  startNameEdit() {
    const line = $("greetLine"); if (!line) return;
    const input = document.createElement("input");
    input.className = "greet-input"; input.value = this.app.userName || ""; input.placeholder = "your name"; input.maxLength = 24;
    line.replaceWith(input); $("greetEdit").hidden = true; input.focus(); input.select();
    let done = false;
    const finish = save => {
      if (done) return; done = true;
      if (save) this.app.userName = input.value.trim().slice(0, 24);
      Store.set(KEY_NAME, this.app.userName);
      const span = document.createElement("span"); span.className = "greet-line"; span.id = "greetLine";
      input.replaceWith(span); $("greetEdit").hidden = false; this.renderGreeting();
      if (save && this.app.userName) this.toast("Nice to meet you, " + this.app.userName + " ✦");
    };
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); finish(true); } else if (e.key === "Escape") finish(false); });
    input.addEventListener("blur", () => finish(true));
  }

  /* ── month picker ── */

  openMonthPicker()  { this.mpYearShown = this.app.view.y; this._renderMonthPicker(); $("monthPicker").hidden = false; }
  closeMonthPicker() { $("monthPicker").hidden = true; }

  _renderMonthPicker() {
    $("mpYear").textContent = this.mpYearShown;
    const maxY = NOW.getFullYear();
    $("mpNextY").disabled = this.mpYearShown >= maxY;
    $("mpGrid").innerHTML = MONTHS.map((name, i) => {
      const future = this.mpYearShown > maxY || (this.mpYearShown === maxY && i > NOW.getMonth());
      const cur    = (i === this.app.view.m && this.mpYearShown === this.app.view.y);
      return '<button data-m="' + i + '"' + (cur ? ' class="cur"' : '') + (future ? ' disabled' : '') + '>' + name.slice(0,3) + '</button>';
    }).join("");
  }

  /* ── onboarding / cloud connection ── */

  openOnboard() {
    $("cloudUrlInput").value = this.app.cloudUrl || "";
    const v = $("obVerify"); v.textContent = ""; v.className = "ob-verify";
    $("obChoose").hidden = false; $("obFlow").hidden = true;
    $("onboard").hidden = false;
  }
  closeOnboard() { $("onboard").hidden = true; }

  chooseMode(mode) {
    const existing = mode === "existing";
    $("obChoose").hidden = true; $("obFlow").hidden = false;
    $("obStep1").hidden = existing; $("obStep2").hidden = existing;
    $("obStep3Num").textContent  = existing ? "1" : "3";
    $("obStep3Title").textContent = existing ? "Link your existing Sheet" : "Paste your URL";
    $("obStep3Desc").innerHTML   = existing
      ? "Open your existing PaisaPulse Sheet → <code>Extensions → Apps Script → Deploy → Manage deployments</code> to copy its Web app URL (or paste the one you saved). Connecting <b>pulls all the data from that Sheet</b> onto this device — the Sheet itself isn't changed."
      : "Paste the Web app URL below and connect — I'll verify it can talk to your Sheet before saving anything.";
    const v = $("obVerify"); v.textContent = ""; v.className = "ob-verify";
  }

  async connectCloud() {
    const url = $("cloudUrlInput").value.trim(), v = $("obVerify");
    if (!URL_RE.test(url)) {
      v.className = "ob-verify err";
      v.textContent = "That doesn't look like a Web app URL — it should end in /exec, like https://script.google.com/macros/s/…/exec";
      return;
    }
    v.className = "ob-verify busy"; v.textContent = "Checking the connection to your Sheet…";
    if (!(await this.app.cloud.ping(url))) {
      v.className = "ob-verify err";
      v.textContent = "Couldn't reach it. Make sure you deployed as a Web app with access = Anyone, and pasted the /exec URL.";
      return;
    }
    this.app.cloudUrl = url;
    try { localStorage.setItem(KEY_URL, url); } catch(e) {}
    v.className = "ob-verify ok"; v.textContent = "✓ Connected! Syncing your Sheet…";
    await this.app.cloud.firstSync();
    this._dismissSeedBanner();
    this.closeOnboard(); this.app.cloud.updateConnUI(); this.toast("Google Drive connected ✓"); Sounds.success();
  }

  /* ── settings modal ── */

  fillSettings() {
    $("bOverall").value = this.app.budgets.overall || "";
    $("bCats").innerHTML = CATS.map(c =>
      '<div class="set-row"><label>' + c.e + " " + c.n + '</label><input data-bcat="' + c.k +
      '" inputmode="numeric" placeholder="—" value="' + (this.app.budgets.cats[c.k]||"") + '"></div>'
    ).join("");
  }

  /* ── data modal ── */

  fillTxnFilter() {
    $("txnFilter").innerHTML = '<option value="">All categories</option>' +
      CATS.map(c => '<option value="' + c.k + '">' + c.e + " " + c.n + '</option>').join("");
  }

  finishImport(res) {
    this.app.render();
    if (res.rows && res.rows.length) this.app.cloud.sync({op:"import", expenses: res.rows});
    this.toast(
      "Imported " + res.added + " · skipped " + res.skipped + " duplicate" + (res.skipped === 1 ? "" : "s") +
      (res.bad ? " · " + res.bad + " unreadable" : "") +
      (this.app.cloudUrl && res.added ? " · saving to Drive…" : "")
    );
    if (res.added) $("dataModal").close();
  }

  csvOut() {
    let s = "Date,Category,Description,Amount\n";
    for (const e of this.app.expenses) {
      const c = catByKey(e.cat);
      s += e.date + ',"' + c.n + '","' + String(e.note||"").replace(/"/g,'""') + '",' + e.amount + "\n";
    }
    return s;
  }

  download(name, text, type) {
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], {type}));
      a.download = name; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
    } catch(err) { console.error(err); }
  }

  _dismissSeedBanner() {
    this.app.meta.seedDismissed = true;
    $("seedBanner").hidden = true;
    Store.set(KEY_META, JSON.stringify(this.app.meta));
  }

  /* ── monthly report ── */

  printReport() {
    const a = this.app;
    const D = a.renderer.monthData(a.view.y, a.view.m);
    if (!D.list.length) { this.toast("No expenses in " + MONTHS[a.view.m] + " to report"); return; }
    const Pm = a.view.m === 0 ? 11 : a.view.m - 1;
    const Py = a.view.m === 0 ? a.view.y - 1 : a.view.y;
    const P  = a.renderer.monthData(Py, Pm);
    const month = MONTHS[a.view.m] + " " + a.view.y;
    const B = a.budgets.overall;
    const diff = P.spent > 0 ? D.spent - P.spent : null;
    const txnCount = D.list.length;
    const avgTxn   = txnCount > 0 ? D.spent / txnCount : 0;
    const perDay   = D.perDay.slice(1);
    const daysWithSpend = perDay.filter(v => v > 0).length;
    const maxDaySpend   = Math.max(...perDay);
    const maxDayIdx     = D.perDay.indexOf(maxDaySpend, 1);
    const maxDayStr     = maxDayIdx > 0 ? new Date(D.y, D.m, maxDayIdx).toLocaleDateString("en-IN", {weekday:"short", day:"numeric", month:"short"}) : null;

    const catRows = CATS
      .map(c => ({c, sp: D.byCat[c.k] || 0, b: a.budgets.cats[c.k] || null}))
      .filter(r => r.sp > 0).sort((x, y) => y.sp - x.sp);
    const maxSp = catRows.length ? catRows[0].sp : 1;

    const catHTML = catRows.map(({c, sp, b}) => {
      const pct = Math.round(sp / D.spent * 100);
      const cls = b ? (sp > b ? "over" : sp > b * 0.8 ? "warn" : "") : "";
      return `<div class="rcat">
        <div class="rcat-top"><span class="re">${c.e}</span><span class="rcat-name">${c.n}</span>
        <span class="rcat-pct">${pct}%</span>
        <span class="rcat-amt">${fmt(sp)}${b ? '<span class="rbud"> / ' + fmt(b) + '</span>' : ''}</span></div>
        <div class="rbar-wrap"><div class="rbar ${cls}" style="width:${Math.round(sp/maxSp*100)}%"></div></div>
      </div>`;
    }).join("");

    const byDate = {};
    for (const e of [...D.list].sort((x,y) => x.date < y.date ? 1 : -1))
      (byDate[e.date] = byDate[e.date] || []).push(e);
    const txnHTML = Object.entries(byDate).map(([dt, items]) => {
      const total = items.reduce((s, e) => s + e.amount, 0);
      const d = new Date(dt + "T00:00:00");
      return `<div class="rday"><div class="rday-h"><span>${d.toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}</span><b>${fmt(total)}</b></div>` +
        items.map(e => { const c = catByKey(e.cat); return `<div class="rtxn"><span class="re">${c.e}</span><span class="rtxn-n">${esc(e.note||c.n)}</span><span class="rtxn-c">${c.n}</span><span class="rtxn-a">${fmt(e.amount)}</span></div>`; }).join("") +
        `</div>`;
    }).join("");

    const ins = [];
    if (maxDayStr && maxDaySpend > 0) ins.push({l:"Biggest Day", v: maxDayStr + " · " + fmt(maxDaySpend), cls:""});
    ins.push({l:"Active Days", v: daysWithSpend + " of " + D.elapsed + " days", cls:""});
    ins.push({l:"Avg per Transaction", v: fmt(avgTxn), cls:""});
    if (catRows[0]) ins.push({l:"Top Category", v: catRows[0].c.e + " " + catRows[0].c.n + " · " + Math.round(catRows[0].sp/D.spent*100) + "%", cls:""});
    if (diff !== null) ins.push({l:"vs " + MONTHS[Pm].slice(0,3), v:(diff<=0?"▼ Saved ":"▲ Spent ")+fmt(Math.abs(diff))+(diff>0?" more":""), cls:diff<=0?"good":"bad"});
    if (D.isCur) ins.push({l:"Month-End Projection", v: fmt(D.proj), cls:""});
    if (B) ins.push({l:"Budget Used", v: Math.round(D.spent/B*100)+"% of "+fmt(B), cls: D.spent>B?"bad":""});
    const insHTML = ins.map(i => `<div class="ri"><div class="ri-l">${i.l}</div><div class="ri-v ${i.cls}">${i.v}</div></div>`).join("");

    const kpis = [
      {l:"Total Spent", v:fmt(D.spent), sub: diff!==null?(diff<=0?"▼ ":"▲ ")+fmt(Math.abs(diff))+" vs "+MONTHS[Pm].slice(0,3):"", cls:diff!==null?(diff<=0?"good":"bad"):""},
      {l:"Transactions", v:String(txnCount), sub:"avg "+fmt(avgTxn)+" each", cls:""},
      {l:"Daily Average", v:fmt(D.avg), sub:"over "+D.elapsed+" days", cls:""},
      ...(B?[{l:"vs Budget", v:fmt(Math.abs(B-D.spent)), sub:D.spent>B?"⛔ Over budget":"✓ Under budget", cls:D.spent>B?"bad":"good"}]:[])
    ];
    const kpiHTML = kpis.map(k=>`<div class="rkpi"><div class="rkpi-l">${k.l}</div><div class="rkpi-v">${k.v}</div><div class="rkpi-sub ${k.cls}">${k.sub}</div></div>`).join("");
    const genDate = new Date().toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"});

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PaisaPulse — ${month} Report</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@700;900&family=Manrope:wght@600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#080611;color:rgba(245,240,255,.94);font-family:'Manrope',system-ui,sans-serif;font-size:14px;line-height:1.6}
.report{max-width:860px;margin:0 auto;padding:44px 28px 100px}
.r-hd{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:36px;padding-bottom:24px;border-bottom:1px solid rgba(255,255,255,.09)}
.r-brand{display:flex;align-items:center;gap:14px}
.r-logo{width:44px;height:44px;border-radius:12px;background:rgba(176,107,255,.15);border:1px solid rgba(176,107,255,.28);display:flex;align-items:center;justify-content:center;font-size:22px}
.r-bname{font-family:'Unbounded',sans-serif;font-weight:900;font-size:17px;background:linear-gradient(100deg,#b06bff,#f472b6 60%,#fcd34d);-webkit-background-clip:text;background-clip:text;color:transparent}
.r-bsub{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(245,240,255,.36);margin-top:2px}
.r-right{text-align:right}
.r-month{font-family:'Unbounded',sans-serif;font-weight:700;font-size:19px}
.r-gen{font-size:11px;color:rgba(245,240,255,.32);margin-top:4px}
.rkpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px;margin-bottom:34px}
.rkpi{background:linear-gradient(165deg,rgba(255,255,255,.065),rgba(255,255,255,.022));border:1px solid rgba(255,255,255,.09);border-radius:16px;padding:16px}
.rkpi-l{font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:rgba(245,240,255,.36);margin-bottom:5px}
.rkpi-v{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:22px}
.rkpi-sub{font-size:11.5px;font-weight:600;color:rgba(245,240,255,.44);margin-top:3px}
.rkpi-sub.good{color:#b06bff}.rkpi-sub.bad{color:#fb6f92}
h2{font-family:'Unbounded',sans-serif;font-weight:700;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(245,240,255,.38);margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.07)}
.rsec{margin-bottom:36px}
.rcat{margin-bottom:14px}
.rcat-top{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.re{flex:none;font-size:15px}
.rcat-name{flex:1;font-weight:700;font-size:13px}
.rcat-pct{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:rgba(245,240,255,.44);min-width:36px;text-align:right}
.rcat-amt{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;min-width:90px;text-align:right}
.rbud{color:rgba(245,240,255,.34);font-size:11px}
.rbar-wrap{height:6px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden}
.rbar{height:100%;border-radius:99px;background:linear-gradient(90deg,#b06bff,#f472b6)}
.rbar.warn{background:linear-gradient(90deg,#fbbf24,#fb923c)}
.rbar.over{background:linear-gradient(90deg,#fb6f92,#f43f5e)}
.ri-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}
.ri{padding:12px 14px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);border-radius:12px}
.ri-l{font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:rgba(245,240,255,.36);margin-bottom:4px}
.ri-v{font-weight:700;font-size:13px}
.ri-v.good{color:#b06bff}.ri-v.bad{color:#fb6f92}
.rday{margin-bottom:4px}
.rday-h{display:flex;justify-content:space-between;align-items:baseline;padding:10px 0 5px;font-size:10.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:rgba(245,240,255,.36);border-bottom:1px solid rgba(255,255,255,.06)}
.rday-h b{font-family:'JetBrains Mono',monospace;font-size:12px;color:rgba(245,240,255,.52);letter-spacing:0;text-transform:none;font-weight:700}
.rtxn{display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid rgba(255,255,255,.04)}
.rtxn:last-child{border-bottom:none}
.rtxn-n{flex:1;font-weight:700;font-size:13px}
.rtxn-c{font-size:11px;color:rgba(245,240,255,.36);font-weight:600;min-width:130px}
.rtxn-a{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:13px;min-width:80px;text-align:right}
.r-footer{margin-top:40px;text-align:center;font-size:11px;color:rgba(245,240,255,.22);font-weight:600;letter-spacing:.5px;padding-top:20px;border-top:1px solid rgba(255,255,255,.06)}
.r-printbtn{position:fixed;bottom:24px;right:24px;background:linear-gradient(120deg,#b06bff,#f472b6);color:#04140d;font-family:'Manrope',sans-serif;font-weight:800;font-size:13px;border:none;border-radius:12px;padding:12px 22px;cursor:pointer;box-shadow:0 0 24px rgba(176,107,255,.45);letter-spacing:.3px}
@media print{
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  .r-printbtn{display:none}
  .rsec{break-inside:avoid}
}
</style></head><body>
<div class="report">
  <div class="r-hd">
    <div class="r-brand"><div class="r-logo">₹</div><div><div class="r-bname">PaisaPulse</div><div class="r-bsub">Monthly Expense Report</div></div></div>
    <div class="r-right"><div class="r-month">${month}</div><div class="r-gen">Generated ${genDate}</div></div>
  </div>
  <div class="rkpis">${kpiHTML}</div>
  <div class="rsec"><h2>Category Breakdown</h2>${catHTML}</div>
  <div class="rsec"><h2>Spending Insights</h2><div class="ri-grid">${insHTML}</div></div>
  <div class="rsec"><h2>Transactions · ${txnCount} entries</h2>${txnHTML}</div>
  <div class="r-footer">PaisaPulse · ${genDate}</div>
</div>
<button class="r-printbtn" onclick="window.print()">🖨 Print / Save PDF</button>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) { this.toast("Allow pop-ups for this page to open the report"); return; }
    w.document.write(html);
    w.document.close();
  }

  /* ── event wiring ── */

  wire() {
    const a = this.app;

    /* kbd hint */
    $("kbdHint").innerHTML = 'Amount does math (<kbd>=20+80</kbd>) · <kbd>Ctrl</kbd>+<kbd>J/K/L/;</kbd> jumps amount → date → category → note (or <kbd>Alt</kbd>+<kbd>1</kbd>–<kbd>9</kbd>) · <kbd>Enter</kbd> adds · <kbd>←</kbd>/<kbd>→</kbd> change month';

    /* add expense */
    $("btnAdd").addEventListener("click", () => a.addExpense());

    /* edit */
    $("txnList").addEventListener("click", e => {
      const eb = e.target.closest("[data-edit]"); if (!eb) return;
      a.editTxn(eb.dataset.edit);
    });

    /* delete */
    $("txnList").addEventListener("click", e => {
      const b = e.target.closest("[data-del]"); if (!b) return;
      const id = b.dataset.del;
      if (a.meta.confirmDelete === false) { a.deleteTxn(id); return; }
      if (b.dataset.armed) { a.deleteTxn(id); return; }
      b.dataset.armed = "1"; b.classList.add("confirm"); b.textContent = "Delete?";
      setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.classList.remove("confirm"); b.textContent = "✕"; } }, 3000);
    });

    /* confirm-delete toggle */
    $("confirmDel").checked = a.meta.confirmDelete !== false;
    $("confirmDel").addEventListener("change", () => { a.meta.confirmDelete = $("confirmDel").checked; a.persist(); });

    /* month nav */
    $("prevM").addEventListener("click", () => { a.view.m--; if (a.view.m < 0) { a.view.m = 11; a.view.y--; } Sounds.navPrev(); a.render(); });
    $("nextM").addEventListener("click", () => { a.view.m++; if (a.view.m > 11) { a.view.m = 0; a.view.y++; } Sounds.navNext(); a.render(); });

    /* month picker */
    $("monthLabel").addEventListener("click", e => { e.stopPropagation(); $("monthPicker").hidden ? this.openMonthPicker() : this.closeMonthPicker(); });
    $("mpPrevY").addEventListener("click", () => { this.mpYearShown--; this._renderMonthPicker(); });
    $("mpNextY").addEventListener("click", () => { if (this.mpYearShown < NOW.getFullYear()) { this.mpYearShown++; this._renderMonthPicker(); } });
    $("mpToday").addEventListener("click", () => { a.view = {y:NOW.getFullYear(), m:NOW.getMonth()}; this.closeMonthPicker(); a.render(); });
    $("mpGrid").addEventListener("click", e => {
      const b = e.target.closest("[data-m]"); if (!b || b.disabled) return;
      a.view = {y:this.mpYearShown, m:+b.dataset.m}; this.closeMonthPicker(); a.render();
    });
    document.addEventListener("click", e => { if (!$("monthPicker").hidden && !e.target.closest(".month-nav")) this.closeMonthPicker(); });

    /* txn sort + filter */
    $("txnFilter").addEventListener("change", () => { a.txnCat = $("txnFilter").value; a.render(); });
    $("txnSort").addEventListener("change",   () => { a.txnSort = $("txnSort").value;  a.render(); });

    /* modals: open */
    $("btnData").addEventListener("click",     () => { Sounds.open(); $("dataModal").showModal(); });
    $("btnSettings").addEventListener("click", () => { Sounds.open(); this.fillSettings(); $("settingsModal").showModal(); });

    /* sound toggle */
    const sndBtn = $("btnSound");
    if (sndBtn) {
      sndBtn.textContent = Sounds.on ? "🔊" : "🔇";
      sndBtn.addEventListener("click", () => { sndBtn.textContent = Sounds.toggle() ? "🔊" : "🔇"; });
    }
    document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));

    /* tabs inside data modal */
    document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === t));
      $("tab-import").hidden = t.dataset.tab !== "import";
      $("tab-export").hidden = t.dataset.tab !== "export";
      Sounds.tab();
    }));

    /* import */
    $("csvFile").addEventListener("change", e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { this.finishImport(Calculator.importCSV(String(r.result), a.expenses)); e.target.value = ""; };
      r.readAsText(f);
    });
    $("btnImport").addEventListener("click", () => {
      const t = $("csvPaste").value.trim();
      if (!t) { this.toast("Choose a CSV file or paste CSV text"); return; }
      const res = Calculator.importCSV(t, a.expenses);
      if (res.rows.length) { a.expenses.push(...res.rows); a.sortExp(); a.persist(); }
      this.finishImport(res);
      $("csvPaste").value = "";
    });

    /* export */
    $("btnBackup").addEventListener("click", () => {
      const j = JSON.stringify({app:"PaisaPulse", v:1, exported:new Date().toISOString(), expenses:a.expenses, budgets:a.budgets}, null, 1);
      $("exportBox").value = j; this.download("paisapulse-backup-" + todayISO() + ".json", j, "application/json");
      this.toast("Backup ready — keep it in Drive too");
    });
    $("btnCsvOut").addEventListener("click", () => {
      const c = this.csvOut(); $("exportBox").value = c;
      this.download("paisapulse-expenses-" + todayISO() + ".csv", c, "text/csv");
      this.toast("CSV ready");
    });
    $("btnCopyExport").addEventListener("click", async () => {
      const t = $("exportBox").value; if (!t) { this.toast("Generate an export first"); return; }
      try { await navigator.clipboard.writeText(t); this.toast("Copied ✓"); }
      catch(e) { $("exportBox").select(); this.toast("Press Ctrl+C to copy"); }
    });

    /* restore */
    this._armButton($("btnRestore"), "Restore from pasted JSON (replaces everything)", () => {
      try {
        const j = JSON.parse($("exportBox").value);
        if (!Array.isArray(j.expenses)) throw new Error("no expenses array");
        a.expenses = j.expenses.filter(e => e && e.date && e.amount > 0).map(e => ({id:e.id||uid(), date:e.date, amount:+e.amount, cat:e.cat||"misc", note:e.note||""}));
        a.budgets  = j.budgets && typeof j.budgets === "object" ? {overall:j.budgets.overall||null, cats:j.budgets.cats||{}} : a.budgets;
        a.sortExp(); a.persist(); a.render(); $("dataModal").close();
        if (a.cloudUrl) { a.cloud.sync({op:"replace", expenses:a.expenses}); a.cloud.sync({op:"budgets", budgets:a.budgets}); }
        this.toast("Restored " + a.expenses.length + " expenses ✓");
      } catch(e) { this.toast("That doesn't look like a PaisaPulse backup"); }
    });

    /* safe reset */
    $("wipeConfirm").addEventListener("input", () => { $("btnWipe").disabled = $("wipeConfirm").value.trim().toUpperCase() !== "RESET"; });
    $("btnWipe").addEventListener("click", () => {
      if ($("wipeConfirm").value.trim().toUpperCase() !== "RESET") return;
      a.expenses = []; a.budgets = {overall:null, cats:{}};
      Store.set(KEY_EXP, JSON.stringify(a.expenses)); Store.set(KEY_BUD, JSON.stringify(a.budgets));
      $("wipeConfirm").value = ""; $("btnWipe").disabled = true;
      a.render(); $("settingsModal").close();
      this.toast(a.cloudUrl ? "Local copy cleared — reload to pull your Sheet back" : "Local copy cleared");
    });

    /* save budgets */
    $("btnSaveBudgets").addEventListener("click", () => {
      const o = Calculator.parseAmount($("bOverall").value); a.budgets.overall = (o && o > 0) ? o : null;
      document.querySelectorAll("[data-bcat]").forEach(inp => {
        const v = Calculator.parseAmount(inp.value);
        if (v && v > 0) a.budgets.cats[inp.dataset.bcat] = v; else delete a.budgets.cats[inp.dataset.bcat];
      });
      a.persist(); a.render(); $("settingsModal").close();
      a.cloud.sync({op:"budgets", budgets:a.budgets});
      this.toast("Budgets saved" + (a.cloudUrl ? " · saving…" : " ✓"));
    });

    /* edit modal save */
    $("btnSaveEdit").addEventListener("click", () => a.saveEdit());
    $("editAmt").addEventListener("keydown", e => { if (e.key === "Enter") a.saveEdit(); });

    /* monthly report */
    $("btnReport").addEventListener("click", () => this.printReport());

    /* greeting name edit */
    $("greetEdit").addEventListener("click", () => this.startNameEdit());

    /* seed banner dismiss */
    $("seedDismiss").addEventListener("click", () => this._dismissSeedBanner());

    /* onboarding */
    $("obPickNew").addEventListener("click",      () => this.chooseMode("new"));
    $("obPickExisting").addEventListener("click", () => this.chooseMode("existing"));
    $("obBack").addEventListener("click",         () => { $("obFlow").hidden = true; $("obChoose").hidden = false; });
    $("obNewSheet").addEventListener("click",     () => window.open("https://sheets.new", "_blank", "noopener"));
    $("obShowHow").addEventListener("click",      () => { const h = $("obHowto"); h.hidden = !h.hidden; $("obShowHow").textContent = h.hidden ? "Show deploy steps" : "Hide steps"; });
    $("scriptCode").value = ($("ppScriptSrc").textContent || "").replace(/^\s+/, "");
    $("obCopyScript").addEventListener("click", async () => {
      const code = $("scriptCode").value;
      try { await navigator.clipboard.writeText(code); this.toast("Script copied — paste it into Apps Script ✓"); }
      catch(e) { $("scriptCode").focus(); $("scriptCode").select(); this.toast("Press Ctrl+C to copy the script"); }
    });
    $("obConnect").addEventListener("click",       () => this.connectCloud());
    $("cloudUrlInput").addEventListener("keydown", e => { if (e.key === "Enter") this.connectCloud(); });
    $("obSkip").addEventListener("click", () => { a.meta.onboardSkipped = true; a.persist(); this.closeOnboard(); a.cloud.updateConnUI(); });
  }

  /* Arm-to-confirm helper: first click → confirm text, second click → execute */
  _armButton(btn, label, fn) {
    btn.addEventListener("click", () => {
      if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = label; fn(); }
      else {
        btn.dataset.armed = "1"; btn.textContent = "Sure? Click again to confirm";
        setTimeout(() => { delete btn.dataset.armed; btn.textContent = label; }, 3500);
      }
    });
  }
}
