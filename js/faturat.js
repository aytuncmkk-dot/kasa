// ============================================================
// FATURAT — Fatura-Ödeme Eşleştirme Modülü
// Bağımlılık: db.js, utils.js, config.js, cariler.js
// ============================================================

// Tarih filtresi — localStorage'dan başlat, gelecek tarih ise Mart'a sıfırla
var _fatBaslangic = (function(){
  var v = localStorage.getItem('kasa_fat_baslangic') || '2026-03-01';
  if(v > '2026-04-30') { v = '2026-03-01'; localStorage.setItem('kasa_fat_baslangic', v); }
  return v;
}());

// Modal durumu
var _fatEslModalFaturaId = null;
var _fatEslModalCariId   = null;

// ---- YARDIMCILAR ----

function _fatBaslangicKaydet(tarih) {
  _fatBaslangic = tarih;
  localStorage.setItem('kasa_fat_baslangic', tarih);
}

function _fatEslBagli(fatura_id) {
  return (window.borcOdemeler||[]).filter(function(e){
    return Number(e.fatura_id) === Number(fatura_id) && e.onaylandi !== false;
  });
}

function _fatKalan(fatura_id, fatura_tutar) {
  var bagli = _fatEslBagli(fatura_id);
  var odenen = bagli.reduce(function(s,e){ return s + Number(e.odeme_tutari||e.tutar||0); }, 0);
  return Number(fatura_tutar) - odenen;
}

function _fatDurum(fatura_id, fatura_tutar) {
  var kalan = _fatKalan(fatura_id, fatura_tutar);
  if(kalan <= 0.01) return 'tam';
  if(kalan < Number(fatura_tutar)) return 'kismi';
  return 'acik';
}

// Cari'nin tüm firma isimlerini döner (ad + alias'lar), BÜYÜK HARF
function _cariTumIsimler(cari_id) {
  var set = {};
  var c = (window.cariler||[]).find(function(x){ return x.id===cari_id; });
  if(c && c.ad) set[c.ad.toUpperCase().trim()] = true;
  (window.cariAliases||[]).forEach(function(a){
    if(Number(a.cari_id)===Number(cari_id) && a.alias)
      set[a.alias.toUpperCase().trim()] = true;
  });
  return Object.keys(set);
}

// Firma → cari_id eşleştir (alias tablosundan)
function _firmaCariId(firma) {
  if(!firma) return null;
  var up = firma.toUpperCase().trim();
  var alias = (window.cariAliases||[]).find(function(a){
    return a.alias && a.alias.toUpperCase().trim() === up;
  });
  if(alias) return Number(alias.cari_id);
  var cari = (window.cariler||[]).find(function(c){
    return c.ad && c.ad.toUpperCase().trim() === up;
  });
  return cari ? Number(cari.id) : null;
}

// ---- EŞLEŞTİRME MOTORU ----

