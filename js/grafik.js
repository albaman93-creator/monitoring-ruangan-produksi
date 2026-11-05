/* ---------- 3. GRAFIK ---------- */
function renderHalamanGrafik() {
  const content = document.getElementById('mainContent');
  document.getElementById('monitoringControlPanel').style.display = 'none';
  document.getElementById('pageTitle').innerText = 'GRAFIK MONITORING (TGL 1-31 x 3 SHIFT)';
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
    if (LAST_SHEET) renderSheetsGrafik(LAST_SHEET.room, LAST_SHEET.days, LAST_SHEET.yearMonth, LAST_SHEET.slots);
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
    tampilkanMetaGrafik(res.room, res.count, res.countSlots);
    renderSheetsGrafik(res.room, res.days, res.yearMonth || yearMonth, res.slots);
  }, function (err) {
    const m = document.getElementById('grafikRoomMeta');
    if (m) m.innerHTML += '<div class="empty-note">Gagal memuat data grafik: ' + (err && err.message ? err.message : err) + '</div>';
  });
}

function tampilkanMetaGrafik(room, count, countSlots) {
  const metaEl = document.getElementById('grafikRoomMeta');
  if (!metaEl || !room) return;
  let note = '';
  if (count === 0) note = '<div class="empty-note">Belum ada data untuk ruangan ini pada bulan/shift yang dipilih.</div>';
  else if (count > 0) note = '<div><strong>Data terisi:</strong> ' + count + ' hari' + (countSlots >= 0 ? ' (' + countSlots + ' shift)' : '') + '</div>';
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

const SHIFT_LIST = ['Shift 1', 'Shift 2', 'Shift 3'];
const NS = SHIFT_LIST.length;   // 3 kolom per tanggal

/** Susun 31 x 3 slot. Pakai res.slots dari server; bila server belum diperbarui, turunkan dari days. */
function buatSlots(days, slots) {
  if (slots && slots.length) return slots;
  const out = [];
  for (let d = 1; d <= 31; d++) {
    const rec = (days || []).filter(function (x) { return x.day === d; })[0];
    SHIFT_LIST.forEach(function (sh, k) {
      if (rec && ((rec.shift === sh) || (!rec.shift && k === 0))) { const c = {}; for (const p in rec) c[p] = rec[p]; c.shift = sh; c.slot = k; out.push(c); }
      else out.push({ day: d, slot: k, shift: sh, dp: '', suhu: '', rh: '', jam: '', operator: '', off: false, catatan: '' });
    });
  }
  return out;
}

/** Teks kecil: horizontal bila muat, kalau tidak diputar vertikal di dalam sel. */
function teksSel(x, yTop, h, t, size, opts) {
  opts = opts || {}; t = String(t);
  const fill = opts.fill || '#111', w = opts.bold ? 700 : 400;
  if (!opts.vertikal && t.length <= (opts.maks || 2)) {
    return '<text x="' + x.toFixed(1) + '" y="' + (yTop + h / 2 + size * 0.35).toFixed(1) + '" text-anchor="middle" font-size="' + size + '" font-weight="' + w + '" fill="' + fill + '">' + esc(t) + '</text>';
  }
  return '<text transform="translate(' + (x + size * 0.35).toFixed(1) + ',' + (yTop + h / 2).toFixed(1) + ') rotate(-90)" text-anchor="middle" font-size="' + size + '" font-weight="' + w + '" fill="' + fill + '">' + esc(t) + '</text>';
}

function inisialSpv(nama) {
  const w = String(nama || '').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '';
  if (w.length === 1) return w[0].length <= 4 ? w[0].toUpperCase() : w[0].slice(0, 3).toUpperCase();
  return w.slice(0, 3).map(function (x) { return x[0]; }).join('').toUpperCase();
}

/**
 * Lembar logsheet (meniru form kertas FIMA) berbentuk SVG, tgl 1-31 dalam satu halaman.
 * tipe: 'suhu' | 'rh' | 'dp'
 */
function buatSheetSVG(tipe, room, days, yearMonth, spvNama, slotsIn) {
  spvNama = spvNama || '';
  const slots = buatSlots(days, slotsIn);
  const W = 1110, X0 = 20, LABW = 84, VALW = 24, GX = X0 + LABW + VALW, GR = W - 20, GW = GR - GX, NC = 31 * NS, CW = GW / NC;
  const dim = hariDalamBulan(yearMonth);
  const isDP = (tipe === 'dp');
  const warna = { suhu: '#7b1fa2', rh: '#1b7f4b', dp: '#0277bd' }[tipe];
  const key = tipe;

  // ----- skala & batas -----
  let top, sBot, rowsVal = [], step, lo, hi, limitLines = [], title, unitLabel, alat, limitTxt = [];
  if (isDP) {
    const aD = hasVal(room.alertDP) ? Number(room.alertDP) : 10, cD = hasVal(room.actionDP) ? Number(room.actionDP) : 5;
    let mx = 0;
    slots.forEach(function (d) { if (!d.off && hasVal(d.dp)) mx = Math.max(mx, Number(d.dp)); });
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
  const Y_HDR = 172, hdrRow1 = 15, hdrH = 26, yBar = Y_HDR + hdrH;
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
  slots.forEach(function (d) {
    if (d.day > dim) return;
    const tag = d.day + '/S' + (d.slot + 1);
    if (d.off) offTgl.push(tag);
    else if (d.catatan && String(d.catatan).trim().toUpperCase() !== 'N/A') notes.push('Tgl ' + d.day + ' S' + (d.slot + 1) + ': ' + d.catatan);
  });
  let footLines = [];
  if (offTgl.length) footLines = footLines.concat(wrapTeks('OFF (tgl/shift): ' + offTgl.join(', '), 205));
  if (notes.length) footLines = footLines.concat(wrapTeks('Catatan: ' + notes.join('  |  '), 205));
  if (footLines.length > 5) { footLines = footLines.slice(0, 5); footLines[4] += ' …'; }
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
  const shade = function () {
    slots.forEach(function (d, i) {
      if (d.day > dim) o.push('<rect x="' + cx(i) + '" y="' + Y_HDR + '" width="' + CW + '" height="' + (yEnd - Y_HDR) + '" fill="#3a3a3a"/>');
      else if (d.off) o.push('<rect x="' + cx(i) + '" y="' + yBar + '" width="' + CW + '" height="' + (yEnd - yBar) + '" fill="#cbd5e1"/>');
    });
  };
  shade();
  // baris Action Limit (DP) diberi warna lembut
  if (isDP) o.push('<rect x="' + X0 + '" y="' + yRowsEnd + '" width="' + (GR - X0) + '" height="' + botH + '" fill="#cfe3f3"/>');
  shade();

  // bar hitam Diatas / Dibawah limit
  if (!isDP) {
    o.push('<rect x="' + GX + '" y="' + yBar + '" width="' + GW + '" height="' + topH + '" fill="#111"/>');
    o.push('<rect x="' + GX + '" y="' + yRowsEnd + '" width="' + GW + '" height="' + botH + '" fill="#111"/>');
  }

  // ----- garis grid -----
  const g = [];
  g.push('M' + X0 + ' ' + Y_HDR + 'H' + GR);                       // atas
  g.push('M' + X0 + ' ' + yBar + 'H' + GR);                         // bawah header
  const gG = [];   // garis pemisah tanggal (lebih tebal); garis tipis = pemisah shift
  for (let i = 0; i <= NC; i++) {
    if (i % NS === 0) gG.push('M' + cx(i) + ' ' + Y_HDR + 'V' + yEnd);
    else g.push('M' + cx(i) + ' ' + (Y_HDR + hdrRow1) + 'V' + yEnd);
  }
  g.push('M' + GX + ' ' + (Y_HDR + hdrRow1) + 'H' + GR);   // pemisah baris tanggal | baris shift
  g.push('M' + (X0 + LABW) + ' ' + yBar + 'V' + yBotEnd);            // pemisah label | nilai
  if (!isDP) { g.push('M' + X0 + ' ' + y0 + 'H' + GR); }
  for (let r = 1; r < n; r++) {
    const yy = y0 + r * rh;
    g.push('M' + (X0 + LABW) + ' ' + yy + 'H' + GR);
  }
  [yRowsEnd, yBotEnd, yJam, yOp, ySpv, yCat, yEnd].forEach(function (yy) { g.push('M' + X0 + ' ' + yy + 'H' + GR); });
  g.push('M' + X0 + ' ' + Y_HDR + 'V' + yEnd);
  o.push('<path d="' + g.join('') + '" stroke="#333" stroke-width="0.35" fill="none"/>');
  o.push('<path d="' + gG.join('') + '" stroke="#222" stroke-width="0.9" fill="none"/>');
  o.push('<rect x="' + X0 + '" y="' + Y_HDR + '" width="' + (GR - X0) + '" height="' + (yEnd - Y_HDR) + '" fill="none" stroke="#111" stroke-width="1.3"/>');

  // ----- label kiri -----
  o.push('<text x="' + (X0 + (LABW + VALW) / 2) + '" y="' + (Y_HDR + 11) + '" text-anchor="middle" font-size="9.5" font-weight="700" fill="#111">Tgl</text>');
  o.push('<text x="' + (X0 + (LABW + VALW) / 2) + '" y="' + (Y_HDR + hdrRow1 + 8) + '" text-anchor="middle" font-size="7" font-weight="700" fill="#111">Shift</text>');
  for (let d = 1; d <= dim; d++) {
    const gx = GX + (d - 1) * NS * CW + (NS * CW) / 2;
    o.push('<text x="' + gx.toFixed(1) + '" y="' + (Y_HDR + 11) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#111">' + d + '</text>');
    for (let k = 0; k < NS; k++) o.push('<text x="' + (GX + ((d - 1) * NS + k) * CW + CW / 2).toFixed(1) + '" y="' + (Y_HDR + hdrRow1 + 8) + '" text-anchor="middle" font-size="5.5" fill="#475569">' + (k + 1) + '</text>');
  }
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
    o.push('<line x1="' + GX + '" y1="' + yy + '" x2="' + cx(dim * NS) + '" y2="' + yy + '" stroke="' + L.c + '" stroke-width="1.2" stroke-dasharray="5 3"/>');
  });

  // ----- seri data: urut per tanggal & shift, putus di slot OFF -----
  const segs = []; let cur = [];
  const titik = [];
  slots.forEach(function (d, i) {
    if (d.day > dim) return;
    if (d.off) { if (cur.length) segs.push(cur); cur = []; return; }
    if (hasVal(d[key])) {
      const v = Number(d[key]);
      const p = { x: cmid(i), y: yOf(v), v: v };
      cur.push(p); titik.push(p);
    }
  });
  if (cur.length) segs.push(cur);
  segs.forEach(function (sg) { if (sg.length > 1) o.push('<polyline points="' + sg.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ') + '" fill="none" stroke="' + warna + '" stroke-width="1.2" stroke-linejoin="round"/>'); });
  titik.forEach(function (p) {
    let c = warna;
    if (isDP) {
      const aD = limitLines[0].v, cD = limitLines[1].v;
      if (aD >= cD) c = p.v <= cD ? '#dc2626' : (p.v <= aD ? '#f59e0b' : warna);
      else c = p.v >= cD ? '#dc2626' : (p.v >= aD ? '#f59e0b' : warna);
    } else if (p.v < lo || p.v > hi) c = '#dc2626';
    o.push('<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="2.4" fill="' + c + '" stroke="#fff" stroke-width="0.6"/>');
  });

  // ----- baris data bawah (tiap tanggal x 3 shift) -----
  const spvIni = inisialSpv(spvNama);
  slots.forEach(function (d, i) {
    if (d.day > dim) return;
    const mx = cmid(i);
    if (d.off) {
      o.push('<text transform="translate(' + (mx + 3) + ',' + (y0 + (n * rh) / 2) + ') rotate(-90)" text-anchor="middle" font-size="9" font-weight="800" fill="#475569" letter-spacing="1.5">OFF</text>');
      o.push(teksSel(mx, yVal, valH, 'OFF', 5.5, { bold: true, fill: '#475569', vertikal: true }));
      return;
    }
    const ada = hasVal(d[key]) || d.jam || d.operator;
    if (hasVal(d[key])) o.push(teksSel(mx, yVal, valH, d[key], 6.5, { bold: true, maks: 2 }));
    if (d.jam) o.push(teksSel(mx, yJam, jamH, d.jam, 5.8, { vertikal: true }));
    if (d.operator) o.push(teksSel(mx, yOp, opH, d.operator, 6.3, { bold: true, maks: 2 }));
    if (ada && spvIni) o.push(teksSel(mx, ySpv, spvH, spvIni, 6.3, { bold: true, maks: 2 }));
    if (d.catatan) {
      const t = String(d.catatan); const tt = t.length > 16 ? t.slice(0, 15) + '…' : t;
      o.push(teksSel(mx, yCat, catH, tt, 5.8, { vertikal: true }));
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

function renderSheetsGrafik(room, days, yearMonth, slots) {
  const box = document.getElementById('sheetsContainer');
  if (!box || !room) return;
  LAST_SHEET = { room: room, days: days, slots: slots || (LAST_SHEET && LAST_SHEET.slots) || null, yearMonth: yearMonth, spv: LAST_SHEET_SPV || '' };
  box.innerHTML = jenisSheetRuangan(room).map(function (t) {
    return '<div class="sheet-card"><div class="sheet-scroll"><div class="sheet-inner">' + buatSheetSVG(t, room, days, yearMonth, LAST_SHEET.spv, LAST_SHEET.slots) + '</div></div></div>';
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
    return '<div class="print-page">' + buatSheetSVG(t, L.room, L.days, L.yearMonth, L.spv, L.slots) + '</div>';
  }).join('');
  document.body.appendChild(pa);
  const judulLama = document.title;
  document.title = 'Monitoring_' + String(L.room.id).replace(/[^\w-]/g, '') + '_' + L.yearMonth;
  const bersih = function () { document.title = judulLama; window.removeEventListener('afterprint', bersih); };
  window.addEventListener('afterprint', bersih);
  setTimeout(function () { window.print(); }, 80);
}


TAB_RENDERERS['Grafik'] = renderHalamanGrafik;
