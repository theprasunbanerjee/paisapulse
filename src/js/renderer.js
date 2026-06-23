/* ── renderer.js — all DOM rendering: hero, stats, rail, ledger, budgets, transactions, chips ── */

class Renderer {
  constructor(app) {
    this.app = app;
  }

  /* ── pure computation ── */

  monthData(y, m) {
    const days    = new Date(y, m+1, 0).getDate();
    const isCur   = y === NOW.getFullYear() && m === NOW.getMonth();
    const isPast  = y < NOW.getFullYear() || (y === NOW.getFullYear() && m < NOW.getMonth());
    const elapsed = isCur ? NOW.getDate() : (isPast ? days : 0);
    const list    = this.app.expenses.filter(e => { const d = e.date.split("-"); return +d[0] === y && +d[1] === m+1; });
    const perDay  = Array(days+1).fill(0);
    const byCat   = {};
    let spend = 0, cashflow = 0;
    for (const e of list) {
      const dd = +e.date.split("-")[2];
      const isPay = e.type === TX_PAYMENT, isCred = e.type === TX_CREDIT;
      if (!isPay) {                              // Spend lens (accrual): normal + credit
        perDay[dd] += e.amount; spend += e.amount;
        byCat[e.cat] = (byCat[e.cat]||0) + e.amount;
      }
      if (!isCred) cashflow += e.amount;         // Cash-flow lens: normal + credit_payment
    }
    const cum = Array(days+1).fill(0);
    for (let d = 1; d <= days; d++) cum[d] = cum[d-1] + perDay[d];
    const avg  = elapsed > 0 ? spend / elapsed : 0;
    const proj = isCur ? avg * days : spend;
    return {y, m, days, isCur, isPast, elapsed, list, perDay, cum, byCat, spend, cashflow, spent:spend, avg, proj};
  }

  /* ── number animation ── */

