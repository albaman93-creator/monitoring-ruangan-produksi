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


/* ---------- Registrasi tab form (dipanggil dari line1.js, line2.js, logistic.js, loker.js) ---------- */
function registerFormTab(name, opts) {
  opts = opts || {};
  TAB_RENDERERS[name] = function (tab) {
    renderInputForms(tab);
    document.querySelectorAll('#mainContent .form-card').forEach(function (c) { c.setAttribute('data-tab', tab); });
    if (typeof opts.afterRender === 'function') opts.afterRender(tab);
  };
}
