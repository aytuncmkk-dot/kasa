// ============================================================
// CARİ HESAP — Cari seçilince kayitlar+faturalar otomatik gelir
// Bağımlılık: db.js, utils.js, config.js
// ============================================================

var _vadeDuzId   = null;
var _vadeOdemeId = null;
var _vdSeciliCari = null;

// ---- YARDIMCILAR ----

function _vadeCariAdi(cari_id) {
  if(!window.cariler) return 'Cari #'+cari_id;
  var c = cariler.find(function(x){ return x.id===cari_id; });
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

// Cari için eşleşen tüm firma isimleri
function _cariIsimleri(cari_id) {
  var set = {};
  if(window.cariler) {
    var c = cariler.find(function(x){ return x.id===cari_id; });
    if(c) set[c.ad.toUpperCase().trim()] = true;
  }
  if(window.cariAliases) {
    cariAliases.forEach(function(a){
      if(a.cari_id===cari_id && a.alias) set[a.alias.toUpperCase().trim()] = true;
    });
  }
  return Object.keys(set);
}

function _cariKayitlar(cari_id) {
  var isimleri = _cariIsimleri(cari_id);
  if(!isimleri.length) return [];
  return (window.kayitlar||[]).filter(function(k){
    return k.firma && isimleri.indexOf(k.firma.toUpperCase().trim())!==-1;
  });
}

function _cariFaturalar(cari_id) {
  var isimleri = _cariIsimleri(cari_id);
  if(!isimleri.length) return [];
  return (window.faturalar||[]).filter(function(f){
    return f.firma && isimleri.indexOf(f.firma.toUpperCase().trim())!==-1;
  });
}

// ---- SEKME AÇILIŞI ----

function vadeSecmeAc() {
  _vdCariDropdownDoldur();
  renderVadeBudget();
  // Önceden seçili cari varsa koru
  if(_vdSeciliCari) {
    var el = document.getElementById('vd-cari-sec');
    if(el) el.value = _vdSeciliCari;
    renderVadeler();
  }
}

function _vdCariDropdownDoldur() {
  if(!window.cariler) return;
  var el = document.getElementById('vd-cari-sec');
  if(!el) return;
  var bos  = '<option value="">— Cari seçin —</option>';
  var opts = cariler.slice()
    .sort(function(a,b){ return a.ad.localeCompare(b.ad,'tr'); })
    .map(function(c){ return '<option value="'+c.id+'">'+htmlEsc(c.ad)+'</option>'; })
    .join('');
  el.innerHTML = bos+opts;
  if(_vdSeciliCari) el.value = _vdSeciliCari;
}

function vdCariSecildi() {
  var el = document.getElementById('vd-cari-sec');
  _vdSeciliCari = el ? (Number(el.value)||null) : null;
  renderVadeler();
}

// ---- VADE BUDGET (tüm vadeler özeti) ----

function renderVadeBudget() {
  var el = document.getElementById('vd-budget');
  if(!el) return;
  var bugun = new Date(today+'T00:00:00');

  function topla(gun) {
    return (window.cariVadeler||[]).filter(function(v) {
      if(v.odendi) return false;
      var vt = new Date(v.vade_tarihi+'T00:00:00');
      return vt <= new Date(bugun.getTime() + gun*86400000);
    });
  }

  function kart(baslik, gun, renk) {
    var liste  = topla(gun);
    var toplam = liste.reduce(function(s,v){ return s+Number(v.tutar); }, 0);
    if(!liste.length) return '';
    return '<div class="ok" style="flex:1;min-width:120px;border-top:3px solid '+renk+'">'+
      '<div class="ok-label">'+baslik+'</div>'+
      '<div class="ok-val rc">'+para(toplam)+'</div>'+
      '<div style="font-size:11px;color:#6b7280;margin-top:3px">'+liste.length+' vade</div>'+
    '</div>';
  }

  var gecikmis = (window.cariVadeler||[]).filter(function(v){
    return !v.odendi && _vadeKalanGun(v.vade_tarihi) < 0;
  });
  var gecikmisDeg = gecikmis.reduce(function(s,v){ return s+Number(v.tutar); }, 0);
  var gecHTML = gecikmis.length
    ? '<div class="ok" style="flex:1;min-width:120px;border-top:3px solid #dc2626;background:#fef2f2">'+
        '<div class="ok-label" style="color:#991b1b">GECİKMİŞ</div>'+
        '<div class="ok-val" style="color:#dc2626">'+para(gecikmisDeg)+'</div>'+
        '<div style="font-size:11px;color:#991b1b;margin-top:3px">'+gecikmis.length+' ödeme</div>'+
      '</div>'
    : '';

  var html = gecHTML + kart('30 Gün', 30, '#f59e0b') + kart('60 Gün', 60, '#3b82f6') + kart('90 Gün', 90, '#6b7280');
  el.style.display = html ? 'block' : 'none';
  el.innerHTML = html
    ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">'+html+'</div>'
    : '';
}

// ---- SEÇİLİ CARİ DETAY ----

function renderVadeler() {
  var el  = document.getElementById('vd-cariler-listesi');
  var emp = document.getElementById('vd-empty');
  if(!el) return;

  if(!_vdSeciliCari) {
    el.innerHTML = '';
    if(emp){ emp.style.display='block'; emp.textContent='Yukarıdan bir cari seçin.'; }
    return;
  }
  if(emp) emp.style.display = 'none';

  el.innerHTML = _hesapBolumu(_vdSeciliCari) +
    '<div style="border-top:1px solid #e5e7eb;margin:16px 0"></div>' +
    _vadeBolumu(_vdSeciliCari);
}

// ---- HESAP BÖLÜMü ----

function _hesapBolumu(cari_id) {
  var kayitlar_c  = _cariKayitlar(cari_id);
  var faturalar_c = _cariFaturalar(cari_id);

  var gelir = kayitlar_c.filter(function(k){ return k.tur==='gelir'; })
    .reduce(function(s,k){ return s+Number(k.tutar); }, 0);
  var gider = kayitlar_c.filter(function(k){ return k.tur==='gider'; })
    .reduce(function(s,k){ return s+Number(k.tutar); }, 0);
  var fatToplam   = faturalar_c.reduce(function(s,f){ return s+Number(f.tutar); }, 0);
  var fatBekleyen = faturalar_c.filter(function(f){ return !f.odendi_mi; })
    .reduce(function(s,f){ return s+Number(f.tutar); }, 0);

  var ozet = '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">';
  if(gider) ozet +=
    '<div style="flex:1;min-width:110px;background:#fef2f2;border-radius:8px;padding:10px 14px">'+
      '<div style="font-size:11px;color:#991b1b;font-weight:600;margin-bottom:2px">TOPLAM ÖDEME</div>'+
      '<div style="font-size:18px;font-weight:700;color:#dc2626">'+para(gider)+'</div>'+
      '<div style="font-size:10px;color:#9ca3af">'+kayitlar_c.filter(function(k){return k.tur==='gider';}).length+' kayıt</div>'+
    '</div>';
  if(gelir) ozet +=
    '<div style="flex:1;min-width:110px;background:#f0fdf4;border-radius:8px;padding:10px 14px">'+
      '<div style="font-size:11px;color:#065f46;font-weight:600;margin-bottom:2px">TOPLAM TAHSİLAT</div>'+
      '<div style="font-size:18px;font-weight:700;color:#059669">'+para(gelir)+'</div>'+
      '<div style="font-size:10px;color:#9ca3af">'+kayitlar_c.filter(function(k){return k.tur==='gelir';}).length+' kayıt</div>'+
    '</div>';
  if(faturalar_c.length) ozet +=
    '<div style="flex:1;min-width:110px;background:#eff6ff;border-radius:8px;padding:10px 14px">'+
      '<div style="font-size:11px;color:#1e40af;font-weight:600;margin-bottom:2px">FATURA TOPLAM</div>'+
      '<div style="font-size:18px;font-weight:700;color:#1d4ed8">'+para(fatToplam)+'</div>'+
      '<div style="font-size:10px;color:'+(fatBekleyen>0?'#dc2626':'#9ca3af')+'">'+(fatBekleyen>0?para(fatBekleyen)+' bekliyor':faturalar_c.length+' fatura')+'</div>'+
    '</div>';
  ozet += '</div>';

  if(!kayitlar_c.length && !faturalar_c.length) {
    ozet = '<div style="color:#9ca3af;font-size:13px;padding:12px 0">Bu cari için kayıt bulunamadı.</div>';
  }

  // Kayıt tablosu (tamamı, tarih sıralı)
  var sirali = kayitlar_c.slice().sort(function(a,b){
    return b.tarih<a.tarih?-1:b.tarih>a.tarih?1:0;
  });

  var satirlar = sirali.map(function(k){
    var renk = k.tur==='gelir'?'#059669':'#dc2626';
    var isaret = k.tur==='gelir'?'+':'-';
    return '<tr>'+
      '<td style="font-size:12px;white-space:nowrap">'+fmtT(k.tarih)+'</td>'+
      '<td style="font-size:12px">'+htmlEsc(k.kat||'—')+'</td>'+
      '<td style="font-size:12px;color:#6b7280;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(k.aciklama?htmlEsc(k.aciklama):'—')+'</td>'+
      '<td style="text-align:right;font-weight:600;color:'+renk+';white-space:nowrap">'+isaret+' '+para(k.tutar)+'</td>'+
    '</tr>';
  }).join('');

  var tablo = sirali.length
    ? '<div style="overflow-x:auto">'+
        '<table class="table" style="width:100%;font-size:12px">'+
        '<thead><tr><th>Tarih</th><th>Kategori</th><th>Açıklama</th><th style="text-align:right">Tutar</th></tr></thead>'+
        '<tbody>'+satirlar+'</tbody>'+
        '</table>'+
      '</div>'
    : '';

  return '<div>'+
    '<div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">Hesap Özeti</div>'+
    ozet+tablo+
  '</div>';
}

// ---- VADE BÖLÜMÜ ----

function _vadeBolumu(cari_id) {
  var vadeler = (window.cariVadeler||[]).filter(function(v){ return v.cari_id===cari_id; });
  var sirali  = vadeler.slice().sort(function(a,b){
    if(a.odendi!==b.odendi) return a.odendi?1:-1;
    return a.vade_tarihi<b.vade_tarihi?-1:a.vade_tarihi>b.vade_tarihi?1:0;
  });

  var satirlar = sirali.map(function(v) {
    var kalan = _vadeKalanGun(v.vade_tarihi);
    var renk  = _vadeRenk(kalan, v.odendi);
    return '<tr style="'+(renk.bg?'background:'+renk.bg:'')+'">'+
      '<td style="font-size:12px;white-space:nowrap">'+fmtT(v.vade_tarihi)+'</td>'+
      '<td style="text-align:right;font-weight:500;color:'+(v.odendi?'#9ca3af':'#1a1a1a')+'">'+para(v.tutar)+'</td>'+
      '<td style="color:'+renk.text+';font-size:12px;font-weight:500;white-space:nowrap">'+_vadeKalanMetin(kalan, v.odendi)+'</td>'+
      '<td style="color:#888;font-size:12px">'+(v.fatura_no||'—')+'</td>'+
      '<td style="color:#888;font-size:12px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(v.aciklama||'—')+'</td>'+
      '<td>'+
        (v.odendi
          ? '<span style="background:#E1F5EE;color:#0F6E56;border-radius:12px;padding:1px 8px;font-size:11px;font-weight:600">✓ Ödendi</span>'
          : '<button onclick="vadeOdendiAc('+v.id+')" class="btn btn-g" style="font-size:11px;padding:2px 7px">Ödendi</button>')+
      '</td>'+
      '<td style="white-space:nowrap">'+
        '<button onclick="vadeDuzenle('+v.id+')" style="background:none;border:none;cursor:pointer;color:#185FA5;font-size:12px;padding:2px 4px">✏️</button>'+
        (!v.odendi?'<button onclick="vadeSil('+v.id+')" style="background:none;border:none;cursor:pointer;color:#D85A30;font-size:12px;padding:2px 4px">🗑️</button>':'')+
      '</td>'+
    '</tr>';
  }).join('');

  var tablo = sirali.length
    ? '<div style="overflow-x:auto;margin-bottom:12px">'+
        '<table class="table" style="width:100%;min-width:440px;font-size:12px">'+
        '<thead><tr><th>Vade Tarihi</th><th style="text-align:right">Tutar</th><th>Durum</th><th>Fatura No</th><th>Açıklama</th><th>Ödeme</th><th></th></tr></thead>'+
        '<tbody>'+satirlar+'</tbody>'+
        '</table>'+
      '</div>'
    : '<div style="color:#9ca3af;font-size:12px;margin-bottom:12px">Bu cari için vade kaydı yok.</div>';

  return '<div>'+
    '<div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Vade Takibi</div>'+
    tablo+
    '<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:10px">'+
    '<div style="font-size:11px;font-weight:600;color:#374151;margin-bottom:6px">Yeni Vade Ekle</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px">'+
    '<div class="field"><label>Tutar (TL) *</label><input type="number" id="vd-yt-'+cari_id+'" placeholder="0.00" min="0" step="0.01" style="width:100%"></div>'+
    '<div class="field"><label>Vade (Gün) *</label><input type="number" id="vd-ygun-'+cari_id+'" placeholder="30" min="1" style="width:100%"></div>'+
    '<div class="field"><label>Fatura No</label><input type="text" id="vd-yfat-'+cari_id+'" style="width:100%"></div>'+
    '<div class="field"><label>Açıklama</label><input type="text" id="vd-yacik-'+cari_id+'" style="width:100%"></div>'+
    '</div>'+
    '<button class="btn btn-p" onclick="vadeEkle('+cari_id+')" style="margin-top:8px;font-size:12px">Vade Ekle</button>'+
    '</div>'+
  '</div>';
}

// ---- VADE EKLE ----

async function vadeEkle(cari_id) {
  var tutar = parseFloat(document.getElementById('vd-yt-'+cari_id).value);
  var gun   = parseInt(document.getElementById('vd-ygun-'+cari_id).value);
  var fatno = document.getElementById('vd-yfat-'+cari_id).value.trim();
  var acik  = document.getElementById('vd-yacik-'+cari_id).value.trim();
  if(isNaN(gun)||gun<1)      { alert('Kaç gün olduğunu girin (örn: 30).'); return; }
  if(isNaN(tutar)||tutar<=0) { alert('Geçerli bir tutar girin.'); return; }
  var vadeD = new Date(today+'T00:00:00');
  vadeD.setDate(vadeD.getDate()+gun);
  var tarih = ldStr(vadeD);
  var r = await dbPost('cari_vadeler', {cari_id:cari_id, tutar:tutar, vade_tarihi:tarih, fatura_no:fatno||null, aciklama:acik||null});
  if(!r||!r.ok){ alert('Kayıt hatası!'); return; }
  cariVadeler = await dbGetAll('cari_vadeler','select=*&order=vade_tarihi.asc');
  renderVadeBudget();
  renderVadeler();
  renderVadeUyarilari();
  if(typeof renderCariler==='function') renderCariler();
}

// ---- UYARI BANNER ----

function renderVadeUyarilari() {
  var el = document.getElementById('vade-uyari-banner');
  if(!el||!window.cariVadeler) return;
  var gecikmis = cariVadeler.filter(function(v){ return !v.odendi && _vadeKalanGun(v.vade_tarihi)<0; });
  var buHafta  = cariVadeler.filter(function(v){ var k=_vadeKalanGun(v.vade_tarihi); return !v.odendi&&k>=0&&k<=7; });
  var html = '';
  if(gecikmis.length) {
    var gTop = gecikmis.reduce(function(s,v){ return s+Number(v.tutar); }, 0);
    html += '<div class="uyari" style="margin-bottom:6px;cursor:pointer" onclick="switchTab(\'vadeler\')">'+
      '⚠️ <strong>'+gecikmis.length+' ödemede '+para(gTop)+' gecikmiş vade var.</strong> '+
      '<span style="text-decoration:underline;font-size:11px">Cari Hesap → </span></div>';
  }
  if(buHafta.length) {
    var hTop = buHafta.reduce(function(s,v){ return s+Number(v.tutar); }, 0);
    html += '<div class="bilgi" style="margin-bottom:6px;cursor:pointer" onclick="switchTab(\'vadeler\')">'+
      '🔔 Bu hafta <strong>'+buHafta.length+' vade</strong>: '+para(hTop)+
      '<span style="text-decoration:underline;font-size:11px"> Detay → </span></div>';
  }
  el.style.display = html?'block':'none';
  el.innerHTML = html;
}

// ---- VADE DÜZENLE / SİL / ÖDENDİ ----

function _vadeDuzCariSelectDoldur() {
  if(!window.cariler) return;
  var bos  = '<option value="">— Cari seçin —</option>';
  var opts = cariler.slice().sort(function(a,b){ return a.ad.localeCompare(b.ad,'tr'); })
    .map(function(c){ return '<option value="'+c.id+'">'+htmlEsc(c.ad)+'</option>'; }).join('');
  var el = document.getElementById('vd-duz-cari');
  if(el) el.innerHTML = bos+opts;
}

function vadeDuzenle(id) {
  var v = cariVadeler.find(function(x){ return x.id===id; });
  if(!v) return;
  _vadeDuzId = id;
  _vadeDuzCariSelectDoldur();
  document.getElementById('vd-duz-cari').value      = v.cari_id;
  document.getElementById('vd-duz-tutar').value     = v.tutar;
  document.getElementById('vd-duz-tarih').value     = v.vade_tarihi;
  document.getElementById('vd-duz-fatura-no').value = v.fatura_no||'';
  document.getElementById('vd-duz-aciklama').value  = v.aciklama||'';
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
  if(!cari_id||!tarih||isNaN(tutar)||tutar<=0){ alert('Zorunlu alanlar eksik.'); return; }
  var gunc = {cari_id:cari_id, tutar:tutar, vade_tarihi:tarih, fatura_no:fat_no||null, aciklama:aciklama||null};
  var r = await dbPatch('cari_vadeler','id',_vadeDuzId,gunc);
  if(!r||!r.ok){ alert('Güncelleme hatası!'); return; }
  var idx = cariVadeler.findIndex(function(x){ return x.id===_vadeDuzId; });
  if(idx>=0) Object.assign(cariVadeler[idx], gunc);
  vadeDuzKapat();
  renderVadeBudget();
  renderVadeler();
  renderVadeUyarilari();
}

async function vadeSil(id) {
  if(!confirm('Bu vadeyi silmek istediğinize emin misiniz?')) return;
  var r = await dbDelete('cari_vadeler','id',id);
  if(!r||!r.ok){ alert('Silme hatası!'); return; }
  cariVadeler = cariVadeler.filter(function(v){ return v.id!==id; });
  renderVadeBudget();
  renderVadeler();
  renderVadeUyarilari();
}

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
  if(!tarih){ alert('Ödeme tarihi zorunludur.'); return; }
  var gunc = {odendi:true, odeme_tarihi:tarih, odeme_notu:not||null};
  var r = await dbPatch('cari_vadeler','id',_vadeOdemeId,gunc);
  if(!r||!r.ok){ alert('Güncelleme hatası!'); return; }
  var idx = cariVadeler.findIndex(function(x){ return x.id===_vadeOdemeId; });
  if(idx>=0) Object.assign(cariVadeler[idx], gunc);
  vadeOdemeKapat();
  renderVadeBudget();
  renderVadeler();
  renderVadeUyarilari();
}
