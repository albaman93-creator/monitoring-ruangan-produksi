// Data cadangan (dipakai sebelum data dari Google Sheet selesai dimuat)
let MASTER_DATA = [
  { no: 1, id: "K3081029", nama: "Airlock BF2108", mon: "Gowning D ON (Male) vs Airlock", jenis: "°C, %RH, Pa", area: "Loker Male", tabGroup: "Loker", alertDP: 10, actionDP: 5, suhuMin: 16, suhuMax: 25, rhMin: 45, rhMax: 65 },
  { no: 2, id: "K3081048", nama: "Airlock BF2116", mon: "Airlock BF2116 vs Gowning D ON (Female)", jenis: "Pa", area: "Loker Female", tabGroup: "Loker", alertDP: 10, actionDP: 5, suhuMin: "", suhuMax: "", rhMin: "", rhMax: "" },
  { no: 3, id: "K3081004", nama: "Airlock BF2116", mon: "Airlock BF2116 vs Gowning D ON (Male)", jenis: "Pa", area: "Loker Male", tabGroup: "Loker", alertDP: 10, actionDP: 5, suhuMin: "", suhuMax: "", rhMin: "", rhMax: "" },
  { no: 4, id: "K3081035", nama: "Airlock BF2115", mon: "Corridor Class D vs Airlock BF2115", jenis: "°C, %RH, Pa", area: "Line 1", tabGroup: "Line 1", alertDP: 10, actionDP: 5, suhuMin: 16, suhuMax: 25, rhMin: 45, rhMax: 65 },
  { no: 5, id: "K3081047", nama: "Part Storage", mon: "Corridor Class D vs Part Storage", jenis: "°C, %RH, Pa", area: "Line 1", tabGroup: "Line 1", alertDP: 10, actionDP: 5, suhuMin: 16, suhuMax: 25, rhMin: 45, rhMax: 65 },
  { no: 6, id: "K3081038*", nama: "PM Transfer Line I", mon: "Corridor Class D vs PM Transfer Line I", jenis: "°C, %RH, Pa", area: "Line 1", tabGroup: "Line 1", alertDP: 10, actionDP: 5, suhuMin: 16, suhuMax: 25, rhMin: 45, rhMax: 65 },
  { no: 7, id: "K3081032", nama: "Mixing Room Line I", mon: "Mixing Room Line I vs Corridor Class D", jenis: "°C, %RH, Pa", area: "Line 1", tabGroup: "Line 1", alertDP: 10, actionDP: 5, suhuMin: 16, suhuMax: 25, rhMin: 45, rhMax: 65 },
  { no: 8, id: "K3081034", nama: "Corridor Class D", mon: "Corridor Class D vs Janitor", jenis: "°C, %RH, Pa", area: "Line 1", tabGroup: "Line 1", alertDP: 10, actionDP: 5, suhuMin: 16, suhuMax: 25, rhMin: 45, rhMax: 65 },
  { no: 9, id: "K3081033", nama: "Laundry I", mon: "Laundry vs Corridor Class D", jenis: "°C, %RH, Pa", area: "Line 1", tabGroup: "Line 1", alertDP: 10, actionDP: 5, suhuMin: 16, suhuMax: 25, rhMin: 45, rhMax: 65 },
  { no: 10, id: "K3081039", nama: "Gowning D OFF", mon: "Gowning D OFF vs Corridor Class D", jenis: "°C, %RH, Pa", area: "Line 1", tabGroup: "Line 1", alertDP: 10, actionDP: 5, suhuMin: 16, suhuMax: 25, rhMin: 45, rhMax: 65 },
  { no: 11, id: "K3081031", nama: "Tool Sterilizations", mon: "Tool Sterilizations vs Corridor Class D", jenis: "°C, %RH, Pa", area: "Line 1", tabGroup: "Line 1", alertDP: 10, actionDP: 5, suhuMin: 16, suhuMax: 25, rhMin: 45, rhMax: 65 },
  { no: 12, id: "K3081038*", nama: "Equipment Wash", mon: "Corridor Class D vs Equipment Wash", jenis: "°C, %RH, Pa", area: "Line 1", tabGroup: "Line 1", alertDP: 10, actionDP: 5, suhuMin: 16, suhuMax: 25, rhMin: 45, rhMax: 65 },
  { no: 13, id: "K3081058", nama: "Gowning D OFF", mon: "Gowning D OFF vs Corridor Class D", jenis: "°C, %RH, Pa", area: "Line 2", tabGroup: "Line 2", alertDP: 10, actionDP: 5, suhuMin: 16, suhuMax: 25, rhMin: 45, rhMax: 65 },
  { no: 14, id: "K3081001", nama: "Laundry 2", mon: "Laundry vs Corridor Class D", jenis: "°C, %RH, Pa", area: "Line 2", tabGroup: "Line 2", alertDP: 10, actionDP: 5, suhuMin: 16, suhuMax: 25, rhMin: 45, rhMax: 65 },
  { no: 15, id: "K3081057", nama: "Mixing Room Line 2", mon: "Mixing Room Line 2 vs Corridor Class D", jenis: "°C, %RH, Pa", area: "Line 2", tabGroup: "Line 2", alertDP: 10, actionDP: 5, suhuMin: 16, suhuMax: 25, rhMin: 45, rhMax: 65 },
  { no: 16, id: "K3081002", nama: "PM Transfer", mon: "PM Transfer vs Corridor Class D", jenis: "°C, %RH, Pa", area: "Line 2", tabGroup: "Line 2", alertDP: 10, actionDP: 5, suhuMin: 16, suhuMax: 25, rhMin: 45, rhMax: 65 },
  { no: 17, id: "K3081055", nama: "Airlock BF2107", mon: "Corridor Class D vs Airlock BF2107", jenis: "°C, %RH, Pa", area: "Logistik", tabGroup: "Logistic", alertDP: 10, actionDP: 5, suhuMin: 16, suhuMax: 25, rhMin: 45, rhMax: 65 },
  { no: 18, id: "K3081030", nama: "Primary Packaging Material", mon: "Primary Packaging Material vs Corridor Class D", jenis: "°C, %RH, Pa", area: "Logistik", tabGroup: "Logistic", alertDP: 10, actionDP: 5, suhuMin: 16, suhuMax: 25, rhMin: 45, rhMax: 65 },
  { no: 19, id: "K3081046", nama: "Weighing Room", mon: "Corridor Class D vs Weighing Room", jenis: "°C, %RH, Pa", area: "Logistik", tabGroup: "Logistic", alertDP: 10, actionDP: 5, suhuMin: 16, suhuMax: 25, rhMin: 45, rhMax: 65 },
  { no: 20, id: "K3081045", nama: "Airlock BF2113", mon: "Airlock BF2113 vs Weighing Room", jenis: "°C, %RH, Pa", area: "Logistik", tabGroup: "Logistic", alertDP: 10, actionDP: 5, suhuMin: 16, suhuMax: 25, rhMin: 45, rhMax: 65 },
  { no: 21, id: "K3081061", nama: "Primary Packaging Material", mon: "Primary Packaging Material vs Airlock BF2113", jenis: "Pa", area: "Logistik", tabGroup: "Logistic", alertDP: 10, actionDP: 5, suhuMin: "", suhuMax: "", rhMin: "", rhMax: "" },
  { no: 22, id: "K3081040", nama: "Gowning D ON Female", mon: "Gowning D ON (Female) vs Gowning F OFF (Female)", jenis: "°C, %RH, Pa", area: "Loker Female", tabGroup: "Loker", alertDP: 10, actionDP: 5, suhuMin: 16, suhuMax: 25, rhMin: 45, rhMax: 65 },
  { no: 23, id: "K3081053", nama: "Airlock BF2108", mon: "Airlock BF2108 vs Personal Locker", jenis: "Pa", area: "Loker Female", tabGroup: "Loker", alertDP: 10, actionDP: 5, suhuMin: "", suhuMax: "", rhMin: "", rhMax: "" },
  { no: 24, id: "K3081006", nama: "Production Man Locker", mon: "Production Man Locker vs CNC Corridor", jenis: "Pa", area: "Loker Male", tabGroup: "Loker", alertDP: 10, actionDP: 5, suhuMin: "", suhuMax: "", rhMin: "", rhMax: "" },
  { no: 25, id: "K3081005", nama: "Gowning F OFF Female", mon: "Gowning F OFF (Female) vs Stairs", jenis: "Pa", area: "Loker Female", tabGroup: "Loker", alertDP: 10, actionDP: 5, suhuMin: "", suhuMax: "", rhMin: "", rhMax: "" }
];

