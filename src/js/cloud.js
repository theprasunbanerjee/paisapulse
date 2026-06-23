/* ── cloud.js — Google Apps Script sync: outbox, flush, connect, first-sync ── */

/* Row conversion: expenses use short category keys; the Sheet stores human-readable names */
const catKeyFromName = n => {
  const t = String(n || "").trim().toLowerCase();
  const hit = CATS.find(c => c.n.toLowerCase() === t);
  return hit ? hit.k : Calculator.matchCat(n);
};
const catNameFromKey = k => catByKey(k).n;
const expToRow = e => ({ id:e.id, date:e.date, cat:catNameFromKey(e.cat), note:e.note||"", amount:e.amount, createdAt:e.createdAt||new Date().toISOString() });
const rowToExp = r => ({ id:r.id||uid(), date:Calculator.parseDate(r.date)||String(r.date||""), amount:+r.amount||0, cat:catKeyFromName(r.cat), note:r.note||"", createdAt:r.createdAt||"" });

class CloudSync {
  constructor(app) {
    this.app      = app;
    this.flushing = false;
    this.retryT   = null;
  }

  /* ── network ── */

  async call(body) {
    const url  = this.app.cloudUrl;
    const init = body
      ? { method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"}, body:JSON.stringify(body), redirect:"follow" }
      : { method:"GET",  redirect:"follow" };
    const r = await fetch(url, init);
    if (!r.ok) throw new Error("HTTP " + r.status);
    let j;
    try { j = JSON.parse(await r.text()); } catch(e) { throw new Error("bad response from script"); }
    if (j && j.ok === false) throw new Error(j.error || "script error");
    return j;
  }

  async ping(url) {
    try {
      const r = await fetch(url, {method:"GET", redirect:"follow"});
      if (!r.ok) return false;
      const j = JSON.parse(await r.text());
      return !!(j && (j.ok || Array.isArray(j.expenses)));
    } catch(e) { return false; }
  }

  /* ── data apply ── */

  applyData(j) {
    const rows = Array.isArray(j) ? j : (j.expenses || []);
    this.app.expenses = rows.map(rowToExp).filter(e => e.date && e.amount > 0);
    if (j.budgets && typeof j.budgets === "object")
      this.app.budgets = {overall: j.budgets.overall||null, cats: j.budgets.cats||{}};
    this.app.sortExp();
    this.app.applyTxnMeta();   // re-attach credit type/cardId (the Sheet doesn't store them)
    Store.set(KEY_EXP, JSON.stringify(this.app.expenses));
    Store.set(KEY_BUD, JSON.stringify(this.app.budgets));
    if (j.folderUrl) try { localStorage.setItem(KEY_FOLDER, j.folderUrl); } catch(e) {}
  }

  async loadFromCloud() {
    this.setSync("loading");
    try { this.applyData(await this.call(null)); this.setSync("saved"); this.updateConnUI(); return true; }
    catch(e) { console.error("cloud load failed", e); this.setSync("error"); return false; }
  }

  /* ── outbox: queued writes survive reloads, replayed until the Sheet confirms ── */

  loadOutbox() {
    try { this.app.outbox = JSON.parse(localStorage.getItem(KEY_OUT)) || []; } catch(e) { this.app.outbox = []; }
  }

  saveOutbox() {
    try { localStorage.setItem(KEY_OUT, JSON.stringify(this.app.outbox)); } catch(e) {}
  }

  opBody(op) {
    if (op.op === "add")     return {action:"add",     expense: expToRow(op.expense)};
    if (op.op === "delete")  return {action:"delete",  id: op.id};
    if (op.op === "budgets") return {action:"budgets",  budgets: op.budgets};
    if (op.op === "import")  return {action:"import",  expenses: op.expenses.map(expToRow)};
    if (op.op === "replace") return {action:"import",  replace:true, expenses: op.expenses.map(expToRow)};
  }

  async flushOutbox() {
    const out = this.app.outbox;
    if (this.flushing || !this.app.cloudUrl || !out.length) return;
    this.flushing = true; this.setSync("saving");
    try {
      while (out.length) { await this.call(this.opBody(out[0])); out.shift(); this.saveOutbox(); }
      this.setSync("saved"); this.flushing = false;
    } catch(e) {
      console.error("sync failed", e); this.flushing = false; this.setSync("error");
      if (!this.retryT) this.retryT = setTimeout(() => { this.retryT = null; this.flushOutbox(); }, 5000);
    }
  }

  /* Push an operation; caller has already updated local state */
  sync(op) {
    if (!this.app.cloudUrl) return;
    this.app.outbox.push(op); this.saveOutbox(); this.flushOutbox();
  }

  /* ── status badge ── */

  setSync(state) {
    const badge = $("saveBadge"), bt = $("saveBadgeTxt");
    if (!badge) return;
    badge.className = "badge";
    if (!this.app.cloudUrl) {
      bt.textContent = Store.mode === "local" ? "Saved on this device" : "Saved this session"; return;
    }
    if (state === "loading") { badge.classList.add("saving"); bt.textContent = "Loading…"; }
    else if (state === "saving") { badge.classList.add("saving"); bt.textContent = "Saving…"; }
    else if (state === "error") { badge.classList.add("err"); bt.textContent = "Couldn't reach Drive — retrying"; }
    else { badge.classList.add("synced"); bt.textContent = "Saved to Drive ✓"; }
  }

  updateConnUI() {
    const dot = $("connDot"), txt = $("connTxt"), btn = $("btnChangeConn"), loc = $("btnLocateDrive");
    if (dot) dot.className = "conn-dot" + (this.app.cloudUrl ? "" : " off");
    if (txt) txt.textContent = this.app.cloudUrl ? "Connected to your Google Sheet" : "Not connected — data is on this device only";
    if (btn) btn.textContent = this.app.cloudUrl ? "Change / disconnect Drive" : "Connect Google Drive";
    if (loc) {
      let folderUrl = null;
      if (this.app.cloudUrl) try { folderUrl = localStorage.getItem(KEY_FOLDER); } catch(e) {}
      loc.hidden = !folderUrl;
    }
    this.setSync("saved");
  }

  /* ── first connection: pull if Sheet has data, push if Sheet is empty ── */

  async firstSync() {
    this.setSync("loading");
    try {
      const j    = await this.call(null);
      const rows = Array.isArray(j) ? j : (j.expenses || []);
      if (rows.length) {
        this.applyData(j);                            // Sheet has data → pull, leave Sheet untouched
      } else if (this.app.expenses.length) {          // Sheet empty → push local data up (append, deduped)
        this.sync({op:"import", expenses: this.app.expenses});
        if (this.app.budgets.overall || Object.keys(this.app.budgets.cats).length)
          this.sync({op:"budgets", budgets: this.app.budgets});
      }
      this.app.render(); this.setSync(this.app.outbox.length ? "saving" : "saved");
    } catch(e) { console.error("first sync failed", e); this.setSync("error"); }
  }

  /* ── event wiring ── */

  wire() {
    $("btnLocateDrive").addEventListener("click", () => {
      try { const url = localStorage.getItem(KEY_FOLDER); if (url) window.open(url, "_blank", "noopener"); } catch(e) {}
    });
    $("btnChangeConn").addEventListener("click", () => {
      const was = !!this.app.cloudUrl;
      this.app.cloudUrl = null;
      try { localStorage.removeItem(KEY_URL); } catch(e) {}
      $("dataModal").close();
      this.updateConnUI();
      if (was) this.app.ui.toast("Disconnected — your Sheet & all its data are safe in Drive");
      this.app.ui.openOnboard();
    });
  }
}
