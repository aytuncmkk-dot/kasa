// ============================================================
// CARİ HESAP — Takip listesi localStorage'da kalır
// Bağımlılık: db.js, utils.js, config.js
// ============================================================

var _vdTakipListesi = [];   // cari_id array — kalıcı
var _vadeOdemeId    = null;

// ---- LOCALSTORAGE ----

function _vdTakipYukle() {
  try {
    var raw = localStorage.getItem('kasa_vd_takip');
    _vdTakipListesi = raw ? JSON.parse(raw) : [];
  } catch(e) { _vdTakipListesi = []; }
}

function _vdTakipKaydet() {
  localStorage.setItem('kasa_vd_takip', JSON.stringify(_vdTakipListesi));
}

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
  if(odendi)      return 'Ödendi';
  if(kalan < 0)   return Math.abs(kalan)+' gün geçti';
  if(kalan === 0) return 'Bugün!';
  return kalan+' gün kaldı';
}

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

function _cariFaturalar(cari_id) {
  var isimleri = _cariIsimleri(cari_id);
  if(!isimleri.length) return [];
  return (window.faturalar||[]).filter(function(f){
    return f.firma && isimleri.indexOf(f.firma.toUpperCase().trim())!==-1;
  });
}

// ---- SEKME AÇILIŞI ----

function vadeSecmeAc() {
  _vdTakipYukle();
  _vdCariDropdownDoldur();
  renderVadeBudget();
  renderVadeler();
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
}

// ---- TAKİP LISTESI YÖNETİMİ ----

function vdCariEkle() {
  var el = document.getElementById('vd-cari-sec');
  var id = el ? Number(el.value) : 0;
  if(!id) return;
  if(_vdTakipListesi.indexOf(id) === -1) {
    _vdTakipListesi.push(id);
    _vdTakipKaydet();
  }
  if(el) el.value = '';
  renderVadeler();
  renderVadeBudget();
}

function vdCariKaldir(cari_id) {
  _vdTakipListesi = _vdTakipListesi.filter(function(x){ return x !== cari_id; });
  _vdTakipKaydet();
  renderVadeler();
  renderVadeBudget();
}

// ---- BUDGET (genel özet) ----

function renderVadeBudget() {
  var el = document.getElementById('vd-budget');
  if(!el) return;
  var bugun = new Date(today+'T00:00:00');

  var tumVadeler = (window.cariVadeler||[]).filter(function(v){ return !v.odendi; });
  var fatVadeler = (window.faturalar||[]).filter(function(f){ return f.vade_tarihi; });

  function topla(gun) {
    var limit = new Date(bugun.getTime() + gun * 86400000);
    var vSum = tumVadeler.filter(function(v){
      return new Date(v.vade_tarihi+'T00:00:00') <= limit;
    }).reduce(function(s,v){ return s+Number(v.tutar); }, 0);
    var fSum = fatVadeler.filter(function(f){
      return new Date(f.vade_tarihi+'T00:00:00') <= limit;
    }).reduce(function(s,f){ return s+Number(f.tutar||0); }, 0);
    return vSum + fSum;
  }

  var gecVad = tumVadeler.filter(function(v){ return _vadeKalanGun(v.vade_tarihi) < 0; });
  var gecFat = fatVadeler.filter(function(f){ return _vadeKalanGun(f.vade_tarihi) < 0; });
  var gecToplam = gecVad.reduce(function(s,v){ return s+Number(v.tutar); }, 0) +
                  gecFat.reduce(function(s,f){ return s+Number(f.tutar||0); }, 0);
  var gecSay = gecVad.length + gecFat.length;

  var cards = '';
  if(gecSay) {
    cards += '<div class="ok" style="flex:1;min-width:140px;border-top:3px solid #dc2626;background:#fef2f2">'+
      '<div class="ok-label" style="color:#991b1b">GECİKMİŞ</div>'+
      '<div class="ok-val" style="color:#dc2626">'+para(gecToplam)+'</div>'+
      '<div style="font-size:11px;color:#991b1b;margin-top:3px">'+gecSay+' ödeme</div>'+
    '</div>';
  }
  function kart(baslik, gun, renk) {
    var t = topla(gun);
    if(!t) return '';
    return '<div class="ok" style="flex:1;min-width:140px;border-top:3px solid '+renk+'">'+
      '<div class="ok-label">'+baslik+'</div>'+
      '<div class="ok-val rc">'+para(t)+'</div>'+
    '</div>';
  }
  cards += kart('30 Gün Vade', 30, '#f59e0b') + kart('60 Gün Vade', 60, '#3b82f6') + kart('90 Gün Vade', 90, '#6b7280');

  if(!cards) { el.style.display='none'; el.innerHTML=''; return; }
  el.style.display = 'block';
  el.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">'+cards+'</div>';
}

// ---- UYARI BANNER ----

