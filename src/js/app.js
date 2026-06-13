/* ── app.js — PaisaPulse: main class, state, lifecycle ── */

class PaisaPulse {
  constructor() {
    /* ── app state ── */
    this.expenses  = [];
    this.budgets   = {overall: null, cats: {}};
    this.meta      = {seedDismissed: false};
    this.view      = {y: NOW.getFullYear(), m: NOW.getMonth()};
    this.selCat    = "dining";
    this.txnCat    = "";          // transactions category filter ("" = all)
    this.txnSort   = "date-desc"; // transactions sort order
    this.chartMode = "daily";     // "daily" | "monthly"
    this.userName  = "";
    this.cloudUrl  = null;
    this.outbox    = [];          // write queue — drained by CloudSync.flushOutbox
    this.saveTimer = null;
    this.lastDeleted = null;

    /* ── sub-systems (each receives a reference back to this app) ── */
    this.cloud    = new CloudSync(this);
    this.search   = new CategorySearch(this);
    this.chart    = new Chart(this);
    this.renderer = new Renderer(this);
    this.keyboard = new KeyboardHandler(this);
    this.ui       = new UI(this);
  }

  /* ── core state helpers ── */

  render()  { this.renderer.render(); }
  sortExp() { this.expenses.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0); }

  persist() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      Store.set(KEY_EXP,  JSON.stringify(this.expenses));
      Store.set(KEY_BUD,  JSON.stringify(this.budgets));
      Store.set(KEY_META, JSON.stringify(this.meta));
    }, 200);
  }

  /* ── expense mutations ── */

  addExpense() {
    const a = Calculator.parseAmount($("amt").value);
    if (!a || a <= 0) { this.ui.toast("Enter an amount first"); $("amt").focus(); return; }
    const d   = $("date").value || todayISO();
    const exp = {id:uid(), date:d, amount:a, cat:this.selCat, note:$("note").value.trim(), createdAt:new Date().toISOString()};
    this.expenses.push(exp); this.sortExp(); this.persist();
    const parts = d.split("-"); this.view = {y:+parts[0], m:+parts[1]-1};
    $("amt").value = ""; $("note").value = "";
    this.render();
    this.ui.toast("Added " + fmt(a) + (this.cloudUrl ? " · saving…" : " ✓"));
    this.cloud.sync({op:"add", expense:exp});
  }

  deleteTxn(id) {
    const i = this.expenses.findIndex(x => x.id === id); if (i < 0) return;
    this.lastDeleted = this.expenses.splice(i, 1)[0];
    this.persist(); this.render();
    this.cloud.sync({op:"delete", id:this.lastDeleted.id});
    this.ui.toast("Deleted " + fmt(this.lastDeleted.amount), "Undo", () => {
      this.expenses.push(this.lastDeleted); this.sortExp(); this.persist(); this.render();
      this.cloud.sync({op:"add", expense:this.lastDeleted});
    });
  }

  /* ── initialisation ── */

  async init() {
    await Store.init();
    this.cloud.loadOutbox();
    try { this.cloudUrl = localStorage.getItem(KEY_URL) || null; } catch(e) { this.cloudUrl = null; }

    /* Load local cache first → instant paint, never a blank screen */
    try {
      const e = await Store.get(KEY_EXP);  if (e) this.expenses = JSON.parse(e) || [];
      const b = await Store.get(KEY_BUD);  if (b) this.budgets  = Object.assign({overall:null, cats:{}}, JSON.parse(b));
      const m = await Store.get(KEY_META); if (m) this.meta     = Object.assign(this.meta, JSON.parse(m));
      const n = await Store.get(KEY_NAME); if (n) this.userName = n;
    } catch(err) { console.error("load failed", err); }

    /* Seed only for a brand-new, never-connected user */
    if (!this.expenses.length && !this.cloudUrl) {
      this.expenses = SEED.slice(); this.sortExp(); this.persist();
      if (!this.meta.seedDismissed) $("seedBanner").hidden = false;
    }

    /* Initial DOM setup */
    $("date").value        = todayISO();
    $("todayPill").textContent = NOW.toLocaleDateString("en-IN", {weekday:"short", day:"numeric", month:"short", year:"numeric"});

    this.ui.fillTxnFilter();
    this.renderer.renderChips();
    this.cloud.updateConnUI();
    this.ui.renderGreeting();
    this.render();

    /* Wire all event listeners */
    this.cloud.wire();
    this.search.wire();
    this.renderer.wire();
    this.chart.wire();
    this.keyboard.wire();
    this.ui.wire();

    /* Connect to cloud or show onboarding */
    if (this.cloudUrl) {
      if (!this.expenses.length) document.body.classList.add("loading-cloud");
      await this.cloud.loadFromCloud();
      document.body.classList.remove("loading-cloud");
      this.render();
      this.cloud.flushOutbox();
    } else if (!this.meta.onboardSkipped) {
      this.ui.openOnboard();
    }

    /* Visual effects (non-essential, last) */
    initCursorFx();
    initEntranceAnims();
  }
}

/* Bootstrap */
const app = new PaisaPulse();
app.init();
