// ============================================================
// CARİ HESAP — Kayitlar + Faturalar üzerinden otomatik bakiye
// Bağımlılık: db.js, utils.js, config.js
// ============================================================

var _vadeDuzId    = null;
var _vadeOdemeId  = null;
var _vadeAcikCari = null;

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

// Cari için tüm eşleşen firma isimleri (kendi adı + aliases)
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

// Kayitlar'dan bu cariye ait kayıtlar
function _cariKayitlar(cari_id) {
  var isimleri = _cariIsimleri(cari_id);
  if(!isimleri.length) return [];
  return (window.kayitlar||[]).filter(function(k){
    return k.firma && isimleri.indexOf(k.firma.toUpperCase().trim())!==-1;
  });
}

// Faturalar'dan bu cariye ait faturalar
function _cariFaturalar(cari_id) {
  var isimleri = _cariIsimleri(cari_id);
  if(!isimleri.length) return [];
  return (window.faturalar||[]).filter(function(f){
    return f.firma && isimleri.indexOf(f.firma.toUpperCase().trim())!==-1;
  });
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
    return (window.cariVadeler||[]).filter(function(v) {
      if(v.odendi) return false;
      var vt = new Date(v.vade_tarihi+'T00:00:00');
      return vt <= new Date(bugun.getTime() + gun*86400000);
    });
  }

  function kartVade(baslik, gun, kenarRenk) {
    var liste  = topla(gun);
    var toplam = liste.reduce(function(s,v){ return s+Number(v.tutar); }, 0);
    return '<div class="ok" style="flex:1;min-width:130px;border-top:3px solid '+kenarRenk+'">'+
      '<div class="ok-label">'+baslik+'</div>'+
      '<div class="ok-val rc">'+para(toplam)+'</div>'+
      '<div style="font-size:11px;color:#6b7280;margin-top:4px">'+liste.length+' vade</div>'+
    '</div>';
  }

  var gecikmis    = (window.cariVadeler||[]).filter(function(v){
    return !v.odendi && _vadeKalanGun(v.vade_tarihi) < 0;
  });
  var gecikmisDeg = gecikmis.reduce(function(s,v){ return s+Number(v.tutar); }, 0);
  var gecHTML = gecikmis.length
    ? '<div class="ok" style="flex:1;min-width:130px;border-top:3px solid #dc2626;background:#fef2f2">'+
        '<div class="ok-label" style="color:#991b1b">GECİKMİŞ VADE</div>'+
        '<div class="ok-val" style="color:#dc2626">'+para(gecikmisDeg)+'</div>'+
        '<div style="font-size:11px;color:#991b1b;margin-top:4px">'+gecikmis.length+' ödeme</div>'+
      '</div>'
    : '';

  el.innerHTML =
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">'+
      gecHTML+
      kartVade('30 Gün Vade', 30, '#f59e0b')+
      kartVade('60 Gün Vade', 60, '#3b82f6')+
      kartVade('90 Gün Vade', 90, '#6b7280')+
    '</div>';
}

// ---- CARİ BAZLI ANA LİSTE ----

function renderVadeler() {
  var el  = document.getElementById('vd-cariler-listesi');
  var emp = document.getElementById('vd-empty');
  if(!el) return;

  // Takip listesi: localStorage + vadesi olan cariler
  var takiplistr = _takipListesi();

  // Vadesi olan cariler de dahil et
  (window.cariVadeler||[]).forEach(function(v){
    if(takiplistr.indexOf(v.cari_id)===-1) takiplistr.push(v.cari_id);
  });

  // Kayıtı veya faturası olan cariler
  if(window.cariler) {
    cariler.forEach(function(c){
      if(takiplistr.indexOf(c.id)!==-1) return;
      var k = _cariKayitlar(c.id);
      var f = _cariFaturalar(c.id);
      if(k.length||f.length) takiplistr.push(c.id);
    });
  }

  takiplistr.sort(function(a,b){
    return _vadeCariAdi(a).localeCompare(_vadeCariAdi(b),'tr');
  });

  if(!takiplistr.length) {
    el.innerHTML = '';
    if(emp) emp.style.display = 'block';
    return;
  }
  if(emp) emp.style.display = 'none';

  el.innerHTML = takiplistr.map(function(cari_id) {
    var kayitlar_c  = _cariKayitlar(cari_id);
    var gelir       = kayitlar_c.filter(function(k){ return k.tur==='gelir'; }).reduce(function(s,k){ return s+Number(k.tutar); }, 0);
    var gider       = kayitlar_c.filter(function(k){ return k.tur==='gider'; }).reduce(function(s,k){ return s+Number(k.tutar); }, 0);
    var vadeler     = (window.cariVadeler||[]).filter(function(v){ return v.cari_id===cari_id; });
    var bekVadeler  = vadeler.filter(function(v){ return !v.odendi; });
    var enErken     = bekVadeler.reduce(function(mn,v){ return (!mn||v.vade_tarihi<mn)?v.vade_tarihi:mn; }, null);
    var minKalan    = enErken!==null ? _vadeKalanGun(enErken) : null;
    var vadeRenk    = minKalan!==null ? _vadeRenk(minKalan, false) : {bg:'',text:'#9ca3af'};
    var acik        = _vadeAcikCari===cari_id;

    var durumChip = '';
    if(minKalan!==null) {
      var lbl = minKalan<0?Math.abs(minKalan)+' gün geçti':minKalan===0?'Bugün!':minKalan+' gün';
      durumChip = '<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:'+vadeRenk.bg+';color:'+vadeRenk.text+';font-weight:600;white-space:nowrap">'+lbl+'</span>';
    }

    return '<div style="margin-bottom:10px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">'+
      '<div onclick="vadeCariToggle('+cari_id+')" style="cursor:pointer;display:flex;align-items:center;gap:10px;padding:12px 16px;background:'+(acik?'#f8fafc':'#fff')+';user-select:none">'+
        '<div style="flex:1;font-weight:600;font-size:14px;color:#1f2937">'+htmlEsc(_vadeCariAdi(cari_id))+'</div>'+
        (gider?'<div style="font-size:12px;color:#dc2626;white-space:nowrap">Ödeme: <strong>'+para(gider)+'</strong></div>':'') +
        (gelir?'<div style="font-size:12px;color:#059669;white-space:nowrap">Tahsilat: <strong>'+para(gelir)+'</strong></div>':'') +
        (kayitlar_c.length?'<div style="font-size:11px;color:#9ca3af">'+kayitlar_c.length+' kayıt</div>':'') +
        durumChip+
        '<span style="font-size:14px;color:#9ca3af;min-width:14px;text-align:center">'+(acik?'▲':'▼')+'</span>'+
      '</div>'+
      (acik ? _vadeKartDetay(cari_id) : '')+
    '</div>';
  }).join('');
}