function _fatOnerileriHesapla(fatura) {
  var fatura_id = fatura.id;
  var fatTutar  = Number(fatura.tutar || 0);
  var fatTarih  = fatura.tarih || '';
  var fatFirma  = (fatura.firma || '').toUpperCase().trim();
  var fatNo     = (fatura.fatura_no || '').toUpperCase().trim();
  var fatCariId = _firmaCariId(fatFirma);

  // Zaten bağlı kayit_id'leri çıkar
  var bagliIds  = {};
  _fatEslBagli(fatura_id).forEach(function(e){ bagliIds[e.kayit_id] = true; });

  // Gider kayıtlarından aday al
  var adaylar = (window.kayitlar||[]).filter(function(k){
    if(k.tur !== 'gider') return false;
    if(bagliIds[k.id]) return false;
    // Ödeme faturadan önce olamaz (30 gün tolerans)
    if(k.tarih < _addDays(fatTarih, -30)) return false;
    return true;
  });

  var oneriler = adaylar.map(function(k){
    var skor = 0;
    var kFirma = (k.firma || '').toUpperCase().trim();
    var kAcik  = ((k.aciklama || '') + ' ' + (k.firma || '')).toUpperCase();
    var kTutar = Number(k.tutar || 0);

    // 1. Firma / alias eşleşmesi
    if(fatFirma && kFirma === fatFirma) {
      skor += 20;
    } else if(fatCariId) {
      var kCariId = _firmaCariId(kFirma);
      if(kCariId && kCariId === fatCariId) skor += 15;
    }
    if(fatFirma && fatFirma.length >= 4) {
      var token = fatFirma.split(/\s+/)[0];
      if(token.length >= 4 && kAcik.indexOf(token) !== -1) skor += 8;
    }

    // 2. Fatura numarası açıklamada geçiyor mu?
    if(fatNo && kAcik.indexOf(fatNo) !== -1) skor += 50;

    // 3. Tutar eşleşmesi
    if(Math.abs(kTutar - fatTutar) < 1) {
      skor += 40;
    } else if(fatTutar > 0 && Math.abs(kTutar - fatTutar) / fatTutar < 0.05) {
      skor += 20;
    } else if(fatTutar > 0 && Math.abs(kTutar - fatTutar) / fatTutar < 0.15) {
      skor += 8;
    }

    // 4. Kalan tutarla eşleşme (kısmi ödeme)
    var kalan = _fatKalan(fatura_id, fatTutar);
    if(kalan > 0 && Math.abs(kTutar - kalan) < 1) skor += 30;

    // 5. Tarih yakınlığı (ödeme faturadan sonra, 60 gün içinde idealse)
    if(k.tarih >= fatTarih) {
      var gun = _gunFarki(fatTarih, k.tarih);
      if(gun <= 14) skor += 12;
      else if(gun <= 60) skor += 6;
    }

    // 6. "Fat" / "fatura" gibi anahtar kelimeler
    if(/\bfat\b|\bfatura\b/i.test(kAcik)) skor += 5;

    return { kayit: k, skor: skor };
  });

  return oneriler
    .filter(function(o){ return o.skor >= 15; })
    .sort(function(a,b){ return b.skor - a.skor; })
    .slice(0, 8);
}

function _addDays(tarih, gun) {
  if(!tarih) return '';
  var d = new Date(tarih + 'T00:00:00');
  d.setDate(d.getDate() + gun);
  return ldStr(d);
}

function _gunFarki(t1, t2) {
  var d1 = new Date(t1 + 'T00:00:00');
  var d2 = new Date(t2 + 'T00:00:00');
  return Math.round((d2 - d1) / 86400000);
}

// ---- CRUD ----

async function fatEslBagla(fatura_id, kayit_id, odeme_tutari, kaynak) {
  kaynak = kaynak || 'manuel';
  var fatura  = (window.faturalar||[]).find(function(f){ return f.id===fatura_id; });
  var cari_id = fatura ? _firmaCariId((fatura.firma||'').trim()) : null;
  var data = {
    fatura_id: fatura_id,
    kayit_id:  kayit_id,
    odeme_tutari: odeme_tutari,
    onaylandi: true,
    kaynak: kaynak,
    cari_id: cari_id || null
  };
  try {
    var r = await dbPost('borc_odemeler', [data]);
    if(r && r.ok) {
      // In-memory güncelle
      var fresh = await dbGet('borc_odemeler',
        'fatura_id=eq.'+fatura_id+'&kayit_id=eq.'+kayit_id+'&order=id.desc&limit=1');
      if(Array.isArray(fresh) && fresh.length) {
        borcOdemeler.push(fresh[0]);
      } else {
        borcOdemeler.push(Object.assign({ id: Date.now() }, data));
      }
      return true;
    }
    return false;
  } catch(e) { console.error('fatEslBagla hata:', e); return false; }
}

