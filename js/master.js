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

TAB_RENDERERS['Master'] = renderMasterData;