let CURRENT_TAB = 'Master';
// Registry tab: tiap file tab (master.js, line1.js, ... grafik.js) mendaftarkan renderer-nya di sini
const TAB_RENDERERS = {};
let chartDP = null, chartSuhu = null, chartRH = null;
let SHEET_URL = '';
let STATUS_REQ = 0;
let LAST_KEY = '';
let LAST_GRAFIK_NO = 1;
let OPERATORS = [];
/* ---------- Utilitas ---------- */
function pad2(n) { return n < 10 ? '0' + n : String(n); }
function localYMD(d) { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function hasVal(v) { return v !== '' && v !== null && v !== undefined && !isNaN(Number(v)); }
function numOrNull(v) { return hasVal(v) ? Number(v) : null; }
function show(v) { return hasVal(v) ? v : '-'; }

/* ---------- Mode: di dalam Apps Script (google.script.run) ATAU di luar (fetch ke URL /exec) ---------- */
const API_URL_DEFAULT = 'https://script.google.com/macros/s/AKfycbyOGfgCu-6pLZMMDgpgK6xjjDcIuuDIFAA3gldICTiZco7GlwNCYV6mTF5vBZUUewkXzQ/exec';   // Opsional: isi URL /exec di sini supaya hosting lokal/Vercel/Netlify langsung jalan
const IN_GAS = (typeof google !== 'undefined' && google.script && google.script.run) ? true : false;

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function getApiUrl() { return String(API_URL_DEFAULT || lsGet('FIMA_API_URL') || '').trim(); }

function aturApiUrl() {
  const cur = getApiUrl();
  const val = prompt('Tempel URL Web App Apps Script (berakhiran /exec):', cur);
  if (val === null) return;
  const clean = val.trim();
  if (clean !== '' && !/^https:\/\/script\.google\.com\/.+\/exec$/.test(clean)) {
    alert('URL tidak valid. Contoh: https://script.google.com/macros/s/XXXX/exec');
    return;
  }
  lsSet('FIMA_API_URL', clean);
  SHEET_URL = '';
  showToast('URL API disimpan. Memuat data...');
  syncMasterFromSheets();
  gs('getSpreadsheetUrl', [], function (u) { SHEET_URL = u; });
  if (CURRENT_TAB !== 'Master' && CURRENT_TAB !== 'Grafik') cekStatusShiftArea();
  if (CURRENT_TAB === 'Grafik') muatGrafikBulanan();
}

function inisialisasiMode() {
  if (IN_GAS || API_URL_DEFAULT) return;
  const b = document.getElementById('btnApiUrl');
  if (b) b.style.display = 'flex';
}

function parseResult(r) {
  if (typeof r === 'string') { try { return JSON.parse(r); } catch (e) { return r; } }
  return r;
}

/** Panggil fungsi server. Hasil string JSON otomatis di-parse. Selalu ada handler gagal. */
function gs(fn, args, ok, fail) {
  args = args || [];
  const failH = function (e) {
    if (e && e.message && String(e.message).indexOf('AUTH_GAGAL') >= 0) { keluarLogin('Sesi tidak valid. Silakan masuk lagi.'); return; }
    if (fail) fail(e); else showToast('Error: ' + (e && e.message ? e.message : e));
  };

  if (IN_GAS) {
    google.script.run
      .withSuccessHandler(function (r) { if (ok) ok(parseResult(r)); })
      .withFailureHandler(failH).apiCall(APP_PW, fn, args);
    return;
  }

  const url = getApiUrl();
  if (!url) { failH(new Error('URL API belum diisi. Buka menu ≡ > Atur URL API.')); return; }

  const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 60000) : null;

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // text/plain = tanpa preflight CORS
    body: JSON.stringify({ fn: fn, args: args, pw: APP_PW }),
    redirect: 'follow',
    signal: ctrl ? ctrl.signal : undefined
  })
    .then(function (r) { return r.text(); })
    .then(function (t) {
      let j;
      try { j = JSON.parse(t); } catch (e) {
        throw new Error('Respons server bukan JSON. Pastikan URL berakhiran /exec dan akses deployment = "Siapa saja".');
      }
      if (!j.ok) throw new Error(j.error || 'Error server');
      return j;
    })
    .then(function (j) {
      if (timer) clearTimeout(timer);
      if (ok) ok(parseResult(j.data));
    }, function (e) {
      if (timer) clearTimeout(timer);
      failH((e && e.name === 'AbortError') ? new Error('Waktu habis (60 detik). Coba lagi.') : e);
    });
}