async function fatEslCoz(esl_id) {
  if(!confirm('Bu eşleştirmeyi kaldırmak istiyor musunuz?')) return;
  try {
    var r = await dbDelete('borc_odemeler', 'id', esl_id);
    if(r && r.ok) {
      borcOdemeler = (window.borcOdemeler||[]).filter(function(e){ return e.id !== esl_id; });
      return true;
    }
    return false;
  } catch(e) { console.error('fatEslCoz hata:', e); return false; }
}

// ---- MODAL: FATURA ÖDEME BAĞLAMA ----

function fatEslModalAc(fatura_id, cari_id) {
  _fatEslModalFaturaId = fatura_id;
  _fatEslModalCariId   = cari_id;
  _fatEslModalDoldur();
  var m = document.getElementById('fat-esl-modal');
  if(m) m.classList.add('open');
}

function fatEslModalKapat() {
  _fatEslModalFaturaId = null;
  _fatEslModalCariId   = null;
  var m = document.getElementById('fat-esl-modal');
  if(m) m.classList.remove('open');
}

function _fatEslModalDoldur() {
  var fatura_id = _fatEslModalFaturaId;
  var cari_id   = _fatEslModalCariId;
  var fatura    = (window.faturalar||[]).find(function(f){ return f.id===fatura_id; });
  if(!fatura) return;

  var el = document.getElementById('fat-esl-modal-icerik');
  if(!el) return;

  var kalan   = _fatKalan(fatura_id, fatura.tutar);
  var oneriler = _fatOnerileriHesapla(fatura);
  var bagli   = _fatEslBagli(fatura_id);

  // Bağlı ödemeler
  var bagliHtml = '';
  if(bagli.length) {
    bagliHtml = '<div style="margin-bottom:14px">';
    bagliHtml += '<div style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;margin-bottom:6px">Bağlı Ödemeler</div>';
    bagli.forEach(function(e) {
      var k = (window.kayitlar||[]).find(function(x){ return x.id===e.kayit_id; });
      var label = k ? (fmtT(k.tarih) + ' — ' + (k.firma||k.aciklama||'—')) : 'Kayıt #'+e.kayit_id;
      bagliHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:#f0fdf4;border-radius:6px;margin-bottom:4px">';
      bagliHtml += '<span style="font-size:13px;color:#065f46">'+htmlEsc(label)+'</span>';
      bagliHtml += '<div style="display:flex;gap:8px;align-items:center">';
      bagliHtml += '<strong style="color:#059669">'+para(e.odeme_tutari||e.tutar||0)+'</strong>';
      bagliHtml += '<button onclick="fatEslCozVeYenile('+e.id+','+fatura_id+','+cari_id+')" style="font-size:11px;padding:2px 6px;background:none;color:#9ca3af;border:1px solid #e5e7eb;border-radius:4px;cursor:pointer">✕</button>';
      bagliHtml += '</div></div>';
    });
    bagliHtml += '</div>';
  }

  // Öneriler
  var oneriHtml = '<div style="margin-bottom:14px">';
  oneriHtml += '<div style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;margin-bottom:6px">Önerilen Eşleşmeler <span style="color:#9ca3af;font-weight:400">(seçip onayla)</span></div>';
  if(oneriler.length) {
    oneriler.forEach(function(o, i) {
      var k = o.kayit;
      var renk = o.skor >= 60 ? '#059669' : (o.skor >= 35 ? '#d97706' : '#9ca3af');
      var tatli = '';
      if(kalan > 0 && Math.abs(Number(k.tutar) - kalan) < 1) tatli = ' (kalanı kapatır)';
      oneriHtml += '<label style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;background:#f9fafb;border-radius:6px;margin-bottom:4px;cursor:pointer;border:1px solid #e5e7eb">';
      oneriHtml += '<input type="checkbox" class="fat-esl-oneri-cb" data-idx="'+i+'" style="margin-top:2px">';
      oneriHtml += '<div style="flex:1">';
      oneriHtml += '<div style="font-size:13px;font-weight:500">'+fmtT(k.tarih)+' — '+htmlEsc(k.firma||k.aciklama||'—')+'</div>';
      if(k.aciklama && k.firma !== k.aciklama)
        oneriHtml += '<div style="font-size:11px;color:#6b7280">'+htmlEsc(k.aciklama)+'</div>';
      oneriHtml += '<div style="font-size:11px;color:'+renk+'">%'+o.skor+' eşleşme'+tatli+'</div>';
      oneriHtml += '</div>';
      oneriHtml += '<div style="text-align:right">';
      oneriHtml += '<div style="font-weight:600">'+para(k.tutar)+'</div>';
      oneriHtml += '<input type="number" id="fat-esl-tutar-'+i+'" value="'+Number(k.tutar).toFixed(2)+'" step="0.01" min="0.01" style="width:90px;padding:3px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:12px;margin-top:4px">';
      oneriHtml += '</div>';
      oneriHtml += '</label>';
    });
  } else {
    oneriHtml += '<div style="color:#9ca3af;font-size:13px;padding:8px 0">Otomatik öneri bulunamadı — aşağıdan manuel seçin.</div>';
  }
  oneriHtml += '</div>';

  // Manuel seçim dropdown
  var manuelHtml = '<div style="border-top:1px solid #f3f4f6;padding-top:12px">';
  manuelHtml += '<div style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;margin-bottom:6px">Manuel Seç</div>';
  manuelHtml += '<div style="display:flex;gap:8px;align-items:center">';
  manuelHtml += '<select id="fat-esl-manuel-kayit" style="flex:1;padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px">';
  manuelHtml += '<option value="">— Gider kaydı seçin —</option>';

  var cariIsimler = cari_id ? _cariTumIsimler(cari_id) : [];
  var giderler = (window.kayitlar||[]).filter(function(k){
    if(k.tur !== 'gider') return false;
    if(k.tarih < _addDays(fatura.tarih || _fatBaslangic, -30)) return false;
    var baglimi = (window.borcOdemeler||[]).some(function(e){
      return Number(e.fatura_id)===fatura_id && Number(e.kayit_id)===k.id;
    });
    if(baglimi) return false;
    return true;
  }).sort(function(a,b){ return b.tarih > a.tarih ? 1 : -1; });

  giderler.slice(0, 200).forEach(function(k){
    var label = fmtT(k.tarih)+' | '+(k.firma||'')+(k.aciklama?' — '+k.aciklama.substring(0,30):'');
    manuelHtml += '<option value="'+k.id+'" data-tutar="'+Number(k.tutar).toFixed(2)+'">'+htmlEsc(label)+' | '+para(k.tutar)+'</option>';
  });

  manuelHtml += '</select>';
  manuelHtml += '<input type="number" id="fat-esl-manuel-tutar" placeholder="Tutar" step="0.01" min="0.01" style="width:110px;padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px">';
  manuelHtml += '<button onclick="_fatEslManuelEkle()" style="padding:7px 14px;background:#3b82f6;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;white-space:nowrap">Ekle</button>';
  manuelHtml += '</div></div>';

  el.innerHTML = bagliHtml + oneriHtml + manuelHtml;

  // Tarih input'u otomatik tutar doldur
  var sel = document.getElementById('fat-esl-manuel-kayit');
  if(sel) {
    sel.addEventListener('change', function(){
      var opt = sel.options[sel.selectedIndex];
      var t = opt ? opt.getAttribute('data-tutar') : '';
      var ti = document.getElementById('fat-esl-manuel-tutar');
      if(ti && t) ti.value = t;
    });
  }

  // Başlık
  var baslik = document.getElementById('fat-esl-modal-baslik');
  if(baslik) {
    var d = _fatDurum(fatura_id, fatura.tutar);
    var durumLabel = d === 'tam' ? '✓ Ödendi' : (d === 'kismi' ? 'Kısmen Ödendi' : 'Açık');
    baslik.innerHTML = htmlEsc(fatura.firma||'—') +
      ' — <span style="font-size:13px;color:#6b7280">'+fmtT(fatura.tarih)+'</span>' +
      ' <span style="font-size:13px;color:#6b7280">'+para(fatura.tutar)+'</span>';
    var kalanEl = document.getElementById('fat-esl-modal-kalan');
    if(kalanEl) {
      if(d === 'tam') {
        kalanEl.style.display = 'none';
      } else {
        kalanEl.style.display = 'block';
        kalanEl.innerHTML = 'Kalan: <strong style="color:'+( kalan>0?'#dc2626':'#059669')+'">'+para(kalan)+'</strong>';
      }
    }
  }
}

