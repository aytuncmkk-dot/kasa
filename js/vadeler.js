// ============================================================
// VADELER — Cari bazlı vade takip ve bütçe planlaması
// Bağımlılık: db.js, utils.js, config.js (cariVadeler, cariler, today)
// ============================================================

var _vadeDuzId    = null;
var _vadeOdemeId  = null;
var _vadeAcikCari = null;   // Açık (expand) cari_id

// ---- YARDIMCILAR ----

function _vadeCariAdi(cari_id) {
  if(!window.cariler) return 'Cari #'+cari_id;
  var c = cariler.find(function(x){ return x.id === cari_id; });
  return c ? c.ad : 'Cari #'+cari_id;
}

function _vadeKalanGun(vade_tarihi) {
  var bugun = new Date(today+'T00:00:00');
  var vade  = new Date(vade_tarihi+'T00:00:00');
  return Math.round((vade - bugun) / 86400000);
}

function _vadeRenk(kalan, odendi) {
  if(odendi)     return {bg:'#f3f4f6', text:'#9ca3af'};
  if(kalan < 0)  return {bg:'#fef2f2', text:'#dc2626'};
  if(kalan <= 7) return {bg:'#fef9e7', text:'#92400e'};
  return {bg:'', text:'#374151'};
}

function _vadeKalanMetin(kalan, odendi) {
  if(odendi)      return '—';
  if(kalan < 0)   return Math.abs(kalan)+' gün geçti';
  if(kalan === 0) return 'Bugün!';
  return kalan+' gün kaldı';
}

// ---- SEKME AÇILIŞI ----

function vadeSecmeAc() {
  renderVadeBudget();
  renderVadeler();
}

// ---- BÜTÇE ÖZETİ ----

function renderVadeBudget() {
  var el = document.getElementById('vd-budget');
  if(!el) return;
  var bugun = new Date(today+'T00:00:00');

  function topla(gun) {
    return cariVadeler.filter(function(v) {
      if(v.odendi) return false;
      var vt = new Date(v.vade_tarihi+'T00:00:00');
      return vt <= new Date(bugun.getTime() + gun*86400000);
    });
  }

  function kart(baslik, gun, kenarRenk) {
    var liste  = topla(gun);
    var toplam = liste.reduce(function(s,v){ return s+Number(v.tutar); }, 0);
    return '<div class="ok" style="flex:1;min-width:130px;border-top:3px solid '+kenarRenk+'">'+
      '<div class="ok-label">'+baslik+'</div>'+
      '<div class="ok-val rc">'+para(toplam)+'</div>'+
      '<div style="font-size:11px;color:#6b7280;margin-top:4px">'+liste.length+' ödeme</div>'+
    '</div>';
  }

  var gecikmis    = cariVadeler.filter(function(v){
    return !v.odendi && _vadeKalanGun(v.vade_tarihi) < 0;
  });
  var gecikmisDeg = gecikmis.reduce(function(s,v){ return s+Number(v.tutar); }, 0);

  var gecHTML = '';
  if(gecikmis.length) {
    gecHTML = '<div class="ok" style="flex:1;min-width:130px;border-top:3px solid #dc2626;background:#fef2f2">'+
      '<div class="ok-label" style="color:#991b1b">GECİKMİŞ</div>'+
      '<div class="ok-val" style="color:#dc2626">'+para(gecikmisDeg)+'</div>'+
      '<div style="font-size:11px;color:#991b1b;margin-top:4px">'+gecikmis.length+' ödeme</div>'+
    '</div>';
  }

  el.innerHTML =
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">'+
      gecHTML+
      kart('30 Gün İçinde', 30, '#f59e0b')+
      kart('60 Gün İçinde', 60, '#3b82f6')+
      kart('90 Gün İçinde', 90, '#6b7280')+
    '</div>';
}

// ---- CARİ BAZLI ANA LİSTE ----