function vadeCariToggle(cari_id) {
  _vadeAcikCari = (_vadeAcikCari===cari_id) ? null : cari_id;
  renderVadeler();
}

// ---- KART DETAY ----

function _vadeKartDetay(cari_id) {
  return '<div style="padding:0 16px 16px">'+
    _hesapBolumu(cari_id)+
    '<div style="border-top:1px solid #e5e7eb;margin:14px 0"></div>'+
    _vadeBolumu(cari_id)+
  '</div>';
}

// ---- HESAP BÖLÜMÜ (otomatik kayıtlar) ----

function _hesapBolumu(cari_id) {
  var kayitlar_c = _cariKayitlar(cari_id);
  var faturalar_c = _cariFaturalar(cari_id);

  var gelir  = kayitlar_c.filter(function(k){ return k.tur==='gelir'; }).reduce(function(s,k){ return s+Number(k.tutar); }, 0);
  var gider  = kayitlar_c.filter(function(k){ return k.tur==='gider'; }).reduce(function(s,k){ return s+Number(k.tutar); }, 0);
  var fatToplam = faturalar_c.reduce(function(s,f){ return s+Number(f.tutar); }, 0);
  var fatBekleyen = faturalar_c.filter(function(f){ return !f.odendi_mi; }).reduce(function(s,f){ return s+Number(f.tutar); }, 0);

  // Özet kartlar
  var ozet = '';
  if(gider||gelir||faturalar_c.length) {
    ozet = '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">';
    if(gider) ozet += '<div style="flex:1;min-width:100px;background:#fef2f2;border-radius:8px;padding:8px 12px">'+
      '<div style="font-size:11px;color:#991b1b;font-weight:600">TOPLAM ÖDEME</div>'+
      '<div style="font-size:16px;font-weight:700;color:#dc2626">'+para(gider)+'</div>'+
      '<div style="font-size:10px;color:#9ca3af">'+kayitlar_c.filter(function(k){return k.tur==='gider';}).length+' kayıt</div>'+
    '</div>';
    if(gelir) ozet += '<div style="flex:1;min-width:100px;background:#f0fdf4;border-radius:8px;padding:8px 12px">'+
      '<div style="font-size:11px;color:#065f46;font-weight:600">TOPLAM TAHSİLAT</div>'+
      '<div style="font-size:16px;font-weight:700;color:#059669">'+para(gelir)+'</div>'+
      '<div style="font-size:10px;color:#9ca3af">'+kayitlar_c.filter(function(k){return k.tur==='gelir';}).length+' kayıt</div>'+
    '</div>';
    if(faturalar_c.length) ozet += '<div style="flex:1;min-width:100px;background:#eff6ff;border-radius:8px;padding:8px 12px">'+
      '<div style="font-size:11px;color:#1e40af;font-weight:600">FATURA</div>'+
      '<div style="font-size:16px;font-weight:700;color:#1d4ed8">'+para(fatToplam)+'</div>'+
      '<div style="font-size:10px;color:#9ca3af">'+(fatBekleyen>0?para(fatBekleyen)+' bekliyor':faturalar_c.length+' fatura')+'</div>'+
    '</div>';
    ozet += '</div>';
  }

  // Kayıt tablosu (son 20)
  var sirali = kayitlar_c.slice().sort(function(a,b){ return b.tarih<a.tarih?-1:b.tarih>a.tarih?1:0; }).slice(0,20);
  var satirlar = sirali.map(function(k){
    var renk = k.tur==='gelir'?'#059669':'#dc2626';
    var isaret = k.tur==='gelir'?'+':'-';
    return '<tr>'+
      '<td style="font-size:12px;color:#6b7280">'+fmtT(k.tarih)+'</td>'+
      '<td style="font-size:12px">'+htmlEsc(k.kat||'—')+'</td>'+
      '<td style="font-size:12px;color:#6b7280;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(k.aciklama?htmlEsc(k.aciklama):'—')+'</td>'+
      '<td style="text-align:right;font-weight:600;color:'+renk+'">'+isaret+' '+para(k.tutar)+'</td>'+
    '</tr>';
  }).join('');

  var tablo = kayitlar_c.length
    ? '<div style="overflow-x:auto;margin-bottom:4px">'+
        '<table class="table" style="width:100%;font-size:12px">'+
        '<thead><tr><th>Tarih</th><th>Kategori</th><th>Açıklama</th><th style="text-align:right">Tutar</th></tr></thead>'+
        '<tbody>'+satirlar+'</tbody>'+
        '</table>'+
        (kayitlar_c.length>20?'<div style="font-size:11px;color:#9ca3af;padding:4px 0">... ve '+(kayitlar_c.length-20)+' kayıt daha</div>':'')+
      '</div>'
    : '<div style="color:#9ca3af;font-size:12px;text-align:center;padding:10px">Bu cari için kayıt bulunamadı.</div>';

  return '<div>'+
    '<div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">Hesap Özeti</div>'+
    ozet+
    tablo+
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
      '<td style="font-size:12px">'+fmtT(v.vade_tarihi)+'</td>'+
      '<td style="text-align:right;font-weight:500;color:'+(v.odendi?'#9ca3af':'#1a1a1a')+'">'+para(v.tutar)+'</td>'+
      '<td style="color:'+renk.text+';font-size:12px;font-weight:500">'+_vadeKalanMetin(kalan, v.odendi)+'</td>'+
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
      '<tbody>'+satirlar+'</tbody></table></div>'
    : '';

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

// ---- TAKİP LİSTESİ (localStorage) ----

function _takipListesi() {
  try { return JSON.parse(localStorage.getItem('kasa_takip_cariler')||'[]'); }
  catch(e){ return []; }
}

function _takipEkle(cari_id) {
  var liste = _takipListesi();
  if(liste.indexOf(cari_id)===-1){ liste.push(cari_id); localStorage.setItem('kasa_takip_cariler',JSON.stringify(liste)); }
}

// ---- YENİ CARİ TAKİBE AL ----

function vadeTakipAc() {
  _vadeTakipCariSelectDoldur();
  document.getElementById('vd-takip-modal').classList.add('open');
}

function vadeTakipKapat() {
  document.getElementById('vd-takip-modal').classList.remove('open');
}

function _vadeTakipCariSelectDoldur() {
  if(!window.cariler) return;
  var mevcut = _takipListesi();
  (window.cariVadeler||[]).forEach(function(v){ if(mevcut.indexOf(v.cari_id)===-1) mevcut.push(v.cari_id); });
  var bos  = '<option value="">— Cari seçin —</option>';
  var opts = cariler
    .filter(function(c){ return mevcut.indexOf(c.id)===-1; })
    .slice().sort(function(a,b){ return a.ad.localeCompare(b.ad,'tr'); })
    .map(function(c){ return '<option value="'+c.id+'">'+htmlEsc(c.ad)+'</option>'; })
    .join('');
  var el = document.getElementById('vd-tak-cari');
  if(el) el.innerHTML = bos+opts;
}

function vadeTakipKaydet() {
  var cari_id = Number(document.getElementById('vd-tak-cari').value);
  if(!cari_id){ alert('Lütfen bir cari seçin.'); return; }
  _takipEkle(cari_id);
  _vadeAcikCari = cari_id;
  vadeTakipKapat();
  renderVadeler();
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
  var yeni = {cari_id:cari_id, tutar:tutar, vade_tarihi:tarih, fatura_no:fatno||null, aciklama:acik||null};
  var r = await dbPost('cari_vadeler', yeni);
  if(!r||!r.ok){ alert('Kayıt hatası!'); return; }
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
  if(!el||!window.cariVadeler) return;
  var gecikmis = cariVadeler.filter(function(v){
    return !v.odendi && _vadeKalanGun(v.vade_tarihi) < 0;
  });
  var buHafta = cariVadeler.filter(function(v){
    var k = _vadeKalanGun(v.vade_tarihi);
    return !v.odendi && k>=0 && k<=7;
  });
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

// ---- VADE DÜZENLE MODAL ----

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
