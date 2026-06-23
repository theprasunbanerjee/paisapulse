/* ── config.js — constants, pure helpers, shared DOM accessor ── */

const $ = id => document.getElementById(id);
const NOW = new Date();

const CATS = [
  {k:"dining",   n:"Eating Out & Snacks",     e:"🍔"},
  {k:"commute",  n:"Commute & Travel",        e:"🚕"},
  {k:"groceries",n:"Groceries & Home",        e:"🛒"},
  {k:"subs",     n:"Subscriptions",           e:"📺"},
  {k:"ent",      n:"Entertainment & Games",   e:"🎮"},
  {k:"care",     n:"Personal Care",           e:"💇"},
  {k:"health",   n:"Health & Medical",        e:"💊"},
  {k:"housing",  n:"Housing & Utilities",     e:"🏠"},
  {k:"debt",     n:"Debt & EMIs",             e:"💸"},
  {k:"learn",    n:"Learning & Courses",      e:"📚"},
  {k:"gifts",    n:"Gifts & Treats",          e:"🎁"},
  {k:"lending",  n:"Lending",                 e:"🤝"},
  {k:"assets",   n:"Big Purchases & Assets",  e:"💼"},
  {k:"invest",   n:"Investments & Trading",   e:"📈"},
  {k:"misc",     n:"Miscellaneous",           e:"❓"}
];
const catByKey = k => CATS.find(c => c.k === k) || CATS[CATS.length - 1];

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MABBR  = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};

const fmt      = n  => "₹" + new Intl.NumberFormat("en-IN", {maximumFractionDigits:0}).format(Math.round(n || 0));
const pad      = n  => String(n).padStart(2, "0");
const todayISO = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()); };
const uid      = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc      = s  => String(s).replace(/[&<>"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));

/* localStorage keys */
const KEY_EXP  = "pp.expenses.v1";
const KEY_BUD  = "pp.budgets.v1";
const KEY_META = "pp.meta.v1";
const KEY_NAME = "pp.name.v1";
const KEY_URL  = "pp.cloud.url.v1";
const KEY_OUT    = "pp.outbox.v1";
const KEY_FOLDER = "pp.folder.url.v1";
const KEY_CARDS    = "pp.cards.v1";
const KEY_TXN_META = "pp.txnmeta.v1";

/* transaction types — see the two-lens accounting model */
const TX_NORMAL  = "normal";          // cash/UPI — hits Spend + Cash-flow same day
const TX_CREDIT  = "credit";          // card swipe — hits Spend now, Cash-flow later
const TX_PAYMENT = "credit_payment";  // paying the card bill — Cash-flow only, never Spend

const URL_RE = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec/;

/* Public-release seed — empty so new users start clean */
const SEED = [];