function renderVadeler() {
  var el  = document.getElementById('vd-cariler-listesi');
  var emp = document.getElementById('vd-empty');
  if(!el) return;

  var cariIdler = [];
  cariVadeler.forEach(function(v) {
    if(cariIdler.indexOf(v.cari_id) === -1) cariIdler.push(v.cari_id);
  });

  cariIdler.sort(function(a, b) {
    return _vadeCariAdi(a).localeCompare(_vadeCariAdi(b), 'tr');
  });

  if(!cariIdler.length) {
    el.innerHTML = '';
    if(emp) emp.style.display = 'block';
    return;
  }
  if(emp) emp.style.display = 'none';

  el.innerHTML = cariIdler.map(function(cari_id) {
    var tumVadeler  = cariVadeler.filter(function(v){ return v.cari_id === cari_id; });
    var bekleyenler = tumVadeler.filter(function(v){ return !v.odendi; });
    var toplam      = bekleyenler.reduce(function(s,v){ return s+Number(v.tutar); }, 0);
    var enErken     = bekleyenler.reduce(function(min, v){
      return (!min || v.vade_tarihi < min) ? v.vade_tarihi : min;
    }, null);
    var minKalan    = enErken !== null ? _vadeKalanGun(enErken) : null;
    var renk        = minKalan !== null ? _vadeRenk(minKalan, false) : {bg:'#f9fafb', text:'#9ca3af'};
    var acik        = _vadeAcikCari === cari_id;

    var durumChip = '';
    if(minKalan !== null) {
      var chipLabel = minKalan < 0
        ? Math.abs(minKalan)+' gün geçti'
        : minKalan === 0 ? 'Bugün!'
        : minKalan+' gün kaldı';
      durumChip = '<span style="font-size:11px;padding:2px 10px;border-radius:10px;background:'
        +renk.bg+';color:'+renk.text+';font-weight:600;white-space:nowrap">'+chipLabel+'</span>';
    }

    return '<div style="margin-bottom:10px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">'+
      '<div onclick="vadeCariToggle('+cari_id+')" style="cursor:pointer;display:flex;align-items:center;gap:12px;padding:12px 16px;background:'+(acik?'#f8fafc':'#fff')+';user-select:none">'+
        '<div style="flex:1;font-weight:600;font-size:14px;color:#1f2937">'+htmlEsc(_vadeCariAdi(cari_id))+'</div>'+
        (bekleyenler.length ? '<div style="font-size:12px;color:#6b7280">'+bekleyenler.length+' bekleyen</div>' : '')+
        '<div style="font-weight:600;font-size:14px;color:'+(toplam>0?'#dc2626':'#374151')+'">'+para(toplam)+'</div>'+
        durumChip+
        '<span style="font-size:14px;color:#9ca3af;min-width:16px;text-align:center">'+(acik?'▲':'▼')+'</span>'+
      '</div>'+
      (acik ? _vadeKartDetay(cari_id, tumVadeler) : '')+
    '</div>';
  }).join('');
}

