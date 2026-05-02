// ============================================================
// VERGİ TAKİP & PROJEKSİYON
// ============================================================

var vergiKalemleri = [];
var _vergiYuklendi = false;
var _vergiProjDonem = '';

// ── GİRİŞ ────────────────────────────────────────────────────

async function vergiSekmeAc() {
  if (!_vergiProjDonem) _vergiProjDonem = today.slice(0, 7);
  if (!_vergiYuklendi) {
    document.getElementById('vergi-icerik').innerHTML = '<div class="empty">Veriler yükleniyor...</div>';
    await vergiVeriYukle();
    _vergiYuklendi = true;
  }
  renderVergi();
}

function vergiIcTabSec(t) {
  ['takvim', 'beyanname', 'proj', 'mutabakat', 'karlilik'].forEach(function(id) {
    var btn = document.getElementById('vitab-' + id);
    var sec = document.getElementById('vi-' + id);
    if (btn) btn.classList.toggle('active', id === t);
    if (sec) sec.style.display = id === t ? '' : 'none';
  });
  if (t === 'takvim')    renderVergiTakvim();
  if (t === 'beyanname') renderKdvBeyanname();
  if (t === 'proj')      renderVergiProj();
  if (t === 'mutabakat') renderVergiMutabakat();
  if (t === 'karlilik')  renderKarlilik();
}

function renderVergi() {
  var el = document.getElementById('vergi-icerik');
  if (!el) return;
  el.innerHTML =
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;border-bottom:1px solid #e0e0db;padding-bottom:10px">' +
      '<button id="vitab-takvim"    class="tab active" onclick="vergiIcTabSec(\'takvim\')"    style="font-size:12px">📅 Vergi Takvimi</button>' +
      '<button id="vitab-beyanname" class="tab"        onclick="vergiIcTabSec(\'beyanname\')" style="font-size:12px">🧾 KDV Beyannamesi</button>' +
      '<button id="vitab-proj"      class="tab"        onclick="vergiIcTabSec(\'proj\')"      style="font-size:12px">📊 Projeksiyon</button>' +
      '<button id="vitab-mutabakat" class="tab"        onclick="vergiIcTabSec(\'mutabakat\')" style="font-size:12px">🔍 Mutabakat</button>' +
      '<button id="vitab-karlilik"  class="tab"        onclick="vergiIcTabSec(\'karlilik\')"  style="font-size:12px">📈 Karlılık Raporu</button>' +
    '</div>' +
    '<div id="vi-takvim"></div>' +
    '<div id="vi-beyanname" style="display:none"></div>' +
    '<div id="vi-proj"      style="display:none"></div>' +
    '<div id="vi-mutabakat" style="display:none"></div>' +
    '<div id="vi-karlilik"  style="display:none"></div>';
  renderVergiTakvim();
}

// ── VERİ YÜKLEMELERİ ─────────────────────────────────────────

async function vergiVeriYukle() {
  try {
    vergiKalemleri = await dbGetAll('vergi_kalemleri', 'select=*&order=odeme_tarihi.desc');
  } catch (e) {
    vergiKalemleri = [];
    console.warn('vergi_kalemleri tablosu okunamadı. SQL migration çalıştırıldı mı?', e.message);
  }
  try {
    var ayarlar = await dbGet('vergi_ayarlar', 'select=*');
    window._vAyarCache = {};
    ayarlar.forEach(function(a) { window._vAyarCache[a.anahtar] = a.deger; });
  } catch (e) {
    window._vAyarCache = {};
    console.warn('vergi_ayarlar okunamadı:', e.message);
  }
}

// ── OTOMATİK İÇE AKTARMA ─────────────────────────────────────

async function importKayitlardan() {
  var btn = document.getElementById('vergi-import-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Aktarılıyor...'; }

  var mevcutKayitIdler = new Set(
    vergiKalemleri.filter(function(v) { return v.kayit_id; }).map(function(v) { return v.kayit_id; })
  );

  var kaynaklar = kayitlar.filter(function(k) {
    return k.tur === 'gider' && (k.kat === 'Vergiler' || k.kat === 'SGK');
  });

  var muhVergi = kayitlar.filter(function(k) {
    return k.tur === 'gider' && k.kat === 'Muhasebe Giderleri' &&
           /KDV|VERGİ|SGK|STOPAJ/i.test(k.aciklama || '');
  });

  var hepsi = kaynaklar.concat(muhVergi).filter(function(k) {
    return !mevcutKayitIdler.has(k.id);
  });

  if (!hepsi.length) {
    alert('Tüm kayıtlar zaten içe aktarılmış.');
    if (btn) { btn.disabled = false; btn.textContent = '↻ Yeniden İçe Aktar'; }
    return;
  }

  var hatalar = 0;
  for (var i = 0; i < hepsi.length; i++) {
    var k = hepsi[i];
    var acikVeyaFirma = k.aciklama || k.firma || '';
    var r = await dbPost('vergi_kalemleri', {
      donem:        donemTahmini(k.tarih, acikVeyaFirma, k.kat),
      tur:          turEtiket(k.kat, acikVeyaFirma),
      tutar:        k.tutar,
      odeme_tarihi: k.tarih,
      aciklama:     acikVeyaFirma + (k.kat === 'Muhasebe Giderleri' ? ' [Muh.Gider]' : ''),
      kayit_id:     k.id,
      kaynak:       'otomatik'
    });
    if (!r.ok) hatalar++;
  }

  await vergiVeriYukle();
  renderVergiTakvim();
  if (btn) { btn.disabled = false; btn.textContent = '↻ Yeniden İçe Aktar'; }
  alert('İçe aktarma tamamlandı: ' + (hepsi.length - hatalar) + '/' + hepsi.length + ' kayıt eklendi.' +
        (hatalar ? '\n' + hatalar + ' hata oluştu — konsolu kontrol edin.' : ''));
}

// ── TAKVİM ────────────────────────────────────────────────────

