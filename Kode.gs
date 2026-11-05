/**
 * FORM INPUT MONITORING RUANGAN - PT FIMA  (Kode.gs  v4, SATU FILE)
 * Tampilan HTML/CSS/JS sudah ada di bagian paling bawah file ini (APP_HTML).
 * Project Apps Script cukup berisi 1 file: Kode.gs (tidak perlu Index.html)
 * HTML yang sama juga ada sebagai index.html terpisah untuk hosting lokal/Vercel/Netlify (lewat doPost di bawah)
 *
 * PERTAMA KALI / SETELAH GANTI KODE:
 *   Pilih fungsi  perbaikiSpreadsheet  di dropdown editor -> klik Jalankan (1x saja).
 *   Fungsi ini memperbaiki header, data lama, limit kosong, dan membangun ulang tab Grafik Tekanan.
 *   Setelah itu: Terapkan > Kelola deployment > Edit > Versi baru > Terapkan.
 */
const SPREADSHEET_ID = '18xXo8OoU__3FzC9dyqKDlyyNEGV0q54_dXjYquv5eAw';
const TIMEZONE = 'Asia/Jakarta';

// PASSWORD LOGIN APLIKASI. Ganti di sini bila ingin mengubah (lalu deploy Versi baru).
const APP_PASSWORD = 'fima2026';
const CACHE_KEY = 'SHEETS_READY_V5';

const HEADERS_MASTER = [
  'No', 'ID', 'Nama Ruang', 'Monitoring', 'Jenis Pengukuran', 'Area', 'Status',
  'Alert DP (Pa)', 'Action DP (Pa)', 'Suhu Min (°C)', 'Suhu Max (°C)', 'RH Min (%)', 'RH Max (%)'
];
const HEADERS_INPUT = [
  'Tanggal', 'Jam', 'Shift', 'Operator', 'Tab Area', 'Sub Area',
  'No Titik', 'ID Alat', 'Nama Ruang', 'Monitoring',
  'Suhu (°C)', 'RH (%)', 'Tekanan (Pa)', 'Timestamp Input',
  'Catatan', 'Status Hari'
];
const HEADERS_OPERATOR = ['Inisial', 'Nama'];
const HEADERS_SPV = ['Bulan (yyyy-MM)', 'Nama Spv Area', 'Tanggal Input'];

let _ss = null;

function doGet(e) {
  if (e && e.parameter && e.parameter.ping) {
    return ContentService.createTextOutput(JSON.stringify({ ok: true, pong: true })).setMimeType(ContentService.MimeType.JSON);
  }
  ensureSheetsExist_();
  return HtmlService.createHtmlOutput(APP_HTML)
    .setTitle('Form Input Monitoring Ruangan')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * API untuk HTML yang dihosting di luar Apps Script (lokal / Vercel / Netlify).
 * Dipanggil lewat fetch POST (Content-Type text/plain) berisi {fn, args}.
 * Hanya fungsi di daftar putih ini yang boleh dipanggil.
 */
function doPost(e) {
  let out;
  try {
    const req = JSON.parse(e.postData.contents);
    out = { ok: true, data: apiCall(req.pw, req.fn, req.args) };
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Pintu masuk tunggal untuk SEMUA panggilan dari halaman (google.script.run maupun fetch).
 * Memeriksa password di sisi server, lalu menjalankan fungsi yang ada di daftar putih.
 */
function apiCall(pw, fn, args) {
  if (String(pw) !== APP_PASSWORD) {
    if (fn === 'cekLogin') {
      Utilities.sleep(700); // perlambat tebak-tebakan password
      return JSON.stringify({ ok: false });
    }
    Utilities.sleep(700);
    throw new Error('AUTH_GAGAL');
  }
  if (fn === 'cekLogin') return JSON.stringify({ ok: true });

  const allowed = {
    getMasterData: getMasterData,
    saveMasterData: saveMasterData,
    cekShift: cekShift,
    simpanMonitoringBulk: simpanMonitoringBulk,
    getGrafikSheetData: getGrafikSheetData,
    getSpreadsheetUrl: getSpreadsheetUrl,
    getOperators: getOperators,
    saveOperator: saveOperator,
    deleteOperator: deleteOperator,
    getSpvReview: getSpvReview,
    saveSpvReview: saveSpvReview
  };
  if (!allowed[fn]) throw new Error('Fungsi tidak dikenal: ' + fn);
  return allowed[fn].apply(null, args || []);
}

/* ====================== UTILITAS ====================== */

function getSpreadsheet_() {
  if (_ss) return _ss;
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== '') {
    _ss = SpreadsheetApp.openById(SPREADSHEET_ID.trim());
    return _ss;
  }
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) { _ss = active; return _ss; }
  } catch (e) {}
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty('AUTO_SPREADSHEET_ID');
  if (savedId) {
    try { _ss = SpreadsheetApp.openById(savedId); return _ss; } catch (e) {}
  }
  _ss = SpreadsheetApp.create('Database Monitoring Ruangan FIMA');
  props.setProperty('AUTO_SPREADSHEET_ID', _ss.getId());
  return _ss;
}

function getSpreadsheetUrl() {
  return getSpreadsheet_().getUrl();
}

function ssTz_() {
  return getSpreadsheet_().getSpreadsheetTimeZone() || TIMEZONE;
}

function pad2_(n) { return n < 10 ? '0' + n : String(n); }

/** Tanggal sel -> 'yyyy-MM-dd' (aman untuk teks maupun Date) */
function toYmd_(v, tz) {
  if (v === '' || v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, tz || TIMEZONE, 'yyyy-MM-dd');
  }
  return String(v).trim().substring(0, 10);
}

/** Jam sel -> 'HH:mm'. Untuk sel jam bertipe Date dipakai teks tampilan sel. */
function toHm_(v, display) {
  if (v === '' || v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    const m = String(display || '').match(/(\d{1,2})[.:](\d{2})/);
    return m ? pad2_(Number(m[1])) + ':' + m[2] : '';
  }
  const m2 = String(v).trim().match(/^(\d{1,2})[.:](\d{2})/);
  return m2 ? pad2_(Number(m2[1])) + ':' + m2[2] : String(v).trim();
}

function toNum_(v) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(String(v).replace(',', '.'));
  return isNaN(n) ? '' : n;
}

function toTs_(v, tz) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, tz || TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  }
  return String(v === null || v === undefined ? '' : v);
}

/* ====================== DATA MASTER AWAL ====================== */

/** [No, ID, Nama, Monitoring, Jenis, Area, Status, AlertDP, ActionDP, SuhuMin, SuhuMax, RHMin, RHMax] */
function getInitialMasterData_() {
  return [
    [1, 'K3081029', 'Airlock BF2108', 'Gowning D ON (Male) vs Airlock', '°C, %RH, Pa', 'Loker Male', 'Aktif', 10, 5, 16, 25, 45, 65],
    [2, 'K3081048', 'Airlock BF2116', 'Airlock BF2116 vs Gowning D ON (Female)', 'Pa', 'Loker Female', 'Aktif', 10, 5, '', '', '', ''],
    [3, 'K3081004', 'Airlock BF2116', 'Airlock BF2116 vs Gowning D ON (Male)', 'Pa', 'Loker Male', 'Aktif', 10, 5, '', '', '', ''],
    [4, 'K3081035', 'Airlock BF2115', 'Corridor Class D vs Airlock BF2115', '°C, %RH, Pa', 'Line 1', 'Aktif', 10, 5, 16, 25, 45, 65],
    [5, 'K3081047', 'Part Storage', 'Corridor Class D vs Part Storage', '°C, %RH, Pa', 'Line 1', 'Aktif', 10, 5, 16, 25, 45, 65],
    [6, 'K3081038*', 'PM Transfer Line I', 'Corridor Class D vs PM Transfer Line I', '°C, %RH, Pa', 'Line 1', 'Aktif', 10, 5, 16, 25, 45, 65],
    [7, 'K3081032', 'Mixing Room Line I', 'Mixing Room Line I vs Corridor Class D', '°C, %RH, Pa', 'Line 1', 'Aktif', 10, 5, 16, 25, 45, 65],
    [8, 'K3081034', 'Corridor Class D', 'Corridor Class D vs Janitor', '°C, %RH, Pa', 'Line 1', 'Aktif', 10, 5, 16, 25, 45, 65],
    [9, 'K3081033', 'Laundry I', 'Laundry vs Corridor Class D', '°C, %RH, Pa', 'Line 1', 'Aktif', 10, 5, 16, 25, 45, 65],
    [10, 'K3081039', 'Gowning D OFF', 'Gowning D OFF vs Corridor Class D', '°C, %RH, Pa', 'Line 1', 'Aktif', 10, 5, 16, 25, 45, 65],
    [11, 'K3081031', 'Tool Sterilizations', 'Tool Sterilizations vs Corridor Class D', '°C, %RH, Pa', 'Line 1', 'Aktif', 10, 5, 16, 25, 45, 65],
    [12, 'K3081038*', 'Equipment Wash', 'Corridor Class D vs Equipment Wash', '°C, %RH, Pa', 'Line 1', 'Aktif', 10, 5, 16, 25, 45, 65],
    [13, 'K3081058', 'Gowning D OFF', 'Gowning D OFF vs Corridor Class D', '°C, %RH, Pa', 'Line 2', 'Aktif', 10, 5, 16, 25, 45, 65],
    [14, 'K3081001', 'Laundry 2', 'Laundry vs Corridor Class D', '°C, %RH, Pa', 'Line 2', 'Aktif', 10, 5, 16, 25, 45, 65],
    [15, 'K3081057', 'Mixing Room Line 2', 'Mixing Room Line 2 vs Corridor Class D', '°C, %RH, Pa', 'Line 2', 'Aktif', 10, 5, 16, 25, 45, 65],
    [16, 'K3081002', 'PM Transfer', 'PM Transfer vs Corridor Class D', '°C, %RH, Pa', 'Line 2', 'Aktif', 10, 5, 16, 25, 45, 65],
    [17, 'K3081055', 'Airlock BF2107', 'Corridor Class D vs Airlock BF2107', '°C, %RH, Pa', 'Logistik', 'Aktif', 10, 5, 16, 25, 45, 65],
    [18, 'K3081030', 'Primary Packaging Material', 'Primary Packaging Material vs Corridor Class D', '°C, %RH, Pa', 'Logistik', 'Aktif', 10, 5, 16, 25, 45, 65],
    [19, 'K3081046', 'Weighing Room', 'Corridor Class D vs Weighing Room', '°C, %RH, Pa', 'Logistik', 'Aktif', 10, 5, 16, 25, 45, 65],
    [20, 'K3081045', 'Airlock BF2113', 'Airlock BF2113 vs Weighing Room', '°C, %RH, Pa', 'Logistik', 'Aktif', 10, 5, 16, 25, 45, 65],
    [21, 'K3081061', 'Primary Packaging Material', 'Primary Packaging Material vs Airlock BF2113', 'Pa', 'Logistik', 'Aktif', 10, 5, '', '', '', ''],
    [22, 'K3081040', 'Gowning D ON Female', 'Gowning D ON (Female) vs Gowning F OFF (Female)', '°C, %RH, Pa', 'Loker Female', 'Aktif', 10, 5, 16, 25, 45, 65],
    [23, 'K3081053', 'Airlock BF2108', 'Airlock BF2108 vs Personal Locker', 'Pa', 'Loker Female', 'Aktif', 10, 5, '', '', '', ''],
    [24, 'K3081006', 'Production Man Locker', 'Production Man Locker vs CNC Corridor', 'Pa', 'Loker Male', 'Aktif', 10, 5, '', '', '', ''],
    [25, 'K3081005', 'Gowning F OFF Female', 'Gowning F OFF (Female) vs Stairs', 'Pa', 'Loker Female', 'Aktif', 10, 5, '', '', '', '']
  ];
}

/* ====================== MEMASTIKAN TAB ADA ====================== */

function styleHeader_(range) {
  range.setFontWeight('bold').setBackground('#0288d1').setFontColor('#ffffff');
}

function ensureSheetsExist_(force) {
  const cache = CacheService.getScriptCache();
  if (!force && cache.get(CACHE_KEY)) return;

  const ss = getSpreadsheet_();

  // 1. MasterData
  let sm = ss.getSheetByName('MasterData');
  if (!sm) sm = ss.insertSheet('MasterData');
  sm.getRange(1, 1, 1, HEADERS_MASTER.length).setValues([HEADERS_MASTER]);
  styleHeader_(sm.getRange(1, 1, 1, HEADERS_MASTER.length));
  if (sm.getLastRow() <= 1) {
    const init = getInitialMasterData_();
    sm.getRange(2, 1, init.length, 13).setValues(init);
  }

  // 2. FormInput (header selalu disamakan dengan 14 kolom format baru)
  let si = ss.getSheetByName('FormInput');
  if (!si) si = ss.insertSheet('FormInput');
  if (si.getMaxColumns() < HEADERS_INPUT.length) si.insertColumnsAfter(si.getMaxColumns(), HEADERS_INPUT.length - si.getMaxColumns());
  si.getRange(1, 1, 1, HEADERS_INPUT.length).setValues([HEADERS_INPUT]);
  styleHeader_(si.getRange(1, 1, 1, HEADERS_INPUT.length));
  si.setFrozenRows(1);

  // 2b. Operator (daftar inisial untuk dropdown)
  let so = ss.getSheetByName('Operator');
  if (!so) so = ss.insertSheet('Operator');
  so.getRange(1, 1, 1, HEADERS_OPERATOR.length).setValues([HEADERS_OPERATOR]);
  styleHeader_(so.getRange(1, 1, 1, HEADERS_OPERATOR.length));
  so.setFrozenRows(1);

  // 2c. SpvReview (nama Spv Area per bulan)
  let spv = ss.getSheetByName('SpvReview');
  if (!spv) spv = ss.insertSheet('SpvReview');
  spv.getRange(1, 1, 1, HEADERS_SPV.length).setValues([HEADERS_SPV]);
  styleHeader_(spv.getRange(1, 1, 1, HEADERS_SPV.length));
  spv.setFrozenRows(1);

  // 3. Grafik Tekanan
  if (!ss.getSheetByName('Grafik Tekanan')) setupGrafikTekananSheet_(ss);

  cache.put(CACHE_KEY, '1', 21600);
}

/* ====================== TAB GRAFIK TEKANAN (SHEET) ====================== */