function renderVadeUyarilari() {
  var el = document.getElementById('vade-uyari-banner');
  if(!el) return;
  var gecikmis = (window.cariVadeler||[]).filter(function(v){
    return !v.odendi && _vadeKalanGun(v.vade_tarihi) < 0;
  });
  var buHafta = (window.cariVadeler||[]).filter(function(v){
    var k = _vadeKalanGun(v.vade_tarihi);
    return !v.odendi && k >= 0 && k <= 7;
  });
  var html = '';
  if(gecikmis.length) {
    html += '<div class="uyari" style="margin-bottom:6px">'+gecikmis.length+' gecikmiş vade — Toplam: '+para(gecikmis.reduce(function(s,v){ return s+Number(v.tutar); },0))+'</div>';
  }
  if(buHafta.length) {
    html += '<div class="bilgi">Bu hafta '+buHafta.length+' vade geliyor — Toplam: '+para(buHafta.reduce(function(s,v){ return s+Number(v.tutar); },0))+'</div>';
  }
  el.style.display = html ? 'block' : 'none';
  el.innerHTML = html;
}

// ---- ANA RENDER ----

function renderVadeler() {
  var el = document.getElementById('vd-cariler-listesi');
  var em = document.getElementById('vd-empty');
  if(!el) return;

  if(!_vdTakipListesi.length) {
    el.innerHTML = '';
    if(em) { em.style.display='block'; em.textContent='Yukarıdan cari seçerek takibe alın.'; }
    return;
  }
  if(em) em.style.display = 'none';

  var html = '';
  _vdTakipListesi.forEach(function(cari_id) {
    html += _cariKart(Number(cari_id));
  });
  el.innerHTML = html;
}

function _cariKart(cari_id) {
  var cadi = _vadeCariAdi(cari_id);

  // cari_vadeler (en yakın → geç, ödenenler sona)
  var vadeler = (window.cariVadeler||[]).filter(function(v){ return v.cari_id===cari_id; });
  vadeler.sort(function(a,b){
    if(a.odendi !== b.odendi) return a.odendi ? 1 : -1;
    return a.vade_tarihi > b.vade_tarihi ? 1 : -1;
  });

  // faturalar with vade_tarihi
  var fatVadeler = _cariFaturalar(cari_id).filter(function(f){ return f.vade_tarihi; });
  fatVadeler.sort(function(a,b){ return a.vade_tarihi > b.vade_tarihi ? 1 : -1; });

  var html = '<div style="border:1px solid #e5e7eb;border-radius:10px;margin-bottom:14px;overflow:hidden">';

  // Header
  html += '<div style="background:#f9fafb;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5e7eb">';
  html += '<span style="font-weight:600;font-size:15px">'+htmlEsc(cadi)+'</span>';
  html += '<button onclick="vdCariKaldir('+cari_id+')" style="font-size:12px;color:#9ca3af;background:none;border:1px solid #e5e7eb;border-radius:4px;padding:3px 10px;cursor:pointer">Takipten Çıkar</button>';
  html += '</div>';

  html += '<div style="padding:12px 16px">';

  // Fatura vadeleri
  if(fatVadeler.length) {
    html += '<div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Fatura Vadeleri</div>';
    fatVadeler.forEach(function(f) {
      var kalan = _vadeKalanGun(f.vade_tarihi);
      var r = _vadeRenk(kalan, false);
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-radius:6px;margin-bottom:3px;background:'+(r.bg||'#f9fafb')+'">';
      html += '<span style="font-size:13px;color:'+r.text+'">'+fmtT(f.vade_tarihi);
      if(f.belge_no) html += ' <span style="font-size:11px;color:#9ca3af">'+htmlEsc(f.belge_no)+'</span>';
      html += '</span>';
      html += '<div style="text-align:right">';
      html += '<span style="font-size:13px;font-weight:600;color:'+r.text+'">'+para(f.tutar||0)+'</span>';
      html += ' <span style="font-size:11px;color:'+r.text+'">'+_vadeKalanMetin(kalan, false)+'</span>';
      html += '</div></div>';
    });
  }

  // Manuel vadeler
  if(vadeler.length) {
    if(fatVadeler.length) html += '<div style="border-top:1px solid #f3f4f6;margin:10px 0 8px 0"></div>';
    html += '<div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Manuel Vadeler</div>';
    vadeler.forEach(function(v) {
      var kalan = _vadeKalanGun(v.vade_tarihi);
      var r = _vadeRenk(kalan, v.odendi);
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-radius:6px;margin-bottom:3px;background:'+(r.bg||'#f9fafb')+'">';
      html += '<span style="font-size:13px;color:'+r.text+'">'+fmtT(v.vade_tarihi);
      if(v.aciklama) html += ' <span style="font-size:11px;color:#9ca3af">'+htmlEsc(v.aciklama)+'</span>';
      html += '</span>';
      html += '<div style="display:flex;align-items:center;gap:8px">';
      html += '<span style="font-size:13px;font-weight:600;color:'+r.text+'">'+para(v.tutar)+'</span>';
      html += '<span style="font-size:11px;color:'+r.text+'">'+_vadeKalanMetin(kalan, v.odendi)+'</span>';
      if(!v.odendi) html += '<button onclick="vadeOdendiAc('+v.id+')" style="font-size:11px;padding:2px 7px;background:#ecfdf5;color:#065f46;border:1px solid #6ee7b7;border-radius:4px;cursor:pointer">Ödendi</button>';
      html += '<button onclick="vadeSil('+v.id+')" style="font-size:11px;padding:2px 6px;background:none;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;cursor:pointer">×</button>';
      html += '</div></div>';
    });
  }

  if(!fatVadeler.length && !vadeler.length) {
    html += '<div style="text-align:center;color:#9ca3af;font-size:13px;padding:12px 0">Vade kaydı yok</div>';
  }

  // Yeni vade ekle
  html += '<div style="border-top:1px solid #f3f4f6;margin-top:10px;padding-top:10px;display:flex;gap:8px;align-items:flex-end">';
  html += '<div class="field" style="flex:1"><label>Tutar (₺)</label><input type="number" id="vd-ytutar-'+cari_id+'" placeholder="0.00" step="0.01" min="0"></div>';
  html += '<div class="field" style="flex:1"><label>Vade (gün)</label><input type="number" id="vd-ygun-'+cari_id+'" placeholder="30" min="1" max="365"></div>';
  html += '<button onclick="vadeEkle('+cari_id+')" style="padding:7px 14px;background:#3b82f6;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;white-space:nowrap;flex-shrink:0;font-weight:500">+ Vade Ekle</button>';
  html += '</div>';

  html += '</div></div>';
  return html;
}