/* ---------- LOGIN ---------- */
let APP_PW = '';
function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
function hapusSesi() {
  try { sessionStorage.removeItem('FIMA_PW'); } catch (e) {}
  try { localStorage.removeItem('FIMA_PW'); } catch (e) {}
}

function tampilLogin(msg) {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginError').textContent = msg || '';
  document.getElementById('loginUrlRow').style.display = (!IN_GAS && !getApiUrl()) ? 'block' : 'none';
  setTimeout(function () { const p = document.getElementById('loginPw'); if (p) p.focus(); }, 120);
}
function sembunyiLogin() { document.getElementById('loginScreen').style.display = 'none'; }

function togglePw() {
  const i = document.getElementById('loginPw');
  const ic = document.getElementById('pwIcon');
  const sh = i.type === 'password';
  i.type = sh ? 'text' : 'password';
  ic.className = sh ? 'fas fa-eye-slash' : 'fas fa-eye';
}

function mulaiAplikasi() {
  syncMasterFromSheets();
  muatOperator();
  gs('getSpreadsheetUrl', [], function (u) { SHEET_URL = u; });
}

function cobaMasukOtomatis() {
  const saved = ssGet('FIMA_PW') || lsGet('FIMA_PW');
  if (!saved || (!IN_GAS && !getApiUrl())) { tampilLogin(''); return; }
  APP_PW = saved;
  gs('cekLogin', [], function (r) {
    if (r && r.ok) { sembunyiLogin(); mulaiAplikasi(); }
    else { APP_PW = ''; hapusSesi(); tampilLogin('Sesi berakhir, silakan masuk lagi.'); }
  }, function (err) {
    APP_PW = '';
    tampilLogin('Tidak bisa terhubung: ' + (err && err.message ? err.message : err));
  });
}