function _vadeKartDetay(cari_id, tumVadeler) {
  var sirali = tumVadeler.slice().sort(function(a,b){
    if(a.odendi !== b.odendi) return a.odendi ? 1 : -1;
    return a.vade_tarihi < b.vade_tarihi ? -1 : a.vade_tarihi > b.vade_tarihi ? 1 : 0;
  });

  var satirlar = sirali.map(function(v) {
    var kalan = _vadeKalanGun(v.vade_tarihi);
    var renk  = _vadeRenk(kalan, v.odendi);
    return '<tr style="'+(renk.bg?'background:'+renk.bg:'')+'">'+
      '<td>'+fmtT(v.vade_tarihi)+'</td>'+
      '<td style="text-align:right;font-weight:500;color:'+(v.odendi?'#9ca3af':'#1a1a1a')+'">'+para(v.tutar)+'</td>'+
      '<td style="color:'+renk.text+';font-size:12px;font-weight:500">'+_vadeKalanMetin(kalan, v.odendi)+'</td>'+
      '<td style="color:#888;font-size:12px">'+(v.fatura_no||'—')+'</td>'+
      '<td style="color:#888;font-size:12px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(v.aciklama||'—')+'</td>'+
      '<td>'+
        (v.odendi
          ? '<span style="background:#E1F5EE;color:#0F6E56;border-radius:12px;padding:2px 8px;font-size:11px;font-weight:600;white-space:nowrap">✓ Ödendi</span>'+
            (v.odeme_tarihi ? '<br><small style="color:#9ca3af">'+fmtT(v.odeme_tarihi)+'</small>' : '')
          : '<button onclick="vadeOdendiAc('+v.id+')" class="btn btn-g" style="font-size:11px;padding:2px 8px;white-space:nowrap">Ödendi</button>')+
      '</td>'+
      '<td style="white-space:nowrap">'+
        '<button onclick="vadeDuzenle('+v.id+')" style="background:none;border:none;cursor:pointer;color:#185FA5;font-size:13px;padding:2px 5px" title="Düzenle">✏️</button>'+
        (!v.odendi ? '<button onclick="vadeSil('+v.id+')" style="background:none;border:none;cursor:pointer;color:#D85A30;font-size:13px;padding:2px 5px" title="Sil">🗑️</button>' : '')+
      '</td>'+
    '</tr>';
  }).join('');

  return '<div style="padding:0 16px 16px 16px">'+
    '<div style="overflow-x:auto;margin-bottom:12px">'+
    '<table class="table" style="width:100%;min-width:520px;font-size:13px">'+
    '<thead><tr>'+
    '<th>Vade Tarihi</th><th style="text-align:right">Tutar</th><th>Durum</th>'+
    '<th>Fatura No</th><th>Açıklama</th><th>Ödeme</th><th></th>'+
    '</tr></thead>'+
    '<tbody>'+satirlar+'</tbody>'+
    '</table>'+
    '</div>'+
    '<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:12px">'+
    '<div style="font-size:11px;font-weight:600;color:#374151;margin-bottom:8px;text-transform:uppercase;letter-spacing:.3px">Yeni Vade Ekle</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px">'+
    '<div class="field"><label>Tutar (TL) *</label>'+
    '<input type="number" id="vd-yt-'+cari_id+'" placeholder="0.00" min="0" step="0.01" style="width:100%"></div>'+
    '<div class="field"><label>Vade Tarihi *</label>'+
    '<input type="date" id="vd-ytarih-'+cari_id+'" style="width:100%"></div>'+
    '<div class="field"><label>Fatura No</label>'+
    '<input type="text" id="vd-yfat-'+cari_id+'" style="width:100%"></div>'+
    '<div class="field"><label>Açıklama</label>'+
    '<input type="text" id="vd-yacik-'+cari_id+'" style="width:100%"></div>'+
    '</div>'+
    '<button class="btn btn-p" onclick="vadeEkle('+cari_id+')" style="margin-top:8px;font-size:12px">Vade Ekle</button>'+
    '</div>'+
  '</div>';
}

function vadeCariToggle(cari_id) {
  _vadeAcikCari = (_vadeAcikCari === cari_id) ? null : cari_id;
  renderVadeler();
}

// ---- YENİ CARİ TAKİBE AL ----

function vadeTakipAc() {
  _vadeTakipCariSelectDoldur();
  document.getElementById('vd-tak-tutar').value = '';
  document.getElementById('vd-tak-tarih').value = '';
  document.getElementById('vd-tak-fatno').value = '';
  document.getElementById('vd-tak-acik').value  = '';
  document.getElementById('vd-takip-modal').classList.add('open');
}

function vadeTakipKapat() {
  document.getElementById('vd-takip-modal').classList.remove('open');
}

function _vadeTakipCariSelectDoldur() {
  if(!window.cariler) return;
  var takipteOlanlar = [];
  cariVadeler.forEach(function(v){
    if(takipteOlanlar.indexOf(v.cari_id) === -1) takipteOlanlar.push(v.cari_id);
  });
  var bos  = '<option value="">— Cari seçin —</option>';
  var opts = cariler
    .filter(function(c){ return takipteOlanlar.indexOf(c.id) === -1; })
    .slice().sort(function(a,b){ return a.ad.localeCompare(b.ad,'tr'); })
    .map(function(c){ return '<option value="'+c.id+'">'+htmlEsc(c.ad)+'</option>'; })
    .join('');
  var el = document.getElementById('vd-tak-cari');
  if(el) el.innerHTML = bos + opts;
}