function setupGrafikTekananSheet_(ss) {
  const sh = ss.insertSheet('Grafik Tekanan');

  // Pastikan kolom cukup (sheet baru hanya punya 26 kolom, kita butuh sampai AL = 38)
  if (sh.getMaxColumns() < 40) sh.insertColumnsAfter(sh.getMaxColumns(), 40 - sh.getMaxColumns());
  if (sh.getMaxRows() < 70) sh.insertRowsAfter(sh.getMaxRows(), 70 - sh.getMaxRows());

  sh.getRange('A1').setValue('CATATAN HASIL MONITORING TEKANAN UDARA (DP) – RUANG PRODUKSI').setFontWeight('bold').setFontSize(12);
  sh.getRange('A2').setValue('Pemantauan Lingkungan Produksi, Laboratorium, dan Ruang Bantu').setFontStyle('italic');

  sh.getRange('A4').setValue('No. Ruangan').setFontWeight('bold');
  sh.getRange('B4').setValue(1).setBackground('#fef08a').setFontWeight('bold');

  // setFormula = sintaks Inggris (koma). Tidak tergantung bahasa/locale spreadsheet.
  const lookup = function (col, def) {
    return '=IFERROR(INDEX(MasterData!$' + col + '$2:$' + col + '$200,MATCH($B$4,MasterData!$A$2:$A$200,0)),' + def + ')';
  };
  sh.getRange('A5').setValue('ID');
  sh.getRange('B5').setFormula(lookup('B', '"-"'));
  sh.getRange('A6').setValue('Nama Ruang');
  sh.getRange('B6').setFormula(lookup('C', '"-"'));
  sh.getRange('A7').setValue('Monitoring');
  sh.getRange('B7').setFormula(lookup('D', '"-"'));
  sh.getRange('A8').setValue('Jenis Pengukuran');
  sh.getRange('B8').setFormula(lookup('E', '"-"'));
  sh.getRange('A9').setValue('Bulan / Tahun');
  sh.getRange('B9').setNumberFormat('@').setValue(Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM'));

  sh.getRange('V4').setValue('Limit').setFontWeight('bold');
  sh.getRange('V5').setValue('Alert limit (Pa)');
  sh.getRange('AA5').setFormula(lookup('H', '10')).setBackground('#fef08a');
  sh.getRange('V6').setValue('Action limit (Pa)');
  sh.getRange('AA6').setFormula(lookup('I', '5')).setBackground('#fef08a');
  sh.getRange('V7').setValue('Ruangan, bulan, dan isi tabel diisi otomatis dari aplikasi (tab Grafik).');

  // Tabel horizontal tanggal 1-31 (baris 34-42)
  const tgl = ['Tgl'];
  for (let d = 1; d <= 31; d++) tgl.push(d);
  sh.getRange(34, 1, 1, 32).setValues([tgl]).setFontWeight('bold').setBackground('#e2e8f0').setHorizontalAlignment('center');
  sh.getRange('A35').setValue('DP (Pa)').setFontWeight('bold');
  sh.getRange('A36').setValue('Jam');
  sh.getRange('A37').setValue('Dicatat oleh');
  sh.getRange('A38').setValue('Diketahui oleh Spv Area');
  sh.getRange('A39').setValue('Catatan');
  sh.getRange('A41').setValue('Alert limit');
  sh.getRange('A42').setValue('Action limit');
  sh.getRange('A40').setValue('Baris 41-42 dan tabel AI34:AL65 = sumber data grafik (otomatis, jangan diubah)').setFontStyle('italic').setFontColor('#64748b');

  sh.setColumnWidth(1, 180);
  for (let c = 2; c <= 32; c++) sh.setColumnWidth(c, 38);

  // Tabel vertikal sumber grafik: AI = Tgl (teks), AJ = DP, AK = Alert, AL = Action
  sh.getRange('AI34:AL34').setValues([['Tgl', 'DP (Pa)', 'Alert limit', 'Action limit']]).setFontWeight('bold').setBackground('#e2e8f0');
  const tglText = [];
  for (let d = 1; d <= 31; d++) tglText.push([String(d)]);
  sh.getRange('AI35:AI65').setNumberFormat('@').setValues(tglText);

  buildGrafikChart_(sh);
  return sh;
}

function buildGrafikChart_(sh) {
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  const chart = sh.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(sh.getRange('AI34:AL65'))
    .setNumHeaders(1)
    .setOption('useFirstColumnAsDomain', true)
    .setOption('interpolateNulls', true)
    .setOption('title', 'Grafik Monitoring Tekanan Udara (DP - Pa)')
    .setOption('legend', { position: 'bottom' })
    .setOption('hAxis', { title: 'Tanggal (1 - 31)' })
    .setOption('vAxis', { title: 'DP (Pa)' })
    .setOption('series', {
      0: { color: '#0288d1', lineWidth: 3, pointSize: 5 },
      1: { color: '#eab308', lineDashStyle: [4, 4], lineWidth: 2, pointSize: 0 },
      2: { color: '#ef4444', lineDashStyle: [4, 4], lineWidth: 2, pointSize: 0 }
    })
    .setPosition(11, 1, 0, 0)
    .setOption('width', 980)
    .setOption('height', 360)
    .build();
  sh.insertChart(chart);
}

function updateSheetGrafikCells_(ss, room, yearMonth, days) {
  const sh = ss.getSheetByName('Grafik Tekanan');
  if (!sh) return;

  sh.getRange('B4').setValue(room.no);
  sh.getRange('B9').setNumberFormat('@').setValue(yearMonth);

  const dpRow = days.map(function (d) { return d.dp; });
  const jamRow = days.map(function (d) { return d.jam; });
  const opRow = days.map(function (d) { return d.operator; });
  const alertV = (room.alertDP === '' ? '' : Number(room.alertDP));
  const actionV = (room.actionDP === '' ? '' : Number(room.actionDP));

  sh.getRange(35, 2, 1, 31).setValues([dpRow]);
  sh.getRange(36, 2, 1, 31).setNumberFormat('@').setValues([jamRow]);
  sh.getRange(37, 2, 1, 31).setNumberFormat('@').setValues([opRow]);
  sh.getRange(41, 2, 1, 31).setValues([days.map(function () { return alertV; })]);
  sh.getRange(42, 2, 1, 31).setValues([days.map(function () { return actionV; })]);

  const vert = days.map(function (d) { return [d.dp, alertV, actionV]; });
  sh.getRange(35, 36, 31, 3).setValues(vert); // kolom AJ:AL
}

/* ====================== MASTER DATA (API) ====================== */

function getMasterData() {
  ensureSheetsExist_();
  return JSON.stringify(getMasterList_());
}

function getMasterList_() {
  const sheet = getSpreadsheet_().getSheetByName('MasterData');
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  const list = [];
  data.forEach(function (r, i) {
    if (String(r[1] || '').trim() === '' && String(r[2] || '').trim() === '') return; // baris kosong
    const rawArea = String(r[5] || '').trim();
    let tabGroup = rawArea;
    const low = rawArea.toLowerCase();
    if (low.indexOf('loker') >= 0 || low.indexOf('worker') >= 0) tabGroup = 'Loker';
    if (low.indexOf('logistik') >= 0 || low.indexOf('logistic') >= 0) tabGroup = 'Logistic';

    const jenisStr = String(r[4] || '').trim();
    const adaSuhu = jenisStr.indexOf('°C') >= 0;
    const val = function (x, def) { const n = toNum_(x); return n === '' ? def : n; };

    list.push({
      rowIndex: i + 2,
      no: Number(r[0]) || (i + 1),
      id: String(r[1] || '').trim(),
      nama: String(r[2] || '').trim(),
      mon: String(r[3] || '').trim(),
      jenis: jenisStr,
      area: rawArea,
      tabGroup: tabGroup,
      status: String(r[6] || 'Aktif').trim(),
      alertDP: val(r[7], 10),
      actionDP: val(r[8], 5),
      suhuMin: val(r[9], adaSuhu ? 16 : ''),
      suhuMax: val(r[10], adaSuhu ? 25 : ''),
      rhMin: val(r[11], adaSuhu ? 45 : ''),
      rhMax: val(r[12], adaSuhu ? 65 : '')
    });
  });
  return list;
}

function saveMasterData(payload) {
  ensureSheetsExist_();
  const sheet = getSpreadsheet_().getSheetByName('MasterData');
  const numOrBlank = function (x) { const n = toNum_(x); return n === '' ? '' : n; };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const isEdit = !!payload.rowIndex;
    let no = Number(payload.no) || 0;
    if (!isEdit) {
      const lastRow = sheet.getLastRow();
      let maxNo = 0;
      if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, 1).getValues().forEach(function (r) { maxNo = Math.max(maxNo, Number(r[0]) || 0); });
      }
      no = maxNo + 1;
    }
    const rowValues = [
      no,
      String(payload.id || '').trim(),
      String(payload.nama || '').trim(),
      String(payload.mon || '').trim(),
      String(payload.jenis || '°C, %RH, Pa').trim(),
      String(payload.area || 'Line 1').trim(),
      String(payload.status || 'Aktif').trim(),
      numOrBlank(payload.alertDP), numOrBlank(payload.actionDP),
      numOrBlank(payload.suhuMin), numOrBlank(payload.suhuMax),
      numOrBlank(payload.rhMin), numOrBlank(payload.rhMax)
    ];
    if (isEdit) {
      sheet.getRange(Number(payload.rowIndex), 1, 1, 13).setValues([rowValues]);
      return JSON.stringify({ success: true, message: 'Master Data & Limit Ruangan berhasil diperbarui.' });
    }
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, 13).setValues([rowValues]);
    return JSON.stringify({ success: true, message: 'Titik ruangan baru berhasil ditambahkan (No. ' + no + ').' });
  } finally {
    lock.releaseLock();
  }
}

/* ====================== MEMBACA FormInput ====================== */

/** Semua baris FormInput format baru (14 kolom). Baris tanpa No Titik valid dilewati. */
function readInputRows_() {
  const ss = getSpreadsheet_();
  const sh = ss.getSheetByName('FormInput');
  const last = sh.getLastRow();
  if (last <= 1) return [];

  const nCol = Math.min(HEADERS_INPUT.length, sh.getMaxColumns());
  const rng = sh.getRange(2, 1, last - 1, nCol);
  const vals = rng.getValues();
  const disp = rng.getDisplayValues();
  const tz = ssTz_();
  const out = [];

  for (let i = 0; i < vals.length; i++) {
    const r = vals[i];
    const no = Number(r[6]);
    if (!(no > 0)) continue;
    out.push({
      row: i + 2,
      tanggal: toYmd_(r[0], tz),
      jam: toHm_(r[1], disp[i][1]),
      shift: String(r[2]).trim(),
      operator: String(r[3]).trim(),
      tabGroup: String(r[4]).trim(),
      no: no,
      id: String(r[7]).trim(),
      suhu: toNum_(r[10]),
      rh: toNum_(r[11]),
      dp: toNum_(r[12]),
      catatan: String(r.length > 14 ? (r[14] || '') : '').trim(),
      status: String(r.length > 15 ? (r[15] || '') : '').trim().toUpperCase()
    });
  }
  return out;
}

/* ====================== CEK STATUS SHIFT (anti isi ulang) ====================== */

function cekShift(tanggal, shift, tabGroup) {
  ensureSheetsExist_();
  const targetDate = toYmd_(tanggal);
  const targetShift = String(shift).trim();
  const targetTab = String(tabGroup).trim();

  const totalRooms = getMasterList_().filter(function (m) {
    return m.tabGroup === targetTab && m.status === 'Aktif';
  }).length;

  const recordsByNo = {};
  let lastOperator = '';
  readInputRows_().forEach(function (r) {
    if (r.tanggal === targetDate && r.shift === targetShift && r.tabGroup === targetTab) {
      lastOperator = r.operator;
      recordsByNo[String(r.no)] = { suhu: r.suhu, rh: r.rh, dp: r.dp, operator: r.operator, catatan: r.catatan, status: r.status };
    }
  });

  const filledCount = Object.keys(recordsByNo).length;
  return JSON.stringify({
    sudahDiisi: filledCount > 0,
    isComplete: totalRooms > 0 && filledCount >= totalRooms,
    filledCount: filledCount,
    totalRooms: totalRooms,
    operator: lastOperator,
    recordsByNo: recordsByNo
  });
}

/* ====================== SIMPAN DATA ====================== */

function simpanMonitoringBulk(payload) {
  ensureSheetsExist_();

  if (!payload || !payload.tanggal || !payload.jam || !payload.shift || !payload.operator || !payload.tabGroup) {
    throw new Error('Tanggal, Jam/Shift, dan Inisial Operator wajib diisi.');
  }
  const entries = payload.entries || [];
  if (entries.length === 0) throw new Error('Tidak ada data ruangan yang diisi.');

  const tanggal = toYmd_(payload.tanggal);
  const shift = String(payload.shift).trim();
  const tabGroup = String(payload.tabGroup).trim();
  const timestamp = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');

  let savedCount = 0;
  const skipped = [];

  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const sheet = getSpreadsheet_().getSheetByName('FormInput');

    // Kunci anti-dobel: tanggal + shift + area + no titik
    const existing = {};
    readInputRows_().forEach(function (r) {
      if (r.tanggal === tanggal && r.shift === shift && r.tabGroup === tabGroup) existing[r.no] = true;
    });

    const rows = [];
    entries.forEach(function (item) {
      const jenis = String(item.jenis || '');
      const butuhSuhu = jenis.indexOf('°C') >= 0;
      const butuhRH = jenis.indexOf('%RH') >= 0;
      const label = item.id + ' (' + item.nama + ')';
      const isOff = String(item.status || '').toUpperCase() === 'OFF';

      let dpNum = '', suhuNum = '', rhNum = '';
      if (!isOff) {
        dpNum = toNum_(item.dp);
        if (dpNum === '') throw new Error('Nilai DP (Pa) pada ruangan ' + label + ' wajib berupa angka.');
        if (butuhSuhu) {
          suhuNum = toNum_(item.suhu);
          if (suhuNum === '') throw new Error('Nilai Suhu (°C) pada ruangan ' + label + ' wajib berupa angka.');
        }
        if (butuhRH) {
          rhNum = toNum_(item.rh);
          if (rhNum === '') throw new Error('Nilai %RH pada ruangan ' + label + ' wajib berupa angka.');
        }
      }

      if (existing[Number(item.no)]) { skipped.push(item.id); return; }
      const catatan = isOff ? 'OFF' : String(item.catatan || '').trim().substring(0, 200);

      rows.push([
        tanggal, String(payload.jam).trim(), shift,
        String(payload.operator).trim().toUpperCase(),
        tabGroup, String(item.area).trim(),
        Number(item.no), String(item.id).trim(), String(item.nama).trim(), String(item.mon).trim(),
        suhuNum, rhNum, dpNum, timestamp,
        catatan, isOff ? 'OFF' : ''
      ]);
    });

    if (rows.length > 0) {
      const start = sheet.getLastRow() + 1;
      const need = start + rows.length;
      if (sheet.getMaxRows() < need) sheet.insertRowsAfter(sheet.getMaxRows(), need - sheet.getMaxRows() + 500);
      sheet.getRange(start, 1, rows.length, 2).setNumberFormat('@');   // Tanggal & Jam disimpan sebagai teks
      sheet.getRange(start, 14, rows.length, 1).setNumberFormat('@');  // Timestamp teks
      sheet.getRange(start, 15, rows.length, 2).setNumberFormat('@');  // Catatan & Status Hari teks
      sheet.getRange(start, 1, rows.length, HEADERS_INPUT.length).setValues(rows);
      SpreadsheetApp.flush();
      savedCount = rows.length;
    }
  } finally {
    lock.releaseLock();
  }

  if (savedCount === 0) {
    return JSON.stringify({
      success: false, savedCount: 0, skipped: skipped,
      message: 'Data ' + shift + ' tanggal ' + tanggal + ' (' + tabGroup + ') sudah tersimpan sebelumnya. Tidak disimpan ulang.'
    });
  }

  try {
    syncGrafikTekananSheet_(Number(entries[0].no), tanggal.substring(0, 7), 'ALL');
  } catch (e) {
    console.error('Sinkron grafik gagal: ' + e);
  }

  let msg = savedCount + ' titik ruangan pada ' + tabGroup + ' (' + shift + ') berhasil disimpan!';
  if (skipped.length) msg += ' (' + skipped.length + ' titik dilewati karena sudah ada)';
  return JSON.stringify({ success: true, savedCount: savedCount, skipped: skipped, message: msg });
}

/* ====================== GRAFIK ====================== */

/** Nomor slot shift (0,1,2) dari satu baris input: dari teks 'Shift n', cadangan dari jam. */
function slotShift_(r) {
  const m = String(r.shift || '').match(/([123])/);
  if (m) return Number(m[1]) - 1;
  const h = Number(String(r.jam || '').split(/[.:]/)[0]);
  if (h >= 7 && h < 15) return 0;
  if (h >= 15 && h < 23) return 1;
  return 2;
}

function getGrafikSheetData(filters) {
  ensureSheetsExist_();
  const ss = getSpreadsheet_();
  const masterList = getMasterList_();
  if (masterList.length === 0) return JSON.stringify({ room: null, days: [], count: 0 });

  const noTitik = Number(filters && filters.noTitik ? filters.noTitik : 1);
  const yearMonth = (filters && filters.yearMonth) ? String(filters.yearMonth) : Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM');
  const shiftFilter = (filters && filters.shift) ? String(filters.shift) : 'ALL';

  const room = masterList.filter(function (m) { return m.no === noTitik; })[0] || masterList[0];

  const records = readInputRows_().filter(function (r) {
    return r.no === room.no && r.tanggal.indexOf(yearMonth) === 0 && (shiftFilter === 'ALL' || r.shift === shiftFilter);
  });

  const days = [];
  let count = 0;
  for (let d = 1; d <= 31; d++) {
    const fullDate = yearMonth + '-' + pad2_(d);
    const matches = records.filter(function (r) { return r.tanggal === fullDate; });
    if (matches.length > 0) {
      const rec = matches[matches.length - 1];
      if (rec.status !== 'OFF') count++;
      const off = (rec.status === 'OFF');
      days.push({ day: d, dp: off ? '' : rec.dp, suhu: off ? '' : rec.suhu, rh: off ? '' : rec.rh, jam: rec.jam, operator: rec.operator, shift: rec.shift, off: off, catatan: rec.catatan });
    } else {
      days.push({ day: d, dp: '', suhu: '', rh: '', jam: '', operator: '', shift: '', off: false, catatan: '' });
    }
  }

  // 31 tanggal x 3 shift = 93 slot (1 slot = 1 kolom di lembar grafik)
  const slots = [];
  let countSlots = 0;
  for (let d = 1; d <= 31; d++) {
    const fullDate = yearMonth + '-' + pad2_(d);
    for (let k = 0; k < 3; k++) {
      const m = records.filter(function (r) { return r.tanggal === fullDate && slotShift_(r) === k; });
      if (m.length > 0) {
        const rec = m[m.length - 1];
        const off = (rec.status === 'OFF');
        if (!off) countSlots++;
        slots.push({ day: d, slot: k, shift: 'Shift ' + (k + 1), dp: off ? '' : rec.dp, suhu: off ? '' : rec.suhu, rh: off ? '' : rec.rh, jam: rec.jam, operator: rec.operator, off: off, catatan: rec.catatan });
      } else {
        slots.push({ day: d, slot: k, shift: 'Shift ' + (k + 1), dp: '', suhu: '', rh: '', jam: '', operator: '', off: false, catatan: '' });
      }
    }
  }

  try {
    updateSheetGrafikCells_(ss, room, yearMonth, days);
  } catch (e) {
    console.error('Update tab Grafik Tekanan gagal: ' + e);
  }

  return JSON.stringify({ room: room, yearMonth: yearMonth, shift: shiftFilter, days: days, slots: slots, count: count, countSlots: countSlots });
}

function syncGrafikTekananSheet_(noTitik, yearMonth, shift) {
  getGrafikSheetData({ noTitik: noTitik, yearMonth: yearMonth, shift: shift || 'ALL' });
}