function prosesLogin(ev) {
  if (ev) ev.preventDefault();
  const pw = document.getElementById('loginPw').value;
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('btnLogin');
  errEl.textContent = '';

  if (!IN_GAS) {
    // Hanya periksa dan validasi input URL jika belum ada URL yang valid di sistem (API_URL_DEFAULT / localStorage)
    if (!getApiUrl()) {
      const u = document.getElementById('loginUrl').value.trim();
      if (!u) { errEl.textContent = 'Isi URL Web App terlebih dahulu.'; return; }
      if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(u)) { errEl.textContent = 'URL tidak valid. Harus berakhiran /exec'; return; }
      lsSet('FIMA_API_URL', u);
    }
  }
  if (!pw) { errEl.textContent = 'Password wajib diisi.'; return; }

  const reset = function () { btn.disabled = false; btn.innerHTML = '<i class="fas fa-right-to-bracket"></i> MASUK'; };
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MEMERIKSA...';
  APP_PW = pw;

  gs('cekLogin', [], function (r) {
    reset();
    if (r && r.ok) {
      ssSet('FIMA_PW', pw);
      if (document.getElementById('loginRemember').checked) lsSet('FIMA_PW', pw);
      document.getElementById('loginPw').value = '';
      sembunyiLogin();
      mulaiAplikasi();
    } else {
      APP_PW = '';
      errEl.textContent = 'Password salah.';
      document.getElementById('loginPw').select();
    }
  }, function (err) {
    reset();
    APP_PW = '';
    errEl.textContent = 'Gagal terhubung: ' + (err && err.message ? err.message : err);
  });
}