async function vadeTakipKaydet() {
  var cari_id = Number(document.getElementById('vd-tak-cari').value);
  var tutar   = parseFloat(document.getElementById('vd-tak-tutar').value);
  var tarih   = document.getElementById('vd-tak-tarih').value;
  var fatno   = document.getElementById('vd-tak-fatno').value.trim();
  var acik    = document.getElementById('vd-tak-acik').value.trim();
  if(!cari_id)           { alert('Lütfen bir cari seçin.'); return; }
  if(!tarih)             { alert('Vade tarihi zorunludur.'); return; }
  if(isNaN(tutar)||tutar<=0) { alert('Geçerli bir tutar girin.'); return; }
  var yeni = {cari_id:cari_id, tutar:tutar, vade_tarihi:tarih, fatura_no:fatno||null, aciklama:acik||null};
  var r = await dbPost('cari_vadeler', yeni);
  if(!r||!r.ok) { alert('Kayıt hatası!'); return; }
  cariVadeler = await dbGetAll('cari_vadeler','select=*&order=vade_tarihi.asc');
  _vadeAcikCari = cari_id;
  vadeTakipKapat();
  renderVadeBudget();
  renderVadeler();
  renderVadeUyarilari();
  if(typeof renderCariler==='function') renderCariler();
}

// ---- VAR OLAN CARİYE VADE EKLE ----

async function vadeEkle(cari_id) {
  var tutar = parseFloat(document.getElementById('vd-yt-'+cari_id).value);
  var tarih = document.getElementById('vd-ytarih-'+cari_id).value;
  var fatno = document.getElementById('vd-yfat-'+cari_id).value.trim();
  var acik  = document.getElementById('vd-yacik-'+cari_id).value.trim();
  if(!tarih)             { alert('Vade tarihi zorunludur.'); return; }
  if(isNaN(tutar)||tutar<=0) { alert('Geçerli bir tutar girin.'); return; }
  var yeni = {cari_id:cari_id, tutar:tutar, vade_tarihi:tarih, fatura_no:fatno||null, aciklama:acik||null};
  var r = await dbPost('cari_vadeler', yeni);
  if(!r||!r.ok) { alert('Kayıt hatası!'); return; }
  cariVadeler = await dbGetAll('cari_vadeler','select=*&order=vade_tarihi.asc');
  _vadeAcikCari = cari_id;
  renderVadeBudget();
  renderVadeler();
  renderVadeUyarilari();
  if(typeof renderCariler==='function') renderCariler();
}

// ---- UYARI BANNER ----

function renderVadeUyarilari() {
  var el = document.getElementById('vade-uyari-banner');
  if(!el || !window.cariVadeler) return;

  var gecikmis = cariVadeler.filter(function(v){
    return !v.odendi && _vadeKalanGun(v.vade_tarihi) < 0;
  });
  var buHafta = cariVadeler.filter(function(v){
    var k = _vadeKalanGun(v.vade_tarihi);
    return !v.odendi && k >= 0 && k <= 7;
  });

  var html = '';
  if(gecikmis.length) {
    var gTop = gecikmis.reduce(function(s,v){ return s+Number(v.tutar); }, 0);
    html += '<div class="uyari" style="margin-bottom:6px;cursor:pointer" onclick="switchTab(\'vadeler\')">'+
      '⚠️ <strong>'+gecikmis.length+' ödemede '+para(gTop)+' tutarında gecikmiş vade var.</strong> '+
      '<span style="text-decoration:underline;font-size:11px">Vadeler → </span>'+
    '</div>';
  }
  if(buHafta.length) {
    var hTop = buHafta.reduce(function(s,v){ return s+Number(v.tutar); }, 0);
    html += '<div class="bilgi" style="margin-bottom:6px;cursor:pointer" onclick="switchTab(\'vadeler\')">'+
      '🔔 Bu hafta içinde <strong>'+buHafta.length+' vade</strong> var: '+para(hTop)+'. '+
      '<span style="text-decoration:underline;font-size:11px">Detay → </span>'+
    '</div>';
  }

  el.style.display = html ? 'block' : 'none';
  el.innerHTML = html;
}

// ---- DÜZENLE MODAL ----

function _vadeDuzCariSelectDoldur() {
  if(!window.cariler) return;
  var bos  = '<option value="">— Cari seçin —</option>';
  var opts = cariler.slice().sort(function(a,b){ return a.ad.localeCompare(b.ad,'tr'); })
    .map(function(c){ return '<option value="'+c.id+'">'+htmlEsc(c.ad)+'</option>'; }).join('');
  var el = document.getElementById('vd-duz-cari');
  if(el) el.innerHTML = bos + opts;
}