/* ====================== OPERATOR (dropdown inisial) ====================== */

function getOperatorList_() {
  const sh = getSpreadsheet_().getSheetByName('Operator');
  if (!sh || sh.getLastRow() <= 1) return [];
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  const out = [];
  vals.forEach(function (r) {
    const ini = String(r[0] || '').trim().toUpperCase();
    if (ini) out.push({ inisial: ini, nama: String(r[1] || '').trim() });
  });
  return out;
}

function getOperators() {
  ensureSheetsExist_();
  return JSON.stringify(getOperatorList_());
}

function saveOperator(payload) {
  ensureSheetsExist_();
  const ini = String((payload && payload.inisial) || '').trim().toUpperCase().substring(0, 8);
  const nama = String((payload && payload.nama) || '').trim().substring(0, 40);
  if (!ini) throw new Error('Inisial operator wajib diisi.');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = getSpreadsheet_().getSheetByName('Operator');
    const exists = getOperatorList_().some(function (o) { return o.inisial === ini; });
    if (exists) {
      return JSON.stringify({ success: false, message: 'Operator ' + ini + ' sudah ada di daftar.', operators: getOperatorList_() });
    }
    const row = sh.getLastRow() + 1;
    sh.getRange(row, 1, 1, 2).setNumberFormat('@').setValues([[ini, nama]]);
  } finally {
    lock.releaseLock();
  }
  return JSON.stringify({ success: true, message: 'Operator ' + ini + ' berhasil ditambahkan.', operators: getOperatorList_() });
}

function deleteOperator(inisial) {
  ensureSheetsExist_();
  const ini = String(inisial || '').trim().toUpperCase();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = getSpreadsheet_().getSheetByName('Operator');
    const last = sh.getLastRow();
    if (last > 1) {
      const vals = sh.getRange(2, 1, last - 1, 1).getValues();
      for (let i = vals.length - 1; i >= 0; i--) {
        if (String(vals[i][0]).trim().toUpperCase() === ini) sh.deleteRow(i + 2);
      }
    }
  } finally {
    lock.releaseLock();
  }
  return JSON.stringify({ success: true, message: 'Operator ' + ini + ' dihapus dari daftar.', operators: getOperatorList_() });
}

/* ====================== SPV AREA (1x per bulan) ====================== */

function getSpvReview(yearMonth) {
  ensureSheetsExist_();
  const sh = getSpreadsheet_().getSheetByName('SpvReview');
  if (!sh || sh.getLastRow() <= 1) return JSON.stringify({ nama: '' });
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
  const ym = String(yearMonth || '').trim();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === ym) {
      return JSON.stringify({ nama: String(vals[i][1] || '').trim(), tanggal: vals[i][2] || '' });
    }
  }
  return JSON.stringify({ nama: '' });
}

function saveSpvReview(payload) {
  ensureSheetsExist_();
  const ym = String((payload && payload.yearMonth) || '').trim();
  const nama = String((payload && payload.nama) || '').trim().substring(0, 40);
  if (!ym) throw new Error('Bulan wajib diisi.');

  const ts = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = getSpreadsheet_().getSheetByName('SpvReview');
    const last = sh.getLastRow();
    let rowIdx = -1;
    if (last > 1) {
      const vals = sh.getRange(2, 1, last - 1, 1).getValues();
      for (let i = 0; i < vals.length; i++) {
        if (String(vals[i][0]).trim() === ym) { rowIdx = i + 2; break; }
      }
    }
    const rowData = [ym, nama, ts];
    if (rowIdx > 0) sh.getRange(rowIdx, 1, 1, 3).setValues([rowData]);
    else sh.getRange(sh.getLastRow() + 1, 1, 1, 3).setValues([rowData]);
  } finally {
    lock.releaseLock();
  }
  return JSON.stringify({
    success: true,
    message: nama ? 'Nama Spv Area bulan ' + ym + ' disimpan.' : 'Nama Spv Area bulan ' + ym + ' dikosongkan.'
  });
}

/* ====================== PERBAIKAN SEKALI JALAN ====================== */

/**
 * JALANKAN SEKALI dari editor (pilih fungsi ini -> Jalankan).
 * 1. Header FormInput disamakan (14 kolom) + baris format lama dibuang
 * 2. Data dobel (tanggal+shift+area+no titik sama) dirapikan: yang terbaru dipertahankan
 * 3. Tanggal/Jam diubah jadi teks agar tidak bergeser zona waktu
 * 4. Limit MasterData yang kosong diisi default
 * 5. Tab Grafik Tekanan dihapus & dibangun ulang (rumus + grafik)
 * Hasil ringkas ada di Log eksekusi.
 */
function perbaikiSpreadsheet() {
  const ss = getSpreadsheet_();
  const tz = ssTz_();
  const log = [];
  CacheService.getScriptCache().remove(CACHE_KEY);

  // --- MasterData: header + isi limit kosong
  let sm = ss.getSheetByName('MasterData');
  if (!sm) sm = ss.insertSheet('MasterData');
  sm.getRange(1, 1, 1, 13).setValues([HEADERS_MASTER]);
  styleHeader_(sm.getRange(1, 1, 1, 13));
  if (sm.getLastRow() <= 1) {
    const init = getInitialMasterData_();
    sm.getRange(2, 1, init.length, 13).setValues(init);
    log.push('MasterData kosong -> diisi 25 ruangan');
  } else {
    const defaults = {};
    getInitialMasterData_().forEach(function (r) { defaults[r[0]] = r; });
    const rng = sm.getRange(2, 1, sm.getLastRow() - 1, 13);
    const vals = rng.getValues();
    let filled = 0;
    vals.forEach(function (r) {
      const def = defaults[Number(r[0])];
      if (!def) return;
      for (let c = 7; c <= 12; c++) {
        if (r[c] === '' && def[c] !== '') { r[c] = def[c]; filled++; }
      }
      if (r[6] === '') r[6] = 'Aktif';
    });
    rng.setValues(vals);
    log.push('Limit MasterData yang kosong diisi: ' + filled + ' sel');
  }

  // --- FormInput
  let si = ss.getSheetByName('FormInput');
  if (!si) si = ss.insertSheet('FormInput');
  if (si.getMaxColumns() < HEADERS_INPUT.length) si.insertColumnsAfter(si.getMaxColumns(), HEADERS_INPUT.length - si.getMaxColumns());
  const NCOL = HEADERS_INPUT.length;
  const last = si.getLastRow();
  let removedOld = 0, removedDup = 0, kept = 0;
  if (last > 1) {
    const rng = si.getRange(2, 1, last - 1, NCOL);
    const vals = rng.getValues();
    const disp = rng.getDisplayValues();
    const byKey = {};
    const order = [];
    vals.forEach(function (r, i) {
      const no = Number(r[6]);
      if (!(no > 0)) { removedOld++; return; }
      const row = r.slice();
      row[0] = toYmd_(r[0], tz);
      row[1] = toHm_(r[1], disp[i][1]);
      row[2] = String(r[2]).trim();
      row[13] = toTs_(r[13], tz);
      const key = [row[0], row[2], String(row[4]).trim(), no].join('|');
      if (byKey[key] !== undefined) { removedDup++; order[byKey[key]] = null; }
      byKey[key] = order.length;
      order.push(row);
    });
    const keep = order.filter(function (x) { return x !== null; });
    kept = keep.length;
    rng.clearContent();
    si.getRange(2, 1, last - 1, 2).setNumberFormat('@');
    si.getRange(2, 14, last - 1, 1).setNumberFormat('@');
    if (keep.length) si.getRange(2, 1, keep.length, NCOL).setValues(keep);
    si.getRange(2, 15, last - 1, 2).setNumberFormat('@');
  }
  si.getRange(1, 1, 1, NCOL).setValues([HEADERS_INPUT]);
  styleHeader_(si.getRange(1, 1, 1, NCOL));
  si.setFrozenRows(1);
  log.push('FormInput: dipertahankan ' + kept + ' baris, format lama dibuang ' + removedOld + ', dobel dibuang ' + removedDup);

  // --- Grafik Tekanan: bangun ulang
  const old = ss.getSheetByName('Grafik Tekanan');
  if (old) ss.deleteSheet(old);
  setupGrafikTekananSheet_(ss);

  ensureSheetsExist_(true);

  // isi grafik dengan ruangan pertama yang punya data (atau No. 1)
  const rows = readInputRows_();
  const no = rows.length ? rows[rows.length - 1].no : 1;
  const ym = rows.length ? rows[rows.length - 1].tanggal.substring(0, 7) : Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM');
  getGrafikSheetData({ noTitik: no, yearMonth: ym, shift: 'ALL' });
  SpreadsheetApp.flush();

  const b5 = ss.getSheetByName('Grafik Tekanan').getRange('B5').getDisplayValue();
  log.push('Tab Grafik Tekanan dibangun ulang. Tes rumus B5 = "' + b5 + '"');
  log.push('SELESAI. Sekarang deploy versi baru: Terapkan > Kelola deployment > Edit > Versi baru.');
  Logger.log(log.join('\n'));
  return log.join('\n');
}