function keluarLogin(msg) {
  APP_PW = '';
  hapusSesi();
  STATUS_REQ++;
  switchTab('Master', document.getElementById('nav-Master'));
  tampilLogin(msg || '');
}

function showToast(msg) {
  const el = document.getElementById('toastMsg');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(function () { el.style.display = 'none'; }, 3500);
}

const LOGO_SRC = 'img/logo.png';

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('img.company-logo').forEach(function (im) { im.src = LOGO_SRC; });
  const now = new Date();
  const h = now.getHours();
  let shiftVal = '23:00|Shift 3', tgl = new Date(now);
  if (h >= 7 && h < 15) shiftVal = '07:00|Shift 1';
  else if (h >= 15 && h < 23) shiftVal = '15:00|Shift 2';
  else if (h < 7) tgl.setDate(tgl.getDate() - 1); // Shift 3 setelah tengah malam = tanggal kemarin
  document.getElementById('ctrlTanggal').value = localYMD(tgl);
  document.getElementById('ctrlJamShift').value = shiftVal;
  try { OPERATORS = JSON.parse(lsGet('FIMA_OPERATORS') || '[]') || []; } catch (e) { OPERATORS = []; }
  renderOperatorOptions();

  renderMasterData();
  inisialisasiMode();
  cobaMasukOtomatis();
});

function syncMasterFromSheets() {
  gs('getMasterData', [], function (res) {
    if (res && res.length > 0) {
      MASTER_DATA = res;
      if (CURRENT_TAB === 'Master') renderMasterData();
    }
  }, function (e) { showToast('Gagal memuat Master: ' + (e && e.message ? e.message : e)); });
}

function bukaLinkSpreadsheet() {
  if (SHEET_URL) { window.open(SHEET_URL, '_blank'); return; }
  gs('getSpreadsheetUrl', [], function (u) { SHEET_URL = u; showToast('Ketuk lagi untuk membuka Sheet'); });
}


/* ---------- 4. NAVIGASI & MODAL ---------- */
function switchTab(tabName, element) {
  CURRENT_TAB = tabName;
  STATUS_REQ++; // batalkan respons status tab sebelumnya
  document.querySelectorAll('.nav-item').forEach(function (nav) { nav.classList.remove('active'); });
  if (element) element.classList.add('active');
  const render = TAB_RENDERERS[tabName] || renderInputForms;
  render(tabName);
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}

function setTheme(themeName) {
  const f = document.getElementById('appFrame');
  f.classList.remove('theme-light', 'theme-dark');
  f.classList.add(themeName);
  document.getElementById('btnLight').classList.toggle('active-theme', themeName === 'theme-light');
  document.getElementById('btnDark').classList.toggle('active-theme', themeName === 'theme-dark');
  toggleSidebar();
}