  animateNum(el, target, prefixFmt) {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { el.textContent = prefixFmt(target); return; }
    const start = performance.now(), dur = 900, from = 0;
    const step = t => {
      const p = Math.min((t-start)/dur, 1), ease = 1 - Math.pow(1-p, 3);
      el.textContent = prefixFmt(from + (target-from) * ease);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ── main render ── */

  render() {
    const a   = this.app;
    const D   = this.monthData(a.view.y, a.view.m);
    const Pm  = a.view.m === 0 ? 11 : a.view.m - 1;
    const Py  = a.view.m === 0 ? a.view.y - 1 : a.view.y;
    const P   = this.monthData(Py, Pm);

    $("monthLabel").textContent = MONTHS[a.view.m].slice(0,3) + " " + a.view.y;
    $("nextM").disabled = (a.view.y === NOW.getFullYear() && a.view.m === NOW.getMonth());
    $("heroEyebrow").textContent = D.isCur ? "Spent so far in " + MONTHS[a.view.m] : "Spent in " + MONTHS[a.view.m] + " " + a.view.y;
    this.animateNum($("heroAmt"), D.spent, fmt);

    /* hero sub: vs last month */
    if (P.spent > 0) {
      const diff = D.spent - P.spent, sign = diff <= 0 ? "down" : "up";
      $("heroSub").innerHTML = "across <b>" + D.list.length + "</b> expenses · <span class='" + sign + "'>" +
        (diff <= 0 ? "▼ " : "▲ ") + fmt(Math.abs(diff)) + "</span> vs " + MONTHS[P.m].slice(0,3) + " (" + fmt(P.spent) + ")";
    } else {
      $("heroSub").innerHTML = "across <b>" + D.list.length + "</b> expenses";
    }

    /* pace rail + aura */
    const B = a.budgets.overall;
    let pace = "ok", msg = "";
    if (D.isCur) {
      if (B) {
        if (D.spent > B)       { pace = "over"; msg = "⛔ Over budget by " + fmt(D.spent-B) + ". Every rupee from here is borrowed from July-you."; }
        else if (D.proj > B)   { pace = "warn"; msg = "⚠ On pace for " + fmt(D.proj) + " — that overshoots your " + fmt(B) + " budget by " + fmt(D.proj-B) + ". Trim ~" + fmt(Math.max(0,(B-D.spent)/Math.max(1,D.days-D.elapsed))) + "/day to land safe."; }
        else                   { pace = "ok";   msg = "✓ On pace for " + fmt(D.proj) + " — inside your " + fmt(B) + " budget with " + fmt(B-D.proj) + " breathing room."; }
        $("railFill").style.width   = Math.min(100, D.spent/B*100) + "%";
        $("railProj").style.left    = Math.min(100, D.proj/B*100) + "%";
        $("railProj").style.display = "block";
        $("railRight").innerHTML    = "budget <b id='railBudget'>" + fmt(B) + "</b>";
      } else {
        pace = "ok"; msg = "On pace for " + fmt(D.proj) + " by " + MONTHS[D.m].slice(0,3) + " " + D.days + ". Set a budget (⚙) and I'll glow amber when you drift.";
        const ref = Math.max(D.proj, D.spent, 1);
        $("railFill").style.width   = (D.spent/ref*100) + "%";
        $("railProj").style.left    = Math.min(100, D.proj/ref*100) + "%";
        $("railProj").style.display = "block";
        $("railRight").innerHTML    = "projected <b>" + fmt(D.proj) + "</b>";
      }
    } else {
      msg = D.spent > 0 ? "Month closed at " + fmt(D.spent) + " · daily average " + fmt(D.avg) + "." : "No expenses logged this month.";
      if (B) {
        pace = D.spent > B ? "over" : "ok";
        $("railFill").style.width = Math.min(100, B ? D.spent/B*100 : 0) + "%";
        $("railRight").innerHTML  = "budget <b>" + fmt(B) + "</b>";
      } else {
        $("railFill").style.width = D.spent > 0 ? "100%" : "0%";
        $("railRight").innerHTML  = "";
      }
      $("railProj").style.display = "none";
    }
    document.body.className   = "pace-" + pace;
    $("paceMsg").className    = pace;
    $("paceMsg").textContent  = msg;
    $("railSpent").textContent = fmt(D.spent);

    /* stat cards */
    const todayD = NOW.getDate();
    const tAmt   = D.isCur ? D.perDay[todayD] : 0;
    const yAmt   = D.isCur ? (todayD > 1 ? D.perDay[todayD-1] : 0) : 0;
    $("todayAmt").textContent = fmt(tAmt);
    $("todaySub").textContent = D.isCur ? "yesterday " + fmt(yAmt) : "—";
    $("avgAmt").textContent   = fmt(D.avg);
    $("avgSub").textContent   = D.elapsed > 0 ? "over " + D.elapsed + " day" + (D.elapsed > 1 ? "s" : "") : "—";
    $("projAmt").textContent  = fmt(D.proj);
    $("projSub").textContent  = D.isCur ? "at current pace, by " + MONTHS[D.m].slice(0,3) + " " + D.days : "actual (month closed)";

    let top = null;
    for (const k in D.byCat) { if (!top || D.byCat[k] > D.byCat[top]) top = k; }
    if (top) {
      const c = catByKey(top);
      $("topCat").textContent    = c.e + " " + c.n;
      $("topCatSub").textContent = fmt(D.byCat[top]) + " · " + Math.round(D.byCat[top]/D.spent*100) + "% of month";
    } else {
      $("topCat").textContent    = "—";
      $("topCatSub").textContent = "nothing yet";
    }

    if (a.chartMode === "monthly") a.chart.renderMonthly(); else a.chart.renderDaily(D);
    this.renderLedger(D);
    this.renderBudgets(D);
    this.renderTxns(D);
    this.renderCredit(D);
  }

  /* ── day ledger ── */

  renderLedger(D) {
    const lastDay = D.isCur ? D.elapsed : D.days;
    const maxDay  = Math.max(...D.perDay, 1);
    let html = "";
    for (let d = 1; d <= lastDay; d++) {
      const dt      = new Date(D.y, D.m, d);
      const wd      = dt.toLocaleDateString("en-IN", {weekday:"short"});
      const isToday = D.isCur && d === NOW.getDate();
      const hasSpend = D.perDay[d] > 0;
      html += '<tr' + (isToday ? ' class="is-today"' : '') + (hasSpend ? ' data-day="' + d + '"' : '') + '>' +
        '<td>' + wd + " " + d + (isToday ? " · today" : "") + '</td>' +
        '<td>' + fmt(D.perDay[d]) + '</td>' +
        '<td style="text-align:left;width:90px"><span class="mini" style="width:' + Math.round(D.perDay[d]/maxDay*80) + 'px"></span></td>' +
        '<td>' + fmt(D.cum[d]) + '</td>' +
        '<td>' + fmt(D.cum[d]/d) + '</td></tr>';
    }
    $("dayLedger").innerHTML = html || '<tr><td colspan="5" class="empty">No days yet</td></tr>';
  }

  /* ── category budgets ── */

  renderBudgets(D) {
    const maxSpent = Math.max(...Object.values(D.byCat), 1);
    const rows = CATS
      .map(c => ({c, sp: D.byCat[c.k]||0, b: this.app.budgets.cats[c.k]}))
      .filter(r => r.sp || r.b)
      .sort((a, b) => (b.sp - a.sp) || ((b.b||0) - (a.b||0)));

    let html = "";
    for (const {c, sp, b} of rows) {
      let w, cls = "";
      if (b) { const r = sp/b; w = Math.min(100, r*100); cls = r > 1 ? "over" : (r >= (D.isCur ? D.elapsed/D.days : 1) ? "warn" : ""); }
      else   w = sp / maxSpent * 100;
      const pct = D.spent > 0 ? Math.round(sp/D.spent*100) : 0;
      html += '<div class="b-row"><span class="b-emoji">' + c.e + '</span><span class="b-name">' + c.n +
        '</span><span class="b-pct">' + pct + '%</span><span class="b-bar"><span class="b-fill ' + cls + '" style="width:' + w + '%"></span></span>' +
        '<span class="b-amt"><b>' + fmt(sp) + "</b>" + (b ? " / " + fmt(b) : "") + '</span></div>';
    }
    $("budgetList").innerHTML = html || '<div class="empty">Log expenses or set budgets (⚙) to see this fill up.</div>';
  }

  /* ── transactions list ── */

  renderTxns(D) {
    const a    = this.app;
    const list = a.txnCat ? D.list.filter(e => e.cat === a.txnCat) : D.list;
    if (!list.length) {
      $("txnList").innerHTML = '<div class="empty">' +
        (a.txnCat ? "No " + catByKey(a.txnCat).n + " expenses in " + MONTHS[D.m] + "." : "Nothing logged in " + MONTHS[D.m] + " yet — add your first expense ↑") +
        '</div>';
      return;
    }

    /* tag shown on the category line for credit / payment rows */
    const badge = e => {
      if (e.type === TX_CREDIT)  { const c = a.cardById(e.cardId); return ' <span class="credit-badge">💳 ' + esc(c ? c.name : "Card") + '</span>'; }
      if (e.type === TX_PAYMENT) { const c = a.cardById(e.cardId); return ' <span class="pay-badge">💳 ' + esc(c ? c.name : "Card") + '</span>'; }
      return '';
    };

    /* dateStr: pass a "12 Jun" string for flat mode, "" for grouped mode */
    const txnRow = (e, dateStr) => {
      const c = catByKey(e.cat);
      const isPay = e.type === TX_PAYMENT;
      const emoji = isPay ? "💳" : c.e;
      const name  = isPay ? "Card payment" : esc(e.note || c.n);
      const sub   = (isPay ? "Bill payment" : c.n) + (dateStr ? ' · <span class="tdate">' + dateStr + '</span>' : "") + badge(e);
      const amt   = (isPay ? "−" : "") + fmt(e.amount);
      const editBtn = isPay ? "" : '<button class="edit-btn" data-edit="' + e.id + '" aria-label="Edit">✎</button>';
      return '<div class="' + (isPay ? "txn is-payment" : "txn") + '" data-date="' + e.date + '"><span class="e">' + emoji +
        '</span><span class="t"><span class="n">' + name + '</span><span class="c">' + sub + '</span></span><span class="a">' + amt +
        '</span>' + editBtn + '<button class="x" data-del="' + e.id + '" aria-label="Delete">✕</button></div>';
    };

    let html = "";
    if (a.txnSort === "date-desc" || a.txnSort === "date-asc") {
      const byDate = {};
      for (const e of list) { (byDate[e.date] = byDate[e.date]||[]).push(e); }
      const dates = Object.keys(byDate).sort();
      if (a.txnSort === "date-desc") dates.reverse();
      for (const dt of dates) {
        const items = byDate[dt];
        const total = items.reduce((s, e) => s + (e.type === TX_PAYMENT ? 0 : e.amount), 0);  // day total = spend lens
        const d = new Date(dt + "T00:00:00");
        html += '<div class="txn-day" data-date="' + dt + '"><div class="day-h"><span>' +
          d.toLocaleDateString("en-IN", {weekday:"long", day:"numeric", month:"short"}) +
          '</span><b>' + fmt(total) + '</b></div>' + items.map(e => txnRow(e, "")).join("") + '</div>';
      }
    } else {
      const flat = list.slice();
      if (a.txnSort === "amt-desc") flat.sort((a, b) => b.amount - a.amount);
      else if (a.txnSort === "amt-asc") flat.sort((a, b) => a.amount - b.amount);
      else if (a.txnSort === "cat") flat.sort((a, b) => a.cat < b.cat ? -1 : a.cat > b.cat ? 1 : b.amount - a.amount);
      html = '<div class="txn-flat">' + flat.map(e => {
        const dd = new Date(e.date + "T00:00:00").toLocaleDateString("en-IN", {day:"numeric", month:"short"});
        return txnRow(e, dd);
      }).join("") + '</div>';
    }
    $("txnList").innerHTML = html;
  }

  /* ── cards & credit: outstanding, cash-flow, incoming bills ── */

  /* statement closes on statementDay; a purchase on/before that day closes this
     month, after it rolls to next month. Returns a Date at midnight. */
  _statementClose(dateISO, statementDay) {
    const p = dateISO.split("-").map(Number);
    let cy = p[0], cm = p[1] - 1; const d = p[2];
    if (d > statementDay) { cm++; if (cm > 11) { cm = 0; cy++; } }
    const last = new Date(cy, cm + 1, 0).getDate();
    return new Date(cy, cm, Math.min(statementDay, last));
  }

  /* due date = first occurrence of dueDay strictly after the statement close */
  _dueDate(close, dueDay) {
    let cy = close.getFullYear(), cm = close.getMonth();
    let last = new Date(cy, cm + 1, 0).getDate();
    let due = new Date(cy, cm, Math.min(dueDay, last));
    if (due <= close) { cm++; if (cm > 11) { cm = 0; cy++; } last = new Date(cy, cm + 1, 0).getDate(); due = new Date(cy, cm, Math.min(dueDay, last)); }
    return due;
  }

  renderCredit(D) {
    const a = this.app;
    if (!$("creditSection")) return;
    D = D || this.monthData(a.view.y, a.view.m);

    let totCredit = 0, totPaid = 0;
    for (const e of a.expenses) {
      if (e.type === TX_CREDIT) totCredit += e.amount;
      else if (e.type === TX_PAYMENT) totPaid += e.amount;
    }
    const outstanding = Math.max(0, totCredit - totPaid);
    $("outstandingAmt").textContent = fmt(outstanding);
    $("cashflowAmt").textContent    = fmt(D.cashflow);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const bills = [];
    for (const card of a.cards) {
      const cycles = {};
      for (const e of a.expenses) {
        if (e.type !== TX_CREDIT || e.cardId !== card.id) continue;
        const close = this._statementClose(e.date, card.statementDay);
        const key = close.getFullYear() + "-" + pad(close.getMonth() + 1);
        (cycles[key] || (cycles[key] = {close, total: 0})).total += e.amount;
      }
      let paid = a.expenses.filter(e => e.type === TX_PAYMENT && e.cardId === card.id).reduce((s, e) => s + e.amount, 0);
      for (const k of Object.keys(cycles).sort()) {           // oldest cycle first (FIFO)
        const cyc = cycles[k];
        const owed = cyc.total - Math.min(paid, cyc.total);
        paid = Math.max(0, paid - cyc.total);
        if (owed <= 0.5) continue;
        const due  = this._dueDate(cyc.close, card.dueDay);
        const days = Math.round((due - today) / 86400000);
        bills.push({card, owed, due, days});
      }
    }
    bills.sort((x, y) => x.due - y.due);

    const shock = $("shockList");
    if (!bills.length) {
      shock.innerHTML = '<div class="empty" style="padding:20px 10px">' +
        (a.cards.length ? "No bills due — you're all paid up ✓" : "Add a card (＋ Manage cards) to track credit spends and bills.") + '</div>';
    } else {
      shock.innerHTML = bills.map(b => {
        const cls  = b.days < 0 ? "overdue" : b.days <= 5 ? "urgent" : "";
        const when = b.days < 0 ? Math.abs(b.days) + "d overdue" : b.days === 0 ? "due today" : "in " + b.days + " day" + (b.days === 1 ? "" : "s");
        const dueStr = b.due.toLocaleDateString("en-IN", {day:"numeric", month:"short"});
        return '<div class="shock-row ' + cls + '"><div class="shock-l">' +
          '<div class="shock-card">💳 ' + esc(b.card.name) + '</div>' +
          '<div class="shock-due">due ' + dueStr + ' · <b>' + when + '</b></div></div>' +
          '<div class="shock-amt">' + fmt(b.owed) + '</div>' +
          '<button class="shock-pay" data-pay="' + b.card.id + '">Pay</button></div>';
      }).join("");
    }
  }

  /* ── category chips ── */

  renderChips() {
    $("catChips").innerHTML = CATS.map((c, i) =>
      '<span class="chip' + (c.k === this.app.selCat ? " on" : "") + '" data-cat="' + c.k + '" role="button" tabindex="0">' +
      c.e + " " + c.n + (i < 9 ? '<span class="k">' + (i+1) + '</span>' : '') + '</span>'
    ).join("");
  }

  renderEditChips() {
    const el = $("editCatChips"); if (!el) return;
    el.innerHTML = CATS.map(c =>
      '<span class="chip' + (c.k === this.app.editSelCat ? " on" : "") + '" data-ecat="' + c.k + '" role="button" tabindex="0">' +
      c.e + " " + c.n + '</span>'
    ).join("");
  }

  wire() {
    /* Edit category chip click */
    $("editCatChips").addEventListener("click", e => {
      const t = e.target.closest("[data-ecat]"); if (!t) return;
      this.app.editSelCat = t.dataset.ecat; Sounds.chip(); this.renderEditChips();
    });

    /* Category chip click / keyboard */
    $("catChips").addEventListener("click", e => {
      const t = e.target.closest(".chip"); if (!t) return;
      this.app.selCat = t.dataset.cat; Sounds.chip(); this.renderChips();
    });
    $("catChips").addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        const t = e.target.closest(".chip");
        if (t) { e.preventDefault(); this.app.selCat = t.dataset.cat; this.renderChips(); }
      }
    });

