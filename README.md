# 💜 PaisaPulse — *money, made visible*

A beautiful, private expense tracker that lives in **one HTML file** and stores your data in **your own Google Sheet**. No accounts to create with me, no servers, no ads, no tracking. **100% free.**

> I spent a fair bit of time (and roughly **₹_____ worth of AI tokens** — fill in your number, Prasun 🙂) building and polishing this. **You get it completely free.** Download it, open it, use it on your own device with your own Google account. That's it.

---

## ✨ What you get

- A clean, glowing dashboard: daily spend, running total, daily average, month-end projection, and a "pace" glow that gently warns you when you're drifting over budget.
- **15 smart categories**, per-category budgets, and a month-by-month view.
- Friendly, time-aware greetings (set your name once).
- **Your data is yours.** It saves instantly on your device, and — if you want — syncs permanently to a Google Sheet *in your own Drive* so a dead laptop never costs you your history.
- Works **offline**. It's a single file.

---

## ⬇️ How to get it (free, ~2 minutes)

1. Click the green **`<> Code`** button at the top of this page → **Download ZIP** (or just open `paisapulse.html` and use **Save As**).
2. Unzip it, then **double-click `paisapulse.html`** — it opens in your browser (Chrome or Edge recommended).
3. That's it. Start adding expenses. Your data is saved on that device automatically.

> Want it one tap away? On desktop, drag the tab to your bookmarks. On mobile, open the file and "Add to Home screen."

---

## ☁️ (Recommended) Make your data permanent + crash-proof

Local-only is fine, but if your laptop dies, the local copy dies with it. To keep your history safe forever, connect it to a **Google Sheet in your own Google Drive**. The app walks you through it — here's the short version:

1. Open the app → **⇅ Data → Connect Google Drive → "I'm new"**.
2. **Create a blank Google Sheet** (the button opens `sheets.new`).
3. In that Sheet: **Extensions → Apps Script**, delete the sample, and paste the script (the app gives you a **Copy** button; it's also in [`apps-script.gs`](apps-script.gs)). Save.
4. **Deploy → New deployment → Web app** → *Execute as: Me*, *Who has access: Anyone* → **Deploy** → authorize → copy the URL (ends in `/exec`).
5. Paste that URL into the app and hit **Connect**. Done.

**New laptop later?** Just open the app → **⇅ Data → "I already have a PaisaPulse Sheet"** → paste the same URL → all your data comes back.

---

## 🔒 Is this safe? (yes — here's exactly why)

- **Nobody but you sees your data.** It lives in *your* browser and *your* Google Sheet, in *your* Google Drive. There is no "my" server in the middle — I literally cannot see your money.
- **The app is one readable HTML file.** No hidden dependencies, no analytics, no network calls except to *your own* Sheet.
- **The Google Apps Script runs as you, on your Sheet only.** Setting access to "Anyone" only makes the little web-app URL *reachable* (so the app can talk to it) — it does **not** make your Sheet public, searchable, or visible to anyone who doesn't have your secret URL.

### "Will using a Google Apps Script get my Google account banned?"
**No.** Google Apps Script is an **official Google product** built for exactly this — turning your own Sheet into a tiny private web app. Deploying a script bound to your own Sheet, in your own account, is a fully sanctioned, everyday use. There are generous free **quotas** (script runtime, requests per day, etc.), but personal expense tracking uses a tiny fraction of them — you won't get anywhere near the limits, and staying within quotas is not a ban risk. You're not scraping, spamming, or abusing anything; you're using your own Drive the way Google designed it.

---

## 🛠️ Tech (for the curious)

Single `paisapulse.html` — vanilla HTML/CSS/JS, **no build step, no dependencies**. Storage is `localStorage` (instant local cache) with an optional Google Apps Script + Google Sheets backend (`apps-script.gs`). Import/export supports CSV and JSON.

## 📄 License

[MIT](LICENSE) — do whatever you like with it. Free forever. 💜
