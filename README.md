# 💜 PaisaPulse — *money, made visible*

A beautiful, private expense tracker that lives in **one HTML file** and stores your data in **your own Google Sheet**. No accounts, no servers, no ads, no tracking. **100% free.**

---

## ✨ What you get

- A glowing dashboard with daily spend, running total, daily average, month-end projection, and a pace indicator that warns you when you're drifting over budget.
- **15 smart categories** with per-category budgets and a month-by-month analysis chart.
- Fuzzy category search with IntelliSense-style suggestions.
- Friendly, time-aware greetings — set your name once.
- **Your data is yours.** Saves instantly on your device, and optionally syncs permanently to a Google Sheet in your own Drive so a dead laptop never costs you your history.
- Works **offline**. Double-click and go.

---

## ⬇️ How to use it

1. Click the green **`<> Code`** button → **Download ZIP** (or right-click `paisapulse.html` → Save As).
2. Unzip, then **double-click `paisapulse.html`** — it opens in your browser (Chrome or Edge recommended).
3. Start adding expenses. Your data is saved on that device automatically.

> **One tap away?** On desktop, drag the tab to your bookmarks bar. On mobile, open the file and tap "Add to Home screen."

---

## ☁️ Make your data permanent (recommended)

Local storage is instant, but if your laptop dies the local copy goes with it. Connect to a **Google Sheet in your own Drive** to keep your history safe forever. The app walks you through it:

1. Open the app → **⇅ Data → Connect Google Drive → "I'm new"**.
2. **Create a blank Google Sheet** (the button opens `sheets.new`).
3. In that Sheet: **Extensions → Apps Script** → delete the sample → paste the script (the app has a **Copy** button; it's also in [`apps-script.gs`](apps-script.gs)) → Save.
4. **Deploy → New deployment → Web app** → *Execute as: Me*, *Who has access: Anyone* → **Deploy** → authorize → copy the `/exec` URL.
5. Paste that URL into the app and hit **Connect**. Done.

**Switching devices later?** Open the app → **⇅ Data → "I already have a PaisaPulse Sheet"** → paste the same URL → all your data comes back.

---

## 🔒 Is this safe?

- **Nobody but you sees your data.** It lives in your browser and your Google Sheet, in your Google Drive. No server in the middle.
- **The app is one readable HTML file.** No hidden dependencies, no analytics, no network calls except to your own Sheet.
- **The Apps Script runs as you, on your Sheet only.** Setting access to "Anyone" makes the URL *reachable* — it does **not** make your Sheet public or visible to anyone without your secret URL.

### "Will this get my Google account banned?"
No. Google Apps Script is an **official Google product** built exactly for this — turning your own Sheet into a private web app. Personal expense tracking uses a tiny fraction of the free quotas. You're not scraping or abusing anything.

---

## ⌨️ Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+J` | Jump to Amount field |
| `Ctrl+K` | Jump to Date field |
| `Ctrl+L` | Jump to Category search |
| `Ctrl+;` | Jump to Note field |
| `Alt+1`–`9` | Pick category by number |
| `Enter` | Add expense (from any field) |
| `←` / `→` | Previous / next month |

---

## 🛠️ For developers

The project is structured for clean development with a single-file distributable:

```
src/
  index.html          HTML skeleton (open directly in browser for dev)
  css/styles.css      All styles
  js/
    config.js         Constants, CATS, keys, pure helpers
    storage.js        StorageAdapter class (localStorage / memory)
    calculator.js     Calculator class — eval, parse, CSV import
    cloud.js          CloudSync class — outbox, flush, connect, firstSync
    search.js         CategorySearch class — fuzzy IntelliSense
    chart.js          Chart class — daily & monthly views
    renderer.js       Renderer class — all DOM updates
    effects.js        Cursor trail + entrance animations
    keyboard.js       KeyboardHandler class
    ui.js             UI class — toast, modals, onboarding, greeting
    app.js            PaisaPulse class — owns all state, wires everything
build.py              Bundles src/ → paisapulse.html
apps-script.gs        Google Apps Script backend (paste into your Sheet)
```

**Dev workflow:**
```bash
# Edit files in src/ — open src/index.html in browser to test live
# When ready to ship:
python build.py       # produces paisapulse.html (the distributable)
```

**Stack:** Vanilla HTML/CSS/JS — no build tools, no npm, no dependencies. Storage is `localStorage` with an optional Google Apps Script + Google Sheets backend.

---

## 📄 License

[MIT](LICENSE) — do whatever you like with it. Free forever. 💜