    /* Calculator hint */
    $("amt").addEventListener("input", () => {
      const v = $("amt").value.trim(), h = $("calcHint");
      if (v && (v[0] === "=" || /\d[-+*/]/.test(v.replace(/^-/, "")))) {
        const r = Calculator.evalAmount(v);
        if (r != null && r > 0) { h.hidden = false; h.dataset.val = r; h.innerHTML = '= <b>' + fmt(r) + '</b> &nbsp;· tap or press Enter'; }
        else { h.hidden = false; delete h.dataset.val; h.textContent = '…keep typing a calculation'; }
      } else h.hidden = true;
    });
    $("calcHint").addEventListener("click", () => {
      const h = $("calcHint");
      if (h.dataset.val) { $("amt").value = h.dataset.val; h.hidden = true; $("amt").focus(); }
    });

    /* Amount field: Tab fills calc result and stays; Enter adds expense; blur resolves */
    $("amt").addEventListener("keydown", e => {
      if (e.key === "Tab" && !e.shiftKey) {
        const h = $("calcHint");
        if (!h.hidden && h.dataset.val) { e.preventDefault(); $("amt").value = h.dataset.val; h.hidden = true; }
        return;
      }
      if (e.key === "Enter") this.app.addExpense();
    });
    $("amt").addEventListener("blur", () => {
      const v = $("amt").value.trim();
      if (v && (v[0] === "=" || /\d[-+*/]/.test(v.replace(/^-/, "")))) {
        const r = Calculator.evalAmount(v); if (r != null && r > 0) $("amt").value = r;
      }
      $("calcHint").hidden = true;
    });