function renderVergiTakvim() {
  var el = document.getElementById('vi-takvim');
  if (!el) return;

  var tabloBosmu = vergiKalemleri.length === 0;
  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">' +
    '<div style="font-size:13px;font-weight:500;color:#555">Önümüzdeki 90 Gün</div>' +
    '<div style="display:flex;gap:8px;align-items:center">';

  if (tabloBosmu) {
    html += '<span style="font-size:11px;color:#D85A30">⚠️ Henüz geçmiş veri aktarılmadı — tahminler gösterilemez</span>';
    html += '<button id="vergi-import-btn" class="btn btn-p" onclick="importKayitlardan()" style="font-size:12px">Geçmişi İçe Aktar</button>';
  } else {
    html += '<button id="vergi-import-btn" class="btn" onclick="importKayitlardan()" style="font-size:11px;color:#888">↻ Yeniden İçe Aktar</button>';
  }
  html += '<button class="btn no-print" onclick="vergiTakvimYazdir()" style="font-size:11px">🖨 Yazdır</button>';
  html += '</div></div>';

  var odemeler = yaklasenOdemeler(today, 90);
  var gruplar = {};
  odemeler.forEach(function(o) {
    var ay = o.vade.slice(0, 7);
    if (!gruplar[ay]) gruplar[ay] = [];
    gruplar[ay].push(o);
  });

  var bekleyenToplam = 0;

  Object.keys(gruplar).sort().forEach(function(ay) {
    html += '<div style="margin-bottom:16px">';
    html += '<div class="sec-title">' + donemYazi(ay) + '</div>';
    html += '<div class="tw"><table><thead><tr>' +
      '<th>Vade</th><th>Vergi Türü</th><th>Dönem</th>' +
      '<th style="text-align:right">Tahmini Tutar</th><th>Durum</th>' +
      '</tr></thead><tbody>';

    var ayToplam = 0;
    gruplar[ay].forEach(function(o) {
      var odendi = vergiKalemleri.some(function(v) {
        return v.tur === o.tur && v.donem === o.donem;
      });
      var gecikti = !odendi && o.vade < today;
      var durum = odendi
        ? '<span class="badge" style="background:#dcfce7;color:#166534">✓ Ödendi</span>'
        : gecikti
          ? '<span class="badge" style="background:#fef2f2;color:#991b1b">⚠ Gecikti</span>'
          : '<span class="badge" style="background:#fefce8;color:#854d0e">Bekliyor</span>';

      var tahmin = sistemTahmin(o.tur, o.donem);
      if (o.tur === 'kdv2') {
        var kdv2s = parseFloat(vAyarOku('kdv2_sabit_' + o.vade.slice(0, 7)) || vAyarOku('kdv2_sabit_global') || '0');
        if (kdv2s > 0) tahmin = kdv2s;
      }
      // Beyanname hesabı varsa onu kullan (proj_kdv_YYYY-MM veya proj_kdv2_YYYY-MM)
      var beyTahmin = parseFloat(vAyarOku('proj_' + o.tur + '_' + o.donem) || '0');
      if (beyTahmin > 0) tahmin = beyTahmin;
      var tahminStr = tahmin ? para(tahmin) : '<span style="color:#aaa">—</span>';
      if (tahmin) ayToplam += tahmin;
      if (!odendi && tahmin) bekleyenToplam += tahmin;

      var vadeBg = gecikti ? 'background:#fef2f2' : '';

      html += '<tr style="' + vadeBg + '">' +
        '<td style="font-size:12px;white-space:nowrap">' + fmtT(o.vade) + '</td>' +
        '<td style="font-weight:500;color:' + turRenk(o.tur) + '">' + turAdi(o.tur) + '</td>' +
        '<td style="font-size:12px;color:#888">' + donemYaziKisa(o.donem) + '</td>' +
        '<td style="text-align:right;font-size:12px;font-weight:500">' + tahminStr + '</td>' +
        '<td>' + durum + '</td>' +
        '</tr>';
    });

    if (ayToplam > 0) {
      html += '<tr style="background:#f3f4f6;border-top:2px solid #e5e7eb">' +
        '<td colspan="3" style="font-weight:600;font-size:12px;color:#374151">AYLIK TOPLAM</td>' +
        '<td style="text-align:right;font-weight:700;font-size:13px;color:#111">' + para(ayToplam) + '</td>' +
        '<td></td>' +
        '</tr>';
    }
    html += '</tbody></table></div></div>';
  });

  if (bekleyenToplam > 0) {
    html += '<div class="fb" style="background:#fefce8;border-color:#fde047;margin-top:4px">' +
      '<div style="font-size:12px;color:#713f12">⚠️ Tahmini toplam bekleyen vergi yükü: <strong>' + para(bekleyenToplam) + '</strong></div>' +
      '</div>';
  }

  if (!odemeler.length) {
    html += '<div class="empty">Önümüzdeki 90 günde vergi takvimi bulunamadı.</div>';
  }

  el.innerHTML = html;
}

// ── PROJEKSİYON ──────────────────────────────────────────────

function renderVergiProj() {
  var el = document.getElementById('vi-proj');
  if (!el) return;

  var donemlar = projDonemListesi();
  if (!_vergiProjDonem) _vergiProjDonem = today.slice(0, 7);

  var html = '<div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap">' +
    '<label style="font-size:12px;color:#888;font-weight:500">Dönem:</label>' +
    '<select id="proj-donem-sel" onchange="projDonemDegisti()" style="border:1px solid #e0e0db;border-radius:8px;padding:6px 10px;font-size:13px;background:#fff">';

  donemlar.forEach(function(d) {
    html += '<option value="' + d + '"' + (d === _vergiProjDonem ? ' selected' : '') + '>' + donemYazi(d) + '</option>';
  });
  html += '</select></div><div id="proj-icerik"></div>';

  el.innerHTML = html;
  renderProjIcerik(_vergiProjDonem);
}

function projDonemDegisti() {
  var sel = document.getElementById('proj-donem-sel');
  if (sel) { _vergiProjDonem = sel.value; renderProjIcerik(_vergiProjDonem); }
}