async function _fatEslManuelEkle() {
  var sel    = document.getElementById('fat-esl-manuel-kayit');
  var tutarEl = document.getElementById('fat-esl-manuel-tutar');
  var kayit_id = sel ? Number(sel.value) : 0;
  var tutar    = tutarEl ? parseFloat(tutarEl.value) : 0;
  if(!kayit_id || !tutar || tutar <= 0) { alert('Kayıt ve tutar seçin.'); return; }
  var ok = await fatEslBagla(_fatEslModalFaturaId, kayit_id, tutar, 'manuel');
  if(ok) {
    _fatEslModalDoldur();
    _refreshCariKart(_fatEslModalCariId);
    renderHaftalikOzet();
  } else {
    alert('Bu kayıt zaten bağlı olabilir veya kayıt hatası oluştu.');
  }
}

async function fatEslOnaylaSecililer() {
  var fatura_id = _fatEslModalFaturaId;
  var cari_id   = _fatEslModalCariId;
  var fatura    = (window.faturalar||[]).find(function(f){ return f.id===fatura_id; });
  if(!fatura) return;

  var oneriler = _fatOnerileriHesapla(fatura);
  var cblar    = document.querySelectorAll('.fat-esl-oneri-cb:checked');
  if(!cblar.length) { alert('Hiçbir öneri seçilmedi.'); return; }

  var hata = 0;
  for(var i = 0; i < cblar.length; i++) {
    var idx    = Number(cblar[i].getAttribute('data-idx'));
    var kayit  = oneriler[idx] ? oneriler[idx].kayit : null;
    if(!kayit) continue;
    var tutarEl = document.getElementById('fat-esl-tutar-'+idx);
    var tutar   = tutarEl ? parseFloat(tutarEl.value) : Number(kayit.tutar);
    var ok = await fatEslBagla(fatura_id, kayit.id, tutar, 'oneri');
    if(!ok) hata++;
  }

  if(hata) alert(hata + ' kayıt bağlanamadı (zaten bağlı olabilir).');
  _fatEslModalDoldur();
  _refreshCariKart(cari_id);
  renderHaftalikOzet();
}

