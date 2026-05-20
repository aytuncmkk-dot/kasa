// ============================================================
// CARİ HESAP — cari_id bazlı fatura/ödeme takibi
// Bağımlılık: db.js, utils.js, config.js
// ============================================================

var _vdTakipListesi = [];   // localStorage'dan gelen cari_id array
var _vadeOdemeId    = null;
var _vadeDuzId      = null;
var _cariHareketCariId = null;
var _cariHareketTip    = null;
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
  var c = cariler.find(function(x){ return Number(x.id)===Number(cari_id); });
  if(!c) return 'Cari #'+cari_id;
  // Fatura kaynaklı resmi isim varsa onu tercih et
  if(window.cariAliases) {
    var resmiAliaslar = cariAliases.filter(function(a){
      return a.cari_id===cari_id && a.alias && a.alias.trim() !== c.ad.trim();
    });
    if(resmiAliaslar.length) {
      // manuel (kullanıcı ataması) > otomatik > fuzzy > kayit
      var oncelik = ['manuel','otomatik','fuzzy','kayit'];
      for(var oi=0; oi<oncelik.length; oi++) {
        var grup = resmiAliaslar.filter(function(a){ return a.kaynak===oncelik[oi]; });
        if(grup.length) return grup.sort(function(a,b){ return b.alias.length-a.alias.length; })[0].alias;
      }
    }
  }
  return c.ad;
}

async function cariAdDuzenle(cari_id) {
  var mevcutAd = _vadeCariAdi(cari_id);
  var yeniAd = prompt('Cari adını düzenle:', mevcutAd);
  if(!yeniAd || !yeniAd.trim() || yeniAd.trim()===mevcutAd) return;
  yeniAd = yeniAd.trim();
  var r = await dbPatch('cariler','id',cari_id,{ad:yeniAd});
  if(r && r.ok) {
    var c = (window.cariler||[]).find(function(x){ return x.id===cari_id; });
    if(c) c.ad = yeniAd;
    _refreshCariKart(cari_id);
  }
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
  // Tarih filtresi input'unu doldur
  var bi = document.getElementById('fat-baslangic-input');
  if(bi && typeof _fatBaslangic !== 'undefined') bi.value = _fatBaslangic;
  renderVadeBudget();
  renderHaftalikOzet();
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
  var scrollY = window.scrollY;
  renderVadeler();
  renderVadeBudget();
  window.scrollTo(0, scrollY);
}

function vdCariKaldir(cari_id) {
  _vdTakipListesi = _vdTakipListesi.filter(function(x){ return x !== cari_id; });
  _vdTakipKaydet();
  var scrollY = window.scrollY;
  renderVadeler();
  renderVadeBudget();
  window.scrollTo(0, scrollY);
}

// ---- BUDGET ÖZET ----

