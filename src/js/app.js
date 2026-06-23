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
    this.editingId   = null;
    this.editSelCat  = "dining";
    this.cards       = [];        // credit cards: {id, name, statementDay, dueDay}
    this.addType     = TX_NORMAL; // payment method on the add form
    this.addCardId   = null;
    this.editType    = TX_NORMAL;
    this.editCardId  = null;
    this.payCardId   = null;

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

  /* ── credit overlay + cards persistence ── */

  /* Mirror type/cardId into a side-table keyed by id, so a cloud pull
     (which rebuilds expenses from the Sheet, sans these fields) can re-attach them. */
  saveTxnMeta() {
    const m = {};
    for (const e of this.expenses) {
      if ((e.type && e.type !== TX_NORMAL) || e.cardId) m[e.id] = {type: e.type || TX_NORMAL, cardId: e.cardId || null};
    }
    try { localStorage.setItem(KEY_TXN_META, JSON.stringify(m)); } catch(e) {}
  }
  saveCards() { try { localStorage.setItem(KEY_CARDS, JSON.stringify(this.cards)); } catch(e) {} }
  cardById(id) { return this.cards.find(c => c.id === id) || null; }

  /* Re-attach type/cardId from the overlay onto whatever is in this.expenses.
     Local rows already carry them; cloud-pulled rows don't — this fixes those. */
  applyTxnMeta() {
    let m = {};
    try { m = JSON.parse(localStorage.getItem(KEY_TXN_META)) || {}; } catch(e) {}
    for (const e of this.expenses) {
      const o = m[e.id];
      if (!e.type) e.type = (o && o.type) || TX_NORMAL;
      if (e.cardId == null) e.cardId = (o && o.cardId) || null;
    }
  }

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
    const isCredit = this.addType === TX_CREDIT;
    if (isCredit && !this.addCardId) { this.ui.toast("Pick a card for this credit purchase"); return; }
    const exp = {id:uid(), date:d, amount:a, cat:this.selCat, note:$("note").value.trim(), createdAt:new Date().toISOString(),
                 type: isCredit ? TX_CREDIT : TX_NORMAL, cardId: isCredit ? this.addCardId : null};
    this.expenses.push(exp); this.sortExp(); this.persist(); this.saveTxnMeta();
    const parts = d.split("-"); this.view = {y:+parts[0], m:+parts[1]-1};
    $("amt").value = ""; $("note").value = "";
    this.addType = TX_NORMAL; this.addCardId = null; this.ui.syncAddPaywith();
    this.render();
    Sounds.add();
    this.ui.toast("Added " + fmt(a) + (isCredit ? " on " + (this.cardById(exp.cardId)?.name || "card") : "") + (this.cloudUrl ? " · saving…" : " ✓"));
    this.cloud.sync({op:"add", expense:exp});
  }

  deleteTxn(id) {
    const i = this.expenses.findIndex(x => x.id === id); if (i < 0) return;
    this.lastDeleted = this.expenses.splice(i, 1)[0];
    Sounds.delete();
    this.persist(); this.saveTxnMeta(); this.render();
    this.cloud.sync({op:"delete", id:this.lastDeleted.id});
    this.ui.toast("Deleted " + fmt(this.lastDeleted.amount), "Undo", () => {
      this.expenses.push(this.lastDeleted); this.sortExp(); this.persist(); this.saveTxnMeta(); this.render();
      this.cloud.sync({op:"add", expense:this.lastDeleted});
    });
  }

  editTxn(id) {
    const exp = this.expenses.find(x => x.id === id); if (!exp) return;
    if (exp.type === TX_PAYMENT) { this.ui.toast("Edit card payments from the Cards section"); return; }
    this.editingId  = id;
    this.editSelCat = exp.cat;
    this.editType   = exp.type === TX_CREDIT ? TX_CREDIT : TX_NORMAL;
    this.editCardId = exp.cardId || null;
    $("editAmt").value  = exp.amount;
    $("editDate").value = exp.date;
    $("editNote").value = exp.note || "";
    this.renderer.renderEditChips();
    this.ui.syncEditPaywith();
    $("editModal").showModal();
    Sounds.open();
  }

  saveEdit() {
    const id = this.editingId; if (!id) return;
    const a = Calculator.parseAmount($("editAmt").value);
    if (!a || a <= 0) { this.ui.toast("Enter a valid amount"); $("editAmt").focus(); return; }
    const isCredit = this.editType === TX_CREDIT;
    if (isCredit && !this.editCardId) { this.ui.toast("Pick a card for this credit purchase"); return; }
    const i = this.expenses.findIndex(x => x.id === id); if (i < 0) return;
    const old = this.expenses[i];
    const updated = {id: old.id, date: $("editDate").value || old.date, amount: a, cat: this.editSelCat, note: $("editNote").value.trim(),
                     createdAt: old.createdAt || "", type: isCredit ? TX_CREDIT : TX_NORMAL, cardId: isCredit ? this.editCardId : null};
    this.expenses[i] = updated;
    this.sortExp(); this.persist(); this.saveTxnMeta();
    const parts = updated.date.split("-"); this.view = {y:+parts[0], m:+parts[1]-1};
    this.render();
    $("editModal").close();
    Sounds.add();
    this.ui.toast("Transaction updated ✓");
    this.cloud.sync({op:"delete", id: old.id});
    this.cloud.sync({op:"add", expense: updated});
    this.editingId = null;
  }

  /* ── card payments & card CRUD ── */

  recordPayment(cardId, amount, date) {
    const a = Calculator.parseAmount(amount);
    if (!a || a <= 0) { this.ui.toast("Enter a valid amount"); return false; }
    const card = this.cardById(cardId);
    const exp = {id:uid(), date: date || todayISO(), amount:a, cat:"debt",
                 note: "Card payment" + (card ? " · " + card.name : ""), createdAt:new Date().toISOString(),
                 type: TX_PAYMENT, cardId: cardId || null};
    this.expenses.push(exp); this.sortExp(); this.persist(); this.saveTxnMeta();
    const parts = exp.date.split("-"); this.view = {y:+parts[0], m:+parts[1]-1};
    this.render();
    Sounds.add();
    this.ui.toast("Payment of " + fmt(a) + " recorded" + (this.cloudUrl ? " · saving…" : " ✓"));
    this.cloud.sync({op:"add", expense:exp});
    return true;
  }

  addCard(name, statementDay, dueDay) {
    name = String(name || "").trim().slice(0, 40);
    if (!name) { this.ui.toast("Give the card a name"); return false; }
    const s = Math.min(31, Math.max(1, +statementDay || 1));
    const d = Math.min(31, Math.max(1, +dueDay || 1));
    this.cards.push({id:uid(), name, statementDay:s, dueDay:d});
    this.saveCards(); this.render();
    return true;
  }
  updateCard(id, name, statementDay, dueDay) {
    const c = this.cardById(id); if (!c) return false;
    c.name = String(name || c.name).trim().slice(0, 40);
    c.statementDay = Math.min(31, Math.max(1, +statementDay || c.statementDay));
    c.dueDay = Math.min(31, Math.max(1, +dueDay || c.dueDay));
    this.saveCards(); this.render();
    return true;
  }
  deleteCard(id) {
    this.cards = this.cards.filter(c => c.id !== id);
    this.saveCards(); this.render();
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
      const cd = await Store.get(KEY_CARDS); if (cd) this.cards = JSON.parse(cd) || [];
    } catch(err) { console.error("load failed", err); }

    /* Re-attach credit type/cardId from the local overlay (survives cloud pulls) */
    this.applyTxnMeta();

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
    Sounds.wireGlobal();
  }
}

/* Bootstrap */
const app = new PaisaPulse();
app.init();
