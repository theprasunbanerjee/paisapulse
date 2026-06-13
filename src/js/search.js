/* ── search.js — fuzzy IntelliSense category search ── */

const CAT_SYN = {
  dining:    "food eating restaurant cafe lunch dinner snack swiggy zomato",
  commute:   "travel transport uber ola auto rapido cab metro bus fuel petrol",
  groceries: "grocery home blinkit zepto vegetables milk supplies kitchen",
  subs:      "subscription bills netflix spotify prime recharge phone internet wifi membership",
  ent:       "entertainment games movie fun ott steam",
  care:      "personal grooming haircut salon spa gym skincare",
  health:    "medical medicine doctor pharmacy hospital",
  housing:   "rent utilities electricity maintenance gas water",
  debt:      "emi loan credit card repayment",
  learn:     "learning course book education class udemy",
  gifts:     "gift treat donation party celebration",
  lending:   "lent borrow loan friend",
  assets:    "big purchase gadget electronics furniture appliance",
  invest:    "investment trading stocks crypto mutual fund sip savings",
  misc:      "other miscellaneous random"
};

class CategorySearch {
  constructor(app) {
    this.app    = app;
    this.list   = [];   // current suggestion list
    this.active = 0;    // keyboard-highlighted index
  }

  score(q, c) {
    q = q.toLowerCase();
    const hay = (c.n + " " + c.k + " " + (CAT_SYN[c.k] || "")).toLowerCase();
    if (c.n.toLowerCase().startsWith(q)) return 100;
    const wi = hay.split(/\s+/).findIndex(w => w.startsWith(q));
    if (wi > -1) return 80 - wi;
    const idx = hay.indexOf(q);
    if (idx > -1) return 50 - Math.min(idx, 40);
    // subsequence match (lowest score)
    let i = 0;
    for (const ch of hay) { if (ch === q[i]) i++; if (i === q.length) break; }
    return i === q.length ? 20 : -1;
  }

  render(q) {
    const box = $("catSuggest");
    if (!q) { box.hidden = true; this.list = []; return; }
    this.list = CATS
      .map(c => ({c, s: this.score(q, c)}))
      .filter(x => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map(x => x.c);
    if (!this.list.length) {
      box.innerHTML = '<div class="cs-item">no match — pick a chip below</div>';
      box.hidden = false; return;
    }
    this.active = 0;
    box.innerHTML = this.list.map((c, i) => {
      const n = CATS.indexOf(c) + 1;
      return '<div class="cs-item' + (i === 0 ? " active" : "") + '" data-cat="' + c.k + '">' +
        '<span class="cs-e">' + c.e + '</span><span class="cs-n">' + c.n + '</span>' +
        (n <= 9 ? '<span class="cs-hint">Alt+' + n + '</span>' : '') + '</div>';
    }).join("");
    box.hidden = false;
  }

  pick(k) {
    this.app.selCat = k;
    this.app.renderer.renderChips();
    const s = $("catSearch"); s.value = ""; $("catSuggest").hidden = true; this.list = [];
    const c = catByKey(k);
    this.app.ui.toast(c.e + " " + c.n + " selected");
    $("amt").focus();
  }

  wire() {
    $("catSearch").addEventListener("input", () => this.render($("catSearch").value.trim()));

    $("catSearch").addEventListener("keydown", e => {
      if (!this.list.length) { if (e.key === "Enter") e.preventDefault(); return; }
      if (e.key === "ArrowDown")          { e.preventDefault(); this.active = (this.active + 1) % this.list.length; }
      else if (e.key === "ArrowUp")       { e.preventDefault(); this.active = (this.active - 1 + this.list.length) % this.list.length; }
      else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); this.pick(this.list[this.active].k); return; }
      else if (e.key === "Escape")        { $("catSearch").value = ""; $("catSuggest").hidden = true; this.list = []; return; }
      else return;
      document.querySelectorAll("#catSuggest .cs-item").forEach((el, i) => el.classList.toggle("active", i === this.active));
    });

    $("catSuggest").addEventListener("click", e => {
      const it = e.target.closest("[data-cat]"); if (it) this.pick(it.dataset.cat);
    });

    $("catSearch").addEventListener("blur", () => setTimeout(() => { $("catSuggest").hidden = true; }, 150));
  }
}