function renderVadeBudget() {
  var el = document.getElementById('vd-budget');
  if(!el) return;
  var bugun = new Date(today+'T00:00:00');

  // Takip listesindeki carilerin alias firma isimlerini topla
  var _takipFirmaSet = {};
  _vdTakipListesi.forEach(function(cid){
    _cariIsimleri(cid).forEach(function(fn){ _takipFirmaSet[fn] = true; });
  });
  var takipFaturalar = (window.faturalar||[]).filter(function(f){
    return f.firma && _takipFirmaSet[f.firma.toUpperCase().trim()] && f.durum!=='odendi';
  });

  // cariVadeler (manuel vadeler) de dahil et
  var takipManuelVadeler = (window.cariVadeler||[]).filter(function(v){
    return _vdTakipListesi.indexOf(Number(v.cari_id)) !== -1 && !v.odendi;
  });

  function topla(gun) {
    var limit = new Date(bugun.getTime() + gun*86400000);
    var fatTop = takipFaturalar.filter(function(f){
      var vt = f.vade || f.vade_tarihi;
      return vt && new Date(vt+'T00:00:00') <= limit;
    }).reduce(function(s,f){ return s+Number(f.tutar||0); }, 0);
    var mvTop = takipManuelVadeler.filter(function(v){
      return v.vade_tarihi && new Date(v.vade_tarihi+'T00:00:00') <= limit;
    }).reduce(function(s,v){ return s+Number(v.tutar||0); }, 0);
    return fatTop + mvTop;
  }

  var gecFat = takipFaturalar.filter(function(f){
    var vt = f.vade || f.vade_tarihi;
    return vt && _vadeKalanGun(vt) < 0;
  });
  var gecMV = takipManuelVadeler.filter(function(v){
    return v.vade_tarihi && _vadeKalanGun(v.vade_tarihi) < 0;
  });
  var gecToplam = gecFat.reduce(function(s,f){ return s+Number(f.tutar||0); }, 0) +
                  gecMV.reduce(function(s,v){ return s+Number(v.tutar||0); }, 0);

  var cards = '';
  var gecToplamSayi = gecFat.length + gecMV.length;
  if(gecToplamSayi) {
    cards += '<div class="ok" style="flex:1;min-width:140px;border-top:3px solid #dc2626;background:#fef2f2">'+
      '<div class="ok-label" style="color:#991b1b">GECİKMİŞ</div>'+
      '<div class="ok-val" style="color:#dc2626">'+para(gecToplam)+'</div>'+
      '<div style="font-size:11px;color:#991b1b;margin-top:3px">'+gecToplamSayi+' kayıt</div>'+
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
  _vdTakipYukle();
  var _trackFirmaSet = {};
  _vdTakipListesi.forEach(function(cid){
    _cariIsimleri(cid).forEach(function(fn){ _trackFirmaSet[fn] = true; });
  });
  var gecikmis = (window.faturalar||[]).filter(function(f){
    if(f.durum==='odendi') return false;
    if(!f.firma || !_trackFirmaSet[f.firma.toUpperCase().trim()]) return false;
    var vt = f.vade || f.vade_tarihi;
    return vt && _vadeKalanGun(vt) < 0;
  });
  var buHafta = (window.faturalar||[]).filter(function(f){
    if(f.durum==='odendi') return false;
    if(!f.firma || !_trackFirmaSet[f.firma.toUpperCase().trim()]) return false;
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

  var baslangic = (typeof _fatBaslangic !== 'undefined') ? _fatBaslangic : '2026-03-01';

  // Tüm firmaların ad setini bir kez oluştur: firma_upper → cari_id (null = eşleşmez)
  var firmaCariMap = {};  // firma_upper → cari_id|null
  (window.cariler||[]).forEach(function(c){
    var isimler = _cariIsimleri(c.id);
    isimler.forEach(function(n){ firmaCariMap[n] = c.id; });
  });

  // Tarih aralığındaki tüm faturaları tara
  var fatCariSet = {};           // cari_id → true  (eşleşen)
  var orphanFirmaSet = {};       // firma_upper → [fatura, ...]  (eşleşmeyen)

  (window.faturalar||[]).forEach(function(f){
    if(!f.firma || !f.tarih || f.tarih < baslangic) return;
    var up = f.firma.toUpperCase().trim();
    var cid = firmaCariMap[up];
    if(cid) {
      fatCariSet[cid] = true;
    } else {
      if(!orphanFirmaSet[up]) orphanFirmaSet[up] = [];
      orphanFirmaSet[up].push(f);
    }
  });

  // Takip listesindeki carileri de ekle
  (_vdTakipListesi||[]).forEach(function(cid){ fatCariSet[Number(cid)] = true; });

  var cariIds = Object.keys(fatCariSet).map(Number);

  if(!cariIds.length && !Object.keys(orphanFirmaSet).length) {
    el.innerHTML = '';
    if(em) { em.style.display='block'; em.textContent=baslangic+' tarihinden itibaren fatura bulunamadı.'; }
    return;
  }
  if(em) em.style.display = 'none';

  // Cari kartları — açık bakiyeye göre büyükten küçüğe
  cariIds.sort(function(a, b){
    var isimA = _cariIsimleri(a), isimB = _cariIsimleri(b);
    var borA = (window.faturalar||[]).reduce(function(s,f){
      if(!f.firma||!f.tarih||f.tarih<baslangic) return s;
      if(isimA.indexOf(f.firma.toUpperCase().trim())===-1) return s;
      return s+(typeof _fatKalan==='function'?_fatKalan(f.id,f.tutar):0);
    }, 0);
    var borB = (window.faturalar||[]).reduce(function(s,f){
      if(!f.firma||!f.tarih||f.tarih<baslangic) return s;
      if(isimB.indexOf(f.firma.toUpperCase().trim())===-1) return s;
      return s+(typeof _fatKalan==='function'?_fatKalan(f.id,f.tutar):0);
    }, 0);
    return borB - borA;
  });

  var html = '';
  cariIds.forEach(function(cari_id){ html += _cariKart(cari_id); });

  // Eşleşmeyen firma kartları — cari tanımı yok, sadece fatura listesi
  Object.keys(orphanFirmaSet).sort().forEach(function(firma_up){
    var fatlar = orphanFirmaSet[firma_up].sort(function(a,b){ return a.tarih>b.tarih?1:-1; });
    var topAcik = fatlar.reduce(function(s,f){
      return s+(typeof _fatKalan==='function'?_fatKalan(f.id,f.tutar):Number(f.tutar));
    }, 0);
    html += '<details style="border:1px solid #fde68a;border-radius:10px;margin-bottom:10px;overflow:hidden">';
    html += '<summary style="background:#fefce8;padding:11px 16px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;list-style:none;border-bottom:1px solid #fde68a">';
    html += '<span style="font-weight:600;font-size:14px;color:#92400e">'+htmlEsc(fatlar[0].firma)+'</span>';
    html += '<div style="display:flex;gap:10px;align-items:center">';
    if(topAcik>0.01) html += '<span style="font-size:13px;font-weight:700;color:#dc2626">Açık '+para(topAcik)+'</span>';
    html += '<span style="font-size:11px;color:#9ca3af">'+fatlar.length+' fatura · cari eşleşmedi</span>';
    html += '</div></summary>';
    html += '<div style="padding:10px 14px">';
    fatlar.forEach(function(f){
      var kalan = typeof _fatKalan==='function'?_fatKalan(f.id,f.tutar):Number(f.tutar);
      var renk = kalan>0.01?'#dc2626':'#059669';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f3f4f6;font-size:13px">';
      html += '<span style="color:#6b7280">'+fmtT(f.tarih)+(f.fatura_no?' · '+htmlEsc(f.fatura_no):'')+'</span>';
      html += '<span style="font-weight:600;color:'+renk+'">'+para(kalan)+'</span>';
      html += '</div>';
    });
    html += '</div></details>';
  });

  el.innerHTML = html;
}

// Sadece belirli bir cari kartını yeniler — scroll ve açık/kapalı durum korunur
function _refreshCariKart(cari_id) {
  var el = document.getElementById('vd-kart-'+cari_id);
  if(!el) { renderVadeler(); return; }
  var wasOpen = el.open;
  var scrollY = window.scrollY;
  // Focus kaybı scroll-to-top tetikler — önce blur et
  if(document.activeElement && el.contains(document.activeElement)) {
    document.activeElement.blur();
  }
  var tmpDiv = document.createElement('div');
  tmpDiv.innerHTML = _cariKart(Number(cari_id));
  var newEl = tmpDiv.firstElementChild;
  if(wasOpen) newEl.setAttribute('open', '');
  el.parentNode.replaceChild(newEl, el);
  // rAF: browser reflow tamamlanınca scroll restore et
  requestAnimationFrame(function(){ window.scrollTo(0, scrollY); });
  renderVadeBudget();
}

// ---- CARİ KART ----

function _cariKart(cari_id) {
  var cadi      = _vadeCariAdi(cari_id);
  var cariObj   = (window.cariler||[]).find(function(x){ return x.id===cari_id; });
  var firmaSet  = _cariIsimleri(cari_id);

  // Tarih filtreli faturalar
  var fatList = (window.faturalar||[]).filter(function(f){
    if(!f.firma) return false;
    if(firmaSet.indexOf(f.firma.toUpperCase().trim()) === -1) return false;
    if(f.tarih && f.tarih < (typeof _fatBaslangic!=='undefined'?_fatBaslangic:'2026-01-01')) return false;
    return true;
  });

  // Açık bakiye — fatura bazlı kalan toplamı
  var acikBakiye = fatList.reduce(function(s,f){
    var d = typeof _fatDurum==='function' ? _fatDurum(f.id,f.tutar) : 'acik';
    return s + (d==='tam'?0:(typeof _fatKalan==='function'?_fatKalan(f.id,f.tutar):Number(f.tutar)));
  }, 0);

  var bakiyeRenk = acikBakiye > 0 ? '#dc2626' : (acikBakiye < 0 ? '#059669' : '#6b7280');

  var html = '<details id="vd-kart-'+cari_id+'" open style="border:1px solid #e5e7eb;border-radius:10px;margin-bottom:10px;overflow:hidden">';

  // Summary
  html += '<summary style="background:#f9fafb;padding:11px 16px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;list-style:none;border-bottom:1px solid #e5e7eb">';
  html += '<div style="display:flex;align-items:center;gap:6px">';
  html += '<span style="font-weight:600;font-size:14px">'+htmlEsc(cadi)+'</span>';
  if(cariObj && cariObj.ad !== cadi) html += '<span style="font-size:11px;color:#9ca3af">('+htmlEsc(cariObj.ad)+')</span>';
  html += '<button onclick="event.stopPropagation();cariAdDuzenle('+cari_id+')" title="Cari adını düzenle" style="font-size:12px;background:none;border:none;color:#9ca3af;cursor:pointer;padding:0 2px">✏️</button>';
  html += '</div>';
  html += '<div style="display:flex;align-items:center;gap:10px" onclick="event.stopPropagation()">';
  if(acikBakiye > 0.01) {
    html += '<span style="font-size:13px;font-weight:700;color:'+bakiyeRenk+'">Açık Borç '+para(acikBakiye)+'</span>';
  } else if(fatList.length) {
    html += '<span style="font-size:12px;color:#059669;font-weight:600">✓ Kapalı</span>';
  }
  html += '<span style="font-size:11px;color:#9ca3af">'+fatList.length+' fatura</span>';
  html += '<button onclick="event.stopPropagation();vdCariKaldir('+cari_id+')" style="font-size:11px;color:#9ca3af;background:none;border:1px solid #e5e7eb;border-radius:4px;padding:2px 8px;cursor:pointer">Çıkar</button>';
  html += '</div></summary>';

  html += '<div style="padding:12px 16px">';

  // Faturalar — faturat.js renderFaturaBolumu
  html += '<div style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Faturalar</div>';
  html += (typeof renderFaturaBolumu==='function') ? renderFaturaBolumu(cari_id) : '';

  // Manuel Vadeler (cari_vadeler)
  var manuelVadeler = (window.cariVadeler||[]).filter(function(v){ return Number(v.cari_id)===cari_id; });
  if(manuelVadeler.length) {
    var mvAcik = manuelVadeler.filter(function(v){ return !v.odendi; }).reduce(function(s,v){ return s+Number(v.tutar||0); }, 0);
    html += '<div style="border-top:1px solid #f3f4f6;margin:12px 0 8px 0"></div>';
    html += '<div style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;display:flex;justify-content:space-between">'+
      '<span>Manuel Vadeler</span><span style="color:'+(mvAcik>0?'#dc2626':'#059669')+'">'+para(mvAcik)+'</span></div>';
    manuelVadeler.slice().sort(function(a,b){ return (a.vade_tarihi||'')>(b.vade_tarihi||'')?1:-1; }).forEach(function(v){
      var kg = v.vade_tarihi ? _vadeKalanGun(v.vade_tarihi) : 0;
      var r  = _vadeRenk(kg, v.odendi);
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-radius:6px;margin-bottom:3px;background:'+(r.bg||'#f9fafb')+'">';
      html += '<div style="flex:1"><span style="font-size:13px;color:'+r.text+'">'+(v.vade_tarihi?fmtT(v.vade_tarihi):'—')+'</span>';
      if(v.fatura_no) html += ' <span style="font-size:11px;color:#9ca3af">'+htmlEsc(v.fatura_no)+'</span>';
      if(!v.odendi && v.vade_tarihi) html += ' <span style="font-size:11px;color:'+r.text+';margin-left:6px">'+_vadeKalanMetin(kg,false)+'</span>';
      if(v.odendi) html += ' <span style="font-size:11px;color:#059669">✓ Ödendi</span>';
      if(v.aciklama) html += ' — <span style="font-size:11px;color:#9ca3af">'+htmlEsc(v.aciklama)+'</span>';
      html += '</div>';
      html += '<div style="display:flex;align-items:center;gap:5px">';
      html += '<span style="font-size:13px;font-weight:600;color:'+r.text+'">'+para(v.tutar||0)+'</span>';
      if(!v.odendi) html += '<button onclick="vadeOdendiAc('+v.id+')" style="font-size:11px;padding:2px 7px;background:#ecfdf5;color:#065f46;border:1px solid #6ee7b7;border-radius:4px;cursor:pointer">Ödendi</button>';
      if(!v.odendi) html += '<button onclick="vadeDuzAc('+v.id+')" style="font-size:11px;padding:2px 5px;background:none;color:#6b7280;border:1px solid #e5e7eb;border-radius:4px;cursor:pointer">✏️</button>';
      html += '<button onclick="vadeSil('+v.id+')" style="font-size:11px;padding:2px 5px;background:none;color:#9ca3af;border:1px solid #e5e7eb;border-radius:4px;cursor:pointer">✕</button>';
      html += '</div></div>';
    });
  }

  // Manuel vade ekle
  html += '<div style="border-top:1px solid #f3f4f6;margin:12px 0 0 0;padding-top:10px;display:flex;gap:8px;align-items:flex-end">';
  html += '<div class="field" style="flex:1"><label>Tutar (₺)</label><input type="number" id="vd-ytutar-'+cari_id+'" placeholder="0.00" step="0.01" min="0"></div>';
  html += '<div class="field" style="flex:1"><label>Vade (gün)</label><input type="number" id="vd-ygun-'+cari_id+'" placeholder="30" min="1" max="365"></div>';
  html += '<button onclick="vadeEkle('+cari_id+')" style="padding:7px 14px;background:#3b82f6;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;white-space:nowrap;flex-shrink:0;font-weight:500">+ Manuel Vade</button>';
  html += '</div>';

  html += '</div></details>';
  return html;
}

// ---- ÖNERİ FORMÜLÜ ----

function _onerilenKayitlar(cari_id, fatList) {
  var dismissed = _vdDismissed[cari_id] || {};
  var aliases   = _cariIsimleri(cari_id);

  // Cari isminden anlamlı kelimeler (>3 harf, sayısal olmayan)
  var cariObj = window.cariler && cariler.find(function(c){ return c.id===cari_id; });
  var kelimeler = cariObj ? cariObj.ad.split(/\s+/).filter(function(w){
    return w.length >= 3 && !/^\d+$/.test(w);
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
    if(k.tur !== 'gider')   return false;
    if(dismissed[k.id])     return false;
    if(!k.firma)            return false;

    var firma = k.firma.toUpperCase().trim();

    // Herhangi bir cariye alias ile bağlıysa atla
    var eslenmisMi = (window.cariAliases||[]).some(function(a){
      return a.alias && a.alias.toUpperCase().trim()===firma;
    });
    if(eslenmisMi) return false;

    // Cari isminden kelime içeriyorsa + tarih aralığında öner
    var kelimeEsles = kelimeler.some(function(w){
      return firma.indexOf(w.toUpperCase()) !== -1;
    });
    if(!kelimeEsles) return false;
    if(minTarih && maxTarih) return k.tarih >= minTarih && k.tarih <= maxTarih;
    return true;
  }).slice(0, 20);
}

// ---- KAYIT BAĞLAMA ----

async function kaydiCarieBagla(kayit_id, cari_id) {
  var kayit = (window.kayitlar||[]).find(function(k){ return k.id===kayit_id; });
  if(kayit && kayit.firma && typeof aliasAtaSessiz==='function') {
    // aliasAtaSessiz zaten cariAliases'e push ediyor — tam DB yüklemesi gereksiz
    await aliasAtaSessiz(kayit.firma, cari_id);
  }
  _refreshCariKart(cari_id);
}

function kaydiReddet(kayit_id, cari_id) {
  if(!_vdDismissed[cari_id]) _vdDismissed[cari_id] = {};
  _vdDismissed[cari_id][kayit_id] = true;
  var el = document.getElementById('vd-oneri-'+kayit_id);
  if(el) el.style.display = 'none';
}

// ---- VADE CRUD (manuel) ----

async function vadeEkle(cari_id) {
  var tutarEl = document.getElementById('vd-ytutar-'+cari_id);
  var gunEl   = document.getElementById('vd-ygun-'+cari_id);
  if(!tutarEl || !gunEl) return;
  var tutar = parseFloat(tutarEl.value);
  var gun   = parseInt(gunEl.value, 10);
  if(!tutar || tutar <= 0 || !gun || gun < 1) { alert('Tutar ve vade gün sayısı giriniz.'); return; }
  var vadeTarihi = ldStr(new Date(Date.now() + gun * 86400000));
  try {
    var r = await dbPost('cari_vadeler', [{cari_id:cari_id, tip:'borc', tutar:tutar, vade_tarihi:vadeTarihi, odendi:false}]);
    if(r && r.ok) {
      tutarEl.value = ''; gunEl.value = '';
      // Vadeyi memory'ye ekle — tam listeyi yeniden yükle
      try{ var vd=await dbGet('cari_vadeler','cari_id=eq.'+cari_id+'&order=vade_tarihi.asc'); if(Array.isArray(vd)) { cariVadeler=cariVadeler.filter(function(v){return v.cari_id!==cari_id;}); cariVadeler=cariVadeler.concat(vd); } }catch(e){}
      _refreshCariKart(cari_id);
    }
  } catch(e) { alert('Vade eklenemedi.'); }
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
  var hedefVade = (window.cariVadeler||[]).find(function(v){ return v.id===_vadeOdemeId; });
  var hedefCariId = hedefVade ? hedefVade.cari_id : null;
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
    if(hedefCariId) _refreshCariKart(hedefCariId); else renderVadeler();
  });
}

function vadeSil(id) {
  if(!confirm('Bu vadeyi silmek istediğinize emin misiniz?')) return;
  var hedefVade = (window.cariVadeler||[]).find(function(v){ return v.id===id; });
  var hedefCariId = hedefVade ? hedefVade.cari_id : null;
  dbDelete('cari_vadeler', 'id', id).then(function() {
    cariVadeler = (window.cariVadeler||[]).filter(function(v){ return v.id !== id; });
    if(hedefCariId) _refreshCariKart(hedefCariId); else renderVadeler();
  });
}

// ---- TAKİP MODALİ ----

function vadeTakipKapat() {
  var m = document.getElementById('vd-takip-modal');
  if(m) m.classList.remove('open');
}

function vadeTakipKaydet() {
  var el = document.getElementById('vd-tak-cari');
  var id = el ? Number(el.value) : 0;
  if(!id) { alert('Lütfen bir cari seçin.'); return; }
  if(_vdTakipListesi.indexOf(id) === -1) {
    _vdTakipListesi.push(id);
    _vdTakipKaydet();
  }
  if(el) el.value = '';
  vadeTakipKapat();
  renderVadeler();
  renderVadeBudget();
}

// ---- VADE DÜZENLEME MODALİ ----

function vadeDuzAc(id) {
  _vadeDuzId = id;
  var v = (window.cariVadeler||[]).find(function(x){ return x.id===id; });
  if(!v) return;
  var m = document.getElementById('vd-duz-modal');
  if(!m) return;
  var sel = document.getElementById('vd-duz-cari');
  if(sel) {
    sel.innerHTML = '<option value="">— Cari seçin —</option>'+
      (window.cariler||[]).slice().sort(function(a,b){ return a.ad.localeCompare(b.ad,'tr'); })
      .map(function(c){ return '<option value="'+c.id+'"'+(Number(c.id)===Number(v.cari_id)?' selected':'')+'>'+htmlEsc(c.ad)+'</option>'; }).join('');
  }
  var tutarEl = document.getElementById('vd-duz-tutar');
  if(tutarEl) tutarEl.value = v.tutar||'';
  var tarihEl = document.getElementById('vd-duz-tarih');
  if(tarihEl) tarihEl.value = v.vade_tarihi||'';
  var fatEl = document.getElementById('vd-duz-fatura-no');
  if(fatEl) fatEl.value = v.fatura_no||'';
  var acikEl = document.getElementById('vd-duz-aciklama');
  if(acikEl) acikEl.value = v.aciklama||'';
  m.classList.add('open');
}

function vadeDuzKapat() {
  var m = document.getElementById('vd-duz-modal');
  if(m) m.classList.remove('open');
  _vadeDuzId = null;
}

async function vadeDuzKaydet() {
  if(!_vadeDuzId) return;
  var sel    = document.getElementById('vd-duz-cari');
  var tutarEl= document.getElementById('vd-duz-tutar');
  var tarihEl= document.getElementById('vd-duz-tarih');
  var fatEl  = document.getElementById('vd-duz-fatura-no');
  var acikEl = document.getElementById('vd-duz-aciklama');
  var cariId = sel ? Number(sel.value) : 0;
  var tutar  = tutarEl ? parseFloat(tutarEl.value) : 0;
  var tarih  = tarihEl ? tarihEl.value : '';
  if(!cariId || !tutar || !tarih) { alert('Cari, tutar ve vade tarihi zorunludur.'); return; }
  var data = { cari_id: cariId, tutar: tutar, vade_tarihi: tarih };
  if(fatEl && fatEl.value.trim()) data.fatura_no = fatEl.value.trim();
  if(acikEl && acikEl.value.trim()) data.aciklama = acikEl.value.trim();
  try {
    var r = await dbPatch('cari_vadeler','id',_vadeDuzId,data);
    if(r && r.ok) {
      var idx = (window.cariVadeler||[]).findIndex(function(v){ return v.id===_vadeDuzId; });
      if(idx !== -1) Object.assign(cariVadeler[idx], data);
      var hedefCariId = cariId;
      vadeDuzKapat();
      _refreshCariKart(hedefCariId);
    } else { alert('Güncelleme hatası.'); }
  } catch(e) { alert('Hata: '+e.message); }
}

// ---- CARİ HAREKET MODALİ (borç/ödeme) ----

function cariHareketAc(cari_id, tip) {
  _cariHareketCariId = cari_id;
  _cariHareketTip    = tip || 'borc';
  var m = document.getElementById('ch-modal');
  if(!m) return;
  var baslik = document.getElementById('ch-baslik');
  if(baslik) baslik.textContent = tip === 'odeme' ? 'Ödeme Ekle' : 'Borç Ekle';
  var tutarEl = document.getElementById('ch-tutar');
  if(tutarEl) tutarEl.value = '';
  var belgeEl = document.getElementById('ch-belge');
  if(belgeEl) belgeEl.value = '';
  var acikEl  = document.getElementById('ch-acik');
  if(acikEl)  acikEl.value  = '';
  m.classList.add('open');
}

function cariHareketKapat() {
  var m = document.getElementById('ch-modal');
  if(m) m.classList.remove('open');
  _cariHareketCariId = null;
  _cariHareketTip    = null;
}

async function cariHareketKaydet() {
  if(!_cariHareketCariId) return;
  var tutarEl = document.getElementById('ch-tutar');
  var belgeEl = document.getElementById('ch-belge');
  var acikEl  = document.getElementById('ch-acik');
  var tutar = tutarEl ? parseFloat(tutarEl.value) : 0;
  if(!tutar || tutar <= 0) { alert('Tutar giriniz.'); return; }
  var data = { cari_id: _cariHareketCariId, tip: _cariHareketTip, tutar: tutar, tarih: today };
  if(belgeEl && belgeEl.value.trim()) data.belge_no = belgeEl.value.trim();
  if(acikEl  && acikEl.value.trim())  data.aciklama = acikEl.value.trim();
  try {
    var r = await dbPost('cari_hareketler',[data]);
    if(r && r.ok) {
      cariHareketKapat();
      _refreshCariKart(_cariHareketCariId);
    } else { alert('Kayıt hatası.'); }
  } catch(e) { alert('Hata: '+e.message); }
}