function vadeDuzenle(id) {
  var v = cariVadeler.find(function(x){ return x.id === id; });
  if(!v) return;
  _vadeDuzId = id;
  _vadeDuzCariSelectDoldur();
  document.getElementById('vd-duz-cari').value      = v.cari_id;
  document.getElementById('vd-duz-tutar').value     = v.tutar;
  document.getElementById('vd-duz-tarih').value     = v.vade_tarihi;
  document.getElementById('vd-duz-fatura-no').value = v.fatura_no  || '';
  document.getElementById('vd-duz-aciklama').value  = v.aciklama   || '';
  document.getElementById('vd-duz-modal').classList.add('open');
}

function vadeDuzKapat() {
  document.getElementById('vd-duz-modal').classList.remove('open');
  _vadeDuzId = null;
}

async function vadeDuzKaydet() {
  if(!_vadeDuzId) return;
  var cari_id  = Number(document.getElementById('vd-duz-cari').value);
  var tutar    = parseFloat(document.getElementById('vd-duz-tutar').value);
  var tarih    = document.getElementById('vd-duz-tarih').value;
  var fat_no   = document.getElementById('vd-duz-fatura-no').value.trim();
  var aciklama = document.getElementById('vd-duz-aciklama').value.trim();
  if(!cari_id)           { alert('Lütfen bir cari seçin.'); return; }
  if(!tarih)             { alert('Vade tarihi zorunludur.'); return; }
  if(isNaN(tutar)||tutar<=0) { alert('Geçerli bir tutar girin.'); return; }
  var gunc = {cari_id:cari_id, tutar:tutar, vade_tarihi:tarih, fatura_no:fat_no||null, aciklama:aciklama||null};
  var r = await dbPatch('cari_vadeler','id',_vadeDuzId,gunc);
  if(!r||!r.ok) { alert('Güncelleme hatası!'); return; }
  var idx = cariVadeler.findIndex(function(x){ return x.id === _vadeDuzId; });
  if(idx >= 0) Object.assign(cariVadeler[idx], gunc);
  vadeDuzKapat();
  renderVadeBudget();
  renderVadeler();
  renderVadeUyarilari();
  if(typeof renderCariler==='function') renderCariler();
}

// ---- SİL ----

async function vadeSil(id) {
  if(!confirm('Bu vadeyi silmek istediğinize emin misiniz?')) return;
  var r = await dbDelete('cari_vadeler','id',id);
  if(!r||!r.ok) { alert('Silme hatası!'); return; }
  cariVadeler = cariVadeler.filter(function(v){ return v.id !== id; });
  renderVadeBudget();
  renderVadeler();
  renderVadeUyarilari();
  if(typeof renderCariler==='function') renderCariler();
}

// ---- ÖDENDİ MODAL ----

function vadeOdendiAc(id) {
  _vadeOdemeId = id;
  document.getElementById('vd-odm-tarih').value = today;
  document.getElementById('vd-odm-not').value   = '';
  document.getElementById('vd-odm-modal').classList.add('open');
}

function vadeOdemeKapat() {
  document.getElementById('vd-odm-modal').classList.remove('open');
  _vadeOdemeId = null;
}

async function vadeOdemeKaydet() {
  if(!_vadeOdemeId) return;
  var tarih = document.getElementById('vd-odm-tarih').value;
  var not   = document.getElementById('vd-odm-not').value.trim();
  if(!tarih) { alert('Ödeme tarihi zorunludur.'); return; }
  var gunc = {odendi:true, odeme_tarihi:tarih, odeme_notu:not||null};
  var r = await dbPatch('cari_vadeler','id',_vadeOdemeId,gunc);
  if(!r||!r.ok) { alert('Güncelleme hatası!'); return; }
  var idx = cariVadeler.findIndex(function(x){ return x.id === _vadeOdemeId; });
  if(idx >= 0) Object.assign(cariVadeler[idx], gunc);
  vadeOdemeKapat();
  renderVadeBudget();
  renderVadeler();
  renderVadeUyarilari();
  if(typeof renderCariler==='function') renderCariler();
}
