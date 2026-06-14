/* ── keyboard.js — global keyboard shortcuts ── */

class KeyboardHandler {
  constructor(app) {
    this.app = app;
  }

  wire() {
    const isTyping = el => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");

    document.addEventListener("keydown", e => {
      if (!$("onboard").hidden) return;  // don't hijack during onboarding

      /* Ctrl+J/K/L/; → jump directly to an add-expense field */
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const map = {j:"amt", k:"date", l:"catSearch", ";":"note"};
        const target = map[e.key.toLowerCase()] || map[e.key];
        if (target) {
          e.preventDefault();
          const el = $(target);
          el.scrollIntoView({block:"center"}); el.focus();
          if (el.type !== "date" && el.select) try { el.select(); } catch(_) {}
          return;
        }
      }

      /* Alt+1–9 → pick category chip */
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key >= "1" && e.key <= "9") {
        const idx = +e.key - 1;
        if (idx < CATS.length) {
          e.preventDefault();
          this.app.selCat = CATS[idx].k;
          Sounds.chip(); this.app.renderer.renderChips();
          const a = $("amt");
          if (document.activeElement !== a && !isTyping(document.activeElement)) a.focus();
        }
        return;
      }

      /* ←/→ → change month (when not focused in a field or dialog) */
      if (!isTyping(document.activeElement) && !document.querySelector("dialog[open]")) {
        if (e.key === "ArrowLeft")  $("prevM").click();
        else if (e.key === "ArrowRight") { if (!$("nextM").disabled) $("nextM").click(); }
      }
    });
  }
}
