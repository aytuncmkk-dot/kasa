// ============================================================
// MALİYET — Sezon & dönem analizi
// ============================================================

var MAL_GRUPLAR = [
  { baslik: 'YİYECEK & İÇECEK', kisa: 'yiyecek', renk: '#b45309', katlar: ['Yiyecek Giderleri', 'İçecek Giderleri'] },
  { baslik: 'PERSONEL',          kisa: 'personel', renk: '#7c3aed', katlar: ['Personel Giderleri', 'Extra Personel'] },
  { baslik: 'EĞLENCE',           kisa: 'eglence',  renk: '#0e7490', katlar: ['Eğlence Giderleri'] },
  { baslik: 'SABİT GİDERLER',   kisa: 'sabit',    renk: '#374151', katlar: ['Sabit Giderler','Kadıköy Belediyesi','Banka Giderleri','Kredi Ödemeleri','İletişim Giderleri','Muhasebe Giderleri','MÜYAP','Reklam Giderleri','Temizlik Giderleri','Tamir & Tadilat'] },
];

var MAL_HEDEF_DEFAULT = { yiyecek: 30, personel: 35, eglence: 15, sabit: 18 };

function malHedefOku(kisa) {
  var v = localStorage.getItem('mal_hedef_' + kisa);
  return v !== null ? parseFloat(v) : MAL_HEDEF_DEFAULT[kisa];
}
function malHedefKaydet(kisa, v) {
  localStorage.setItem('mal_hedef_' + kisa, v);
}

function maliyetTipDegisti() {
  var tip = document.getElementById('m-tip').value;
  document.getElementById('m-ay').style.display          = tip === 'ay'     ? '' : 'none';
  document.getElementById('m-aralik-wrap').style.display = tip === 'aralik' ? 'flex' : 'none';
  document.getElementById('m-yil').style.display         = tip === 'yil'    ? '' : 'none';
  if (tip === 'sezon') {
    // Otomatik sezon: geçen Kasım 1 → bu Mart 31
    var simdi = new Date();
    var sezonYil = simdi.getMonth() >= 10 ? simdi.getFullYear() : simdi.getFullYear() - 1;
    document.getElementById('m-bas').value = sezonYil + '-11-01';
    document.getElementById('m-son').value = (sezonYil + 1) + '-03-31';
    document.getElementById('m-aralik-wrap').style.display = 'flex';
  }
  renderMaliyet();
}

function getMaliyetListe() {
  var tip = document.getElementById('m-tip').value;
  return kayitlar.filter(function(k) {
    if (tip === 'ay')    return k.tarih.startsWith(document.getElementById('m-ay').value);
    if (tip === 'aralik' || tip === 'sezon') {
      var b = document.getElementById('m-bas').value, s = document.getElementById('m-son').value;
      if (b && s) return k.tarih >= b && k.tarih <= s;
      return true;
    }
    if (tip === 'yil')   return k.tarih.startsWith(document.getElementById('m-yil').value);
    return true;
  });
}

