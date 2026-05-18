// ============================================================
// CARİ HESAP — cari_id bazlı fatura/ödeme takibi
// Bağımlılık: db.js, utils.js, config.js
// ============================================================

var _vdTakipListesi = [];   // localStorage'dan gelen cari_id array
var _vadeOdemeId    = null;
var _vdDismissed    = {};   // {cari_id: {kayit_id: true}} — oturumda reddedilenler

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

// Cari alias isimleri (alias eşleşmemiş kayıt önerileri için hâlâ kullanılır)
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

// ---- TAKİP LİSTESİ ----

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

// ---- BUDGET ÖZET ----

function renderVadeBudget() {
  var el = document.getElementById('vd-budget');
  if(!el) return;
  var bugun = new Date(today+'T00:00:00');

  // Sadece takip listesindeki carilerin faturalarından hesapla
  var takipFaturalar = (window.faturalar||[]).filter(function(f){
    return f.cari_id && _vdTakipListesi.indexOf(f.cari_id)!==-1 && f.durum!=='odendi';
  });

  function topla(gun) {
    var limit = new Date(bugun.getTime() + gun*86400000);
    return takipFaturalar.filter(function(f){
      var vt = f.vade || f.vade_tarihi;
      return vt && new Date(vt+'T00:00:00') <= limit;
    }).reduce(function(s,f){ return s+Number(f.tutar||0); }, 0);
  }

  var gecFat = takipFaturalar.filter(function(f){
    var vt = f.vade || f.vade_tarihi;
    return vt && _vadeKalanGun(vt) < 0;
  });
  var gecToplam = gecFat.reduce(function(s,f){ return s+Number(f.tutar||0); }, 0);

  var cards = '';
  if(gecFat.length) {
    cards += '<div class="ok" style="flex:1;min-width:140px;border-top:3px solid #dc2626;background:#fef2f2">'+
      '<div class="ok-label" style="color:#991b1b">GECİKMİŞ</div>'+
      '<div class="ok-val" style="color:#dc2626">'+para(gecToplam)+'</div>'+
      '<div style="font-size:11px;color:#991b1b;margin-top:3px">'+gecFat.length+' fatura</div>'+
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
  cards += kart('30 Gün', 30, '#f59e0b') + kart('60 Gün', 60, '#3b82f6') + kart('90 Gün', 90, '#6b7280');

  if(!cards) { el.style.display='none'; el.innerHTML=''; return; }
  el.style.display = 'block';
  el.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">'+cards+'</div>';
}

// ---- UYARI BANNER ----

function renderVadeUyarilari() {
  var el = document.getElementById('vade-uyari-banner');
  if(!el) return;
  var gecikmis = (window.faturalar||[]).filter(function(f){
    if(f.durum==='odendi' || !f.cari_id) return false;
    var vt = f.vade || f.vade_tarihi;
    return vt && _vadeKalanGun(vt) < 0;
  });
  var buHafta = (window.faturalar||[]).filter(function(f){
    if(f.durum==='odendi' || !f.cari_id) return false;
    var vt = f.vade || f.vade_tarihi;
    if(!vt) return false;
    var k = _vadeKalanGun(vt);
    return k >= 0 && k <= 7;
  });
  var html = '';
  if(gecikmis.length) {
    html += '<div class="uyari" style="margin-bottom:6px">'+gecikmis.length+' gecikmiş fatura vadesi — Toplam: '+para(gecikmis.reduce(function(s,f){ return s+Number(f.tutar||0); },0))+'</div>';
  }
  if(buHafta.length) {
    html += '<div class="bilgi">Bu hafta '+buHafta.length+' fatura vadesi geliyor — Toplam: '+para(buHafta.reduce(function(s,f){ return s+Number(f.tutar||0); },0))+'</div>';
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

// ---- CARİ KART (fatura + ödeme + öneri) ----

function _cariKart(cari_id) {
  var cadi = _vadeCariAdi(cari_id);

  // cari_id ile doğrudan bağlı faturalar
  var fatList = (window.faturalar||[]).filter(function(f){ return f.cari_id===cari_id; });
  fatList.sort(function(a,b){ return (a.vade||a.tarih) > (b.vade||b.tarih) ? 1 : -1; });

  // cari_id ile doğrudan bağlı gider kayıtları (ödemeler)
  var odList = (window.kayitlar||[]).filter(function(k){
    return k.cari_id===cari_id && k.tur==='gider';
  });
  odList.sort(function(a,b){ return a.tarih > b.tarih ? 1 : -1; });

  var toplamFatura  = fatList.reduce(function(s,f){ return s+Number(f.tutar||0); }, 0);
  var toplamOdeme   = odList.reduce(function(s,k){ return s+Number(k.tutar||0); }, 0);
  var bakiye        = toplamFatura - toplamOdeme;

  // Önerilen eşleşmemiş kayıtlar
  var oneriler = _onerilenKayitlar(cari_id, fatList);

  var html = '<div style="border:1px solid #e5e7eb;border-radius:10px;margin-bottom:16px;overflow:hidden">';

  // --- Başlık ---
  html += '<div style="background:#f9fafb;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5e7eb">';
  html += '<span style="font-weight:600;font-size:15px">'+htmlEsc(cadi)+'</span>';
  html += '<div style="display:flex;align-items:center;gap:12px">';
  // Bakiye badge
  var bakiyeRenk = bakiye > 0 ? '#dc2626' : (bakiye < 0 ? '#059669' : '#6b7280');
  html += '<span style="font-size:13px;font-weight:700;color:'+bakiyeRenk+'">'+
    (bakiye>0?'Borç: ':'Alacak: ')+para(Math.abs(bakiye))+'</span>';
  html += '<button onclick="vdCariKaldir('+cari_id+')" style="font-size:12px;color:#9ca3af;background:none;border:1px solid #e5e7eb;border-radius:4px;padding:3px 10px;cursor:pointer">Takipten Çıkar</button>';
  html += '</div></div>';

  html += '<div style="padding:12px 16px">';

  // --- Faturalar bölümü ---
  html += '<div style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;display:flex;justify-content:space-between">'+
    '<span>Faturalar</span><span>'+para(toplamFatura)+'</span></div>';

  if(fatList.length) {
    fatList.forEach(function(f) {
      var vt   = f.vade || f.vade_tarihi;
      var bek  = f.durum !== 'odendi';
      var kalan = vt ? _vadeKalanGun(vt) : 999;
      var r    = bek ? _vadeRenk(kalan, false) : {bg:'#f3f4f6', text:'#9ca3af'};
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-radius:6px;margin-bottom:3px;background:'+(r.bg||'#f9fafb')+'">';
      html += '<div style="flex:1">';
      html += '<span style="font-size:13px;color:'+r.text+'">'+fmtT(f.tarih)+'</span>';
      if(f.fatura_no) html += ' <span style="font-size:11px;color:#9ca3af">'+htmlEsc(f.fatura_no)+'</span>';
      if(vt && bek) html += ' <span style="font-size:11px;color:'+r.text+';margin-left:6px">Vade: '+fmtT(vt)+' ('+_vadeKalanMetin(kalan,false)+')</span>';
      if(!bek) html += ' <span style="font-size:11px;color:#059669">✓ Ödendi</span>';
      html += '</div>';
      html += '<div style="display:flex;align-items:center;gap:8px">';
      html += '<span style="font-size:13px;font-weight:600;color:'+r.text+'">'+para(f.tutar||0)+'</span>';
      if(bek) html += '<button onclick="faturaOde('+f.id+')" style="font-size:11px;padding:2px 7px;background:#ecfdf5;color:#065f46;border:1px solid #6ee7b7;border-radius:4px;cursor:pointer">Ödendi</button>';
      html += '</div></div>';
    });
  } else {
    html += '<div style="color:#9ca3af;font-size:13px;text-align:center;padding:8px 0">Bağlı fatura yok — yeni fatura girerken bu cariyi seçin</div>';
  }

  // --- Ödemeler bölümü ---
  html += '<div style="border-top:1px solid #f3f4f6;margin:12px 0 8px 0"></div>';
  html += '<div style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;display:flex;justify-content:space-between">'+
    '<span>Ödemeler (Gider Kayıtları)</span><span>'+para(toplamOdeme)+'</span></div>';

  if(odList.length) {
    odList.forEach(function(k) {
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-radius:6px;margin-bottom:3px;background:#f0fdf4">';
      html += '<span style="font-size:13px;color:#065f46">'+fmtT(k.tarih);
      if(k.aciklama) html += ' <span style="font-size:11px;color:#6b7280">'+htmlEsc(k.aciklama)+'</span>';
      html += '</span>';
      html += '<span style="font-size:13px;font-weight:600;color:#059669">'+para(k.tutar)+'</span>';
      html += '</div>';
    });
  } else {
    html += '<div style="color:#9ca3af;font-size:13px;text-align:center;padding:8px 0">Bağlı ödeme yok — gider kaydı girerken bu cariyi seçin</div>';
  }

  // --- Önerilen eşleşmemiş kayıtlar ---
  if(oneriler.length) {
    html += '<div style="border-top:1px solid #f3f4f6;margin:12px 0 8px 0"></div>';
    html += '<div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">'+
      'Bu cariye ait olabilir ('+oneriler.length+' kayıt)</div>';
    oneriler.forEach(function(k) {
      html += '<div id="vd-oneri-'+k.id+'" style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-radius:6px;margin-bottom:3px;background:#fef9e7;border:1px solid #fde68a">';
      html += '<div style="flex:1">';
      html += '<span style="font-size:13px;color:#92400e">'+fmtT(k.tarih)+'</span>';
      html += ' <span style="font-size:12px;color:#6b7280">'+htmlEsc(k.firma||'')+'</span>';
      if(k.aciklama) html += ' <span style="font-size:11px;color:#9ca3af">'+htmlEsc(k.aciklama)+'</span>';
      html += '</div>';
      html += '<div style="display:flex;align-items:center;gap:6px">';
      html += '<span style="font-size:13px;font-weight:600;color:#92400e">'+para(k.tutar)+'</span>';
      html += '<button onclick="kaydiCarieBagla('+k.id+','+cari_id+')" style="font-size:11px;padding:2px 8px;background:#3b82f6;color:#fff;border:none;border-radius:4px;cursor:pointer">Bağla</button>';
      html += '<button onclick="kaydiReddet('+k.id+','+cari_id+')" style="font-size:11px;padding:2px 6px;background:none;color:#9ca3af;border:1px solid #e5e7eb;border-radius:4px;cursor:pointer">Değil</button>';
      html += '</div></div>';
    });
  }

  // --- Manuel vade ekle ---
  html += '<div style="border-top:1px solid #f3f4f6;margin:12px 0 0 0;padding-top:10px;display:flex;gap:8px;align-items:flex-end">';
  html += '<div class="field" style="flex:1"><label>Tutar (₺)</label><input type="number" id="vd-ytutar-'+cari_id+'" placeholder="0.00" step="0.01" min="0"></div>';
  html += '<div class="field" style="flex:1"><label>Vade (gün)</label><input type="number" id="vd-ygun-'+cari_id+'" placeholder="30" min="1" max="365"></div>';
  html += '<button onclick="vadeEkle('+cari_id+')" style="padding:7px 14px;background:#3b82f6;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;white-space:nowrap;flex-shrink:0;font-weight:500">+ Manuel Vade</button>';
  html += '</div>';

  html += '</div></div>';
  return html;
}

// ---- ÖNERİ FORMÜLÜ ----

function _onerilenKayitlar(cari_id, fatList) {
  var dismissed = _vdDismissed[cari_id] || {};
  var aliases   = _cariIsimleri(cari_id);

  // Cari isminden anlamlı kelimeler (>3 harf, sayısal olmayan)
  var cariObj = window.cariler && cariler.find(function(c){ return c.id===cari_id; });
  var kelimeler = cariObj ? cariObj.ad.split(/\s+/).filter(function(w){
    return w.length > 3 && !/^\d+$/.test(w);
  }) : [];

  // Fatura tarih aralığı
  var minTarih = null, maxTarih = null;
  if(fatList.length) {
    var tarihler = fatList.map(function(f){ return f.tarih; }).sort();
    minTarih = tarihler[0];
    maxTarih = tarihler[tarihler.length-1];
    // Aralığı 90 gün genişlet
    var minD = new Date(minTarih+'T00:00:00');
    var maxD = new Date(maxTarih+'T00:00:00');
    minD.setDate(minD.getDate()-90);
    maxD.setDate(maxD.getDate()+90);
    minTarih = ldStr(minD);
    maxTarih = ldStr(maxD);
  }

  return (window.kayitlar||[]).filter(function(k) {
    if(k.cari_id)           return false; // zaten bağlı
    if(k.tur !== 'gider')   return false;
    if(dismissed[k.id])     return false;
    if(!k.firma)            return false;

    var firma = k.firma.toUpperCase().trim();

    // 1. Alias tam eşleşmesi
    if(aliases.indexOf(firma) !== -1) return true;

    // 2. Cari isminden kelime içeriyorsa + tarih aralığında
    var kelimeEsles = kelimeler.some(function(w){
      return firma.indexOf(w.toUpperCase()) !== -1;
    });
    if(!kelimeEsles) return false;
    if(minTarih && maxTarih) return k.tarih >= minTarih && k.tarih <= maxTarih;
    return true;
  }).slice(0, 20); // en fazla 20 öneri
}

// ---- KAYIT BAĞLAMA ----

async function kaydiCarieBagla(kayit_id, cari_id) {
  await dbPatch('kayitlar', 'id', kayit_id, {cari_id: cari_id});
  var idx = -1;
  (window.kayitlar||[]).forEach(function(k,i){ if(k.id===kayit_id) idx=i; });
  if(idx !== -1) kayitlar[idx].cari_id = cari_id;
  renderVadeler();
  renderVadeBudget();
}

function kaydiReddet(kayit_id, cari_id) {
  if(!_vdDismissed[cari_id]) _vdDismissed[cari_id] = {};
  _vdDismissed[cari_id][kayit_id] = true;
  var el = document.getElementById('vd-oneri-'+kayit_id);
  if(el) el.style.display = 'none';
}

// ---- VADE CRUD (manuel) ----

function vadeEkle(cari_id) {
  var tutarEl = document.getElementById('vd-ytutar-'+cari_id);
  var gunEl   = document.getElementById('vd-ygun-'+cari_id);
  if(!tutarEl || !gunEl) return;
  var tutar = parseFloat(tutarEl.value);
  var gun   = parseInt(gunEl.value, 10);
  if(!tutar || tutar <= 0 || !gun || gun < 1) { alert('Tutar ve vade gün sayısı giriniz.'); return; }
  var vadeTarihi = ldStr(new Date(Date.now() + gun * 86400000));
  dbPost('cari_vadeler', {
    cari_id: cari_id, tip: 'borc', tutar: tutar,
    vade_tarihi: vadeTarihi, odendi: false
  }).then(function(r) {
    if(r && r[0]) {
      cariVadeler.push(r[0]);
      tutarEl.value = ''; gunEl.value = '';
      renderVadeler();
    }
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
    odendi: true, odeme_tarihi: odTarih, odeme_notu: not||null
  }).then(function() {
    var idx = -1;
    (window.cariVadeler||[]).forEach(function(v,i){ if(v.id===_vadeOdemeId) idx=i; });
    if(idx !== -1) {
      cariVadeler[idx].odendi = true;
      cariVadeler[idx].odeme_tarihi = odTarih;
    }
    vadeOdemeKapat();
    renderVadeler();
  });
}

function vadeSil(id) {
  if(!confirm('Bu vadeyi silmek istediğinize emin misiniz?')) return;
  dbDelete('cari_vadeler', 'id', id).then(function() {
    cariVadeler = (window.cariVadeler||[]).filter(function(v){ return v.id !== id; });
    renderVadeler();
  });
}
