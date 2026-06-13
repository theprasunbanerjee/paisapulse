/*** PaisaPulse — Google Apps Script backend (bind this to your Sheet) ***/
/*
   HOW TO USE (also shown inside the app's onboarding):
   1. Create a new Google Sheet (sheets.new) in your own Google Drive.
   2. In that Sheet: Extensions → Apps Script.
   3. Delete the sample code, paste THIS whole file, and click Save 💾.
   4. Deploy → New deployment → type: Web app.
      • Execute as: Me
      • Who has access: Anyone
   5. Deploy → authorize when asked → copy the Web app URL (ends in /exec).
   6. Paste that URL into PaisaPulse. Done — your Sheet is now your private database.

   It is safe: the script only ever runs as YOU and only touches THIS Sheet.
   "Anyone" just means the URL is reachable without a Google login (so the app
   can talk to it) — it does NOT make your Sheet public or searchable.
*/

var SHEET_EXP = 'Expenses';
var SHEET_BUD = 'Budgets';
var HEADERS   = ['ID','Date','Category','Note','Amount','CreatedAt'];

function doGet(e){
  return json(readAll());
}

function doPost(e){
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch(err){ return json({ok:false, error:'busy, try again'}); }
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    switch (body.action) {
      case 'ping':    return json({ok:true});
      case 'add':     addRow(body.expense);                                  return json({ok:true});
      case 'delete':  return json({ok:true, deleted: deleteRow(body.id)});
      case 'budgets': writeBudgets(body.budgets || {});                      return json({ok:true});
      case 'import':  return json(merge({ok:true}, importRows(body.expenses || [], body.replace === true)));
      default:        return json({ok:false, error:'unknown action'});
    }
  } catch (err) {
    return json({ok:false, error: String(err)});
  } finally {
    lock.releaseLock();
  }
}

/* ---------- sheets (self-initializing) ---------- */
function ss(){ return SpreadsheetApp.getActiveSpreadsheet(); }

function expSheet(){
  var s = ss(), sh = s.getSheetByName(SHEET_EXP);
  if (!sh) { sh = s.getSheets()[0]; sh.setName(SHEET_EXP); }
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.getRange('B:B').setNumberFormat('@'); // keep dates as plain text (no timezone drift)
    sh.setFrozenRows(1);
  }
  return sh;
}

function budSheet(){
  var s = ss(), sh = s.getSheetByName(SHEET_BUD);
  if (!sh) sh = s.insertSheet(SHEET_BUD);
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,2).setValues([['Key','Value']]).setFontWeight('bold');
  return sh;
}

/* ---------- reads ---------- */
function readAll(){
  var sh = expSheet(), last = sh.getLastRow(), expenses = [];
  if (last > 1) {
    var vals = sh.getRange(2,1,last-1,HEADERS.length).getValues();
    for (var i=0;i<vals.length;i++){
      var r = vals[i];
      if (r[0]==='' && r[1]==='' && r[4]==='') continue;
      expenses.push({
        id: String(r[0]), date: fmtDate(r[1]), cat: String(r[2]),
        note: String(r[3]), amount: Number(r[4]) || 0,
        createdAt: r[5] ? String(r[5]) : ''
      });
    }
  }
  var sp = ss(), folderUrl = '';
  try {
    var parents = DriveApp.getFileById(sp.getId()).getParents();
    folderUrl = parents.hasNext() ? parents.next().getUrl() : '';
  } catch(e) {}
  return {ok:true, expenses: expenses, budgets: readBudgets(), folderUrl: folderUrl, sheetUrl: sp.getUrl()};
}

function readBudgets(){
  var sh = budSheet(), last = sh.getLastRow(), out = {overall:null, cats:{}};
  if (last > 1) {
    var vals = sh.getRange(2,1,last-1,2).getValues();
    for (var i=0;i<vals.length;i++){
      var k = String(vals[i][0]), v = vals[i][1];
      if (k === 'overall') out.overall = (v === '' ? null : Number(v));
      else if (k) out.cats[k] = Number(v) || 0;
    }
  }
  return out;
}

/* ---------- writes ---------- */
function addRow(exp){
  if (!exp) return;
  var sh = expSheet();
  if (exp.id && findRowById(sh, exp.id) > 0) return; // idempotent — safe to retry
  sh.appendRow([ exp.id || '', fmtDate(exp.date), exp.cat || '', exp.note || '',
                 Number(exp.amount) || 0, exp.createdAt || new Date().toISOString() ]);
}

function deleteRow(id){
  var sh = expSheet(), row = findRowById(sh, id);
  if (row > 0) { sh.deleteRow(row); return 1; }
  return 0;
}

function importRows(rows, replace){
  var sh = expSheet();
  if (replace) { var l = sh.getLastRow(); if (l > 1) sh.deleteRows(2, l-1); }
  var seen = {}, last = sh.getLastRow();
  if (last > 1) {
    var ex = sh.getRange(2,1,last-1,HEADERS.length).getValues();
    for (var i=0;i<ex.length;i++){ seen['id:'+String(ex[i][0])] = true; seen[sig(ex[i])] = true; }
  }
  var out = [], added = 0, skipped = 0;
  for (var j=0;j<rows.length;j++){
    var e = rows[j], row = [ e.id||'', fmtDate(e.date), e.cat||'', e.note||'',
                             Number(e.amount)||0, e.createdAt || new Date().toISOString() ];
    if (seen['id:'+String(e.id)] || seen[sig(row)]) { skipped++; continue; }
    seen['id:'+String(e.id)] = true; seen[sig(row)] = true;
    out.push(row); added++;
  }
  if (out.length) sh.getRange(sh.getLastRow()+1, 1, out.length, HEADERS.length).setValues(out);
  return {added: added, skipped: skipped};
}

function writeBudgets(b){
  var sh = budSheet(), last = sh.getLastRow();
  if (last > 1) sh.deleteRows(2, last-1);
  var rows = [];
  if (b.overall != null && b.overall !== '') rows.push(['overall', Number(b.overall)]);
  var cats = b.cats || {};
  for (var k in cats) if (cats.hasOwnProperty(k)) rows.push([k, Number(cats[k]) || 0]);
  if (rows.length) sh.getRange(2,1,rows.length,2).setValues(rows);
}

/* ---------- helpers ---------- */
function findRowById(sh, id){
  var last = sh.getLastRow(); if (last < 2) return -1;
  var ids = sh.getRange(2,1,last-1,1).getValues();
  for (var i=0;i<ids.length;i++) if (String(ids[i][0]) === String(id)) return i+2;
  return -1;
}
function sig(r){ return [fmtDate(r[1]), r[2], r[3], Number(r[4])||0].join('|'); }
function fmtDate(v){
  if (v instanceof Date){
    return v.getFullYear() + '-' + ('0'+(v.getMonth()+1)).slice(-2) + '-' + ('0'+v.getDate()).slice(-2);
  }
  return String(v || '');
}
function merge(a,b){ for (var k in b) if (b.hasOwnProperty(k)) a[k]=b[k]; return a; }
function json(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