function renderMaliyet() {
  var el = document.getElementById('m-icerik');
  if (!el) return;

  var list  = getMaliyetListe();
  var gel   = list.filter(function(k) { return k.tur === 'gelir'; });
  var gid   = list.filter(function(k) { return k.tur === 'gider'; });

  var topGelir = gel.reduce(function(s, k) { return s + Number(k.tutar); }, 0);

  function katTop(kat) { return gid.filter(function(k) { return k.kat === kat; }).reduce(function(s, k) { return s + Number(k.tutar); }, 0); }
  function grupTop(g)  { return g.katlar.reduce(function(s, k) { return s + katTop(k); }, 0); }

  var topMaliyet = MAL_GRUPLAR.reduce(function(s, g) { return s + grupTop(g); }, 0);
  var netKar     = topGelir - topMaliyet;
  var karMarji   = topGelir > 0 ? (netKar / topGelir * 100) : 0;

  // Kişi başı (gelir grupları)
  var grupKisi = {};
  gel.forEach(function(k) {
    var key = k.tarih + '|' + (k.firma || '');
    if (!grupKisi[key]) grupKisi[key] = { kisi: 0, tutar: 0 };
    grupKisi[key].tutar += Number(k.tutar);
    if (Number(k.kisi_sayisi) > 0) grupKisi[key].kisi += Number(k.kisi_sayisi);
  });
  var topKisi = 0, kisiBazliGelir = 0;
  Object.keys(grupKisi).forEach(function(key) {
    topKisi += grupKisi[key].kisi;
    if (grupKisi[key].kisi > 0) kisiBazliGelir += grupKisi[key].tutar;
  });
  var kisiBasiGelir = topKisi > 0 ? (kisiBazliGelir / topKisi) : 0;

  // Dönem metni
  var tip = document.getElementById('m-tip').value;
  var donemMetni = '';
  if (tip === 'sezon' || tip === 'aralik') {
    var b2 = document.getElementById('m-bas').value, s2 = document.getElementById('m-son').value;
    if (b2 && s2) donemMetni = b2.split('-').reverse().join('.') + ' — ' + s2.split('-').reverse().join('.');
  } else if (tip === 'ay') {
    donemMetni = document.getElementById('m-ay').value;
  } else if (tip === 'yil') {
    donemMetni = document.getElementById('m-yil').value;
  } else {
    donemMetni = 'Tüm Zamanlar';
  }

  var html = '';

  // PDF butonu
  html += '<div style="display:flex;justify-content:flex-end;margin-bottom:12px">' +
    '<button class="btn btn-p" onclick="maliyetRaporuYazdir()" style="font-size:12px">📄 Ortaklara Rapor — PDF</button>' +
  '</div>';

  // ── ÖZET METRİKLER ──────────────────────────────────────────
  var mkRenk = karMarji >= 30 ? '#166534' : karMarji >= 15 ? '#92400e' : '#991b1b';
  var mkBg   = karMarji >= 30 ? '#dcfce7' : karMarji >= 15 ? '#fefce8' : '#fef2f2';

  html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px">' +
    '<div class="ok"><div class="ok-label">Toplam Gelir</div><div class="ok-val gc">' + para(topGelir) + '</div></div>' +
    '<div class="ok"><div class="ok-label">Toplam Maliyet</div><div class="ok-val rc">' + para(topMaliyet) + '</div></div>' +
    '<div class="ok" style="border-color:' + mkRenk + ';background:' + mkBg + '">' +
      '<div class="ok-label" style="color:' + mkRenk + '">Net Kar</div>' +
      '<div class="ok-val" style="color:' + mkRenk + '">' + para(netKar) + '</div>' +
      '<div style="font-size:11px;color:' + mkRenk + ';margin-top:3px">%' + karMarji.toFixed(1) + ' kar marjı</div>' +
    '</div>' +
    '<div class="ok"><div class="ok-label">Toplam Kişi</div><div class="ok-val" style="color:#185FA5">' + topKisi.toLocaleString('tr-TR') + '</div></div>' +
    '<div class="ok"><div class="ok-label">Kişi Başı Gelir</div><div class="ok-val" style="color:#185FA5">' + para(kisiBasiGelir) + '</div></div>' +
  '</div>';

  // ── MALİYET YAPISI ──────────────────────────────────────────
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">';

  MAL_GRUPLAR.forEach(function(g) {
    var gt = grupTop(g);
    var oran = topGelir > 0 ? (gt / topGelir * 100) : 0;
    var hedef = malHedefOku(g.kisa);
    var fark = oran - hedef;
    var durumRenk = fark <= 0 ? '#166534' : fark <= 5 ? '#92400e' : '#dc2626';
    var durumBg   = fark <= 0 ? '#dcfce7' : fark <= 5 ? '#fefce8' : '#fef2f2';

    html += '<div style="background:#fff;border:1px solid #e0e0db;border-radius:10px;overflow:hidden">' +
      '<div style="background:' + g.renk + ';color:#fff;padding:8px 12px;display:flex;justify-content:space-between;align-items:center">' +
        '<span style="font-size:12px;font-weight:700">' + g.baslik + '</span>' +
        '<span style="font-size:18px;font-weight:800">' + para(gt) + '</span>' +
      '</div>' +
      '<div style="padding:8px 12px;display:flex;gap:10px;border-bottom:1px solid #f0f0ec">' +
        '<div style="flex:1;text-align:center">' +
          '<div style="font-size:10px;color:#888">GELİRE ORAN</div>' +
          '<div style="font-size:20px;font-weight:700;color:' + g.renk + '">%' + oran.toFixed(1) + '</div>' +
        '</div>' +
        '<div style="flex:1;text-align:center">' +
          '<div style="font-size:10px;color:#888">HEDEF</div>' +
          '<div style="font-size:20px;font-weight:700;color:#888">%' + hedef.toFixed(1) + '</div>' +
        '</div>' +
        '<div style="flex:1;text-align:center">' +
          '<div style="font-size:10px;color:#888">FARK</div>' +
          '<div style="font-size:18px;font-weight:700;padding:2px 8px;border-radius:6px;background:' + durumBg + ';color:' + durumRenk + '">' +
            (fark > 0 ? '+' : '') + fark.toFixed(1) + '%' +
          '</div>' +
        '</div>' +
      '</div>';

    // Alt kategoriler
    g.katlar.forEach(function(kat) {
      var v = katTop(kat);
      if (!v) return;
      var ko = topGelir > 0 ? (v / topGelir * 100).toFixed(1) : 0;

      // Top 3 kayıt bu kategori için
      var kayitlarKat = gid.filter(function(k) { return k.kat === kat; });
      var kayitGruplar = {};
      kayitlarKat.forEach(function(k) {
        var anahtar = (k.aciklama && k.aciklama.trim()) ? k.aciklama.trim() : (k.firma && k.firma.trim() ? k.firma.trim() : 'Diğer');
        kayitGruplar[anahtar] = (kayitGruplar[anahtar] || 0) + Number(k.tutar);
      });
      var top3 = Object.keys(kayitGruplar)
        .sort(function(a, b) { return kayitGruplar[b] - kayitGruplar[a]; })
        .slice(0, 3);

      html += '<div style="padding:6px 12px;border-bottom:1px solid #f5f5f3">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<span style="font-size:12px;color:#555">' + kat + '</span>' +
          '<div style="display:flex;gap:10px;align-items:center">' +
            '<span style="font-size:11px;color:#aaa">%' + ko + '</span>' +
            '<span style="font-size:12px;font-weight:600;color:' + g.renk + '">' + para(v) + '</span>' +
          '</div>' +
        '</div>';

      if (top3.length) {
        html += '<div style="margin-top:3px">';
        top3.forEach(function(key) {
          html += '<div style="display:flex;justify-content:space-between;padding:1px 0;font-size:11px;color:#999">' +
            '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px">' + key + '</span>' +
            '<span>' + para(kayitGruplar[key]) + '</span>' +
          '</div>';
        });
        html += '</div>';
      }
      html += '</div>';
    });

    html += '</div>';
  });

  html += '</div>';

  // ── AYLIK TREND ─────────────────────────────────────────────
  var aylarSet = {};
  list.forEach(function(k) { aylarSet[k.tarih.slice(0, 7)] = true; });
  var aylar = Object.keys(aylarSet).sort();

  if (aylar.length > 1) {
    html += '<div style="font-size:12px;font-weight:600;color:#555;margin-bottom:8px">AYLIK TREND</div>';
    html += '<div class="tw" style="margin-bottom:16px"><table><thead><tr>' +
      '<th>Ay</th><th style="text-align:right">Gelir</th>';
    MAL_GRUPLAR.forEach(function(g) { html += '<th style="text-align:right">' + g.baslik.split(' ')[0] + '</th>'; });
    html += '<th style="text-align:right">Net Kar</th><th style="text-align:right">Kar %</th></tr></thead><tbody>';

    aylar.forEach(function(ay) {
      var ayList = list.filter(function(k) { return k.tarih.startsWith(ay); });
      var ayGelir = ayList.filter(function(k) { return k.tur === 'gelir'; }).reduce(function(s, k) { return s + Number(k.tutar); }, 0);
      var ayGid   = ayList.filter(function(k) { return k.tur === 'gider'; });
      function ayKatTop(kat) { return ayGid.filter(function(k) { return k.kat === kat; }).reduce(function(s, k) { return s + Number(k.tutar); }, 0); }
      var ayMaliyet = MAL_GRUPLAR.reduce(function(s, g) { return s + g.katlar.reduce(function(ss, k) { return ss + ayKatTop(k); }, 0); }, 0);
      var ayKar  = ayGelir - ayMaliyet;
      var ayMarj = ayGelir > 0 ? (ayKar / ayGelir * 100) : 0;
      var karRenk = ayMarj >= 30 ? '#166534' : ayMarj >= 15 ? '#92400e' : '#dc2626';

      html += '<tr>' +
        '<td style="font-weight:500">' + donemYazi(ay) + '</td>' +
        '<td style="text-align:right">' + para(ayGelir) + '</td>';
      MAL_GRUPLAR.forEach(function(g) {
        var v = g.katlar.reduce(function(s, k) { return s + ayKatTop(k); }, 0);
        var o = ayGelir > 0 ? (v / ayGelir * 100).toFixed(0) : 0;
        html += '<td style="text-align:right;font-size:12px;color:' + g.renk + '">' +
          (v ? para(v) + '<br><span style="font-size:10px;color:#aaa">%' + o + '</span>' : '<span style="color:#ccc">—</span>') + '</td>';
      });
      html += '<td style="text-align:right;font-weight:600;color:' + karRenk + '">' + para(ayKar) + '</td>' +
        '<td style="text-align:right"><span style="padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;background:' + (ayMarj >= 30 ? '#dcfce7' : ayMarj >= 15 ? '#fefce8' : '#fef2f2') + ';color:' + karRenk + '">%' + ayMarj.toFixed(1) + '</span></td>' +
      '</tr>';
    });

    html += '<tr style="background:#f3f4f6;border-top:2px solid #e5e7eb;font-weight:600">' +
      '<td>TOPLAM</td><td style="text-align:right">' + para(topGelir) + '</td>';
    MAL_GRUPLAR.forEach(function(g) {
      var v = grupTop(g);
      var o = topGelir > 0 ? (v / topGelir * 100).toFixed(0) : 0;
      html += '<td style="text-align:right;color:' + g.renk + '">' + para(v) + '<br><span style="font-size:10px">%' + o + '</span></td>';
    });
    var netRenk = netKar >= 0 ? '#166534' : '#dc2626';
    html += '<td style="text-align:right;color:' + netRenk + '">' + para(netKar) + '</td>' +
      '<td style="text-align:right"><span style="padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;background:' + mkBg + ';color:' + mkRenk + '">%' + karMarji.toFixed(1) + '</span></td>' +
    '</tr>';
    html += '</tbody></table></div>';
  }

  // ── EN BÜYÜK 15 TEKİL GİDER ─────────────────────────────────
  var top15 = gid.slice().sort(function(a, b) { return Number(b.tutar) - Number(a.tutar); }).slice(0, 15);
  if (top15.length) {
    html += '<div style="font-size:12px;font-weight:600;color:#555;margin-bottom:8px">EN BÜYÜK 15 GİDER KAYDI</div>';
    html += '<div class="tw" style="margin-bottom:16px"><table><thead><tr>' +
      '<th>#</th><th>Tarih</th><th>Kategori</th><th>Açıklama / Firma</th>' +
      '<th style="text-align:right">Tutar</th><th style="text-align:right">Gelire %</th>' +
    '</tr></thead><tbody>';
    top15.forEach(function(k, i) {
      var acik = (k.aciklama && k.aciklama.trim()) || (k.firma && k.firma.trim()) || '—';
      var oran = topGelir > 0 ? (Number(k.tutar) / topGelir * 100).toFixed(2) : 0;
      html += '<tr>' +
        '<td style="color:#aaa;font-size:11px">' + (i + 1) + '</td>' +
        '<td style="font-size:12px;white-space:nowrap">' + fmtT(k.tarih) + '</td>' +
        '<td style="font-size:12px">' + (k.kat || '—') + '</td>' +
        '<td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + acik + '</td>' +
        '<td style="text-align:right;font-weight:600;color:#D85A30">' + para(Number(k.tutar)) + '</td>' +
        '<td style="text-align:right;font-size:11px;color:#aaa">%' + oran + '</td>' +
      '</tr>';
    });
    html += '</tbody></table></div>';
  }

  // ── BİR SONRAKİ SEZON HEDEFLERİ ─────────────────────────────
  html += '<div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:10px;padding:14px">' +
    '<div style="font-size:13px;font-weight:700;color:#3730a3;margin-bottom:12px">🎯 Bir Sonraki Sezon Hedefleri</div>' +
    '<div style="font-size:11px;color:#6366f1;margin-bottom:12px">Hedef yüzdeleri düzenleyin — tasarruf potansiyeli otomatik hesaplanır (aynı gelir baz alınır)</div>' +
    '<div class="tw"><table><thead><tr>' +
      '<th>Kategori</th>' +
      '<th style="text-align:right">Bu Sezon TL</th>' +
      '<th style="text-align:right">Bu Sezon %</th>' +
      '<th style="text-align:right;width:110px">Hedef %</th>' +
      '<th style="text-align:right">Tasarruf Potansiyeli</th>' +
    '</tr></thead><tbody>';

  var topTasarruf = 0;
  MAL_GRUPLAR.forEach(function(g) {
    var gt    = grupTop(g);
    var oran  = topGelir > 0 ? (gt / topGelir * 100) : 0;
    var hedef = malHedefOku(g.kisa);
    var tasarruf = topGelir > 0 ? Math.max(0, (oran - hedef) / 100 * topGelir) : 0;
    topTasarruf += tasarruf;
    var tRenk = tasarruf > 0 ? '#166534' : '#aaa';
    html += '<tr>' +
      '<td style="font-weight:600;color:' + g.renk + '">' + g.baslik + '</td>' +
      '<td style="text-align:right">' + para(gt) + '</td>' +
      '<td style="text-align:right;font-weight:600">%' + oran.toFixed(1) + '</td>' +
      '<td style="text-align:right">' +
        '<input type="number" value="' + hedef + '" min="0" max="100" step="0.5" ' +
          'style="width:80px;border:1px solid #c7d2fe;border-radius:6px;padding:4px 8px;font-size:12px;text-align:right;background:#fff" ' +
          'onchange="malHedefKaydet(\'' + g.kisa + '\',this.value);renderMaliyet()">' +
      '</td>' +
      '<td style="text-align:right;font-weight:600;color:' + tRenk + '">' +
        (tasarruf > 0 ? para(tasarruf) : '<span style="color:#aaa">—</span>') +
      '</td>' +
    '</tr>';
  });

  html += '<tr style="background:#e0e7ff;font-weight:700;border-top:2px solid #c7d2fe">' +
    '<td colspan="4" style="color:#3730a3">TOPLAM TASARRUF POTANSİYELİ</td>' +
    '<td style="text-align:right;font-size:15px;color:#166534">' + (topTasarruf > 0 ? para(topTasarruf) : '—') + '</td>' +
  '</tr>';
  html += '</tbody></table></div></div>';

  el.innerHTML = html;
}

