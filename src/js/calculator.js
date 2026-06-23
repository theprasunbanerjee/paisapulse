/* ── calculator.js — safe expression evaluator, amount/date/CSV parsers ── */

class Calculator {

  /* Safe eval: "=20+80", "20*3", "(100-15)/2". Whitelist-only — no arbitrary code. */
  static evalAmount(s) {
    let str = String(s || "").replace(/[₹,\s]/g, "");
    if (str[0] === "=") str = str.slice(1);
    if (!str || !/\d/.test(str) || !/^[-+*/().\d]+$/.test(str)) return null;
    try {
      const v = Function('"use strict";return (' + str + ')')();
      return (typeof v === "number" && isFinite(v)) ? v : null;
    } catch(e) { return null; }
  }

  static parseAmount(s) {
    if (typeof s === "number") return s;
    const str = String(s || "").trim();
    if (str[0] === "=" || /[-+*/()]/.test(str.replace(/^-/, ""))) {
      const r = Calculator.evalAmount(str);
      if (r != null) return r;
    }
    const n = parseFloat(str.replace(/[₹,\s]/g, ""));
    return isNaN(n) ? null : n;
  }

  static parseDate(s) {
    if (!s) return null;
    s = String(s).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);                          // 2026-06-02
    if (m) return m[1] + "-" + pad(+m[2]) + "-" + pad(+m[3]);
    m = s.match(/^(\d{1,2})[-\/\s]([A-Za-z]{3,})[-\/\s,]+(\d{2,4})$/);        // 2-Jun-2026
    if (m) { const mo = MABBR[m[2].slice(0,3).toLowerCase()]; if (mo == null) return null;
      let y = +m[3]; if (y < 100) y += 2000; return y + "-" + pad(mo+1) + "-" + pad(+m[1]); }
    m = s.match(/^([A-Za-z]{3,})[-\s]+(\d{1,2})[,\s]+(\d{2,4})$/);            // Jun 2, 2026
    if (m) { const mo = MABBR[m[1].slice(0,3).toLowerCase()]; if (mo == null) return null;
      let y = +m[3]; if (y < 100) y += 2000; return y + "-" + pad(mo+1) + "-" + pad(+m[2]); }
    m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);                 // 02/06/2026 → DD/MM
    if (m) { let y = +m[3]; if (y < 100) y += 2000; return y + "-" + pad(+m[2]) + "-" + pad(+m[1]); }
    return null;
  }

  /* Keyword-based category guesser used when importing CSV without explicit category column */
  static matchCat(s) {
    const t = String(s || "").toLowerCase();
    if (!t) return "misc";
    for (const c of CATS) { if (t.includes(c.n.toLowerCase())) return c.k; }
    const words = {
      dining:"dining",snack:"dining",restaurant:"dining",cafe:"dining",
      grocer:"groceries",food:"groceries",household:"groceries",essential:"groceries",
      commute:"commute",travel:"commute",transport:"commute",uber:"commute",rapido:"commute",auto:"commute",
      subscription:"subs",subs:"subs",bill:"subs",recharge:"subs",
      entertainment:"ent",game:"ent",movie:"ent",lifestyle:"ent",
      "personal care":"care",grooming:"care",haircut:"care",salon:"care",
      health:"health",medical:"health",medicine:"health",pharma:"health",
      housing:"housing",rent:"housing",utilit:"housing",electric:"housing",
      debt:"debt",emi:"debt",loan:"debt",
      learn:"learn",course:"learn",book:"learn",education:"learn",
      gift:"gifts",treat:"gifts",social:"gifts",
      lend:"lending",lent:"lending",
      asset:"assets",purchase:"assets",gadget:"assets",
      invest:"invest",trading:"invest",crypto:"invest",saving:"invest"
    };
    for (const w in words) { if (t.includes(w)) return words[w]; }
    return "misc";
  }

  static parseCSV(text) {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i+1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ""; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i+1] === '\n') i++;
        row.push(cell); cell = "";
        if (row.some(x => x.trim() !== "")) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some(x => x.trim() !== "")) rows.push(row);
    return rows;
  }

  /* Returns {added, skipped, bad, rows: newExpenses[]} — pure, does NOT mutate existing */
  static importCSV(text, existing) {
    const rows = Calculator.parseCSV(text);
    if (!rows.length) return {added:0, skipped:0, bad:0, rows:[]};

    let hIdx = -1, map = null;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const low = rows[i].map(c => c.trim().toLowerCase());
      const di = low.findIndex(c => c.includes("date"));
      const ai = low.findIndex(c => c === "amount" || c.includes("amount") || c === "amt" || c.includes("cost") || c.includes("price"));
      if (di > -1 && ai > -1) {
        hIdx = i;
        map = { date:di, amount:ai,
          cat:  low.findIndex(c => c.includes("categ")),
          note: low.findIndex(c => c.includes("desc") || c.includes("note") || c.includes("item") || c.includes("detail")) };
        break;
      }
    }

    let added = 0, skipped = 0, bad = 0;
    const newRows = [];
    const seen = new Set(existing.map(e => e.date + "|" + e.amount + "|" + e.cat + "|" + (e.note || "")));
    const body = hIdx > -1 ? rows.slice(hIdx + 1) : rows;

    for (const r of body) {
      let d, a, c, n;
      if (map) {
        d = Calculator.parseDate(r[map.date]);
        a = Calculator.parseAmount(r[map.amount]);
        c = Calculator.matchCat(map.cat > -1 ? r[map.cat] : "");
        n = (map.note > -1 ? r[map.note] : "") || "";
      } else {
        d = Calculator.parseDate(r[0]);
        if (r.length >= 4) { c = Calculator.matchCat(r[1]); n = r[2] || ""; a = Calculator.parseAmount(r[3]); }
        else { c = "misc"; n = r[1] || ""; a = Calculator.parseAmount(r[2]); }
      }
      if (!d || a == null || a <= 0) { bad++; continue; }
      n = String(n).trim();
      const sig = d + "|" + a + "|" + c + "|" + n;
      if (seen.has(sig)) { skipped++; continue; }
      seen.add(sig);
      newRows.push({id:uid(), date:d, amount:a, cat:c, note:n, createdAt:new Date().toISOString(), type:TX_NORMAL, cardId:null});
      added++;
    }
    return {added, skipped, bad, rows: newRows};
  }
}