async function fatEslCozVeYenile(esl_id, fatura_id, cari_id) {
  var ok = await fatEslCoz(esl_id);
  if(ok) {
    _fatEslModalFaturaId = fatura_id;
    _fatEslModalCariId   = cari_id;
    _fatEslModalDoldur();
    _refreshCariKart(cari_id);
    renderHaftalikOzet();
  }
}

// ---- HAFTALIK ÖZET ----

function renderHaftalikOzet() {
  var el = document.getElementById('vd-haftalik-ozet');
  if(!el) return;

  var bugun = new Date(today + 'T00:00:00');

  // Açık faturaları al (tarih filtreli)
  var acikFaturalar = (window.faturalar||[]).filter(function(f){
    if((f.durum === 'odendi' || f.odendi_mi) && _fatDurum(f.id, f.tutar) !== 'kismi') return false;
    if(_fatDurum(f.id, f.tutar) === 'tam') return false;
    if(f.tarih && f.tarih < _fatBaslangic) return false;
    return true;
  });

  function topla(fromGun, toGun) {
    var from = fromGun !== null ? new Date(bugun.getTime() + fromGun * 86400000) : null;
    var to   = toGun   !== null ? new Date(bugun.getTime() + toGun   * 86400000) : null;
    return acikFaturalar.filter(function(f){
      var vt = f.vade;
      if(!vt) return false;
      var vd = new Date(vt + 'T00:00:00');
      if(from !== null && vd < from) return false;
      if(to   !== null && vd > to)   return false;
      return true;
    }).reduce(function(s,f){ return s + _fatKalan(f.id, f.tutar); }, 0);
  }

  function sayi(fromGun, toGun) {
    var from = fromGun !== null ? new Date(bugun.getTime() + fromGun * 86400000) : null;
    var to   = toGun   !== null ? new Date(bugun.getTime() + toGun   * 86400000) : null;
    return acikFaturalar.filter(function(f){
      var vt = f.vade;
      if(!vt) return false;
      var vd = new Date(vt + 'T00:00:00');
      if(from !== null && vd < from) return false;
      if(to   !== null && vd > to)   return false;
      return true;
    }).length;
  }

  var gecToplam = topla(null, -1);
  var buHafta   = topla(0, 6);
  var gelHafta  = topla(7, 13);
  var buAy      = topla(0, 30);
  var vadesiYok = acikFaturalar.filter(function(f){ return !f.vade; })
                    .reduce(function(s,f){ return s + _fatKalan(f.id, f.tutar); }, 0);

  var html = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">';

  function kart(label, tutar, adet, renk, bg) {
    if(tutar <= 0 && adet === 0) return '';
    return '<div style="flex:1;min-width:120px;border-top:3px solid '+renk+';background:'+(bg||'#fff')+';border:1px solid #e5e7eb;border-top:3px solid '+renk+';border-radius:8px;padding:10px 14px">'+
      '<div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">'+label+'</div>'+
      '<div style="font-size:17px;font-weight:700;color:'+renk+'">'+para(tutar)+'</div>'+
      (adet ? '<div style="font-size:11px;color:#9ca3af;margin-top:2px">'+adet+' fatura</div>' : '')+
    '</div>';
  }

  html += kart('Gecikmiş', gecToplam, sayi(null,-1), '#dc2626', '#fef2f2');
  html += kart('Bu Hafta', buHafta,   sayi(0,6),     '#f59e0b');
  html += kart('Gel. Hafta', gelHafta, sayi(7,13),   '#3b82f6');
  html += kart('Bu Ay (30g)', buAy,    sayi(0,30),   '#6b7280');
  if(vadesiYok > 0) html += kart('Vade Yok', vadesiYok, 0, '#9ca3af');

  html += '</div>';
  el.innerHTML = html;
}

