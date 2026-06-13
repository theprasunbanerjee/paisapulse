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
    this.closeOnboard(); this.app.cloud.updateConnUI(); this.toast("Google Drive connected ✓");
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

  /* ── event wiring ── */

  wire() {
    const a = this.app;

    /* kbd hint */
    $("kbdHint").innerHTML = 'Amount does math (<kbd>=20+80</kbd>) · <kbd>Ctrl</kbd>+<kbd>J/K/L/;</kbd> jumps amount → date → category → note (or <kbd>Alt</kbd>+<kbd>1</kbd>–<kbd>9</kbd>) · <kbd>Enter</kbd> adds · <kbd>←</kbd>/<kbd>→</kbd> change month';

    /* add expense */
    $("btnAdd").addEventListener("click", () => a.addExpense());

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
    $("prevM").addEventListener("click", () => { a.view.m--; if (a.view.m < 0) { a.view.m = 11; a.view.y--; } a.render(); });
    $("nextM").addEventListener("click", () => { a.view.m++; if (a.view.m > 11) { a.view.m = 0; a.view.y++; } a.render(); });

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
    $("btnData").addEventListener("click",     () => $("dataModal").showModal());
    $("btnSettings").addEventListener("click", () => { this.fillSettings(); $("settingsModal").showModal(); });
    document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));

    /* tabs inside data modal */
    document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === t));
      $("tab-import").hidden = t.dataset.tab !== "import";
      $("tab-export").hidden = t.dataset.tab !== "export";
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
