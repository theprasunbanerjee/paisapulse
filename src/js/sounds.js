/* ── sounds.js — SaaS-style UI sound effects (pure sine, musical note frequencies) ── */

const Sounds = (() => {
  const SFX_KEY = "pp.sounds.v1";
  let ctx = null;
  let _on = true;
  try { _on = localStorage.getItem(SFX_KEY) !== "off"; } catch(e) {}

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  /* All tones use sine wave — cleanest, most professional */
  function note({ freq = 440, freq2, vol = 0.08, attack = 0.006, decay = 0.12, delay = 0 }) {
    if (!_on) return;
    try {
      const c = ac(), t = c.currentTime + delay;
      const osc = c.createOscillator(), g = c.createGain();
      osc.connect(g); g.connect(c.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      if (freq2) osc.frequency.exponentialRampToValueAtTime(freq2, t + attack + decay);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);
      osc.start(t);
      osc.stop(t + attack + decay + 0.04);
    } catch(e) {}
  }

  function throttle(fn, ms) {
    let last = 0;
    return (...args) => { const now = Date.now(); if (now - last >= ms) { last = now; fn(...args); } };
  }

  return {
    get on() { return _on; },

    toggle() {
      _on = !_on;
      try { localStorage.setItem(SFX_KEY, _on ? "on" : "off"); } catch(e) {}
      // Confirmation ping on unmute
      if (_on) note({ freq: 659, vol: 0.07, attack: 0.005, decay: 0.14 });
      return _on;
    },

    // Task completed — F5 then A5 (ascending major 3rd)
    add() {
      note({ freq: 698, vol: 0.07, attack: 0.005, decay: 0.13 });
      note({ freq: 880, vol: 0.06, attack: 0.005, decay: 0.15, delay: 0.09 });
    },

    // Dismiss — C5 falling to G4
    delete() {
      note({ freq: 523, freq2: 392, vol: 0.06, attack: 0.003, decay: 0.13 });
    },

    // Navigate back — soft A4
    navPrev() {
      note({ freq: 440, vol: 0.05, attack: 0.004, decay: 0.09 });
    },

    // Navigate forward — soft C5, one step up
    navNext() {
      note({ freq: 523, vol: 0.05, attack: 0.004, decay: 0.09 });
    },

    // Cloud connected — E5 then A5 (clean ascending 4th)
    success() {
      note({ freq: 659, vol: 0.07, attack: 0.006, decay: 0.18 });
      note({ freq: 880, vol: 0.07, attack: 0.006, decay: 0.22, delay: 0.15 });
    },

    // Modal appear — quick soft C5 pop
    open() {
      note({ freq: 523, vol: 0.05, attack: 0.003, decay: 0.09 });
    },

    // Category select — Eb5, bright but clean
    chip() {
      note({ freq: 622, vol: 0.055, attack: 0.004, decay: 0.10 });
    },

    // Tab switch — B4, softer than chip
    tab() {
      note({ freq: 494, vol: 0.045, attack: 0.003, decay: 0.08 });
    },

    wireGlobal() {
      // Generic click — D5, very subtle background texture
      document.addEventListener("click", e => {
        if (!e.target.closest("button, select, [role=button]")) return;
        note({ freq: 587, vol: 0.022, attack: 0.002, decay: 0.045 });
      });

      // Hover — A4 for buttons, G3 for cards, per-element cooldown
      const _hc = new WeakMap();
      document.addEventListener("mouseover", e => {
        if (!_on) return;
        const btn = e.target.closest("button, .chip, [role=button], select, .seg-btn");
        if (btn) {
          const now = Date.now();
          if ((now - (_hc.get(btn) || 0)) < 400) return;
          _hc.set(btn, now);
          note({ freq: 440, vol: 0.018, attack: 0.005, decay: 0.07 });
        } else {
          const card = e.target.closest(".card");
          if (card) {
            const now = Date.now();
            if ((now - (_hc.get(card) || 0)) < 900) return;
            _hc.set(card, now);
            note({ freq: 196, vol: 0.012, attack: 0.012, decay: 0.14 });
          }
        }
      });

    }
  };
})();