    /* Note field: Enter adds expense */
    $("note").addEventListener("keydown", e => { if (e.key === "Enter") this.app.addExpense(); });

    /* Ledger ↔ transactions cross-highlight */
    $("dayLedger").addEventListener("click", e => {
      const tr = e.target.closest("tr[data-day]"); if (!tr) return;
      const a = this.app;
      const d = +tr.dataset.day, iso = a.view.y + "-" + pad(a.view.m+1) + "-" + pad(d);
      let needRender = false;
      if (a.txnCat) { a.txnCat = ""; $("txnFilter").value = ""; needRender = true; }
      if (a.txnSort !== "date-desc" && a.txnSort !== "date-asc") { a.txnSort = "date-desc"; $("txnSort").value = "date-desc"; needRender = true; }
      if (needRender) this.app.render();
      this._glowTxnDay(iso);
    });
    $("txnList").addEventListener("click", e => {
      if (e.target.closest("[data-del]")) return;
      if (e.target.closest("[data-edit]")) return;
      const t = e.target.closest(".txn[data-date]"); if (!t) return;
      this._glowLedgerDay(+t.dataset.date.slice(8, 10));
    });
  }

  _glowLedgerDay(d) {
    const tr = $("dayLedger").querySelector('tr[data-day="' + d + '"]');
    if (tr) { tr.scrollIntoView({behavior:"smooth", block:"center"}); tr.classList.add("glow"); setTimeout(() => tr.classList.remove("glow"), 1900); }
  }
  _glowTxnDay(iso) {
    const el = document.querySelector('.txn-day[data-date="' + iso + '"]');
    if (el) { el.scrollIntoView({behavior:"smooth", block:"center"}); el.classList.add("glow"); setTimeout(() => el.classList.remove("glow"), 1900); }
  }
}