/* ====================== TAMPILAN APLIKASI (HTML + CSS + JS) ====================== */
const APP_HTML = String.raw`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Form Input Monitoring Ruangan</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
body { background-color: #1a1a1a; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
.phone-frame { width: 100%; max-width: 410px; height: 100vh; max-height: 840px; border-radius: 40px; border: 12px solid #020617; position: relative; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8); display: flex; flex-direction: column; transition: background 0.4s ease; }
@media (max-width: 480px) {
  body { background-color: transparent; }
  .phone-frame { max-width: 100%; height: 100dvh; max-height: none; border-radius: 0; border: none; }
  .notch { display: none; }
  .app-content { padding-top: 14px !important; }
}
.notch { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 140px; height: 24px; background-color: #020617; border-bottom-left-radius: 15px; border-bottom-right-radius: 15px; z-index: 1000; }
.app-content { flex: 1; padding: 36px 14px 15px 14px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; z-index: 1; }

/* SIDEBAR */
.sidebar-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); z-index: 400; opacity: 0; visibility: hidden; transition: all 0.3s ease; }
.sidebar-overlay.show { opacity: 1; visibility: visible; }
.sidebar { position: absolute; top: 0; left: -265px; width: 255px; height: 100%; z-index: 500; transition: left 0.3s ease; padding: 45px 18px 20px 18px; display: flex; flex-direction: column; gap: 10px; box-shadow: 2px 0 10px rgba(0,0,0,0.2); }
.sidebar.open { left: 0; }
.sidebar h3 { font-size: 13px; margin-bottom: 2px; border-bottom: 1px solid rgba(150,150,150,0.2); padding-bottom: 6px; }
.theme-btn { padding: 10px 12px; border-radius: 8px; border: none; font-size: 12.5px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: all 0.2s; text-align: left; }

/* HEADER */
.app-header { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; margin-bottom: 2px; }
.menu-btn { background: transparent; border: none; font-size: 20px; cursor: pointer; padding: 4px; }
.logo-container { width: 42px; height: 42px; flex-shrink: 0; border-radius: 8px; display: flex; justify-content: center; align-items: center; padding: 3px; }
.company-logo { max-width: 100%; max-height: 100%; object-fit: contain; }
.header-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; line-height: 1.25; }

/* PANEL KONTROL */
.control-card { border-radius: 10px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.control-grid { display: grid; grid-template-columns: 1.15fr 1.25fr 0.7fr; gap: 6px; }
.ctrl-group { display: flex; flex-direction: column; gap: 3px; }
.ctrl-group label { font-size: 9px; font-weight: 800; color: #0277bd; }
.ctrl-group input, .ctrl-group select { width: 100%; padding: 6px 5px; border-radius: 6px; border: 1.5px solid #cbe2ef; font-size: 11px; font-weight: 700; background: #f8fbfe; color: #0f172a; outline: none; }
.shift-status-banner { padding: 7px 10px; border-radius: 6px; font-size: 10.5px; font-weight: 700; line-height: 1.35; }
.shift-status-banner.done { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
.shift-status-banner.pending { background: #fef9c3; color: #854d0e; border: 1px solid #fde047; }
.shift-status-banner.error { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; cursor: pointer; }

/* MASTER CARD */
.data-card { border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 5px; }
.card-top { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(150,150,150,0.3); padding-bottom: 6px; margin-bottom: 4px; }
.card-id { font-weight: bold; font-size: 13px; display: flex; align-items: center; gap: 5px; }
.card-badge { font-size: 9px; padding: 2px 7px; border-radius: 10px; font-weight: bold; text-transform: uppercase; }
.card-title { font-weight: 700; font-size: 13px; }
.card-desc { font-size: 10px; display: flex; align-items: flex-start; gap: 5px; }
.measurement-tags { display: flex; justify-content: space-between; align-items: center; margin-top: 5px; flex-wrap: wrap; gap: 4px; }
.m-tag { font-size: 9px; padding: 3px 6px; border-radius: 4px; font-weight: bold; margin-right: 3px; }
.limit-info-row { font-size: 9.5px; color: #0369a1; background: rgba(2,136,209,0.08); padding: 4px 7px; border-radius: 5px; margin-top: 3px; font-weight: 600; }

/* FORM INPUT CARD */
.form-card { border-radius: 10px; overflow: hidden; flex-shrink: 0; }
.form-header { padding: 9px 14px; font-size: 14px; font-weight: bold; display: flex; justify-content: space-between; align-items: center; }
.form-body { padding: 12px 14px 14px 14px; }
.location-info { margin-bottom: 10px; padding-bottom: 8px; }
.location-info p { font-size: 11px; margin-bottom: 3px; display: flex; align-items: center; font-weight: 500; }
.location-info p i { width: 16px; margin-right: 5px; text-align: center; }
.input-grid { display: grid; gap: 10px; }
.input-group { display: flex; flex-direction: column; }
.input-group label { font-size: 10px; font-weight: 800; margin-bottom: 4px; text-align: center; text-transform: uppercase; }
.spec-hint { font-size: 8.5px; text-align: center; color: #64748b; margin-top: 3px; font-weight: 600; }
.input-field { width: 100%; padding: 9px 4px; border-radius: 6px; text-align: center; font-size: 14px; font-weight: bold; outline: none; transition: all 0.2s; }
.input-field.val-ok { border-color: #16a34a !important; background-color: #dcfce7 !important; color: #14532d !important; }
.input-field.val-alert { border-color: #eab308 !important; background-color: #fef9c3 !important; color: #713f12 !important; }
.input-field.val-action { border-color: #dc2626 !important; background-color: #fee2e2 !important; color: #7f1d1d !important; }
.input-field.locked { cursor: not-allowed; opacity: 0.9; }
.saved-chip { font-size: 10px; background: #16a34a; color: #fff; padding: 2px 8px; border-radius: 10px; margin-left: 6px; font-weight: 700; }
.btn-submit { padding: 14px; border-radius: 8px; width: 100%; font-size: 14px; font-weight: bold; cursor: pointer; margin-top: 4px; margin-bottom: 12px; display: flex; justify-content: center; align-items: center; gap: 8px; flex-shrink: 0; }
.btn-submit:disabled { opacity: 0.55; cursor: not-allowed; }

/* LOGSHEET */
.logsheet-scroll { overflow-x: auto; margin-top: 6px; border: 1px solid #cbd5e1; border-radius: 6px; }
.logsheet-table { border-collapse: collapse; font-size: 10px; width: max-content; }
.logsheet-table th, .logsheet-table td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: center; min-width: 28px; }
.logsheet-table th { background: #0288d1; color: #fff; font-weight: 700; }
.logsheet-table td.row-label { text-align: left; font-weight: 700; background: #f1f5f9; color: #0f172a; position: sticky; left: 0; min-width: 90px; }
.empty-note { font-size: 10.5px; font-weight: 700; color: #854d0e; background: #fef9c3; border: 1px solid #fde047; border-radius: 6px; padding: 6px 8px; margin-top: 2px; }

/* BOTTOM NAV */
.bottom-nav { display: flex; justify-content: space-between; align-items: stretch; height: 64px; flex-shrink: 0; }
.nav-item { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; font-size: 9px; font-weight: bold; cursor: pointer; }
.nav-item i { font-size: 18px; margin-bottom: 4px; }

/* MODAL */
.modal-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.55); z-index: 800; display: flex; align-items: center; justify-content: center; padding: 14px; }
.modal-box { background: #fff; color: #0f172a; border-radius: 12px; padding: 14px; width: 100%; max-width: 350px; max-height: 90%; overflow-y: auto; }
.modal-box h4 { margin-bottom: 8px; color: #01579b; font-size: 14px; }
.limit-section-title { font-size: 11px; font-weight: 800; color: #0288d1; margin: 8px 0 6px 0; padding-top: 6px; border-top: 1px dashed #cbd5e1; }
.modal-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.modal-field { margin-bottom: 6px; }
.modal-field label { display: block; font-size: 10px; font-weight: 700; margin-bottom: 2px; }
.modal-field input, .modal-field select { width: 100%; padding: 6px 7px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 11.5px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
.btn-cancel { background: #e2e8f0; border: none; padding: 7px 12px; border-radius: 6px; font-size: 11.5px; font-weight: 700; cursor: pointer; }
.btn-save-modal { background: #0288d1; color: #fff; border: none; padding: 7px 14px; border-radius: 6px; font-size: 11.5px; font-weight: 700; cursor: pointer; }
.toast-msg { position: absolute; bottom: 76px; left: 50%; transform: translateX(-50%); background: rgba(15,23,42,0.92); color: #fff; padding: 9px 16px; border-radius: 20px; font-size: 11.5px; font-weight: 600; z-index: 900; display: none; max-width: 92%; text-align: center; }
.chart-card { padding: 10px; border-radius: 10px; margin-bottom: 8px; flex-shrink: 0; }
.chart-box { position: relative; height: 195px; width: 100%; }

/* TEMA TERANG */
.theme-light { background: linear-gradient(135deg, #f0f7fb 0%, #e0eef7 100%); }
.theme-light .sidebar { background: #ffffff; color: #333; }
.theme-light .sidebar h3 { color: #01579b; }
.theme-light .theme-btn { background: #e0eef7; color: #01579b; }
.theme-light .theme-btn.active-theme { background: #0288d1; color: white; }
.theme-light .app-header { background: #ffffff; border: 1px solid #cbe2ef; }
.theme-light .menu-btn { color: #0288d1; }
.theme-light .logo-container { background-color: #cbe2ef; border: 1.5px solid #0288d1; }
.theme-light .header-title { color: #01579b; }
.theme-light .control-card { background: #ffffff; border: 1px solid #cbe2ef; }
.theme-light .data-card, .theme-light .chart-card { background: #ffffff; border: 1px solid #d0e3f0; }
.theme-light .card-id { color: #0288d1; }
.theme-light .card-badge { background: #e0f2fe; color: #0369a1; }
.theme-light .card-title { color: #1e293b; }
.theme-light .card-desc { color: #64748b; }
.theme-light .m-tag { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
.theme-light .form-card { background: #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.08); border: 1px solid #d0e3f0; }
.theme-light .form-header { background: linear-gradient(to bottom, #29b6f6 0%, #0288d1 50%, #01579b 100%); color: white; }
.theme-light .location-info { border-bottom: 1px dashed #cbe2ef; }
.theme-light .location-info p { color: #475569; }
.theme-light .location-info p i { color: #0288d1; }
.theme-light .input-group label { color: #0277bd; }
.theme-light .input-field { border: 2px solid #cbe2ef; background-color: #f8fbfe; color: #334155; }
.theme-light .btn-submit { background: linear-gradient(to bottom, #29b6f6 0%, #0288d1 50%, #01579b 100%); color: white; border: 1px solid #01579b; }
.theme-light .bottom-nav { background: linear-gradient(to bottom, #29b6f6 0%, #0288d1 50%, #01579b 51%, #0277bd 100%); border-top: 1px solid #01579b; }
.theme-light .nav-item { color: #ffffff; border-right: 1px solid rgba(0,0,0,0.2); }
.theme-light .nav-item.active { background: linear-gradient(to bottom, #444444 0%, #111111 50%, #000000 100%); }

/* TEMA GELAP */
.theme-dark { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); }
.theme-dark .sidebar { background: rgba(15,23,42,0.96); color: #fff; }
.theme-dark .sidebar h3 { color: #38bdf8; }
.theme-dark .theme-btn { background: rgba(255,255,255,0.06); color: #bae6fd; }
.theme-dark .theme-btn.active-theme { background: #0ea5e9; color: white; }
.theme-dark .app-header { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); }
.theme-dark .menu-btn, .theme-dark .header-title, .theme-dark .ctrl-group label { color: #38bdf8; }
.theme-dark .logo-container { background-color: #ffffff; border: 2px solid #38bdf8; }
.theme-dark .control-card, .theme-dark .data-card, .theme-dark .chart-card, .theme-dark .form-card { background: rgba(30,41,59,0.8); border: 1px solid rgba(255,255,255,0.1); color: #f1f5f9; }
.theme-dark .form-header { background: linear-gradient(to right, #0369a1 0%, #0284c7 100%); color: white; }
.theme-dark .input-field { background-color: rgba(0,0,0,0.35); border: 1px solid rgba(56,189,248,0.35); color: #ffffff; }
.theme-dark .btn-submit { background: linear-gradient(to bottom, #38bdf8 0%, #0284c7 100%); color: #ffffff; border: 1px solid #0ea5e9; }
.theme-dark .bottom-nav { background: rgba(15,23,42,0.95); }
.theme-dark .nav-item { color: #94a3b8; }
.theme-dark .nav-item.active { color: #38bdf8; border-top: 2px solid #38bdf8; }

/* LOGIN */
.login-screen { position: absolute; inset: 0; z-index: 2000; display: none; align-items: center; justify-content: center; padding: 22px; background: linear-gradient(160deg, #e0f2fe 0%, #bae6fd 45%, #0288d1 100%); overflow-y: auto; }
.login-card { width: 100%; max-width: 330px; background: #ffffff; border-radius: 18px; padding: 24px 20px 20px 20px; box-shadow: 0 18px 40px rgba(1,87,155,0.35); display: flex; flex-direction: column; align-items: center; gap: 4px; }
.login-logo { width: 130px; height: 120px; display: flex; align-items: center; justify-content: center; margin-bottom: 6px; }
.login-logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
#loginLogoText { font-size: 26px; font-weight: 900; color: #0288d1; letter-spacing: 2px; }
.login-company { font-size: 12px; font-weight: 800; color: #0288d1; letter-spacing: 2px; }
.login-title { font-size: 14px; font-weight: 800; color: #01579b; text-align: center; line-height: 1.3; margin-top: 2px; }
.login-sub { font-size: 11px; color: #64748b; margin: 2px 0 12px 0; text-align: center; }
.login-card form { width: 100%; display: flex; flex-direction: column; gap: 10px; }
.login-field label { display: block; font-size: 9.5px; font-weight: 800; color: #0277bd; margin-bottom: 3px; }
.login-field input { width: 100%; padding: 10px; border: 2px solid #cbe2ef; border-radius: 8px; font-size: 14px; font-weight: 600; background: #f8fbfe; color: #0f172a; outline: none; }
.login-field input:focus { border-color: #0288d1; }
.pw-wrap { position: relative; }
.pw-wrap input { padding-right: 40px; }
.pw-toggle { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); border: none; background: transparent; color: #0288d1; font-size: 16px; padding: 6px 8px; cursor: pointer; }
.login-remember { font-size: 11px; color: #475569; display: flex; align-items: center; gap: 6px; font-weight: 600; }
.login-error { min-height: 14px; font-size: 11px; font-weight: 700; color: #b91c1c; text-align: center; }
.login-btn { padding: 13px; border: 1px solid #01579b; border-radius: 8px; background: linear-gradient(to bottom, #29b6f6 0%, #0288d1 50%, #01579b 100%); color: #fff; font-size: 14px; font-weight: 800; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 8px; }
.login-btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* ===== FITUR BARU: OPERATOR, KARTU INPUT, CATATAN/OFF ===== */
.ctrl-top { grid-template-columns: 1fr 1fr !important; }
.op-row { display: flex; gap: 6px; }
.op-row select { flex: 1; min-width: 0; }
.op-add-btn { flex-shrink: 0; width: 34px; border: none; border-radius: 6px; background: #0288d1; color: #fff; font-size: 13px; cursor: pointer; }
.op-add-btn:active { transform: scale(0.95); }

.form-card { border-radius: 14px; transition: box-shadow .2s, opacity .2s; }
.form-header { padding: 10px 14px; gap: 10px; }
.fh-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.fh-no { width: 30px; height: 30px; border-radius: 9px; background: rgba(255,255,255,0.22); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; flex-shrink: 0; }
.fh-text { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
.fh-id { font-size: 14px; font-weight: 800; letter-spacing: .3px; }
.fh-area { font-size: 10px; opacity: .85; font-weight: 600; }
.fh-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.form-header .saved-chip { margin-left: 0; font-size: 9.5px; }
.off-chip { font-size: 9.5px; background: #475569; color: #fff; padding: 2px 8px; border-radius: 10px; font-weight: 800; letter-spacing: .5px; display: none; }
.form-body { padding: 12px 14px 14px 14px; }
.location-info { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; padding: 9px 10px; border-radius: 9px; border-bottom: none !important; }
.location-info p { margin-bottom: 0; font-size: 11.5px; line-height: 1.3; }
.location-info p:first-child { font-weight: 700; font-size: 12.5px; }
.input-group label { display: flex; align-items: center; justify-content: center; gap: 4px; }
.input-group label i { font-size: 10px; opacity: .85; }
.input-field { border-radius: 10px; padding: 11px 4px; font-size: 15px; }
.input-field:focus { box-shadow: 0 0 0 3px rgba(2,136,209,0.22); border-color: #0288d1; }

.note-section { margin-top: 12px; padding-top: 11px; border-top: 1px dashed rgba(148,163,184,0.55); display: flex; flex-direction: column; gap: 6px; }
.note-label { font-size: 10px; font-weight: 800; display: flex; align-items: center; gap: 5px; text-transform: uppercase; letter-spacing: .3px; }
.note-select { width: 100%; padding: 9px 10px; border-radius: 9px; font-size: 12.5px; font-weight: 700; outline: none; appearance: none; -webkit-appearance: none; cursor: pointer;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round'/></svg>");
  background-repeat: no-repeat; background-position: right 11px center; padding-right: 30px; }
.note-select.mode-catatan { border-color: #0288d1 !important; }
.note-select.mode-off { border-color: #64748b !important; background-color: #e2e8f0 !important; color: #334155 !important; }
.note-text { width: 100%; padding: 9px 10px; border-radius: 9px; font-size: 12.5px; font-weight: 600; outline: none; }
.note-text:focus { box-shadow: 0 0 0 3px rgba(2,136,209,0.22); }
.note-select:disabled, .note-text[readonly] { opacity: .85; cursor: not-allowed; }

.form-card.is-off { opacity: .88; }
.form-card.is-off .form-header { background: linear-gradient(to right, #64748b 0%, #475569 100%) !important; }
.form-card.is-off .off-chip { display: inline-block; }
.form-card.is-off .input-field { background-color: #e2e8f0 !important; border-color: #cbd5e1 !important; color: #94a3b8 !important; cursor: not-allowed; }
.off-note { display: none; font-size: 10.5px; font-weight: 700; color: #475569; background: #f1f5f9; border: 1px dashed #94a3b8; border-radius: 7px; padding: 6px 8px; margin-top: 8px; }
.form-card.is-off .off-note { display: block; }

/* modal operator */
.op-list { display: flex; flex-direction: column; gap: 5px; margin: 6px 0 4px 0; max-height: 190px; overflow-y: auto; }
.op-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; font-size: 12px; font-weight: 700; color: #0f172a; }
.op-item small { font-weight: 600; color: #64748b; margin-left: 6px; }
.op-del { border: none; background: #fee2e2; color: #b91c1c; width: 26px; height: 26px; border-radius: 6px; cursor: pointer; font-size: 11px; }
.op-empty { font-size: 11px; color: #854d0e; background: #fef9c3; border: 1px solid #fde047; padding: 7px 9px; border-radius: 7px; font-weight: 700; }

/* logsheet: kolom hari libur */
.logsheet-table th.col-off, .logsheet-table td.col-off { background: #cbd5e1 !important; color: #475569 !important; }
.logsheet-table td.col-off strong { color: #475569; }
.logsheet-table td.note-cell { font-size: 9px; max-width: 70px; white-space: normal; word-break: break-word; line-height: 1.15; }

/* tema terang */
.theme-light .location-info { background: #f1f8fd; }
.theme-light .note-label { color: #0277bd; }
.theme-light .note-select, .theme-light .note-text { background-color: #f8fbfe; border: 2px solid #cbe2ef; color: #334155; }
.theme-light .form-card { box-shadow: 0 6px 16px rgba(2,136,209,0.10); }
/* tema gelap */
.theme-dark .location-info { background: rgba(0,0,0,0.22); }
.theme-dark .location-info p { color: #cbd5e1; }
.theme-dark .location-info p i { color: #38bdf8; }
.theme-dark .input-group label, .theme-dark .note-label { color: #7dd3fc; }
.theme-dark .note-select, .theme-dark .note-text { background-color: rgba(0,0,0,0.35); border: 1px solid rgba(56,189,248,0.35); color: #fff; }
.theme-dark .note-select option { background: #0f172a; color: #fff; }
.theme-dark .note-select.mode-off { background-color: rgba(100,116,139,0.45) !important; color: #e2e8f0 !important; }
.theme-dark .form-card.is-off .input-field { background-color: rgba(100,116,139,0.35) !important; color: #94a3b8 !important; border-color: rgba(148,163,184,0.3) !important; }
.theme-dark .off-note { background: rgba(100,116,139,0.25); color: #cbd5e1; border-color: #64748b; }
.theme-dark .ctrl-group select option { background: #0f172a; color: #fff; }
.theme-dark .ctrl-group input, .theme-dark .ctrl-group select { background: rgba(0,0,0,0.35); border-color: rgba(56,189,248,0.35); color: #fff; }

/* ===== LEMBAR LOGSHEET GRAFIK (tampilan & cetak A4) ===== */
.sheet-card { background: #ffffff; border-radius: 10px; border: 1px solid #cbd5e1; padding: 6px; flex-shrink: 0; margin-bottom: 8px; }
.sheet-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.sheet-inner { min-width: 880px; }
.sheet-inner svg { width: 100%; height: auto; display: block; }
.graf-actions { display: flex; gap: 6px; margin-top: 2px; }
.btn-print { flex: 1; border: none; border-radius: 8px; padding: 10px 8px; font-size: 11.5px; font-weight: 800; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; background: linear-gradient(to bottom, #29b6f6 0%, #0288d1 50%, #01579b 100%); border: 1px solid #01579b; }
.btn-sheet { border: none; border-radius: 8px; padding: 10px 10px; font-size: 11.5px; font-weight: 800; cursor: pointer; background: #e0eef7; color: #01579b; white-space: nowrap; }
.graf-hint { font-size: 9.5px; font-weight: 600; color: #64748b; margin: 2px 2px 6px 2px; }
#printArea { display: none; }
@page { size: A4 landscape; margin: 8mm; }
@media print {
  html, body { background: #fff !important; height: auto !important; min-height: 0 !important; display: block !important; overflow: visible !important; }
  body > *:not(#printArea) { display: none !important; }
  #printArea { display: block !important; }
  #printArea .print-page { break-after: page; page-break-after: always; }
  #printArea .print-page:last-child { break-after: auto; page-break-after: auto; }
  #printArea svg { width: 100%; height: auto; max-height: 192mm; display: block; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
</head>
<body>

<div class="phone-frame theme-light" id="appFrame">
  <div class="notch"></div>

  <!-- HALAMAN LOGIN -->
  <div class="login-screen" id="loginScreen">
    <div class="login-card">
      <div class="login-logo">
        <img alt="Logo FIMA" class="company-logo">
      </div>
      <div class="login-company">PT FIMA</div>
      <div class="login-title">FORM INPUT MONITORING RUANGAN</div>
      <div class="login-sub">Silakan masuk untuk melanjutkan</div>
      <form onsubmit="prosesLogin(event)" novalidate>
        <div class="login-field" id="loginUrlRow" style="display:none;">
          <label>URL WEB APP (APPS SCRIPT, BERAKHIRAN /exec)</label>
          <input type="text" id="loginUrl" autocomplete="off" placeholder="https://script.google.com/macros/s/.../exec">
        </div>
        <div class="login-field">
          <label>PASSWORD</label>
          <div class="pw-wrap">
            <input type="password" id="loginPw" name="fima-pw" autocomplete="current-password" placeholder="Masukkan password">
            <button type="button" class="pw-toggle" onclick="togglePw()"><i class="fas fa-eye" id="pwIcon"></i></button>
          </div>
        </div>
        <label class="login-remember"><input type="checkbox" id="loginRemember"> Ingat di perangkat ini</label>
        <div class="login-error" id="loginError"></div>
        <button type="submit" class="login-btn" id="btnLogin"><i class="fas fa-right-to-bracket"></i> MASUK</button>
      </form>
    </div>
  </div>
  <div class="sidebar-overlay" id="sidebarOverlay" onclick="toggleSidebar()"></div>

  <div class="sidebar" id="sidebar">
    <h3>Pengaturan Tema</h3>
    <button class="theme-btn active-theme" id="btnLight" onclick="setTheme('theme-light')"><i class="fas fa-sun"></i> Light Mode</button>
    <button class="theme-btn" id="btnDark" onclick="setTheme('theme-dark')"><i class="fas fa-moon"></i> Dark Mode</button>

    <h3 style="margin-top:10px;">Database &amp; Pengaturan</h3>
    <button class="theme-btn" onclick="bukaModalMaster(); toggleSidebar();"><i class="fas fa-plus-circle"></i> Tambah Ruangan &amp; Limit</button>
    <button class="theme-btn" onclick="bukaModalOperator(); toggleSidebar();"><i class="fas fa-user-check"></i> Kelola Operator</button>
    <button class="theme-btn" onclick="bukaLinkSpreadsheet(); toggleSidebar();"><i class="fas fa-table"></i> Buka Sheet &amp; Grafik</button>
    <button class="theme-btn" id="btnApiUrl" style="display:none;" onclick="aturApiUrl(); toggleSidebar();"><i class="fas fa-link"></i> Atur URL API (Apps Script)</button>
    <button class="theme-btn" onclick="keluarLogin('Anda sudah keluar.'); toggleSidebar();"><i class="fas fa-right-from-bracket"></i> Keluar (Logout)</button>
  </div>

  <div class="app-content" id="contentArea">
    <div class="app-header">
      <button class="menu-btn" onclick="toggleSidebar()"><i class="fas fa-bars"></i></button>
      <div class="logo-container">
        <img alt="Logo FIMA" class="company-logo">
      </div>
      <div class="header-title" id="pageTitle">FORM INPUT MONITORING RUANGAN</div>
    </div>

    <div id="monitoringControlPanel" class="control-card" style="display:none;">
      <div class="control-grid ctrl-top">
        <div class="ctrl-group">
          <label><i class="far fa-calendar-alt"></i> TANGGAL</label>
          <input type="date" id="ctrlTanggal" onchange="cekStatusShiftArea()">
        </div>
        <div class="ctrl-group">
          <label><i class="far fa-clock"></i> JAM / SHIFT</label>
          <select id="ctrlJamShift" onchange="cekStatusShiftArea()">
            <option value="07:00|Shift 1">07:00 (Shift 1)</option>
            <option value="15:00|Shift 2">15:00 (Shift 2)</option>
            <option value="23:00|Shift 3">23:00 (Shift 3)</option>
          </select>
        </div>
      </div>
      <div class="ctrl-group">
        <label><i class="far fa-user"></i> OPERATOR (INISIAL)</label>
        <div class="op-row">
          <select id="ctrlOperator" onchange="onOperatorChange()"></select>
          <button type="button" class="op-add-btn" title="Tambah / kelola operator" onclick="bukaModalOperator()"><i class="fas fa-user-plus"></i></button>
        </div>
      </div>
      <div id="shiftBanner" class="shift-status-banner pending" onclick="cekStatusShiftArea()">Memeriksa status pengisian shift...</div>
    </div>

    <div id="mainContent" style="display:flex; flex-direction:column; gap:12px;"></div>
  </div>

  <div id="masterModal" class="modal-backdrop" style="display:none;">
    <div class="modal-box">
      <h4 id="modalTitle">Edit Master &amp; Limit Ruangan</h4>
      <form onsubmit="simpanMasterForm(event)">
        <input type="hidden" id="mRowIndex">
        <input type="hidden" id="mNo">
        <div class="modal-grid-2">
          <div class="modal-field"><label>ID Alat Ukur</label><input type="text" id="mId" placeholder="K3081001" required></div>
          <div class="modal-field"><label>Area</label>
            <select id="mArea">
              <option value="Line 1">Line 1</option>
              <option value="Line 2">Line 2</option>
              <option value="Logistik">Logistik</option>
              <option value="Loker Male">Loker Male</option>
              <option value="Loker Female">Loker Female</option>
            </select>
          </div>
        </div>
        <div class="modal-field"><label>Nama Ruang</label><input type="text" id="mNama" placeholder="Laundry 2" required></div>
        <div class="modal-field"><label>Monitoring (Pembanding)</label><input type="text" id="mMon" placeholder="Laundry vs Corridor Class D" required></div>
        <div class="modal-field"><label>Jenis Pengukuran</label>
          <select id="mJenis">
            <option value="°C, %RH, Pa">°C, %RH, Pa</option>
            <option value="Pa">Pa (Hanya Tekanan)</option>
          </select>
        </div>
        <div class="modal-field"><label>Status Kartu</label>
          <select id="mStatus"><option value="Aktif">Aktif (tampil di form)</option><option value="Nonaktif">Nonaktif (disembunyikan)</option></select>
        </div>
        <div class="limit-section-title">Batas Spesifikasi / Limit Ruangan Ini:</div>
        <div class="modal-grid-2">
          <div class="modal-field"><label>Alert Limit DP (Pa)</label><input type="number" step="0.1" id="mAlertDP" placeholder="10"></div>
          <div class="modal-field"><label>Action Limit DP (Pa)</label><input type="number" step="0.1" id="mActionDP" placeholder="5"></div>
          <div class="modal-field"><label>Suhu Min (°C)</label><input type="number" step="0.1" id="mSuhuMin" placeholder="16"></div>
          <div class="modal-field"><label>Suhu Max (°C)</label><input type="number" step="0.1" id="mSuhuMax" placeholder="25"></div>
          <div class="modal-field"><label>RH Min (%)</label><input type="number" step="0.1" id="mRhMin" placeholder="45"></div>
          <div class="modal-field"><label>RH Max (%)</label><input type="number" step="0.1" id="mRhMax" placeholder="65"></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-cancel" onclick="tutupModalMaster()">Batal</button>
          <button type="submit" class="btn-save-modal">Simpan Limit &amp; Data</button>
        </div>
      </form>
    </div>
  </div>

  <div id="operatorModal" class="modal-backdrop" style="display:none;">
    <div class="modal-box">
      <h4><i class="fas fa-user-check"></i> Kelola Operator</h4>
      <div class="limit-section-title" style="border-top:none; margin-top:2px; padding-top:0;">Daftar Operator</div>
      <div class="op-list" id="opList"></div>
      <div class="limit-section-title">Tambah Operator Baru</div>
      <form onsubmit="simpanOperatorBaru(event)">
        <div class="modal-grid-2">
          <div class="modal-field"><label>Inisial</label><input type="text" id="opInisial" maxlength="8" placeholder="AB" style="text-transform:uppercase;" required></div>
          <div class="modal-field"><label>Nama (opsional)</label><input type="text" id="opNama" maxlength="40" placeholder="Nama lengkap"></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-cancel" onclick="tutupModalOperator()">Tutup</button>
          <button type="submit" class="btn-save-modal" id="btnSimpanOp"><i class="fas fa-plus"></i> Tambah</button>
        </div>
      </form>
    </div>
  </div>

  <div id="toastMsg" class="toast-msg"></div>

  <nav class="bottom-nav" id="bottomNav">
    <div class="nav-item active" id="nav-Master" onclick="switchTab('Master', this)"><i class="fas fa-database"></i><span>Master</span></div>
    <div class="nav-item" id="nav-Line1" onclick="switchTab('Line 1', this)"><i class="fas fa-industry"></i><span>Line 1</span></div>
    <div class="nav-item" id="nav-Line2" onclick="switchTab('Line 2', this)"><i class="fas fa-cogs"></i><span>Line 2</span></div>
    <div class="nav-item" id="nav-Logistic" onclick="switchTab('Logistic', this)"><i class="fas fa-truck"></i><span>Logistic</span></div>
    <div class="nav-item" id="nav-Loker" onclick="switchTab('Loker', this)"><i class="fas fa-box-archive"></i><span>Loker</span></div>
    <div class="nav-item" id="nav-Grafik" onclick="switchTab('Grafik', this)"><i class="fas fa-chart-line"></i><span>Grafik</span></div>
  </nav>
</div>

<script>
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
    const u = document.getElementById('loginUrl').value.trim();
    if (u) {
      if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(u)) { errEl.textContent = 'URL tidak valid. Harus berakhiran /exec'; return; }
      lsSet('FIMA_API_URL', u);
    }
    if (!getApiUrl()) { errEl.textContent = 'Isi URL Web App terlebih dahulu.'; return; }
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

const LOGO_SRC = '';

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

/* ---------- 1. MASTER ---------- */
function renderMasterData() {
  const content = document.getElementById('mainContent');
  document.getElementById('monitoringControlPanel').style.display = 'none';
  content.innerHTML = '';
  document.getElementById('pageTitle').innerText = 'MASTER DATA & LIMIT RUANGAN';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn-submit';
  addBtn.style.marginBottom = '0';
  addBtn.innerHTML = '<i class="fas fa-plus-circle"></i> TAMBAH KARTU RUANGAN BARU';
  addBtn.onclick = bukaModalMaster;
  content.appendChild(addBtn);

  MASTER_DATA.forEach(function (item) {
    const tags = item.jenis.split(',').map(function (t) { return '<span class="m-tag">' + t.trim() + '</span>'; }).join('');
    const adaSuhu = item.jenis.indexOf('°C') >= 0;
    const infoLimit = adaSuhu
      ? 'DP Alert: ' + item.alertDP + ' Pa | Action: ' + item.actionDP + ' Pa | Suhu: ' + item.suhuMin + '-' + item.suhuMax + '°C | RH: ' + item.rhMin + '-' + item.rhMax + '%'
      : 'DP Alert: ' + item.alertDP + ' Pa | Action Limit: ' + item.actionDP + ' Pa';

    const card = document.createElement('div');
    card.className = 'data-card';
    if (item.status === 'Nonaktif') card.style.opacity = '0.55';
    card.innerHTML =
      '<div class="card-top"><div class="card-id"><i class="fas fa-barcode"></i> ' + item.no + '. ' + item.id + '</div><div class="card-badge">' + item.area + (item.status === 'Nonaktif' ? ' • NONAKTIF' : '') + '</div></div>' +
      '<div class="card-title">' + item.nama + '</div>' +
      '<div class="card-desc"><i class="fas fa-exchange-alt"></i><span>' + item.mon + '</span></div>' +
      '<div class="limit-info-row"><i class="fas fa-sliders-h"></i> ' + infoLimit + '</div>' +
      '<div class="measurement-tags"><div>' + tags + '</div>' +
      '<button onclick="editMasterItem(' + item.no + ')" style="border:none; background:#0288d1; color:#fff; padding:4px 9px; border-radius:5px; font-size:10px; font-weight:700; cursor:pointer;"><i class="fas fa-edit"></i> Atur Limit</button></div>';
    content.appendChild(card);
  });
}

/* ---------- 2. FORM INPUT ---------- */
function renderInputForms(tabGroupName) {
  const content = document.getElementById('mainContent');
  document.getElementById('monitoringControlPanel').style.display = 'flex';
  content.innerHTML = '';
  document.getElementById('pageTitle').innerText = 'FORM INPUT MONITORING RUANGAN';
  LAST_KEY = '';

  // Kontrol cepat: set semua OFF / reset
  const quickCtrl = document.createElement('div');
  quickCtrl.style.cssText = 'display:flex; gap:6px; padding:8px; background:#fef9c3; border:1px solid #fde047; border-radius:9px; align-items:center;';
  quickCtrl.innerHTML =
    '<div style="flex:1; font-size:10.5px; font-weight:800; color:#854d0e; line-height:1.3;">' +
      '<i class="fas fa-circle-info"></i> Hari libur? Tandai semua ruangan OFF sekaligus:' +
    '</div>' +
    '<button type="button" onclick="setSemuaMode(\'OFF\')" style="border:none; background:#475569; color:#fff; padding:7px 10px; border-radius:6px; font-size:10.5px; font-weight:800; cursor:pointer; white-space:nowrap;">' +
      '<i class="fas fa-moon"></i> SEMUA OFF' +
    '</button>' +
    '<button type="button" onclick="setSemuaMode(\'NA\')" style="border:none; background:#0288d1; color:#fff; padding:7px 10px; border-radius:6px; font-size:10.5px; font-weight:800; cursor:pointer; white-space:nowrap;">' +
      '<i class="fas fa-rotate-left"></i> RESET' +
    '</button>';
  content.appendChild(quickCtrl);

  MASTER_DATA.filter(function (item) { return item.tabGroup === tabGroupName && item.status !== 'Nonaktif'; }).forEach(function (item) {
    let inputHtml = '';
    let colCount = 0;

    if (item.jenis.indexOf('°C') >= 0) {
      inputHtml += '<div class="input-group"><label><i class="fas fa-temperature-half"></i> SUHU</label>' +
        '<input type="text" inputmode="numeric" class="input-field auto-step-input" id="suhu_' + item.no + '" data-no="' + item.no + '" data-type="suhu" data-unit="C" maxlength="6" placeholder="23.4 C" onfocus="stripUnitOnFocus(this)" onblur="appendUnitOnBlur(this)">' +
        '<span class="spec-hint">' + item.suhuMin + '–' + item.suhuMax + ' °C</span></div>';
      colCount++;
    }
    if (item.jenis.indexOf('%RH') >= 0) {
      inputHtml += '<div class="input-group"><label><i class="fas fa-droplet"></i> %RH</label>' +
        '<input type="text" inputmode="numeric" class="input-field auto-step-input" id="rh_' + item.no + '" data-no="' + item.no + '" data-type="rh" data-unit="" maxlength="2" placeholder="50">' +
        '<span class="spec-hint">' + item.rhMin + '–' + item.rhMax + ' %</span></div>';
      colCount++;
    }
    if (item.jenis.indexOf('Pa') >= 0) {
      inputHtml += '<div class="input-group"><label><i class="fas fa-gauge-high"></i> DP</label>' +
        '<input type="text" inputmode="numeric" class="input-field auto-step-input" id="dp_' + item.no + '" data-no="' + item.no + '" data-type="dp" data-unit="" maxlength="2" placeholder="15">' +
        '<span class="spec-hint">Alert:' + item.alertDP + ' | Act:' + item.actionDP + 'Pa</span></div>';
      colCount++;
    }

    const areaLabel = (tabGroupName === 'Loker') ? item.area : tabGroupName;
    const formCard = document.createElement('div');
    formCard.className = 'form-card';
    formCard.id = 'card_' + item.no;
    formCard.innerHTML =
      '<div class="form-header">' +
        '<div class="fh-left"><span class="fh-no">' + item.no + '</span><div class="fh-text"><span class="fh-id">' + item.id + '</span><span class="fh-area">' + areaLabel + '</span></div></div>' +
        '<div class="fh-right"><span class="off-chip" id="offchip_' + item.no + '"><i class="fas fa-moon"></i> OFF</span><span class="saved-chip" id="chip_' + item.no + '" style="display:none;">✔ Tersimpan</span></div>' +
      '</div>' +
      '<div class="form-body">' +
        '<div class="location-info">' +
          '<p><i class="fas fa-map-marker-alt"></i> ' + item.nama + '</p>' +
          '<p><i class="fas fa-exchange-alt"></i> ' + item.mon + '</p>' +
        '</div>' +
        '<div class="input-grid" style="grid-template-columns: repeat(' + colCount + ', 1fr);">' + inputHtml + '</div>' +
        '<div class="off-note"><i class="fas fa-circle-info"></i> Hari libur — tidak ada pengukuran. Pada grafik hari ini akan terputus dan ditandai abu-abu.</div>' +
        '<div class="note-section">' +
          '<label class="note-label" for="note_' + item.no + '"><i class="fas fa-comment-dots"></i> Catatan</label>' +
          '<select class="note-select" id="note_' + item.no + '" data-no="' + item.no + '" onchange="onNoteModeChange(' + item.no + ')">' +
            '<option value="NA">N/A</option><option value="CATATAN">Isi catatan</option><option value="OFF">OFF (Libur)</option>' +
          '</select>' +
          '<input type="text" class="note-text" id="notetxt_' + item.no + '" maxlength="120" placeholder="Tulis catatan..." style="display:none;">' +
        '</div>' +
      '</div>';
    content.appendChild(formCard);
  });

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-submit';
  saveBtn.id = 'btnSimpanArea';
  saveBtn.innerHTML = '<i class="fas fa-save"></i> SIMPAN DATA';
  saveBtn.onclick = function () { simpanDataArea(tabGroupName); };
  content.appendChild(saveBtn);

  pasangSmartTabDanBackspace();
  cekStatusShiftArea();
}

/* ---------- Catatan: N/A | Isi catatan | OFF ---------- */
function inputsKartu(no) {
  return ['suhu_', 'rh_', 'dp_'].map(function (p) { return document.getElementById(p + no); }).filter(Boolean);
}

function kosongkanInputKartu(no) {
  inputsKartu(no).forEach(function (el) {
    el.value = '';
    el.setAttribute('data-raw', '');
    el.classList.remove('val-ok', 'val-alert', 'val-action');
  });
}

/** Set semua kartu di tab aktif ke mode tertentu (OFF/NA). Kartu terkunci (sudah tersimpan) dilewati. */
function setSemuaMode(mode) {
  const tab = CURRENT_TAB;
  if (tab === 'Master' || tab === 'Grafik') return;
  let count = 0, skipped = 0;
  MASTER_DATA.filter(function (m) { return m.tabGroup === tab && m.status !== 'Nonaktif'; }).forEach(function (item) {
    const card = document.getElementById('card_' + item.no);
    if (!card) return;
    if (card.classList.contains('is-locked')) { skipped++; return; }
    const sel = document.getElementById('note_' + item.no);
    if (sel) {
      sel.value = mode;
      onNoteModeChange(item.no);
      count++;
    }
  });
  if (mode === 'OFF') showToast(count + ' ruangan ditandai OFF' + (skipped ? ' (' + skipped + ' sudah tersimpan, dilewati)' : ''));
  else if (mode === 'NA') showToast(count + ' ruangan direset ke N/A' + (skipped ? ' (' + skipped + ' sudah tersimpan, dilewati)' : ''));
}

/** Terapkan tampilan sesuai pilihan catatan. Kartu yang sudah tersimpan (terkunci) tidak diubah. */
function onNoteModeChange(no) {
  const card = document.getElementById('card_' + no);
  const sel = document.getElementById('note_' + no);
  const txt = document.getElementById('notetxt_' + no);
  if (!card || !sel || card.classList.contains('is-locked')) return;
  const mode = sel.value;

  sel.classList.toggle('mode-catatan', mode === 'CATATAN');
  sel.classList.toggle('mode-off', mode === 'OFF');
  txt.style.display = (mode === 'CATATAN') ? 'block' : 'none';
  if (mode !== 'CATATAN') txt.value = '';
  if (mode === 'CATATAN') setTimeout(function () { txt.focus(); }, 30);

  const off = (mode === 'OFF');
  card.classList.toggle('is-off', off);
  if (off) kosongkanInputKartu(no);
  inputsKartu(no).forEach(function (el) { el.readOnly = off; });
  const chip = document.getElementById('offchip_' + no);
  if (chip) chip.style.display = off ? 'inline-block' : 'none';
}

/** Kembalikan satu kartu ke keadaan kosong (dipakai saat tanggal/shift/area berganti). */
function resetKartu(no) {
  const card = document.getElementById('card_' + no);
  if (!card) return;
  card.classList.remove('is-locked', 'is-off');
  inputsKartu(no).forEach(function (el) {
    el.readOnly = false;
    el.classList.remove('locked', 'val-ok', 'val-alert', 'val-action');
    el.value = '';
    el.setAttribute('data-raw', '');
  });
  const sel = document.getElementById('note_' + no);
  const txt = document.getElementById('notetxt_' + no);
  if (sel) { sel.value = 'NA'; sel.disabled = false; sel.classList.remove('mode-catatan', 'mode-off'); }
  if (txt) { txt.value = ''; txt.readOnly = false; txt.style.display = 'none'; }
  const chip = document.getElementById('chip_' + no);
  if (chip) chip.style.display = 'none';
  const oc = document.getElementById('offchip_' + no);
  if (oc) oc.style.display = 'none';
}

/** Tampilkan kartu yang sudah tersimpan di sheet (terkunci, tidak bisa diisi ulang). */
function kunciKartuTersimpan(no, saved) {
  resetKartu(no);
  const card = document.getElementById('card_' + no);
  const sel = document.getElementById('note_' + no);
  const txt = document.getElementById('notetxt_' + no);
  if (!card) return;
  card.classList.add('is-locked');
  const isOff = (saved.status === 'OFF');

  if (isOff) {
    card.classList.add('is-off');
    inputsKartu(no).forEach(function (el) { el.readOnly = true; el.classList.add('locked'); });
    if (sel) { sel.value = 'OFF'; sel.classList.add('mode-off'); }
  } else {
    setFieldState(document.getElementById('suhu_' + no), saved.suhu, true);
    setFieldState(document.getElementById('rh_' + no), saved.rh, true);
    setFieldState(document.getElementById('dp_' + no), saved.dp, true);
    if (saved.catatan && sel && txt) {
      sel.value = 'CATATAN'; sel.classList.add('mode-catatan');
      txt.value = saved.catatan; txt.style.display = 'block';
    }
  }
  if (sel) sel.disabled = true;
  if (txt) txt.readOnly = true;
  const chip = document.getElementById('chip_' + no);
  if (chip) chip.style.display = 'inline-block';
  const oc = document.getElementById('offchip_' + no);
  if (oc) oc.style.display = isOff ? 'inline-block' : 'none';
}

/* Smart Tab & Smart Backspace
   Suhu: 3 digit (234 -> 23.4) lalu pindah | %RH & DP: 2 digit lalu pindah
   Backspace pada kolom kosong -> mundur ke kolom sebelumnya. Kolom terkunci (sudah tersimpan) dilewati. */
function pasangSmartTabDanBackspace() {
  const inputs = Array.from(document.querySelectorAll('.auto-step-input'));

  inputs.forEach(function (inp, idx) {
    inp.addEventListener('input', function (e) {
      if (inp.readOnly) return;
      const type = inp.getAttribute('data-type');
      const isDeleting = (e.inputType && e.inputType.indexOf('delete') >= 0);

      if (type === 'suhu') {
        const digits = inp.value.replace(/\D/g, '').slice(0, 3);
        if (digits.length === 3) {
          const formatted = digits.slice(0, 2) + '.' + digits.slice(2, 3);
          inp.value = formatted;
          inp.setAttribute('data-raw', formatted);
          evaluasiWarnaLimit(inp);
          if (!isDeleting) pindahKeInputBerikutnya(inputs, idx);
        } else {
          inp.value = digits;
          inp.setAttribute('data-raw', digits);
          evaluasiWarnaLimit(inp);
        }
      } else {
        const digits = inp.value.replace(/\D/g, '').slice(0, 2);
        inp.value = digits;
        inp.setAttribute('data-raw', digits);
        evaluasiWarnaLimit(inp);
        if (digits.length === 2 && !isDeleting) pindahKeInputBerikutnya(inputs, idx);
      }
    });

    inp.addEventListener('keydown', function (e) {
      if (inp.readOnly) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        pindahKeInputBerikutnya(inputs, idx);
        return;
      }
      if (e.key === 'Backspace' || e.keyCode === 8) {
        const currentVal = inp.value.replace(/\s*C$/i, '');
        if (currentVal.length === 0) {
          let p = idx - 1;
          while (p >= 0 && inputs[p].readOnly) p--;
          if (p < 0) return;
          e.preventDefault();
          const prev = inputs[p];
          prev.focus();
          let prevDigits = (prev.getAttribute('data-raw') || prev.value).replace(/\D/g, '');
          if (prevDigits.length > 0) prevDigits = prevDigits.slice(0, -1);
          prev.value = prevDigits;
          prev.setAttribute('data-raw', prevDigits);
          evaluasiWarnaLimit(prev);
          const len = prev.value.length;
          try { prev.setSelectionRange(len, len); } catch (err) {}
        }
      }
    });
  });
}

function pindahKeInputBerikutnya(inputs, currentIndex) {
  for (let j = currentIndex + 1; j < inputs.length; j++) {
    if (!inputs[j].readOnly) {
      inputs[j].focus();
      const len = inputs[j].value.length;
      try { inputs[j].setSelectionRange(len, len); } catch (err) {}
      return;
    }
  }
  const btn = document.getElementById('btnSimpanArea');
  if (btn && !btn.disabled) btn.focus();
}

function stripUnitOnFocus(el) {
  if (el.readOnly) return;
  const raw = el.getAttribute('data-raw') || el.value.replace(/[^\d.]/g, '');
  el.value = raw;
  const len = el.value.length;
  setTimeout(function () { try { el.setSelectionRange(len, len); } catch (e) {} }, 10);
}

function appendUnitOnBlur(el) {
  if (el.readOnly) return;
  const digits = el.value.replace(/\D/g, '').slice(0, 3);
  let clean = '';
  if (digits.length === 3) clean = digits.slice(0, 2) + '.' + digits.slice(2, 3);
  else if (digits.length > 0) clean = digits;
  el.setAttribute('data-raw', clean);
  evaluasiWarnaLimit(el);
  const unit = el.getAttribute('data-unit');
  el.value = (clean !== '' && unit) ? clean + ' ' + unit : clean;
}

function getPureNumericValue(el) {
  if (!el) return '';
  const rawAttr = el.getAttribute('data-raw');
  const source = (rawAttr !== null && rawAttr !== '') ? rawAttr : el.value;
  return String(source).replace(',', '.').replace(/[^\d.-]/g, '').trim();
}

function evaluasiWarnaLimit(el) {
  if (!el) return;
  el.classList.remove('val-ok', 'val-alert', 'val-action');
  const raw = String(el.getAttribute('data-raw') || el.value).replace(',', '.').replace(/[^\d.-]/g, '').trim();
  if (raw === '' || isNaN(Number(raw))) return;

  const val = Number(raw);
  const no = Number(el.getAttribute('data-no'));
  const type = el.getAttribute('data-type');
  const room = MASTER_DATA.find(function (m) { return m.no === no; });
  if (!room) return;

  if (type === 'suhu' && hasVal(room.suhuMin) && hasVal(room.suhuMax)) {
    el.classList.add((val < Number(room.suhuMin) || val > Number(room.suhuMax)) ? 'val-action' : 'val-ok');
  } else if (type === 'rh' && hasVal(room.rhMin) && hasVal(room.rhMax)) {
    el.classList.add((val < Number(room.rhMin) || val > Number(room.rhMax)) ? 'val-action' : 'val-ok');
  } else if (type === 'dp' && hasVal(room.alertDP) && hasVal(room.actionDP)) {
    const a = Number(room.alertDP), c = Number(room.actionDP);
    if (a >= c) {
      if (val <= c) el.classList.add('val-action');
      else if (val <= a) el.classList.add('val-alert');
      else el.classList.add('val-ok');
    } else {
      if (val >= c) el.classList.add('val-action');
      else if (val >= a) el.classList.add('val-alert');
      else el.classList.add('val-ok');
    }
  }
}

/* ---------- Status shift: anti isi ulang ---------- */
function setFieldState(el, savedVal, hasSaved) {
  if (!el) return;
  if (hasSaved && hasVal(savedVal)) {
    el.setAttribute('data-raw', String(savedVal));
    const unit = el.getAttribute('data-unit');
    el.value = unit ? savedVal + ' ' + unit : String(savedVal);
    el.readOnly = true;
    el.classList.add('locked');
    evaluasiWarnaLimit(el);
  } else if (el.readOnly && el.classList.contains('locked')) {   // sebelumnya terkunci, sekarang tidak (ganti tanggal/shift)
    el.readOnly = false;
    el.classList.remove('locked', 'val-ok', 'val-alert', 'val-action');
    el.value = '';
    el.setAttribute('data-raw', '');
  }
}

function cekStatusShiftArea() {
  if (CURRENT_TAB === 'Master' || CURRENT_TAB === 'Grafik') return;

  const tanggal = document.getElementById('ctrlTanggal').value;
  const shift = document.getElementById('ctrlJamShift').value.split('|')[1];
  const tab = CURRENT_TAB;
  const banner = document.getElementById('shiftBanner');
  const btn = document.getElementById('btnSimpanArea');
  if (!tanggal) return;

  const key = tanggal + '|' + shift + '|' + tab;
  if (key !== LAST_KEY) {              // tanggal/shift/area berubah -> kosongkan isian
    LAST_KEY = key;
    MASTER_DATA.forEach(function (m) { resetKartu(m.no); });
  }

  const reqId = ++STATUS_REQ;
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MEMERIKSA STATUS...'; }
  banner.className = 'shift-status-banner pending';
  banner.innerHTML = '<i class="fas fa-sync fa-spin"></i> Memeriksa status ' + shift + ' tanggal ' + formatTglIndo(tanggal) + '...';

  gs('cekShift', [tanggal, shift, tab], function (res) {
    if (reqId !== STATUS_REQ || tab !== CURRENT_TAB) return;
    terapkanStatus(res, tab, tanggal, shift);
  }, function (err) {
    if (reqId !== STATUS_REQ) return;
    banner.className = 'shift-status-banner error';
    banner.innerHTML = '⚠️ Gagal memeriksa status: ' + (err && err.message ? err.message : err) + ' (ketuk untuk coba lagi)';
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> SIMPAN DATA'; }
  });
}

function terapkanStatus(res, tab, tanggal, shift) {
  const banner = document.getElementById('shiftBanner');
  const btn = document.getElementById('btnSimpanArea');
  const tglStr = formatTglIndo(tanggal);
  const rec = (res && res.recordsByNo) ? res.recordsByNo : {};

  MASTER_DATA.filter(function (m) { return m.tabGroup === tab && m.status !== 'Nonaktif'; }).forEach(function (item) {
    const saved = rec[String(item.no)];
    if (saved) kunciKartuTersimpan(item.no, saved);
    else if (document.getElementById('card_' + item.no) && document.getElementById('card_' + item.no).classList.contains('is-locked')) resetKartu(item.no);
  });

  if (res.isComplete) {
    banner.className = 'shift-status-banner done';
    banner.innerHTML = '✅ ' + shift + ' tanggal ' + tglStr + ' untuk ' + tab + ' sudah LENGKAP (' + res.filledCount + '/' + res.totalRooms + ' ruangan, Op: ' + (res.operator || '-') + '). Tidak bisa diisi ulang.';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-lock"></i> SHIFT SUDAH LENGKAP'; }
  } else if (res.sudahDiisi) {
    banner.className = 'shift-status-banner pending';
    banner.innerHTML = '⚠️ ' + shift + ' tanggal ' + tglStr + ' untuk ' + tab + ' baru terisi ' + res.filledCount + '/' + res.totalRooms + ' ruangan. Lengkapi sisanya (yang sudah tersimpan terkunci).';
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> SIMPAN DATA'; }
  } else {
    banner.className = 'shift-status-banner pending';
    banner.innerHTML = '⏳ ' + shift + ' tanggal ' + tglStr + ' untuk ' + tab + ' belum diisi.';
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> SIMPAN DATA'; }
  }
}

function formatTglIndo(ymd) {
  if (!ymd) return '';
  const bln = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const p = ymd.split('-');
  if (p.length < 3) return ymd;
  return p[2] + ' ' + bln[parseInt(p[1], 10) - 1] + ' ' + p[0];
}

function simpanDataArea(tabGroupName) {
  const tanggal = document.getElementById('ctrlTanggal').value;
  const jamShift = document.getElementById('ctrlJamShift').value.split('|');
  const operator = (document.getElementById('ctrlOperator').value || '').trim().toUpperCase();

  if (!tanggal) { alert('Mohon pilih Tanggal terlebih dahulu!'); return; }
  if (!operator) { alert('Mohon pilih Operator terlebih dahulu! Tekan tombol + di samping kolom operator untuk menambah.'); return; }
  lsSet('FIMA_OPERATOR', operator);

  const rooms = MASTER_DATA.filter(function (m) { return m.tabGroup === tabGroupName && m.status !== 'Nonaktif'; });
  const entries = [];

  for (let i = 0; i < rooms.length; i++) {
    const item = rooms[i];
    const card = document.getElementById('card_' + item.no);
    if (card && card.classList.contains('is-locked')) continue;   // sudah tersimpan -> dilewati

    const sEl = document.getElementById('suhu_' + item.no);
    const rEl = document.getElementById('rh_' + item.no);
    const dEl = document.getElementById('dp_' + item.no);
    const mode = (document.getElementById('note_' + item.no) || {}).value || 'NA';
    const noteTxt = ((document.getElementById('notetxt_' + item.no) || {}).value || '').trim();
    const base = { no: item.no, id: item.id, nama: item.nama, mon: item.mon, jenis: item.jenis, area: item.area };

    if (mode === 'OFF') {
      entries.push(Object.assign(base, { suhu: '', rh: '', dp: '', status: 'OFF', catatan: 'OFF' }));
      continue;
    }

    const suhuVal = getPureNumericValue(sEl);
    const rhVal = getPureNumericValue(rEl);
    const dpVal = getPureNumericValue(dEl);
    if (suhuVal === '' && rhVal === '' && dpVal === '') {
      if (mode === 'CATATAN' && noteTxt !== '') { alert('Ruangan ' + item.id + ' (' + item.nama + ') berisi catatan tetapi nilainya masih kosong. Isi nilai, atau pilih OFF bila hari libur.'); if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      continue;
    }

    if (item.jenis.indexOf('°C') >= 0 && (suhuVal === '' || isNaN(Number(suhuVal)))) { alert('Suhu (°C) pada ruangan ' + item.id + ' (' + item.nama + ') wajib berupa angka!'); if (sEl) sEl.focus(); return; }
    if (item.jenis.indexOf('%RH') >= 0 && (rhVal === '' || isNaN(Number(rhVal)))) { alert('%RH pada ruangan ' + item.id + ' (' + item.nama + ') wajib berupa angka!'); if (rEl) rEl.focus(); return; }
    if (item.jenis.indexOf('Pa') >= 0 && (dpVal === '' || isNaN(Number(dpVal)))) { alert('DP (Pa) pada ruangan ' + item.id + ' (' + item.nama + ') wajib berupa angka!'); if (dEl) dEl.focus(); return; }
    if (mode === 'CATATAN' && noteTxt === '') { alert('Catatan pada ruangan ' + item.id + ' (' + item.nama + ') masih kosong. Tulis catatannya atau ubah pilihan menjadi N/A.'); const t = document.getElementById('notetxt_' + item.no); if (t) t.focus(); return; }

    entries.push(Object.assign(base, { suhu: suhuVal, rh: rhVal, dp: dpVal, status: '', catatan: (mode === 'CATATAN') ? noteTxt : '' }));
  }

  if (entries.length === 0) {
    alert('Tidak ada isian baru untuk disimpan. Isi minimal 1 kartu ruangan yang belum tersimpan (atau pilih OFF bila hari libur).');
    return;
  }

  const btn = document.getElementById('btnSimpanArea');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> MENYIMPAN DATA...';

  gs('simpanMonitoringBulk', [{
    tanggal: tanggal, jam: jamShift[0], shift: jamShift[1], operator: operator, tabGroup: tabGroupName, entries: entries
  }], function (res) {
    showToast(res.message);
    if (res.success === false) alert(res.message);
    cekStatusShiftArea();
  }, function (err) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> SIMPAN DATA';
    alert('Gagal menyimpan: ' + (err && err.message ? err.message : err));
  });
}

/* ---------- 3. GRAFIK ---------- */
function renderHalamanGrafik() {
  const content = document.getElementById('mainContent');
  document.getElementById('monitoringControlPanel').style.display = 'none';
  document.getElementById('pageTitle').innerText = 'GRAFIK MONITORING (TGL 1-31)';
  const currentYM = localYMD().slice(0, 7);

  const optionsRuang = MASTER_DATA.map(function (m) {
    return '<option value="' + m.no + '"' + (m.no === LAST_GRAFIK_NO ? ' selected' : '') + '>No. ' + m.no + ' — ' + m.id + ' (' + m.nama + ')</option>';
  }).join('');

  content.innerHTML =
    '<div class="control-card">' +
      '<div class="ctrl-group"><label>PILIH NO. RUANGAN</label><select id="gNoTitik" onchange="muatGrafikBulanan()">' + optionsRuang + '</select></div>' +
      '<div class="control-grid" style="grid-template-columns: 1fr 1fr;">' +
        '<div class="ctrl-group"><label>BULAN / TAHUN</label><input type="month" id="gYearMonth" value="' + currentYM + '" onchange="onGrafikMonthChange()"></div>' +
        '<div class="ctrl-group"><label>FILTER SHIFT</label><select id="gShift" onchange="muatGrafikBulanan()">' +
          '<option value="ALL">Semua Shift (Terbaru)</option><option value="Shift 1">Shift 1 (07:00)</option><option value="Shift 2">Shift 2 (15:00)</option><option value="Shift 3">Shift 3 (23:00)</option>' +
        '</select></div>' +
      '</div>' +
      '<div class="ctrl-group"><label><i class="fas fa-user-tie"></i> SPV AREA (1x per bulan, tampil di cetakan)</label>' +
        '<input type="text" id="gSpvNama" maxlength="40" placeholder="Nama Spv Area bulan ini" onchange="simpanSpvNama()">' +
      '</div>' +
      '<div id="grafikRoomMeta" class="limit-info-row" style="margin-top:2px;">Memuat info ruangan...</div>' +
      '<div class="graf-actions"><button class="btn-print" onclick="cetakGrafikA4()"><i class="fas fa-print"></i> CETAK A4 (TREN TGL 1–31)</button><button class="btn-sheet" onclick="bukaLinkSpreadsheet()"><i class="fas fa-table"></i> Sheet</button></div>' +
      '<div class="graf-hint">Satu halaman A4 landscape per jenis ukur (Suhu, %RH, DP). Pilih \"Simpan sebagai PDF\" di dialog cetak bila perlu.</div>' +
    '</div>' +
    '<div id="sheetsContainer"></div>';

  muatSpvBulan(currentYM, function () { muatGrafikBulanan(); });
}

function onGrafikMonthChange() {
  const ym = document.getElementById('gYearMonth').value;
  muatSpvBulan(ym, function () { muatGrafikBulanan(); });
}

function muatSpvBulan(yearMonth, callback) {
  gs('getSpvReview', [yearMonth], function (res) {
    const el = document.getElementById('gSpvNama');
    const nama = (res && res.nama) || '';
    if (el) el.value = nama;
    LAST_SHEET_SPV = nama;
    if (callback) callback();
  }, function () {
    LAST_SHEET_SPV = '';
    if (callback) callback();
  });
}

function simpanSpvNama() {
  const yearMonth = document.getElementById('gYearMonth').value;
  const nama = (document.getElementById('gSpvNama').value || '').trim();
  if (!yearMonth) return;
  gs('saveSpvReview', [{ yearMonth: yearMonth, nama: nama }], function (res) {
    showToast(res.message || 'Nama Spv Area disimpan.');
    LAST_SHEET_SPV = nama;
    if (LAST_SHEET) renderSheetsGrafik(LAST_SHEET.room, LAST_SHEET.days, LAST_SHEET.yearMonth);
  }, function (err) {
    alert('Gagal menyimpan Spv Area: ' + (err && err.message ? err.message : err));
  });
}

function muatGrafikBulanan() {
  const noTitik = Number(document.getElementById('gNoTitik').value || 1);
  const yearMonth = document.getElementById('gYearMonth').value;
  const shift = document.getElementById('gShift').value;
  LAST_GRAFIK_NO = noTitik;

  const roomLocal = MASTER_DATA.find(function (m) { return m.no === noTitik; }) || MASTER_DATA[0];
  tampilkanMetaGrafik(roomLocal, null);

  gs('getGrafikSheetData', [{ noTitik: noTitik, yearMonth: yearMonth, shift: shift }], function (res) {
    if (!res || !res.room || CURRENT_TAB !== 'Grafik') return;
    tampilkanMetaGrafik(res.room, res.count);
    renderSheetsGrafik(res.room, res.days, res.yearMonth || yearMonth);
  }, function (err) {
    const m = document.getElementById('grafikRoomMeta');
    if (m) m.innerHTML += '<div class="empty-note">Gagal memuat data grafik: ' + (err && err.message ? err.message : err) + '</div>';
  });
}

function tampilkanMetaGrafik(room, count) {
  const metaEl = document.getElementById('grafikRoomMeta');
  if (!metaEl || !room) return;
  let note = '';
  if (count === 0) note = '<div class="empty-note">Belum ada data untuk ruangan ini pada bulan/shift yang dipilih.</div>';
  else if (count > 0) note = '<div><strong>Data terisi:</strong> ' + count + ' hari</div>';
  metaEl.innerHTML =
    '<div><strong>ID:</strong> ' + room.id + ' | <strong>Ruang:</strong> ' + room.nama + ' (' + room.area + ')</div>' +
    '<div><strong>Monitoring:</strong> ' + room.mon + '</div>' +
    '<div><strong>Alert Limit DP:</strong> ' + room.alertDP + ' Pa | <strong>Action Limit DP:</strong> ' + room.actionDP + ' Pa</div>' + note;

  const adaSuhu = room.jenis.indexOf('°C') >= 0;
  const cS = document.getElementById('cardChartSuhu');
  const cR = document.getElementById('cardChartRH');
  if (cS) cS.style.display = adaSuhu ? 'block' : 'none';
  if (cR) cR.style.display = adaSuhu ? 'block' : 'none';
}

function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

let LAST_SHEET = null;
let LAST_SHEET_SPV = '';
const NAMA_BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
function hariDalamBulan(ym) { const p = String(ym || '').split('-'); const y = Number(p[0]), m = Number(p[1]); return (y && m) ? new Date(y, m, 0).getDate() : 31; }
function labelBulan(ym) { const p = String(ym || '').split('-'); return (p.length >= 2 && NAMA_BULAN[Number(p[1]) - 1]) ? NAMA_BULAN[Number(p[1]) - 1] + ' ' + p[0] : ''; }

/** Pilih langkah skala agar jumlah baris <= 12 dan batas atas/bawah tepat di baris. */
function pilihLangkah(lo, hi) {
  const range = hi - lo;
  const kandidat = [0.5, 1, 2, 2.5, 5, 10, 20];
  for (let i = 0; i < kandidat.length; i++) {
    const k = kandidat[i];
    const n = range / k;
    if (n <= 11.001 && Math.abs(n - Math.round(n)) < 1e-6) return k;
  }
  return Math.max(1, Math.ceil(range / 11));
}

function wrapTeks(str, maks) {
  const words = String(str).split(' '); const lines = []; let cur = '';
  words.forEach(function (w) {
    if ((cur + ' ' + w).trim().length > maks) { if (cur) lines.push(cur); cur = w; } else { cur = (cur + ' ' + w).trim(); }
  });
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Lembar logsheet (meniru form kertas FIMA) berbentuk SVG, tgl 1-31 dalam satu halaman.
 * tipe: 'suhu' | 'rh' | 'dp'
 */
function buatSheetSVG(tipe, room, days, yearMonth, spvNama) {
  spvNama = spvNama || '';
  const W = 1110, X0 = 20, LABW = 92, VALW = 24, GX = X0 + LABW + VALW, GR = W - 20, GW = GR - GX, CW = GW / 31;
  const dim = hariDalamBulan(yearMonth);
  const isDP = (tipe === 'dp');
  const warna = { suhu: '#7b1fa2', rh: '#1b7f4b', dp: '#0277bd' }[tipe];
  const key = tipe;

  // ----- skala & batas -----
  let top, sBot, rowsVal = [], step, lo, hi, limitLines = [], title, unitLabel, alat, limitTxt = [];
  if (isDP) {
    const aD = hasVal(room.alertDP) ? Number(room.alertDP) : 10, cD = hasVal(room.actionDP) ? Number(room.actionDP) : 5;
    let mx = 0;
    days.forEach(function (d) { if (!d.off && hasVal(d.dp)) mx = Math.max(mx, Number(d.dp)); });
    top = 60; sBot = 5;
    step = 5;
    for (let v = top; v >= 5; v -= 5) rowsVal.push(v);
    limitLines = [{ v: aD, c: '#f59e0b' }, { v: cD, c: '#dc2626' }];
    title = 'Catatan Hasil Monitoring Perbedaan Tekanan'; unitLabel = 'DP (Pa)'; alat = 'Magnehelic';
    limitTxt = ['Limit Perbedaan Tekanan', 'Alert Limit : ' + aD + ' Pa', 'Action Limit : ' + cD + ' Pa'];
    lo = 5; hi = top;
  } else {
    const kMin = tipe === 'suhu' ? room.suhuMin : room.rhMin, kMax = tipe === 'suhu' ? room.suhuMax : room.rhMax;
    lo = hasVal(kMin) ? Number(kMin) : (tipe === 'suhu' ? 16 : 45);
    hi = hasVal(kMax) ? Number(kMax) : (tipe === 'suhu' ? 25 : 65);
    if (hi <= lo) hi = lo + 1;
    // skala vertikal tetap seperti form kertas: Suhu 20..30, RH 45..55 (langkah 1)
    top = (tipe === 'suhu') ? 30 : 55; sBot = (tipe === 'suhu') ? 20 : 45;
    step = 1;
    for (let v = top; v >= sBot; v--) rowsVal.push(v);
    limitLines = [{ v: lo, c: '#dc2626' }, { v: hi, c: '#dc2626' }];
    const u = tipe === 'suhu' ? '°C' : '%';
    title = tipe === 'suhu' ? 'Catatan Hasil Monitoring Suhu Ruangan' : 'Catatan Hasil Monitoring Kelembapan Ruangan';
    unitLabel = tipe === 'suhu' ? 'Suhu (°C)' : 'RH (%)'; alat = 'Thermohygrometer';
    limitTxt = ['Limit : ' + lo + ' – ' + hi + ' ' + u, 'Action Limit : ' + lo + ' ' + u + ' & ' + hi + ' ' + u];
  }
  const n = rowsVal.length;
  const rh = Math.max(14, Math.min(26, Math.floor(300 / n)));

  // ----- geometri -----
  const Y_HDR = 172, hdrH = 18, yBar = Y_HDR + hdrH;
  const topH = isDP ? 0 : 10;
  const y0 = yBar + topH;
  const yRowsEnd = y0 + n * rh;
  const botH = isDP ? 12 : 10;
  const yBotEnd = yRowsEnd + botH;
  const valH = 28, jamH = 20, opH = 20, spvH = 28, catH = 56;
  const yVal = yBotEnd, yJam = yVal + valH, yOp = yJam + jamH, ySpv = yOp + opH, yCat = ySpv + spvH, yEnd = yCat + catH;
  const cx = function (i) { return GX + i * CW; };
  const cmid = function (i) { return GX + i * CW + CW / 2; };
  const yOf = function (v) {
    if (v > top) return yBar + topH / 2 + (isDP ? 0 : 0);
    if (v < sBot) return yRowsEnd + botH / 2;
    return y0 + ((top - v) / step) * rh + rh / 2;
  };

  // ----- footer (catatan lengkap) -----
  const offTgl = [], notes = [];
  days.forEach(function (d) { if (d.day > dim) return; if (d.off) offTgl.push(d.day); else if (d.catatan) notes.push('Tgl ' + d.day + ': ' + d.catatan); });
  let footLines = [];
  if (offTgl.length) footLines.push('Hari libur (OFF): tgl ' + offTgl.join(', '));
  if (notes.length) footLines = footLines.concat(wrapTeks('Catatan: ' + notes.join('  |  '), 205));
  if (footLines.length > 4) { footLines = footLines.slice(0, 4); footLines[3] += ' …'; }
  const yFoot = yEnd + 16;
  const H = yFoot + (footLines.length * 11) + 26;

  const o = [];
  o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" font-family="Segoe UI, Tahoma, Arial, sans-serif" preserveAspectRatio="xMidYMin meet">');
  o.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fff"/>');

  // ----- kepala form -----
  o.push(typeof LOGO_SRC !== 'undefined' && LOGO_SRC ? '<image href="' + LOGO_SRC + '" x="' + X0 + '" y="10" width="86" height="64" preserveAspectRatio="xMidYMid meet"/>' : '<text x="' + X0 + '" y="48" font-size="22" font-weight="800" fill="#0288d1">FIMA</text>');
  o.push('<text x="560" y="32" text-anchor="middle" font-size="15" font-weight="700" fill="#111">Pemantauan Lingkungan Produksi, Laboratorium, dan Ruang Sampling</text>');
  o.push('<text x="560" y="52" text-anchor="middle" font-size="12" font-weight="700" fill="#111">' + esc(title) + '</text>');
  o.push('<text x="' + X0 + '" y="100" font-size="11" font-weight="700" fill="#111">Bulan : ' + esc(labelBulan(yearMonth)) + '</text>');
  o.push('<text x="' + X0 + '" y="116" font-size="10.5" font-weight="700" fill="#111">Tanggal Rekalibrasi ' + alat + ' : ..............................</text>');
  if (spvNama) {
    o.push('<text x="' + GR + '" y="100" text-anchor="end" font-size="10.5" font-weight="700" fill="#0288d1">Ditinjau oleh Spv Area: ' + esc(spvNama) + '</text>');
  }
  o.push('<rect x="' + X0 + '" y="124" width="' + (GR - X0) + '" height="42" fill="none" stroke="#111" stroke-width="1"/>');
  o.push('<line x1="800" y1="124" x2="800" y2="166" stroke="#111" stroke-width="1"/>');
  o.push('<text x="410" y="141" text-anchor="middle" font-size="10.5" font-weight="700" fill="#111">Ruang* : ' + esc(room.nama) + ' (' + esc(room.id) + ') — ' + esc(room.area) + '</text>');
  o.push('<text x="410" y="157" text-anchor="middle" font-size="10" fill="#111">' + esc(room.mon) + '</text>');
  const ly = limitTxt.length === 3 ? [136, 148, 160] : [141, 156];
  limitTxt.forEach(function (t, i) { o.push('<text x="945" y="' + ly[i] + '" text-anchor="middle" font-size="9.5" font-weight="' + (i === 0 ? 700 : 600) + '" fill="#111">' + esc(t) + '</text>'); });

  // ----- latar kolom: OFF abu-abu, tanggal di luar bulan gelap -----
  days.forEach(function (d, i) {
    if (d.day > dim) o.push('<rect x="' + cx(i) + '" y="' + Y_HDR + '" width="' + CW + '" height="' + (yEnd - Y_HDR) + '" fill="#3a3a3a"/>');
    else if (d.off) o.push('<rect x="' + cx(i) + '" y="' + yBar + '" width="' + CW + '" height="' + (yEnd - yBar) + '" fill="#cbd5e1"/>');
  });
  // baris Action Limit (suhu/RH) diberi warna lembut
  if (isDP) o.push('<rect x="' + X0 + '" y="' + yRowsEnd + '" width="' + (GR - X0) + '" height="' + botH + '" fill="#cfe3f3"/>');
  // OFF/di luar bulan harus tetap menimpa tint
  days.forEach(function (d, i) {
    if (d.day > dim) o.push('<rect x="' + cx(i) + '" y="' + Y_HDR + '" width="' + CW + '" height="' + (yEnd - Y_HDR) + '" fill="#3a3a3a"/>');
    else if (d.off) o.push('<rect x="' + cx(i) + '" y="' + yBar + '" width="' + CW + '" height="' + (yEnd - yBar) + '" fill="#cbd5e1"/>');
  });

  // bar hitam Diatas / Dibawah limit
  if (!isDP) {
    o.push('<rect x="' + GX + '" y="' + yBar + '" width="' + GW + '" height="' + topH + '" fill="#111"/>');
    o.push('<rect x="' + GX + '" y="' + yRowsEnd + '" width="' + GW + '" height="' + botH + '" fill="#111"/>');
  }

  // ----- garis grid -----
  const g = [];
  g.push('M' + X0 + ' ' + Y_HDR + 'H' + GR);                       // atas
  g.push('M' + X0 + ' ' + yBar + 'H' + GR);                         // bawah header
  for (let i = 0; i <= 31; i++) g.push('M' + cx(i) + ' ' + Y_HDR + 'V' + yEnd);
  g.push('M' + (X0 + LABW) + ' ' + yBar + 'V' + yBotEnd);            // pemisah label | nilai
  if (!isDP) { g.push('M' + X0 + ' ' + y0 + 'H' + GR); }
  for (let r = 1; r < n; r++) {
    const yy = y0 + r * rh;
    g.push('M' + (X0 + LABW) + ' ' + yy + 'H' + GR);
  }
  [yRowsEnd, yBotEnd, yJam, yOp, ySpv, yCat, yEnd].forEach(function (yy) { g.push('M' + X0 + ' ' + yy + 'H' + GR); });
  g.push('M' + X0 + ' ' + Y_HDR + 'V' + yEnd);
  o.push('<path d="' + g.join('') + '" stroke="#333" stroke-width="0.6" fill="none"/>');
  o.push('<rect x="' + X0 + '" y="' + Y_HDR + '" width="' + (GR - X0) + '" height="' + (yEnd - Y_HDR) + '" fill="none" stroke="#111" stroke-width="1.3"/>');

  // ----- label kiri -----
  o.push('<text x="' + (X0 + (LABW + VALW) / 2) + '" y="' + (Y_HDR + 13) + '" text-anchor="middle" font-size="9.5" font-weight="700" fill="#111">Tgl</text>');
  days.forEach(function (d, i) { if (d.day <= dim) o.push('<text x="' + cmid(i) + '" y="' + (Y_HDR + 13) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#111">' + d.day + '</text>'); });
  if (!isDP) {
    o.push('<text x="' + (X0 + 5) + '" y="' + (yBar + 8) + '" font-size="8" fill="#111">Diatas Limit</text>');
    o.push('<text x="' + (X0 + 5) + '" y="' + (yRowsEnd + 8) + '" font-size="8" fill="#111">Dibawah Limit</text>');
    o.push('<text x="' + (X0 + LABW / 2) + '" y="' + (y0 + (n * rh) / 2 + 3) + '" text-anchor="middle" font-size="8.5" fill="#111">Limit Spesifikasi</text>');
  } else {
    o.push('<text x="' + (X0 + LABW / 2) + '" y="' + (y0 + (n * rh) / 2 + 3) + '" text-anchor="middle" font-size="8.5" fill="#111">Tekanan (Pa)</text>');
    o.push('<text x="' + (X0 + 5) + '" y="' + (yRowsEnd + 9) + '" font-size="8" font-weight="700" fill="#111">Dibawah Limit</text>');
  }
  rowsVal.forEach(function (v, r) { o.push('<text x="' + (X0 + LABW + VALW / 2) + '" y="' + (y0 + r * rh + rh / 2 + 3) + '" text-anchor="middle" font-size="8.5" fill="#111">' + v + '</text>'); });
  [['valH', yVal, valH, unitLabel, 10], ['jam', yJam, jamH, 'Jam', 9], ['op', yOp, opH, 'Dicatat oleh', 9], ['spv', ySpv, spvH, 'Ditinjau oleh Spv Area', 8.5], ['cat', yCat, catH, 'Catatan', 9]].forEach(function (L) {
    o.push('<text x="' + (X0 + 5) + '" y="' + (L[1] + L[2] / 2 + 3) + '" font-size="' + L[4] + '" font-weight="700" fill="#111">' + esc(L[3]) + '</text>');
  });

  // ----- garis batas DP (alert & action) -----
  limitLines.forEach(function (L) {
    if (L.v < sBot || L.v > top) return;
    const yy = yOf(L.v);
    o.push('<line x1="' + GX + '" y1="' + yy + '" x2="' + cx(dim) + '" y2="' + yy + '" stroke="' + L.c + '" stroke-width="1.2" stroke-dasharray="5 3"/>');
  });

  // ----- seri data: putus di hari OFF -----
  const segs = []; let cur = [];
  const titik = [];
  days.forEach(function (d, i) {
    if (d.day > dim) return;
    if (d.off) { if (cur.length) segs.push(cur); cur = []; return; }
    if (hasVal(d[key]) && !(isDP === false && tipe !== 'dp' && false)) {
      const v = Number(d[key]);
      const p = { x: cmid(i), y: yOf(v), v: v };
      cur.push(p); titik.push(p);
    }
  });
  if (cur.length) segs.push(cur);
  segs.forEach(function (sg) { if (sg.length > 1) o.push('<polyline points="' + sg.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ') + '" fill="none" stroke="' + warna + '" stroke-width="1.7" stroke-linejoin="round"/>'); });
  titik.forEach(function (p) {
    let c = warna;
    if (isDP) {
      const aD = limitLines[0].v, cD = limitLines[1].v;
      if (aD >= cD) c = p.v <= cD ? '#dc2626' : (p.v <= aD ? '#f59e0b' : warna);
      else c = p.v >= cD ? '#dc2626' : (p.v >= aD ? '#f59e0b' : warna);
    } else if (p.v < lo || p.v > hi) c = '#dc2626';
    o.push('<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3.3" fill="' + c + '" stroke="#fff" stroke-width="0.8"/>');
  });

  // ----- baris data bawah -----
  days.forEach(function (d, i) {
    if (d.day > dim) return;
    const mx = cmid(i);
    if (d.off) {
      o.push('<text transform="translate(' + (mx + 3.5) + ',' + (y0 + (n * rh) / 2) + ') rotate(-90)" text-anchor="middle" font-size="11" font-weight="800" fill="#475569" letter-spacing="2">OFF</text>');
      o.push('<text x="' + mx + '" y="' + (yVal + valH / 2 + 3) + '" text-anchor="middle" font-size="8" font-weight="800" fill="#475569">OFF</text>');
      return;
    }
    if (hasVal(d[key])) o.push('<text x="' + mx + '" y="' + (yVal + valH / 2 + 3) + '" text-anchor="middle" font-size="8.5" font-weight="700" fill="#111">' + esc(d[key]) + '</text>');
    if (d.jam) o.push('<text x="' + mx + '" y="' + (yJam + jamH / 2 + 2.5) + '" text-anchor="middle" font-size="6.8" fill="#111">' + esc(d.jam) + '</text>');
    if (d.operator) o.push('<text x="' + mx + '" y="' + (yOp + opH / 2 + 3) + '" text-anchor="middle" font-size="' + (String(d.operator).length > 3 ? 6.3 : 8) + '" font-weight="700" fill="#111">' + esc(d.operator) + '</text>');
    if (d.catatan) {
      const t = String(d.catatan); const tt = t.length > 15 ? t.slice(0, 14) + '…' : t;
      o.push('<text transform="translate(' + (mx + 2.5) + ',' + (yCat + catH - 3) + ') rotate(-90)" font-size="6.5" fill="#111">' + esc(tt) + '</text>');
    }
  });

  // ----- footer -----
  footLines.forEach(function (t, i) { o.push('<text x="' + X0 + '" y="' + (yFoot + i * 11) + '" font-size="8.5" fill="#111">' + esc(t) + '</text>'); });
  const yL = H - 10;
  o.push('<circle cx="' + (X0 + 5) + '" cy="' + (yL - 3) + '" r="3.3" fill="' + warna + '"/><text x="' + (X0 + 13) + '" y="' + yL + '" font-size="8" fill="#334155">Normal</text>');
  o.push('<circle cx="' + (X0 + 62) + '" cy="' + (yL - 3) + '" r="3.3" fill="#dc2626"/><text x="' + (X0 + 70) + '" y="' + yL + '" font-size="8" fill="#334155">Di luar limit / Action</text>');
  if (isDP) o.push('<circle cx="' + (X0 + 175) + '" cy="' + (yL - 3) + '" r="3.3" fill="#f59e0b"/><text x="' + (X0 + 183) + '" y="' + yL + '" font-size="8" fill="#334155">Alert</text>');
  o.push('<rect x="' + (X0 + 225) + '" y="' + (yL - 8) + '" width="10" height="9" fill="#cbd5e1" stroke="#64748b" stroke-width="0.5"/><text x="' + (X0 + 240) + '" y="' + yL + '" font-size="8" fill="#334155">Hari libur (OFF)</text>');
  o.push('<text x="' + GR + '" y="' + yL + '" text-anchor="end" font-size="8" fill="#64748b">' + esc(room.id) + ' · ' + esc(labelBulan(yearMonth)) + '</text>');
  o.push('</svg>');
  return o.join('');
}

function jenisSheetRuangan(room) {
  const t = [];
  if (room.jenis.indexOf('°C') >= 0) t.push('suhu');
  if (room.jenis.indexOf('%RH') >= 0) t.push('rh');
  if (room.jenis.indexOf('Pa') >= 0) t.push('dp');
  return t;
}

function renderSheetsGrafik(room, days, yearMonth) {
  const box = document.getElementById('sheetsContainer');
  if (!box || !room) return;
  LAST_SHEET = { room: room, days: days, yearMonth: yearMonth, spv: LAST_SHEET_SPV || '' };
  box.innerHTML = jenisSheetRuangan(room).map(function (t) {
    return '<div class="sheet-card"><div class="sheet-scroll"><div class="sheet-inner">' + buatSheetSVG(t, room, days, yearMonth, LAST_SHEET.spv) + '</div></div></div>';
  }).join('');
}

/** Cetak: satu halaman A4 landscape per jenis ukur (Suhu, RH, DP), tanggal 1-31 */
function cetakGrafikA4() {
  if (!LAST_SHEET) { showToast('Data grafik belum dimuat, tunggu sebentar.'); return; }
  const old = document.getElementById('printArea'); if (old) old.remove();
  const L = LAST_SHEET;
  const pa = document.createElement('div');
  pa.id = 'printArea';
  pa.innerHTML = jenisSheetRuangan(L.room).map(function (t) {
    return '<div class="print-page">' + buatSheetSVG(t, L.room, L.days, L.yearMonth, L.spv) + '</div>';
  }).join('');
  document.body.appendChild(pa);
  const judulLama = document.title;
  document.title = 'Monitoring_' + String(L.room.id).replace(/[^\w-]/g, '') + '_' + L.yearMonth;
  const bersih = function () { document.title = judulLama; window.removeEventListener('afterprint', bersih); };
  window.addEventListener('afterprint', bersih);
  setTimeout(function () { window.print(); }, 80);
}

/* ---------- 4. NAVIGASI & MODAL ---------- */
function switchTab(tabName, element) {
  CURRENT_TAB = tabName;
  STATUS_REQ++; // batalkan respons status tab sebelumnya
  document.querySelectorAll('.nav-item').forEach(function (nav) { nav.classList.remove('active'); });
  if (element) element.classList.add('active');
  if (tabName === 'Master') renderMasterData();
  else if (tabName === 'Grafik') renderHalamanGrafik();
  else renderInputForms(tabName);
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

/* ---------- OPERATOR (dropdown, tersimpan di sheet "Operator") ---------- */
function renderOperatorOptions(pilih) {
  const sel = document.getElementById('ctrlOperator');
  if (!sel) return;
  const saved = pilih || sel.value || lsGet('FIMA_OPERATOR') || '';
  if (!OPERATORS.length) {
    sel.innerHTML = '<option value="">— Belum ada operator, tekan + —</option>';
    return;
  }
  sel.innerHTML = '<option value="">— Pilih operator —</option>' + OPERATORS.map(function (o) {
    return '<option value="' + esc(o.inisial) + '">' + esc(o.inisial) + (o.nama ? ' — ' + esc(o.nama) : '') + '</option>';
  }).join('');
  const ada = OPERATORS.some(function (o) { return o.inisial === saved; });
  sel.value = ada ? saved : '';
}

function onOperatorChange() {
  const v = document.getElementById('ctrlOperator').value;
  if (v) lsSet('FIMA_OPERATOR', v);
}

function muatOperator() {
  gs('getOperators', [], function (res) {
    if (Array.isArray(res)) {
      OPERATORS = res;
      lsSet('FIMA_OPERATORS', JSON.stringify(res));
      renderOperatorOptions();
      renderDaftarOperator();
    }
  }, function (e) { /* gagal -> pakai cache lokal */ });
}

function renderDaftarOperator() {
  const box = document.getElementById('opList');
  if (!box) return;
  if (!OPERATORS.length) { box.innerHTML = '<div class="op-empty">Belum ada operator. Tambahkan inisial di bawah.</div>'; return; }
  box.innerHTML = OPERATORS.map(function (o) {
    return '<div class="op-item"><span>' + esc(o.inisial) + (o.nama ? '<small>' + esc(o.nama) + '</small>' : '') + '</span>' +
      '<button type="button" class="op-del" title="Hapus" onclick="hapusOperator(\'' + esc(o.inisial).replace(/'/g, '') + '\')"><i class="fas fa-trash"></i></button></div>';
  }).join('');
}

function bukaModalOperator() {
  renderDaftarOperator();
  document.getElementById('opInisial').value = '';
  document.getElementById('opNama').value = '';
  document.getElementById('operatorModal').style.display = 'flex';
  muatOperator();
}
function tutupModalOperator() { document.getElementById('operatorModal').style.display = 'none'; }

function simpanOperatorBaru(e) {
  e.preventDefault();
  const ini = document.getElementById('opInisial').value.trim().toUpperCase();
  const nama = document.getElementById('opNama').value.trim();
  if (!ini) return;
  const btn = document.getElementById('btnSimpanOp');
  btn.disabled = true;
  gs('saveOperator', [{ inisial: ini, nama: nama }], function (res) {
    btn.disabled = false;
    showToast(res.message);
    if (res.success === false) return;
    document.getElementById('opInisial').value = '';
    document.getElementById('opNama').value = '';
    OPERATORS = res.operators || OPERATORS;
    lsSet('FIMA_OPERATORS', JSON.stringify(OPERATORS));
    renderOperatorOptions(ini);
    onOperatorChange();
    renderDaftarOperator();
  }, function (err) {
    btn.disabled = false;
    alert('Gagal menyimpan operator: ' + (err && err.message ? err.message : err));
  });
}

function hapusOperator(ini) {
  if (!confirm('Hapus operator ' + ini + ' dari daftar? (Data lama yang sudah tersimpan tidak berubah)')) return;
  gs('deleteOperator', [ini], function (res) {
    showToast(res.message);
    OPERATORS = res.operators || OPERATORS;
    lsSet('FIMA_OPERATORS', JSON.stringify(OPERATORS));
    renderOperatorOptions();
    renderDaftarOperator();
  }, function (err) { alert('Gagal menghapus operator: ' + (err && err.message ? err.message : err)); });
}

function bukaModalMaster() {
  document.getElementById('modalTitle').innerText = 'Tambah Ruangan & Limit Baru';
  document.getElementById('mRowIndex').value = '';
  document.getElementById('mNo').value = '';
  document.getElementById('mId').value = '';
  document.getElementById('mNama').value = '';
  document.getElementById('mMon').value = '';
  document.getElementById('mJenis').value = '°C, %RH, Pa';
  document.getElementById('mArea').value = 'Line 1';
  document.getElementById('mStatus').value = 'Aktif';
  document.getElementById('mAlertDP').value = 10;
  document.getElementById('mActionDP').value = 5;
  document.getElementById('mSuhuMin').value = 16;
  document.getElementById('mSuhuMax').value = 25;
  document.getElementById('mRhMin').value = 45;
  document.getElementById('mRhMax').value = 65;
  document.getElementById('masterModal').style.display = 'flex';
}

function editMasterItem(no) {
  const item = MASTER_DATA.find(function (m) { return m.no === no; });
  if (!item) return;
  document.getElementById('modalTitle').innerText = 'Atur Limit Ruangan #' + item.no + ' (' + item.id + ')';
  document.getElementById('mRowIndex').value = item.rowIndex || (item.no + 1);
  document.getElementById('mNo').value = item.no;
  document.getElementById('mId').value = item.id;
  document.getElementById('mNama').value = item.nama;
  document.getElementById('mMon').value = item.mon;
  document.getElementById('mJenis').value = item.jenis;
  document.getElementById('mArea').value = item.area;
  document.getElementById('mStatus').value = item.status || 'Aktif';
  document.getElementById('mAlertDP').value = item.alertDP;
  document.getElementById('mActionDP').value = item.actionDP;
  document.getElementById('mSuhuMin').value = item.suhuMin;
  document.getElementById('mSuhuMax').value = item.suhuMax;
  document.getElementById('mRhMin').value = item.rhMin;
  document.getElementById('mRhMax').value = item.rhMax;
  document.getElementById('masterModal').style.display = 'flex';
}

function tutupModalMaster() { document.getElementById('masterModal').style.display = 'none'; }

function simpanMasterForm(e) {
  e.preventDefault();
  const g = function (id) { return document.getElementById(id).value; };
  const payload = {
    rowIndex: g('mRowIndex'), no: g('mNo'), id: g('mId'), nama: g('mNama'), mon: g('mMon'),
    jenis: g('mJenis'), area: g('mArea'), status: g('mStatus'),
    alertDP: g('mAlertDP'), actionDP: g('mActionDP'),
    suhuMin: g('mSuhuMin'), suhuMax: g('mSuhuMax'), rhMin: g('mRhMin'), rhMax: g('mRhMax')
  };
  gs('saveMasterData', [payload], function (res) {
    tutupModalMaster();
    showToast(res.message);
    syncMasterFromSheets();
  }, function (err) {
    alert('Gagal menyimpan master: ' + (err && err.message ? err.message : err));
  });
}
</script>
</body>
</html>
`;