function renderProjIcerik(donem) {
  var el = document.getElementById('proj-icerik');
  if (!el) return;

  var qAy = isQAy(donem);
  var turler = ['kdv', 'kdv2', 'muhtasar', 'sgk', 'gecici', 'kurumlar', 'diger'];

  var kdv2SabitOnce = vAyarOku('kdv2_sabit_' + donem) || vAyarOku('kdv2_sabit_global') || '';

  var html = '<div class="tw"><table><thead><tr>' +
    '<th>Vergi Türü</th>' +
    '<th style="text-align:right">Sistem Tahmini <span style="font-weight:400;color:#aaa">(son 3 ay ort.)</span></th>' +
    '<th style="text-align:right">Sizin Girdiniz</th>' +
    '<th style="text-align:right">Fark</th>' +
    '</tr></thead><tbody>';

  var sistemToplam = 0, kullaniciToplam = 0;

  turler.forEach(function(tur) {
    if (tur === 'gecici' && !qAy) return;
    var donemAy = parseInt((donem.split('-')[1]) || 0);
    if (tur === 'kurumlar' && donemAy !== 4) return;
    if (tur === 'diger') return;
    var st = sistemTahmin(tur, donem);
    if (tur === 'kdv2' && kdv2SabitOnce && parseFloat(kdv2SabitOnce) > 0) {
      st = parseFloat(kdv2SabitOnce);
    }
    var kAnahtar = 'proj_' + tur + '_' + donem;
    var kStr = vAyarOku(kAnahtar);
    var kt = kStr ? parseFloat(kStr) : null;

    var stStr = st !== null ? para(st) : '<span style="color:#aaa">—</span>';
    var farkStr = '';
    if (st !== null && kt !== null) {
      var f = kt - st;
      var fc = f > 0 ? '#D85A30' : '#1D9E75';
      farkStr = '<span style="color:' + fc + '">' + (f > 0 ? '+' : '') + para(f) + '</span>';
    }

    if (st) sistemToplam += st;
    if (kt) kullaniciToplam += kt;

    var geciciNot = tur === 'gecici' && !qAy
      ? ' <span style="font-size:10px;color:#aaa;font-weight:400">(çeyrek sonu değil)</span>'
      : '';

    html += '<tr>' +
      '<td style="font-weight:500;color:' + turRenk(tur) + '">' + turAdi(tur) + geciciNot + '</td>' +
      '<td style="text-align:right;font-size:12px">' + stStr + '</td>' +
      '<td><input type="number" value="' + (kt !== null ? kt : '') + '" placeholder="Girin..." ' +
        'style="width:150px;border:1px solid #e0e0db;border-radius:6px;padding:5px 8px;font-size:12px;text-align:right;background:#fff" ' +
        'onchange="projInputKaydet(\'' + tur + '\',\'' + donem + '\',this.value)"></td>' +
      '<td style="text-align:right;font-size:12px">' + farkStr + '</td>' +
      '</tr>';
  });

  // Toplam satırı
  var topFarkStr = '';
  if (sistemToplam && kullaniciToplam) {
    var tf = kullaniciToplam - sistemToplam;
    topFarkStr = '<span style="color:' + (tf > 0 ? '#D85A30' : '#1D9E75') + '">' + (tf > 0 ? '+' : '') + para(tf) + '</span>';
  }
  html += '<tr style="background:#f9f9f8;font-weight:500">' +
    '<td>TOPLAM</td>' +
    '<td style="text-align:right">' + (sistemToplam ? para(sistemToplam) : '—') + '</td>' +
    '<td style="text-align:right">' + (kullaniciToplam ? para(kullaniciToplam) : '—') + '</td>' +
    '<td style="text-align:right">' + (topFarkStr || '—') + '</td>' +
    '</tr>';
  html += '</tbody></table></div>';

  // Ayarlar bölümü
  var yemekOran  = vAyarOku('yemek_oran_' + donem)  || vAyarOku('yemek_oran_global')  || '70';
  var kdv2Sabit  = vAyarOku('kdv2_sabit_' + donem)  || vAyarOku('kdv2_sabit_global')  || '';
  var karMarji   = vAyarOku('kar_marji_' + donem)   || vAyarOku('kar_marji_global')   || '15';

  html += '<div class="fb" style="margin-top:12px">' +
    '<div class="fb-title">Projeksiyon Ayarları — ' + donemYazi(donem) + '</div>' +
    '<div class="grid g4">' +
    '<div class="field"><label>Yemek Satış Oranı %</label>' +
      '<input type="number" id="ay-yemek" value="' + yemekOran + '" min="0" max="100" placeholder="70"></div>' +
    '<div class="field"><label>KDV-2 Sabit Tutar (TL)</label>' +
      '<input type="number" id="ay-kdv2" value="' + kdv2Sabit + '" min="0" placeholder="0"></div>' +
    '<div class="field"><label>Net Kâr Marjı % <span style="color:#aaa;font-size:10px">(geçici vergi)</span></label>' +
      '<input type="number" id="ay-karmarji" value="' + karMarji + '" min="0" max="100" placeholder="15"></div>' +
    '<div style="display:flex;align-items:flex-end">' +
      '<button class="btn btn-p" onclick="projAyarKaydet(\'' + donem + '\')" style="font-size:12px">Kaydet</button>' +
    '</div>' +
    '</div></div>';

  el.innerHTML = html;
}

async function projInputKaydet(tur, donem, val) {
  await vAyarKaydet('proj_' + tur + '_' + donem, val || '0');
}

async function projAyarKaydet(donem) {
  var y = document.getElementById('ay-yemek');
  var k = document.getElementById('ay-kdv2');
  var m = document.getElementById('ay-karmarji');
  if (y) await vAyarKaydet('yemek_oran_' + donem, y.value);
  if (k) await vAyarKaydet('kdv2_sabit_' + donem, k.value);
  if (m) await vAyarKaydet('kar_marji_' + donem, m.value);
  renderProjIcerik(donem);
}

// ── MUTABAKAT ─────────────────────────────────────────────────

