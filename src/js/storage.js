/* ── storage.js — unified storage adapter (localStorage / memory / Claude artifact) ── */

class StorageAdapter {
  constructor() {
    this.mode = "memory";
    this.mem  = {};
  }

  async init() {
    if (typeof window !== "undefined" && window.storage && typeof window.storage.get === "function") {
      this.mode = "claude"; return;
    }
    try {
      localStorage.setItem("__pp_t", "1");
      localStorage.removeItem("__pp_t");
      this.mode = "local";
    } catch(e) {
      this.mode = "memory";
    }
  }

  async get(k) {
    if (this.mode === "claude") {
      try { const r = await window.storage.get(k); return r && r.value != null ? r.value : null; } catch(e) { return null; }
    }
    if (this.mode === "local") {
      try { return localStorage.getItem(k); } catch(e) { return null; }
    }
    return Object.prototype.hasOwnProperty.call(this.mem, k) ? this.mem[k] : null;
  }

  async set(k, v) {
    if (this.mode === "claude") {
      try { await window.storage.set(k, v); } catch(e) { console.error(e); } return;
    }
    if (this.mode === "local") {
      try { localStorage.setItem(k, v); } catch(e) { console.error(e); } return;
    }
    this.mem[k] = v;
  }
}

const Store = new StorageAdapter();