// ── ORTAK PDF RAPORU ─────────────────────────────────────────

function maliyetRaporuYazdir() {
  var tip = document.getElementById('m-tip').value;
  var bas = '', son = '';
  if (tip === 'sezon' || tip === 'aralik') {
    bas = document.getElementById('m-bas').value;
    son = document.getElementById('m-son').value;
  } else if (tip === 'ay') {
    var ay = document.getElementById('m-ay').value;
    bas = ay + '-01';
    var d = new Date(ay + '-01'); d.setMonth(d.getMonth() + 1); d.setDate(d.getDate() - 1);
    son = ldStr(d);
  } else if (tip === 'yil') {
    var y = document.getElementById('m-yil').value;
    bas = y + '-01-01'; son = y + '-12-31';
  } else {
    bas = ''; son = '';
  }

  var donemBas = bas ? bas.split('-').reverse().join('.') : 'Başlangıç';
  var donemSon = son ? son.split('-').reverse().join('.') : 'Bugün';
  var donemBaslik = donemBas + ' — ' + donemSon;

  var list = kayitlar.filter(function(k) {
    if (bas && k.tarih < bas) return false;
    if (son && k.tarih > son) return false;
    return true;
  });
  var fatList = (typeof faturalar !== 'undefined' ? faturalar : []).filter(function(f) {
    if (bas && f.tarih < bas) return false;
    if (son && f.tarih > son) return false;
    return true;
  });
  var dagList = list.filter(function(k) { return k.tur === 'dagitim'; });

  var gel  = list.filter(function(k) { return k.tur === 'gelir'; });
  var gid  = list.filter(function(k) { return k.tur === 'gider'; });

  var topGelir    = gel.reduce(function(s, k) { return s + Number(k.tutar); }, 0);
  var topDagitim  = dagList.reduce(function(s, k) { return s + Number(k.tutar); }, 0);

  function katTop(kat) { return gid.filter(function(k) { return k.kat === kat; }).reduce(function(s, k) { return s + Number(k.tutar); }, 0); }
  function grupTop(g)  { return g.katlar.reduce(function(s, k) { return s + katTop(k); }, 0); }

  var topMaliyet = MAL_GRUPLAR.reduce(function(s, g) { return s + grupTop(g); }, 0);
  var netKar     = topGelir - topMaliyet;
  var karMarji   = topGelir > 0 ? (netKar / topGelir * 100) : 0;
  var kasadaKalan = netKar - topDagitim;

  // Kişi sayısı
  var grupKisi = {};
  gel.forEach(function(k) {
    var key = k.tarih + '|' + (k.firma || '');
    if (!grupKisi[key]) grupKisi[key] = { kisi: 0, tutar: 0 };
    grupKisi[key].tutar += Number(k.tutar);
    if (Number(k.kisi_sayisi) > 0) grupKisi[key].kisi += Number(k.kisi_sayisi);
  });
  var topKisi = 0, kisiBazliGelir = 0;
  Object.keys(grupKisi).forEach(function(key) {
    topKisi += grupKisi[key].kisi;
    if (grupKisi[key].kisi > 0) kisiBazliGelir += grupKisi[key].tutar;
  });
  var kisiBasiGelir = topKisi > 0 ? (kisiBazliGelir / topKisi) : 0;

  // Aylık veriler
  var aylarSet = {};
  list.forEach(function(k) { aylarSet[k.tarih.slice(0, 7)] = true; });
  var aylar = Object.keys(aylarSet).sort();

  // Eğlence + Extra Personel (resmi dışı)
  var RESMI_DISI = ['Eğlence Giderleri', 'Extra Personel'];
  var topRD = RESMI_DISI.reduce(function(s, k) { return s + katTop(k); }, 0);
  var vergiKaybi = Math.round(topRD * 0.25);

  // Tedarikçi bazlı fatura toplamları
  var tedarikci = {};
  fatList.forEach(function(f) {
    var isim = (f.firma && f.firma.trim()) ? f.firma.trim() : 'Belirtilmemiş';
    if (!tedarikci[isim]) tedarikci[isim] = { tutar: 0, kdv: 0, adet: 0 };
    tedarikci[isim].tutar += Number(f.tutar) || 0;
    tedarikci[isim].kdv   += Number(f.kdv_tutar) || 0;
    tedarikci[isim].adet  += 1;
  });
  var tedarikciList = Object.keys(tedarikci).map(function(k) {
    return { isim: k, tutar: tedarikci[k].tutar, kdv: tedarikci[k].kdv, adet: tedarikci[k].adet };
  }).sort(function(a, b) { return b.tutar - a.tutar; });
  var topFatTutar = tedarikciList.reduce(function(s, t) { return s + t.tutar; }, 0);
  var topFatKdv   = tedarikciList.reduce(function(s, t) { return s + t.kdv; }, 0);

  // Ortak dağılımı
  var ortakDag = {};
  dagList.forEach(function(k) {
    var isim = (k.firma && k.firma.trim()) || (k.aciklama && k.aciklama.trim()) || 'Diğer';
    ortakDag[isim] = (ortakDag[isim] || 0) + Number(k.tutar);
  });

  // ── HTML ─────────────────────────────────────────────────────
  var css = [
    'body{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:11px;color:#1a1a1a;margin:0;padding:0;background:#fff}',
    '.page{max-width:210mm;margin:0 auto;padding:16mm 14mm}',
    'h1{font-size:22px;font-weight:800;margin:0;color:#1a1a1a}',
    'h2{font-size:13px;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb;padding-bottom:5px;margin:20px 0 8px}',
    '.subtitle{font-size:12px;color:#6b7280;margin-top:3px}',
    '.meta{font-size:10px;color:#9ca3af;margin-top:2px}',
    '.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:14px 0}',
    '.card{border:1px solid #e5e7eb;border-radius:8px;padding:10px;text-align:center}',
    '.card-label{font-size:9px;color:#9ca3af;font-weight:600;text-transform:uppercase;margin-bottom:4px}',
    '.card-val{font-size:16px;font-weight:800}',
    '.card-sub{font-size:9px;color:#9ca3af;margin-top:2px}',
    '.gc{color:#166534}.rc{color:#dc2626}.bc{color:#185FA5}',
    'table{width:100%;border-collapse:collapse;font-size:10.5px}',
    'th{background:#f9fafb;border-bottom:2px solid #e5e7eb;padding:5px 7px;text-align:left;font-size:10px;color:#6b7280;font-weight:600}',
    'td{padding:4px 7px;border-bottom:1px solid #f3f4f6}',
    'tr:last-child td{border-bottom:none}',
    '.sum-row td{background:#f3f4f6;font-weight:700;border-top:2px solid #e5e7eb}',
    '.grup-row td{background:#f9fafb;font-weight:700;color:#374151}',
    '.kat-row td{padding-left:18px;color:#6b7280}',
    '.notice{background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px 12px;margin-top:12px}',
    '.notice-title{font-weight:700;color:#991b1b;font-size:11px;margin-bottom:4px}',
    '.notice-body{color:#7f1d1d;line-height:1.6;font-size:10.5px}',
    '.footer{margin-top:20px;border-top:1px solid #e5e7eb;padding-top:8px;text-align:center;font-size:9px;color:#9ca3af}',
    '.separator{height:1px;background:#e5e7eb;margin:16px 0}',
    '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}'
  ].join('\n');

  // Yönetici özeti
  var ozet = '<div class="cards">' +
    '<div class="card"><div class="card-label">Toplam Gelir</div><div class="card-val gc">' + para(topGelir) + '</div></div>' +
    '<div class="card"><div class="card-label">İşletme Maliyeti</div><div class="card-val rc">' + para(topMaliyet) + '</div></div>' +
    '<div class="card" style="border-color:' + (karMarji >= 20 ? '#86efac' : '#fca5a5') + ';background:' + (karMarji >= 20 ? '#f0fdf4' : '#fef2f2') + '"><div class="card-label">Net Kar</div><div class="card-val ' + (netKar >= 0 ? 'gc' : 'rc') + '">' + para(netKar) + '</div><div class="card-sub">%' + karMarji.toFixed(1) + ' marj</div></div>' +
    '<div class="card"><div class="card-label">Toplam Misafir</div><div class="card-val bc">' + topKisi.toLocaleString('tr-TR') + '</div></div>' +
    '<div class="card"><div class="card-label">Kişi Başı Gelir</div><div class="card-val bc">' + para(kisiBasiGelir) + '</div></div>' +
  '</div>';

  // Aylık trend tablosu
  var aylikHtml = '<table><thead><tr><th>Ay</th><th style="text-align:right">Gelir</th><th style="text-align:right">Maliyet</th><th style="text-align:right">Net Kar</th><th style="text-align:right">Marj %</th><th style="text-align:right">Misafir</th></tr></thead><tbody>';
  aylar.forEach(function(ay) {
    var ayList = list.filter(function(k) { return k.tarih.startsWith(ay); });
    var ayGelir = ayList.filter(function(k) { return k.tur === 'gelir'; }).reduce(function(s, k) { return s + Number(k.tutar); }, 0);
    var ayGid2  = ayList.filter(function(k) { return k.tur === 'gider'; });
    function ayKT(kat) { return ayGid2.filter(function(k) { return k.kat === kat; }).reduce(function(s, k) { return s + Number(k.tutar); }, 0); }
    var ayMal  = MAL_GRUPLAR.reduce(function(s, g) { return s + g.katlar.reduce(function(ss, k) { return ss + ayKT(k); }, 0); }, 0);
    var ayKar2 = ayGelir - ayMal;
    var ayMrj  = ayGelir > 0 ? (ayKar2 / ayGelir * 100) : 0;
    var ayKisiG = {};
    ayList.filter(function(k) { return k.tur === 'gelir'; }).forEach(function(k) {
      var key2 = k.tarih + '|' + (k.firma || '');
      if (!ayKisiG[key2]) ayKisiG[key2] = 0;
      if (Number(k.kisi_sayisi) > 0) ayKisiG[key2] += Number(k.kisi_sayisi);
    });
    var ayKisi = Object.values(ayKisiG).reduce(function(s, v) { return s + v; }, 0);
    aylikHtml += '<tr><td style="font-weight:600">' + donemYazi(ay) + '</td>' +
      '<td style="text-align:right">' + para(ayGelir) + '</td>' +
      '<td style="text-align:right;color:#dc2626">' + para(ayMal) + '</td>' +
      '<td style="text-align:right;font-weight:600;color:' + (ayKar2 >= 0 ? '#166534' : '#dc2626') + '">' + para(ayKar2) + '</td>' +
      '<td style="text-align:right">' + ayMrj.toFixed(1) + '%</td>' +
      '<td style="text-align:right">' + (ayKisi || '—') + '</td>' +
    '</tr>';
  });
  aylikHtml += '<tr class="sum-row">' +
    '<td>TOPLAM / ORT.</td>' +
    '<td style="text-align:right">' + para(topGelir) + '</td>' +
    '<td style="text-align:right;color:#dc2626">' + para(topMaliyet) + '</td>' +
    '<td style="text-align:right;color:' + (netKar >= 0 ? '#166534' : '#dc2626') + '">' + para(netKar) + '</td>' +
    '<td style="text-align:right">' + karMarji.toFixed(1) + '%</td>' +
    '<td style="text-align:right">' + topKisi.toLocaleString('tr-TR') + '</td>' +
  '</tr>';
  aylikHtml += '</tbody></table>';

  // Maliyet yapısı
  var maliyetHtml = '<table><thead><tr><th>Kategori</th><th style="text-align:right">Tutar</th><th style="text-align:right">Gelire %</th></tr></thead><tbody>';
  MAL_GRUPLAR.forEach(function(g) {
    var gt   = grupTop(g);
    var gOr  = topGelir > 0 ? (gt / topGelir * 100).toFixed(1) : 0;
    maliyetHtml += '<tr class="grup-row"><td>' + g.baslik + '</td><td style="text-align:right">' + para(gt) + '</td><td style="text-align:right">%' + gOr + '</td></tr>';
    g.katlar.forEach(function(kat) {
      var v = katTop(kat);
      if (!v) return;
      var ko = topGelir > 0 ? (v / topGelir * 100).toFixed(1) : 0;
      maliyetHtml += '<tr class="kat-row"><td>' + kat + '</td><td style="text-align:right">' + para(v) + '</td><td style="text-align:right;color:#9ca3af">%' + ko + '</td></tr>';
    });
  });
  maliyetHtml += '<tr class="sum-row"><td>TOPLAM MALİYET</td><td style="text-align:right">' + para(topMaliyet) + '</td><td style="text-align:right">%' + (topGelir > 0 ? (topMaliyet / topGelir * 100).toFixed(1) : 0) + '</td></tr>';
  maliyetHtml += '</tbody></table>';

  // Fatura özeti
  var faturaHtml = '';
  if (tedarikciList.length) {
    faturaHtml = '<table><thead><tr><th>Tedarikçi / Firma</th><th style="text-align:right">Adet</th><th style="text-align:right">Matrah</th><th style="text-align:right">KDV</th><th style="text-align:right">Toplam</th></tr></thead><tbody>';
    tedarikciList.slice(0, 20).forEach(function(t) {
      faturaHtml += '<tr><td>' + t.isim + '</td><td style="text-align:right">' + t.adet + '</td>' +
        '<td style="text-align:right">' + para(t.tutar - t.kdv) + '</td>' +
        '<td style="text-align:right;color:#7c3aed">' + (t.kdv ? para(t.kdv) : '—') + '</td>' +
        '<td style="text-align:right;font-weight:600">' + para(t.tutar) + '</td></tr>';
    });
    if (tedarikciList.length > 20) {
      faturaHtml += '<tr><td style="color:#9ca3af" colspan="4">... ve ' + (tedarikciList.length - 20) + ' firma daha</td><td></td></tr>';
    }
    faturaHtml += '<tr class="sum-row"><td>TOPLAM (' + tedarikciList.length + ' firma)</td><td style="text-align:right">' + fatList.length + ' fatura</td>' +
      '<td style="text-align:right">' + para(topFatTutar - topFatKdv) + '</td>' +
      '<td style="text-align:right;color:#7c3aed">' + (topFatKdv ? para(topFatKdv) : '—') + '</td>' +
      '<td style="text-align:right">' + para(topFatTutar) + '</td></tr>';
    faturaHtml += '</tbody></table>';
  } else {
    faturaHtml = '<p style="color:#9ca3af;font-size:11px">Bu dönem için fatura kaydı bulunamadı.</p>';
  }

  // Kar dağılımı
  var dagHtml = '';
  if (Object.keys(ortakDag).length) {
    dagHtml = '<table><thead><tr><th>Ortak</th><th style="text-align:right">Dönem Ödenen</th></tr></thead><tbody>';
    Object.keys(ortakDag).sort().forEach(function(isim) {
      dagHtml += '<tr><td>' + isim + '</td><td style="text-align:right;font-weight:600">' + para(ortakDag[isim]) + '</td></tr>';
    });
    dagHtml += '<tr class="sum-row"><td>TOPLAM DAĞITIM</td><td style="text-align:right">' + para(topDagitim) + '</td></tr>';
    dagHtml += '<tr><td style="font-weight:600">KASADA KALAN</td><td style="text-align:right;font-weight:800;color:#166534">' + para(kasadaKalan) + '</td></tr>';
    dagHtml += '</tbody></table>';
  }

  // Vergi notu
  var vergiNot = topRD > 0 ? (
    '<div class="notice"><div class="notice-title">⚠️ Vergi Yükü Notu</div>' +
    '<div class="notice-body">Bu dönemde <strong>' + para(katTop('Eğlence Giderleri')) + '</strong> eğlence gideri ve <strong>' + para(katTop('Extra Personel')) + '</strong> extra personel ödemesi yapılmıştır. ' +
    'Bu <strong>' + para(topRD) + '</strong>&#8217;lik harcama kurumlar vergisi matrahından düşülememektedir. ' +
    '%25 oranında <strong>' + para(vergiKaybi) + '</strong> fazla vergi ödenmektedir.</div></div>'
  ) : '';

  var raporHtml = '<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">' +
    '<title>Sezon Raporu — ' + donemBaslik + '</title>' +
    '<style>' + css + '</style></head><body><div class="page">' +

    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">' +
      '<div>' +
        '<h1>ZİYADE FASIL</h1>' +
        '<div class="subtitle">Sezon Analiz Raporu &nbsp;|&nbsp; ' + donemBaslik + '</div>' +
        '<div class="meta">Hazırlanma tarihi: ' + today.split('-').reverse().join('.') + '</div>' +
      '</div>' +
      '<div style="text-align:right;font-size:10px;color:#9ca3af">GİZLİ — Ortak Paylaşımı</div>' +
    '</div>' +

    '<h2>YÖNETİCİ ÖZETİ</h2>' + ozet +

    '<h2>AYLIK GELİR & KAR TABLOSU</h2>' + aylikHtml +

    '<h2>MALİYET YAPISI</h2>' + maliyetHtml +

    (tedarikciList.length ? '<h2>TEDARİKÇİ / FATURA ÖZETİ</h2>' + faturaHtml : '') +

    (Object.keys(ortakDag).length ? '<h2>KAR DAĞILIMI</h2>' + dagHtml : '') +

    vergiNot +

    '<div class="footer">Kasa Defteri &nbsp;|&nbsp; aytuncmkk-dot.github.io/kasa &nbsp;|&nbsp; Bu rapor işletme kayıtlarından otomatik oluşturulmuştur.</div>' +

  '</div></body></html>';

  var win = window.open('', '_blank');
  win.document.write(raporHtml);
  win.document.close();
  win.focus();
  setTimeout(function() { win.print(); }, 600);
}