function renderVergiMutabakat() {
  var el = document.getElementById('vi-mutabakat');
  if (!el) return;

  // Ödeme aylarını topla (vergi_kalemleri + kayitlar)
  var aylarSet = {};
  vergiKalemleri.forEach(function(v) {
    var ay = v.odeme_tarihi ? v.odeme_tarihi.slice(0, 7) : null;
    if (ay) aylarSet[ay] = true;
  });
  kayitlar.forEach(function(k) {
    if (k.tur === 'gider' && (k.kat === 'Vergiler' || k.kat === 'SGK')) {
      aylarSet[k.tarih.slice(0, 7)] = true;
    }
  });

  var aylar = Object.keys(aylarSet).sort().reverse();

  if (!aylar.length) {
    el.innerHTML = '<div class="empty">Henüz veri yok. Takvim sekmesinden "Geçmişi İçe Aktar" butonuna tıklayın.</div>';
    return;
  }

  var html = '<div style="font-size:12px;color:#888;margin-bottom:10px">' +
    'Kasa Defteri kayıtları (Vergiler + SGK) ile Vergi Kalemleri toplamları karşılaştırılır. ' +
    'Fark varsa yanlış kategorize edilmiş veya eksik kayıt olabilir.' +
    '</div>';

  html += '<div class="tw"><table><thead><tr>' +
    '<th>Ödeme Ayı</th>' +
    '<th style="text-align:right">Kasa (Vergiler+SGK)</th>' +
    '<th style="text-align:right">Vergi Kalemleri</th>' +
    '<th style="text-align:right">Fark</th>' +
    '<th style="text-align:right">Muh.Gider Vergi ⚠️</th>' +
    '</tr></thead><tbody>';

  var genelKasa = 0, genelVk = 0;

  aylar.forEach(function(ay) {
    var kasaToplam = kayitlar
      .filter(function(k) {
        return k.tarih.slice(0, 7) === ay && k.tur === 'gider' &&
               (k.kat === 'Vergiler' || k.kat === 'SGK');
      })
      .reduce(function(s, k) { return s + k.tutar; }, 0);

    var vkToplam = vergiKalemleri
      .filter(function(v) {
        return v.odeme_tarihi && v.odeme_tarihi.slice(0, 7) === ay;
      })
      .reduce(function(s, v) { return s + v.tutar; }, 0);

    var muhToplam = kayitlar
      .filter(function(k) {
        return k.tarih.slice(0, 7) === ay && k.tur === 'gider' &&
               k.kat === 'Muhasebe Giderleri' &&
               /KDV|VERGİ|SGK|STOPAJ/i.test(k.aciklama || '');
      })
      .reduce(function(s, k) { return s + k.tutar; }, 0);

    var fark = vkToplam - kasaToplam;
    var eslesti = Math.abs(fark) < 1;
    var farkStr = eslesti
      ? '<span style="color:#1D9E75">✓</span>'
      : '<span style="color:#D85A30">' + (fark > 0 ? '+' : '') + para(fark) + '</span>';
    var rowBg = !eslesti ? 'background:#fffbeb' : '';

    genelKasa += kasaToplam;
    genelVk   += vkToplam;

    html += '<tr style="' + rowBg + '">' +
      '<td style="font-weight:500">' + donemYazi(ay) + '</td>' +
      '<td style="text-align:right;font-size:12px">' + (kasaToplam ? para(kasaToplam) : '—') + '</td>' +
      '<td style="text-align:right;font-size:12px">' + (vkToplam ? para(vkToplam) : '—') + '</td>' +
      '<td style="text-align:right;font-size:12px">' + farkStr + '</td>' +
      '<td style="text-align:right;font-size:12px;color:' + (muhToplam ? '#D85A30' : '#aaa') + '">' +
        (muhToplam ? para(muhToplam) : '—') +
      '</td>' +
      '</tr>';
  });

  var genelFark = genelVk - genelKasa;
  html += '<tr style="background:#f9f9f8;font-weight:500">' +
    '<td>TOPLAM</td>' +
    '<td style="text-align:right">' + para(genelKasa) + '</td>' +
    '<td style="text-align:right">' + para(genelVk) + '</td>' +
    '<td style="text-align:right;color:' + (Math.abs(genelFark) < 1 ? '#1D9E75' : '#D85A30') + '">' +
      (Math.abs(genelFark) < 1 ? '✓ Eşleşti' : (genelFark > 0 ? '+' : '') + para(genelFark)) +
    '</td>' +
    '<td></td>' +
    '</tr>';
  html += '</tbody></table></div>';

  // Muhasebe Giderleri içindeki vergi kalemleri
  var muhList = kayitlar.filter(function(k) {
    return k.tur === 'gider' && k.kat === 'Muhasebe Giderleri' &&
           /KDV|VERGİ|SGK|STOPAJ/i.test(k.aciklama || '');
  }).sort(function(a, b) { return a.tarih < b.tarih ? 1 : -1; });

  if (muhList.length) {
    var muhTopToplam = muhList.reduce(function(s, k) { return s + k.tutar; }, 0);
    html += '<div class="sec-title" style="margin-top:18px">⚠️ Muhasebe Giderleri içindeki vergi kalemleri</div>' +
      '<div style="font-size:11px;color:#888;margin-bottom:8px">' +
        'Bu kayıtlar Vergiler/SGK kategorisinde değil. Vergi toplamlarına dahil edilmemiştir. Toplam: <strong>' + para(muhTopToplam) + '</strong>' +
      '</div>' +
      '<div class="tw"><table><thead><tr><th>Tarih</th><th>Açıklama</th><th style="text-align:right">Tutar</th></tr></thead><tbody>';
    muhList.forEach(function(k) {
      html += '<tr><td style="font-size:12px">' + fmtT(k.tarih) + '</td>' +
        '<td style="font-size:12px">' + (k.aciklama || '') + '</td>' +
        '<td style="text-align:right;font-size:12px">' + para(k.tutar) + '</td></tr>';
    });
    html += '</tbody></table></div>';
  }

  el.innerHTML = html;
}

// ── AYAR CRUD ─────────────────────────────────────────────────

async function vAyarKaydet(anahtar, deger) {
  var H = Object.assign({}, getSBH(), { 'Prefer': 'resolution=merge-duplicates,return=minimal' });
  try {
    await fetch(SB_URL + '/rest/v1/vergi_ayarlar', {
      method: 'POST', headers: H,
      body: JSON.stringify({ anahtar: anahtar, deger: String(deger), updated_at: new Date().toISOString() })
    });
    if (!window._vAyarCache) window._vAyarCache = {};
    window._vAyarCache[anahtar] = String(deger);
  } catch (e) {
    console.warn('Ayar kaydedilemedi:', anahtar, e);
  }
}

function vAyarOku(anahtar) {
  return (window._vAyarCache && window._vAyarCache[anahtar] !== undefined)
    ? window._vAyarCache[anahtar]
    : null;
}

// ── PROJEKSİYON MOTORu ────────────────────────────────────────

function sistemTahmin(tur, donem) {
  // Son 3 dönemin ortalaması (ödeme zamanına göre değil, donem'e göre)
  var byDonem = {};
  vergiKalemleri.forEach(function(v) {
    if (v.tur !== tur || !v.donem || v.donem >= donem) return;
    byDonem[v.donem] = (byDonem[v.donem] || 0) + v.tutar;
  });

  var donems = Object.keys(byDonem).sort().reverse().slice(0, 3);
  if (!donems.length) return null;

  var ort = donems.reduce(function(s, d) { return s + byDonem[d]; }, 0) / donems.length;
  return Math.round(ort);
}

// ── YARDIMCI FONKSİYONLAR ─────────────────────────────────────

function turAdi(tur) {
  var isimler = {
    kdv: "KDV (1 No'lu)", kdv2: "KDV (2 No'lu)", muhtasar: 'Muhtasar & Prim',
    sgk: 'SGK', gecici: 'Geçici Vergi', kurumlar: 'Kurumlar Vergisi', diger: 'Diğer'
  };
  return isimler[tur] || tur;
}