// ---- VADE CRUD ----

function vadeEkle(cari_id) {
  var tutarEl = document.getElementById('vd-ytutar-'+cari_id);
  var gunEl   = document.getElementById('vd-ygun-'+cari_id);
  if(!tutarEl || !gunEl) return;
  var tutar = parseFloat(tutarEl.value);
  var gun   = parseInt(gunEl.value, 10);
  if(!tutar || tutar <= 0 || !gun || gun < 1) { alert('Tutar ve vade gün sayısı giriniz.'); return; }
  var vadeTarihi = ldStr(new Date(Date.now() + gun * 86400000));
  dbPost('cari_vadeler', {
    cari_id: cari_id,
    tip: 'borc',
    tutar: tutar,
    vade_tarihi: vadeTarihi,
    odendi: false
  }).then(function(r) {
    if(r && r[0]) {
      cariVadeler.push(r[0]);
      tutarEl.value = '';
      gunEl.value   = '';
      renderVadeler();
      renderVadeBudget();
      renderVadeUyarilari();
    }
  });
}

function vadeSil(id) {
  if(!confirm('Bu vadeyi silmek istediğinize emin misiniz?')) return;
  dbDelete('cari_vadeler', 'id', id).then(function() {
    cariVadeler = cariVadeler.filter(function(v){ return v.id !== id; });
    renderVadeler();
    renderVadeBudget();
    renderVadeUyarilari();
  });
}

function vadeOdendiAc(id) {
  _vadeOdemeId = id;
  var modal = document.getElementById('vd-odm-modal');
  if(modal) {
    var dtEl = document.getElementById('vd-odm-tarih');
    if(dtEl) dtEl.value = today;
    var ntEl = document.getElementById('vd-odm-not');
    if(ntEl) ntEl.value = '';
    modal.classList.add('open');
  }
}

function vadeOdemeKapat() {
  var modal = document.getElementById('vd-odm-modal');
  if(modal) modal.classList.remove('open');
  _vadeOdemeId = null;
}

function vadeOdemeKaydet() {
  if(!_vadeOdemeId) return;
  var dtEl = document.getElementById('vd-odm-tarih');
  var ntEl = document.getElementById('vd-odm-not');
  var odTarih = dtEl ? dtEl.value : today;
  var not     = ntEl ? ntEl.value.trim() : '';
  dbPatch('cari_vadeler', 'id', _vadeOdemeId, {
    odendi: true,
    odeme_tarihi: odTarih,
    odeme_notu: not || null
  }).then(function() {
    var idx = -1;
    cariVadeler.forEach(function(v,i){ if(v.id===_vadeOdemeId) idx=i; });
    if(idx !== -1) {
      cariVadeler[idx].odendi = true;
      cariVadeler[idx].odeme_tarihi = odTarih;
      cariVadeler[idx].odeme_notu = not || null;
    }
    vadeOdemeKapat();
    renderVadeler();
    renderVadeBudget();
    renderVadeUyarilari();
  });
}