// ---- TARİH FİLTRESİ UI ----

function fatBaslangicDegistir() {
  var el = document.getElementById('fat-baslangic-input');
  if(!el) return;
  _fatBaslangicKaydet(el.value);
  // Tüm vadeler yeniden render
  renderVadeler();
  renderVadeBudget();
  renderHaftalikOzet();
}

// ---- FATURA KARTI BLOĞU (vadeler.js _cariKart'ı çağırır) ----

function renderFaturaBolumu(cari_id) {
  var cariIsimler = _cariTumIsimler(cari_id);

  var fatList = (window.faturalar||[]).filter(function(f){
    if(!f.firma) return false;
    var up = f.firma.toUpperCase().trim();
    if(cariIsimler.indexOf(up) === -1) return false;
    if(f.tarih && f.tarih < _fatBaslangic) return false;
    return true;
  }).sort(function(a,b){ return (a.vade||a.tarih) > (b.vade||b.tarih) ? 1 : -1; });

  if(!fatList.length) {
    return '<div style="color:#9ca3af;font-size:13px;text-align:center;padding:8px 0">'+
      _fatBaslangic + ' tarihinden itibaren bağlı fatura yok</div>';
  }

  var html = '';
  var toplamAcik = 0;

  fatList.forEach(function(f) {
    var kalan  = _fatKalan(f.id, f.tutar);
    var durum  = _fatDurum(f.id, f.tutar);
    var bagli  = _fatEslBagli(f.id);
    var vt     = f.vade;
    var kalan_gun = vt ? _gunFarki(today, vt) : null;

    if(durum !== 'tam') toplamAcik += kalan;

    // Renk
    var bg = '#f9fafb', renk = '#374151';
    if(durum === 'tam') { bg = '#f0fdf4'; renk = '#9ca3af'; }
    else if(vt && kalan_gun !== null && kalan_gun < 0) { bg = '#fef2f2'; renk = '#dc2626'; }
    else if(vt && kalan_gun !== null && kalan_gun <= 7) { bg = '#fef9e7'; renk = '#92400e'; }

    html += '<div style="border-radius:8px;margin-bottom:6px;background:'+bg+';border:1px solid #e5e7eb;overflow:hidden">';

    // Fatura başlık satırı
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px">';
    html += '<div style="flex:1">';
    html += '<span style="font-size:13px;color:'+renk+'">'+fmtT(f.tarih)+'</span>';
    if(f.fatura_no) html += ' <span style="font-size:11px;color:#9ca3af">'+htmlEsc(f.fatura_no)+'</span>';
    if(vt) html += ' <span style="font-size:11px;color:'+renk+';margin-left:6px">Vade: '+fmtT(vt)+(kalan_gun!==null?' ('+( kalan_gun<0?Math.abs(kalan_gun)+' gün geçti':kalan_gun===0?'Bugün!':kalan_gun+' gün')+')')+'</span>';
    if(durum === 'kismi') html += ' <span style="font-size:11px;background:#fef9e7;color:#92400e;padding:1px 6px;border-radius:10px;margin-left:4px">Kısmi</span>';
    if(durum === 'tam')   html += ' <span style="font-size:11px;background:#f0fdf4;color:#059669;padding:1px 6px;border-radius:10px;margin-left:4px">✓ Ödendi</span>';
    html += '</div>';
    html += '<div style="display:flex;align-items:center;gap:8px">';
    html += '<span style="font-weight:600;color:'+renk+'">'+para(f.tutar)+'</span>';
    if(durum !== 'tam') {
      html += '<button onclick="fatEslModalAc('+f.id+','+cari_id+')" style="font-size:11px;padding:3px 9px;background:#3b82f6;color:#fff;border:none;border-radius:5px;cursor:pointer">+ Ödeme Bağla</button>';
    }
    html += '</div></div>';

    // Bağlı ödemeler
    if(bagli.length) {
      html += '<div style="border-top:1px solid #e5e7eb;padding:6px 12px 8px;background:rgba(0,0,0,.02)">';
      var odTop = 0;
      bagli.forEach(function(e){
        var k = (window.kayitlar||[]).find(function(x){ return x.id===e.kayit_id; });
        odTop += Number(e.odeme_tutari||e.tutar||0);
        var kLabel = k ? fmtT(k.tarih)+' — '+htmlEsc(k.firma||k.aciklama||'').substring(0,30) : 'Kayıt #'+e.kayit_id;
        html += '<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:2px 0">';
        html += '<span style="color:#059669">↳ '+kLabel+'</span>';
        html += '<span style="color:#059669;font-weight:500">'+para(e.odeme_tutari||e.tutar||0)+'</span>';
        html += '</div>';
      });
      if(durum === 'kismi' && kalan > 0.01) {
        html += '<div style="font-size:12px;color:#92400e;font-weight:500;padding-top:4px;border-top:1px dashed #fde68a;margin-top:4px">Kalan: '+para(kalan)+'</div>';
      }
      html += '</div>';
    }

    html += '</div>';
  });

  return html;
}