function turRenk(tur) {
  var renkler = {
    kdv: '#185FA5', kdv2: '#5b21b6', muhtasar: '#7c3aed',
    sgk: '#0e7490', gecici: '#b45309', kurumlar: '#9a3412', diger: '#555'
  };
  return renkler[tur] || '#555';
}

function donemYazi(donemStr) {
  if (!donemStr) return '';
  if (/Q\d/.test(donemStr)) {
    var p = donemStr.split('-Q');
    return p[0] + ' ' + p[1] + '. Çeyrek';
  }
  var aylar = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
               'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  var p = donemStr.split('-');
  return (aylar[parseInt(p[1])] || p[1]) + ' ' + p[0];
}

function donemYaziKisa(donemStr) {
  if (!donemStr) return '';
  if (/Q\d/.test(donemStr)) return donemStr;
  var aylar = ['', 'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
               'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  var p = donemStr.split('-');
  return (aylar[parseInt(p[1])] || p[1]) + ' ' + p[0];
}

function isQAy(donemStr) {
  if (!donemStr) return false;
  var m = parseInt((donemStr.split('-')[1]) || 0);
  return m === 2 || m === 5 || m === 8 || m === 11;
}

function projDonemListesi() {
  var now = new Date();
  var result = [];
  for (var i = -6; i <= 5; i++) {
    var d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    result.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }
  return result;
}

function turEtiket(kat, aciklama) {
  if (kat === 'SGK') return 'sgk';
  var acik = (aciklama || '').toUpperCase().trim();
  // KDV 2 → 2 No'lu (aciklama tam eşleşmesi veya KDV-2)
  if (acik === 'KDV 2' || acik === 'KDV-2') return 'kdv2';
  if (/KDV/.test(acik)) return 'kdv';
  if (/MUHTASAR/.test(acik)) return 'muhtasar';
  if (/PEŞİN|GEÇİCİ VERG/.test(acik)) return 'gecici';
  if (/KURUMLAR/.test(acik)) return 'kurumlar';
  return 'diger';
}

function donemTahmini(tarih, aciklama, kat) {
  if (kat === 'SGK') {
    // SGK açıklamasından ay numarasını çek
    var m = (aciklama || '').match(/(\d{1,2})[\.\s]*AY/i);
    if (m) return _ayNumarasiDonem(parseInt(m[1]), tarih);
  }
  var acik = (aciklama || '').toUpperCase().trim();
  var d = new Date(tarih + 'T00:00:00');
  var yil = d.getFullYear(), ay = d.getMonth() + 1;

  // Geçici vergi
  if (/PEŞİN|GEÇİCİ/.test(acik)) {
    if (ay === 2)  return (yil - 1) + '-Q4';
    if (ay === 5)  return yil + '-Q1';
    if (ay === 8)  return yil + '-Q2';
    if (ay === 11) return yil + '-Q3';
    return yil + '-Q?';
  }

  // "X. AY" veya "KDV X. AY"
  var m2 = acik.match(/\b(\d{1,2})[\.\s]*AY\b/);
  if (m2) return _ayNumarasiDonem(parseInt(m2[1]), tarih);

  // Varsayılan: bir önceki ay
  var prevAy = ay - 1, prevYil = yil;
  if (prevAy === 0) { prevAy = 12; prevYil--; }
  return prevYil + '-' + String(prevAy).padStart(2, '0');
}

function _ayNumarasiDonem(ayNo, tarih) {
  if (ayNo < 1 || ayNo > 12) return tarih.slice(0, 7);
  var d = new Date(tarih + 'T00:00:00');
  var yil = d.getFullYear(), ay = d.getMonth() + 1;
  // Ay numarası > ödeme ayı ise önceki yıl
  if (ayNo > ay) yil--;
  return yil + '-' + String(ayNo).padStart(2, '0');
}

function yaklasenOdemeler(basTarih, gunSayisi) {
  var bas = new Date(basTarih + 'T00:00:00');
  var bitis = new Date(bas.getTime() + gunSayisi * 86400000);
  var bitisStr = ldStr(bitis);
  var result = [];

  // Aylık vergiler: KDV, Muhtasar, SGK → dönemin sonraki ayının 26'sı
  for (var i = -1; i <= 4; i++) {
    var refD = new Date(bas.getFullYear(), bas.getMonth() + i, 1);
    var dAy = refD.getMonth() + 1, dYil = refD.getFullYear();
    var vAy = dAy + 1, vYil = dYil;
    if (vAy > 12) { vAy -= 12; vYil++; }
    var vade = vYil + '-' + String(vAy).padStart(2, '0') + '-26';
    var donemStr = dYil + '-' + String(dAy).padStart(2, '0');
    if (vade >= basTarih && vade <= bitisStr) {
      ['kdv', 'kdv2', 'muhtasar', 'sgk'].forEach(function(tur) {
        result.push({ tur: tur, donem: donemStr, vade: vade });
      });
    }
  }

  // Geçici vergi: Q1→May17, Q2→Aug17, Q3→Nov17, Q4→Feb17(+1y)
  var yil = bas.getFullYear();
  [
    { donem: (yil - 1) + '-Q4', vade: yil + '-02-17' },
    { donem: yil + '-Q1',       vade: yil + '-05-17' },
    { donem: yil + '-Q2',       vade: yil + '-08-17' },
    { donem: yil + '-Q3',       vade: yil + '-11-17' },
    { donem: yil + '-Q4',       vade: (yil + 1) + '-02-17' },
  ].forEach(function(g) {
    if (g.vade >= basTarih && g.vade <= bitisStr) {
      result.push({ tur: 'gecici', donem: g.donem, vade: g.vade });
    }
  });

  // Kurumlar Vergisi: her yıl 30 Nisan
  [yil, yil + 1].forEach(function(y) {
    var vade = y + '-04-30';
    if (vade >= basTarih && vade <= bitisStr) {
      result.push({ tur: 'kurumlar', donem: (y - 1) + '-12', vade: vade });
    }
  });

  return result.sort(function(a, b) { return a.vade > b.vade ? 1 : -1; });
}

function renderKarlilik() {
  var el = document.getElementById('vi-karlilik');
  if (!el) return;

  var vergiKatlar = ['Vergiler', 'SGK'];
  var byMonth = {};

  kayitlar.forEach(function(k) {
    var m = k.tarih.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = { gelir: 0, opGider: 0, vergiGider: 0, dagitim: 0 };
    var t = parseFloat(k.tutar) || 0;
    if (k.tur === 'gelir') {
      byMonth[m].gelir += t;
    } else if (k.tur === 'dagitim') {
      byMonth[m].dagitim += t;
    } else if (k.tur === 'gider') {
      if (vergiKatlar.indexOf(k.kat) >= 0) byMonth[m].vergiGider += t;
      else byMonth[m].opGider += t;
    }
  });

  var aylar = Object.keys(byMonth).filter(function(m) {
    return byMonth[m].gelir > 0;
  }).sort().reverse();

  if (!aylar.length) {
    el.innerHTML = '<div class="empty">Henüz kayıt yok.</div>';
    return;
  }

  var renk = function(v) { return v >= 0 ? '#166534' : '#991b1b'; };
  var bg   = function(v) { return v >= 40 ? '#dcfce7' : v >= 20 ? '#fefce8' : v >= 0 ? '#fff7ed' : '#fef2f2'; };

  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
    '<div style="font-size:13px;font-weight:500;color:#555">Aylık Karlılık Analizi</div>' +
    '<button class="btn no-print" onclick="karlilikYazdir()" style="font-size:11px">🖨 Yazdır</button>' +
    '</div>';

  html += '<div class="tw"><table><thead><tr>' +
    '<th>Ay</th>' +
    '<th style="text-align:right">Gelir</th>' +
    '<th style="text-align:right">İşletme Gideri</th>' +
    '<th style="text-align:right">Vergi & SGK</th>' +
    '<th style="text-align:right">Vergi Öncesi Kar</th>' +
    '<th style="text-align:right">Marj %</th>' +
    '<th style="text-align:right">Vergi Sonrası Kar</th>' +
    '<th style="text-align:right">Marj %</th>' +
    '</tr></thead><tbody>';

  var totGelir = 0, totOp = 0, totVergi = 0;

  aylar.forEach(function(m) {
    var d = byMonth[m];
    var vonce = d.gelir - d.opGider;
    var vsonra = d.gelir - d.opGider - d.vergiGider;
    var mOnce = d.gelir ? (vonce / d.gelir * 100) : 0;
    var mSonra = d.gelir ? (vsonra / d.gelir * 100) : 0;
    totGelir += d.gelir; totOp += d.opGider; totVergi += d.vergiGider;

    html += '<tr>' +
      '<td style="font-weight:500">' + donemYazi(m) + '</td>' +
      '<td style="text-align:right">' + para(d.gelir) + '</td>' +
      '<td style="text-align:right;color:#555">' + para(d.opGider) + '</td>' +
      '<td style="text-align:right;color:#b45309">' + para(d.vergiGider) + '</td>' +
      '<td style="text-align:right;font-weight:500;color:' + renk(vonce) + '">' + para(vonce) + '</td>' +
      '<td style="text-align:right"><span style="padding:2px 7px;border-radius:4px;font-size:11px;font-weight:600;background:' + bg(mOnce) + ';color:' + renk(mOnce) + '">' + mOnce.toFixed(1) + '%</span></td>' +
      '<td style="text-align:right;font-weight:500;color:' + renk(vsonra) + '">' + para(vsonra) + '</td>' +
      '<td style="text-align:right"><span style="padding:2px 7px;border-radius:4px;font-size:11px;font-weight:600;background:' + bg(mSonra) + ';color:' + renk(mSonra) + '">' + mSonra.toFixed(1) + '%</span></td>' +
      '</tr>';
  });

  // Genel toplam
  var totVonce = totGelir - totOp;
  var totVsonra = totGelir - totOp - totVergi;
  var totMonce = totGelir ? (totVonce / totGelir * 100) : 0;
  var totMsonra = totGelir ? (totVsonra / totGelir * 100) : 0;
  html += '<tr style="background:#f3f4f6;border-top:2px solid #e5e7eb;font-weight:600">' +
    '<td>TOPLAM / ORT.</td>' +
    '<td style="text-align:right">' + para(totGelir) + '</td>' +
    '<td style="text-align:right;color:#555">' + para(totOp) + '</td>' +
    '<td style="text-align:right;color:#b45309">' + para(totVergi) + '</td>' +
    '<td style="text-align:right;color:' + renk(totVonce) + '">' + para(totVonce) + '</td>' +
    '<td style="text-align:right"><span style="padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;background:' + bg(totMonce) + ';color:' + renk(totMonce) + '">' + totMonce.toFixed(1) + '%</span></td>' +
    '<td style="text-align:right;color:' + renk(totVsonra) + '">' + para(totVsonra) + '</td>' +
    '<td style="text-align:right"><span style="padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;background:' + bg(totMsonra) + ';color:' + renk(totMsonra) + '">' + totMsonra.toFixed(1) + '%</span></td>' +
    '</tr>';

  html += '</tbody></table></div>';
  el.innerHTML = html;
}

function karlilikYazdir() {
  var icerik = document.getElementById('vi-karlilik');
  if (!icerik) return;
  var win = window.open('', '_blank');
  win.document.write(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Karlılık Raporu</title>' +
    '<style>body{font-family:system-ui,sans-serif;font-size:11px;color:#111;margin:24px}' +
    'h2{font-size:15px;margin-bottom:14px}table{width:100%;border-collapse:collapse}' +
    'th{text-align:left;border-bottom:2px solid #e5e7eb;padding:5px 8px;font-size:10px;color:#6b7280;background:#f9fafb}' +
    'td{padding:5px 8px;border-bottom:1px solid #f3f4f6}.no-print{display:none}</style>' +
    '</head><body><h2>Aylık Karlılık Raporu</h2>' +
    icerik.innerHTML + '</body></html>'
  );
  win.document.close();
  win.focus();
  setTimeout(function() { win.print(); }, 400);
}

// ── KDV BEYANNAMESİ ──────────────────────────────────────────

var _beyDonem = '';

function renderKdvBeyanname() {
  var el = document.getElementById('vi-beyanname');
  if (!el) return;
  if (!_beyDonem) _beyDonem = today.slice(0, 7);

  var donemler = projDonemListesi();
  var sel = '<select id="bey-donem-sel" onchange="beyDonemDegisti()" style="border:1px solid #e0e0db;border-radius:8px;padding:6px 10px;font-size:13px;background:#fff">';
  donemler.forEach(function(d) {
    sel += '<option value="' + d + '"' + (d === _beyDonem ? ' selected' : '') + '>' + donemYazi(d) + '</option>';
  });
  sel += '</select>';

  el.innerHTML =
    '<div style="display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap">' +
      '<label style="font-size:12px;color:#888;font-weight:500">Dönem:</label>' + sel +
    '</div>' +
    '<div id="bey-icerik"></div>';

  renderBeyIcerik(_beyDonem);
}

function beyDonemDegisti() {
  var s = document.getElementById('bey-donem-sel');
  if (s) { _beyDonem = s.value; renderBeyIcerik(_beyDonem); }
}

function renderBeyIcerik(donem) {
  var el = document.getElementById('bey-icerik');
  if (!el) return;

  // ── İNDİRİLECEK KDV: faturalar tablosundan ──
  var indirilecekOto = (typeof faturalar !== 'undefined' ? faturalar : [])
    .filter(function(f) { return f.tarih && f.tarih.startsWith(donem) && parseFloat(f.kdv_tutar) > 0; })
    .reduce(function(s, f) { return s + parseFloat(f.kdv_tutar); }, 0);

  var indirilecekManuelStr = vAyarOku('bey_indirilecek_' + donem) || '';
  var indirilecekManuel = indirilecekManuelStr ? parseFloat(indirilecekManuelStr) : null;
  var indirilecek = indirilecekManuel !== null ? indirilecekManuel : indirilecekOto;

  // ── HESAPLANAN KDV: kayıtlı değerler ──
  var fatKdvStr   = vAyarOku('bey_fat_kdv_' + donem)   || '';
  var fisKdvStr   = vAyarOku('bey_fis_kdv_' + donem)   || '';
  var fatKdv  = fatKdvStr  ? parseFloat(fatKdvStr)  : null;
  var fisKdv  = fisKdvStr  ? parseFloat(fisKdvStr)  : null;

  var hesaplanan = (fatKdv || 0) + (fisKdv || 0);
  var net = hesaplanan - indirilecek;

  // Fatura sayısı (KDV girilmiş)
  var fatSayisi = (typeof faturalar !== 'undefined' ? faturalar : [])
    .filter(function(f) { return f.tarih && f.tarih.startsWith(donem) && parseFloat(f.kdv_tutar) > 0; }).length;
  var fatToplamSayisi = (typeof faturalar !== 'undefined' ? faturalar : [])
    .filter(function(f) { return f.tarih && f.tarih.startsWith(donem); }).length;

  var html = '';

  // ── HESAPLANAN KDV KARTI ──
  html += '<div class="fb" style="margin-bottom:12px">' +
    '<div class="fb-title" style="color:#185FA5">Hesaplanan KDV (Satış)</div>' +
    '<div class="grid g4" style="margin-bottom:12px">' +

    '<div class="field"><label>Satış Faturası KDV (TL)</label>' +
      '<div style="display:flex;gap:6px;align-items:center">' +
        '<input type="number" id="bey-fat-kdv" value="' + (fatKdv !== null ? fatKdv : '') + '" placeholder="CSV yükle veya gir" step="0.01" ' +
          'style="flex:1;border:1px solid #e0e0db;border-radius:6px;padding:6px 10px;font-size:13px" ' +
          'onchange="beyKdvKaydet(\'fat\',\'' + donem + '\',this.value)">' +
        '<label style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:6px 10px;border-radius:6px;font-size:11px;cursor:pointer;white-space:nowrap" title="Uyumsoft satış faturası CSV">' +
          '📥 CSV<input type="file" accept=".csv" style="display:none" onchange="beyCsvYukle(this,\'' + donem + '\')">' +
        '</label>' +
      '</div>' +
      '<div style="font-size:10px;color:#aaa;margin-top:3px">Uyumsoft → Satış Faturaları CSV yükleyin</div>' +
    '</div>' +

    '<div class="field"><label>Yazar Kasa / Fiş KDV (TL)</label>' +
      '<input type="number" id="bey-fis-kdv" value="' + (fisKdv !== null ? fisKdv : '') + '" placeholder="Slipten girin" step="0.01" ' +
        'style="width:100%;border:1px solid #e0e0db;border-radius:6px;padding:6px 10px;font-size:13px" ' +
        'onchange="beyKdvKaydet(\'fis\',\'' + donem + '\',this.value)">' +
    '</div>' +

    '</div>' +
    '<div style="display:flex;justify-content:flex-end;align-items:center;gap:16px;border-top:1px solid #e0e0db;padding-top:10px">' +
      '<span style="font-size:12px;color:#888">Toplam Hesaplanan:</span>' +
      '<span style="font-size:18px;font-weight:700;color:#185FA5">' + (hesaplanan ? para(hesaplanan) : '—') + '</span>' +
    '</div>' +
  '</div>';

  // ── İNDİRİLECEK KDV KARTI ──
  var kdvUyariHtml = '';
  if (fatToplamSayisi > 0 && fatSayisi < fatToplamSayisi) {
    kdvUyariHtml = '<div style="font-size:11px;color:#b45309;margin-top:6px">⚠️ ' + donemYazi(donem) +
      ' döneminde ' + fatToplamSayisi + ' faturadan ' + fatSayisi + ' tanesinde KDV tutarı girilmiş. ' +
      'Eksik girişler için fatura sayfasından güncelleyin.</div>';
  }

  html += '<div class="fb" style="margin-bottom:12px">' +
    '<div class="fb-title" style="color:#0e7490">İndirilecek KDV (Alış)</div>' +
    '<div class="grid g4" style="margin-bottom:12px">' +
    '<div class="field"><label>Faturalardan Otomatik <span style="color:#aaa;font-weight:400">(' + fatSayisi + ' fatura)</span></label>' +
      '<div style="padding:8px 10px;background:#f3f4f6;border-radius:6px;font-size:14px;font-weight:500;color:#0e7490">' +
        (indirilecekOto > 0 ? para(indirilecekOto) : '<span style="color:#aaa">KDV girilmemiş</span>') +
      '</div>' +
      kdvUyariHtml +
    '</div>' +
    '<div class="field"><label>Manuel Düzeltme (TL) <span style="color:#aaa;font-weight:400">opsiyonel</span></label>' +
      '<input type="number" id="bey-ind-manuel" value="' + (indirilecekManuelStr || '') + '" placeholder="Boş bırakın = otomatik" step="0.01" ' +
        'style="width:100%;border:1px solid #e0e0db;border-radius:6px;padding:6px 10px;font-size:13px" ' +
        'onchange="beyKdvKaydet(\'indirilecek\',\'' + donem + '\',this.value)">' +
    '</div>' +
    '</div>' +
    '<div style="display:flex;justify-content:flex-end;align-items:center;gap:16px;border-top:1px solid #e0e0db;padding-top:10px">' +
      '<span style="font-size:12px;color:#888">Toplam İndirilecek:</span>' +
      '<span style="font-size:18px;font-weight:700;color:#0e7490">' + (indirilecek ? para(indirilecek) : '—') + '</span>' +
    '</div>' +
  '</div>';

  // ── NET SONUÇ ──
  var netRenk = net > 0 ? '#991b1b' : '#166534';
  var netBg   = net > 0 ? '#fef2f2' : '#dcfce7';
  var netEtiket = net > 0 ? '📤 Ödenecek KDV' : '💰 İade / Devredecek KDV';

  html += '<div style="background:' + netBg + ';border-radius:12px;padding:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">' +
    '<div>' +
      '<div style="font-size:13px;font-weight:600;color:' + netRenk + '">' + netEtiket + '</div>' +
      '<div style="font-size:11px;color:#888;margin-top:2px">' + donemYazi(donem) + ' dönemi KDV-1 Beyannamesi</div>' +
    '</div>' +
    '<div style="font-size:28px;font-weight:800;color:' + netRenk + '">' +
      (hesaplanan ? para(Math.abs(net)) : '—') +
    '</div>' +
  '</div>';

  // ── DETAY TABLOSU ──
  if (hesaplanan || indirilecek) {
    html += '<div class="tw" style="margin-top:14px"><table>' +
      '<thead><tr><th>Kalem</th><th style="text-align:right">Tutar</th></tr></thead><tbody>' +
      '<tr><td>Satış Faturası KDV</td><td style="text-align:right">' + (fatKdv ? para(fatKdv) : '—') + '</td></tr>' +
      '<tr><td>Yazar Kasa / Fiş KDV</td><td style="text-align:right">' + (fisKdv ? para(fisKdv) : '—') + '</td></tr>' +
      '<tr style="border-top:2px solid #e5e7eb;font-weight:600"><td>Toplam Hesaplanan KDV</td><td style="text-align:right;color:#185FA5">' + para(hesaplanan) + '</td></tr>' +
      '<tr><td>İndirilecek KDV</td><td style="text-align:right;color:#0e7490">− ' + para(indirilecek) + '</td></tr>' +
      '<tr style="background:#f9f9f8;font-weight:700"><td>' + netEtiket + '</td><td style="text-align:right;color:' + netRenk + '">' + para(Math.abs(net)) + '</td></tr>' +
      '</tbody></table></div>';
  }

  el.innerHTML = html;
}

async function beyKdvKaydet(tur, donem, val) {
  var anahtar = 'bey_' + tur + '_kdv_' + donem;
  if (tur === 'indirilecek') anahtar = 'bey_indirilecek_' + donem;
  await vAyarKaydet(anahtar, val || '0');
  renderBeyIcerik(donem);
}

function beyCsvYukle(input, donem) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var parsed = uyumCsvParse(e.target.result);
    if (parsed.hatali) { alert('CSV okunamadı: ' + parsed.mesaj); return; }

    var toplamKdv = 0;
    var satirSayisi = 0;
    var kdvCol = 'Toplam KDV';

    parsed.rows.forEach(function(row) {
      // Fatura Tarihi: "DD.MM.YYYY HH:MM:SS"
      var tarihStr = (row['Fatura Tarihi'] || '').split(' ')[0];
      var parts = tarihStr.split('.');
      if (parts.length !== 3) return;
      var satAy = parts[2] + '-' + parts[1]; // YYYY-MM
      if (satAy !== donem) return;

      var kdvStr = (row[kdvCol] || '0').replace(',', '.');
      var kdv = parseFloat(kdvStr) || 0;
      toplamKdv += kdv;
      satirSayisi++;
    });

    if (!satirSayisi) {
      alert(donemYazi(donem) + ' döneminde satış faturası bulunamadı.\n\nCSV dosyasının doğru ay için olduğundan emin olun.');
      input.value = '';
      return;
    }

    var kdvYuvarlak = Math.round(toplamKdv * 100) / 100;
    document.getElementById('bey-fat-kdv').value = kdvYuvarlak;
    beyKdvKaydet('fat', donem, String(kdvYuvarlak));
    input.value = '';
    alert(donemYazi(donem) + ': ' + satirSayisi + ' fatura okundu.\nHesaplanan KDV: ' + para(kdvYuvarlak));
  };
  reader.readAsText(file, 'UTF-8');
}

function beyYazdir() {
  var icerik = document.getElementById('bey-icerik');
  if (!icerik) return;
  var win = window.open('', '_blank');
  win.document.write(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>KDV Beyannamesi</title>' +
    '<style>body{font-family:system-ui,sans-serif;font-size:12px;color:#111;margin:24px}' +
    'h2{font-size:15px;margin-bottom:14px}table{width:100%;border-collapse:collapse}' +
    'th{text-align:left;border-bottom:2px solid #e5e7eb;padding:5px 8px;font-size:11px;color:#6b7280;background:#f9fafb}' +
    'td{padding:5px 8px;border-bottom:1px solid #f3f4f6}.no-print{display:none}' +
    'input,select,label{display:none}' +
    '</style></head><body><h2>KDV Beyannamesi</h2>' +
    icerik.innerHTML + '</body></html>'
  );
  win.document.close();
  win.focus();
  setTimeout(function() { win.print(); }, 400);
}

function vergiTakvimYazdir() {
  var icerik = document.getElementById('vi-takvim');
  if (!icerik) return;
  var win = window.open('', '_blank');
  win.document.write(
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<title>Vergi Takvimi</title>' +
    '<style>' +
    'body{font-family:system-ui,sans-serif;font-size:12px;color:#111;margin:24px}' +
    'h2{font-size:16px;margin-bottom:16px}' +
    '.sec-title{font-weight:700;font-size:14px;margin:16px 0 6px;color:#374151}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:4px}' +
    'th{text-align:left;border-bottom:2px solid #e5e7eb;padding:5px 8px;font-size:11px;color:#6b7280;background:#f9fafb}' +
    'td{padding:5px 8px;border-bottom:1px solid #f3f4f6}' +
    '.badge{padding:2px 6px;border-radius:4px;font-size:10px}' +
    'tr:last-child td{border-bottom:none}' +
    '@media print{button{display:none}}' +
    '</style></head><body>' +
    '<h2>Vergi Ödeme Takvimi — Önümüzdeki 90 Gün</h2>' +
    icerik.innerHTML +
    '</body></html>'
  );
  win.document.close();
  win.focus();
  setTimeout(function() { win.print(); }, 400);
}
