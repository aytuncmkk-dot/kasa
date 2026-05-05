// ============================================================
// MALİYET — Sezon & dönem analizi
// ============================================================

var MAL_GRUPLAR = [
  { baslik: 'YİYECEK & İÇECEK', kisa: 'yiyecek', renk: '#b45309', katlar: ['Yiyecek Giderleri', 'İçecek Giderleri'] },
  { baslik: 'PERSONEL',          kisa: 'personel', renk: '#7c3aed', katlar: ['Personel Giderleri', 'Extra Personel', 'SGK'] },
  { baslik: 'EĞLENCE',           kisa: 'eglence',  renk: '#0e7490', katlar: ['Eğlence Giderleri'] },
  { baslik: 'SABİT GİDERLER',   kisa: 'sabit',    renk: '#374151', katlar: ['Sabit Giderler','Kadıköy Belediyesi','Banka Giderleri','Kredi Ödemeleri','İletişim Giderleri','Muhasebe Giderleri','MÜYAP','Reklam Giderleri','Temizlik Giderleri','Tamir & Tadilat'] },
  { baslik: 'VERGİLER',          kisa: 'vergiler', renk: '#dc2626', katlar: ['Vergiler'] },
];


function maliyetTipDegisti() {
  var tip = document.getElementById('m-tip').value;
  document.getElementById('m-ay').style.display          = tip === 'ay'     ? '' : 'none';
  document.getElementById('m-aralik-wrap').style.display = tip === 'aralik' ? 'flex' : 'none';
  document.getElementById('m-yil').style.display         = tip === 'yil'    ? '' : 'none';
  if (tip === 'yukseksezon') {
    document.getElementById('m-bas').value = '2025-10-15';
    document.getElementById('m-son').value = '2026-03-31';
    document.getElementById('m-aralik-wrap').style.display = 'flex';
  }
  if (tip === 'dusuksezon') {
    document.getElementById('m-aralik-wrap').style.display = 'none';
  }
  renderMaliyet();
}

function getMaliyetListe() {
  var tip = document.getElementById('m-tip').value;
  return kayitlar.filter(function(k) {
    if (tip === 'ay')    return k.tarih.startsWith(document.getElementById('m-ay').value);
    if (tip === 'yukseksezon') return k.tarih >= '2025-10-15' && k.tarih <= '2026-03-31';
    if (tip === 'dusuksezon')  return k.tarih < '2025-10-15' || k.tarih > '2026-03-31';
    if (tip === 'aralik') {
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
  if (tip === 'yukseksezon') {
    donemMetni = '🔥 Yüksek Sezon: 15.10.2025 — 31.03.2026';
  } else if (tip === 'dusuksezon') {
    donemMetni = '❄️ Düşük Sezon (Sezon Dışı)';
  } else if (tip === 'aralik') {
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

    html += '<div style="background:#fff;border:1px solid #e0e0db;border-radius:10px;overflow:hidden">' +
      '<div style="background:' + g.renk + ';color:#fff;padding:8px 12px;display:flex;justify-content:space-between;align-items:center">' +
        '<span style="font-size:12px;font-weight:700">' + g.baslik + '</span>' +
        '<span style="font-size:18px;font-weight:800">' + para(gt) + '</span>' +
      '</div>' +
      '<div style="padding:8px 12px;display:flex;justify-content:center;border-bottom:1px solid #f0f0ec">' +
        '<div style="text-align:center">' +
          '<div style="font-size:10px;color:#888">GELİRE ORAN</div>' +
          '<div style="font-size:26px;font-weight:800;color:' + g.renk + '">%' + oran.toFixed(1) + '</div>' +
        '</div>' +
      '</div>';

    // Alt kategoriler — accordion
    g.katlar.forEach(function(kat) {
      var v = katTop(kat);
      if (!v) return;
      var ko = topGelir > 0 ? (v / topGelir * 100).toFixed(1) : 0;
      var uid = 'mal_' + g.kisa + '_' + kat.replace(/[^a-zA-Z0-9]/g, '_');

      var kayitlarKat = gid.filter(function(k) { return k.kat === kat; });
      var kayitGruplar = {};
      kayitlarKat.forEach(function(k) {
        var rawAnahtar = (k.aciklama && k.aciklama.trim()) ? k.aciklama.trim() : (k.firma && k.firma.trim() ? k.firma.trim() : 'Diğer');
        var anahtar = kat === 'Personel Giderleri' ? normalizePersonelAdi(rawAnahtar) : rawAnahtar;
        kayitGruplar[anahtar] = (kayitGruplar[anahtar] || 0) + Number(k.tutar);
      });
      // Yiyecek Giderleri'nde 10.000 TL altı kalemleri "MUHTELİF YİYECEK" altında topla
      if(kat === 'Yiyecek Giderleri'){
        var muh = 0;
        Object.keys(kayitGruplar).forEach(function(key){if(kayitGruplar[key]<10000){muh+=kayitGruplar[key];delete kayitGruplar[key];}});
        if(muh > 0) kayitGruplar['MUHTELİF YİYECEK'] = (kayitGruplar['MUHTELİF YİYECEK'] || 0) + muh;
      }
      // Eğlence Giderleri'nde SAZ/DANS/DJ dışındakileri "DİĞER" altında topla
      if(kat === 'Eğlence Giderleri'){
        var egD = 0;
        Object.keys(kayitGruplar).forEach(function(key){if(['SAZ','DANS','DJ'].indexOf(key)===-1){egD+=kayitGruplar[key];delete kayitGruplar[key];}});
        if(egD > 0) kayitGruplar['DİĞER'] = (kayitGruplar['DİĞER'] || 0) + egD;
      }
      var sortedKeys = Object.keys(kayitGruplar).sort(function(a, b) { return kayitGruplar[b] - kayitGruplar[a]; });

      html += '<div style="border-bottom:1px solid #f5f5f3">' +
        '<div onclick="accordionToggle(\'' + uid + '\')" style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;cursor:pointer">' +
          '<div style="display:flex;align-items:center;gap:6px">' +
            '<span id="' + uid + '_icon" style="color:#bbb;font-size:10px">&#9658;</span>' +
            '<span style="font-size:12px;color:#555">' + kat + '</span>' +
          '</div>' +
          '<div style="display:flex;gap:10px;align-items:center">' +
            '<span style="font-size:11px;color:#aaa">%' + ko + '</span>' +
            '<span style="font-size:12px;font-weight:600;color:' + g.renk + '">' + para(v) + '</span>' +
          '</div>' +
        '</div>';

      if (sortedKeys.length) {
        html += '<div id="' + uid + '" style="display:none;background:#fafaf9;border-top:1px solid #f0f0ec">';
        sortedKeys.forEach(function(key) {
          var pct = v > 0 ? ((kayitGruplar[key] / v) * 100).toFixed(0) : 0;
          html += '<div style="display:flex;justify-content:space-between;padding:4px 12px 4px 28px;font-size:11px;color:#777">' +
            '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px">' + key + '</span>' +
            '<div style="display:flex;gap:8px">' +
              '<span style="color:#ccc">%' + pct + '</span>' +
              '<span style="color:' + g.renk + '">' + para(kayitGruplar[key]) + '</span>' +
            '</div>' +
          '</div>';
        });
        html += '</div>';
      }
      html += '</div>';
    });

    html += '</div>';
  });

  html += '</div>';

  // ── RAPORA DAHİL OLMAYAN GİDERLER ───────────────────────────
  var dahilOlmayanKatlar = ['Adisyon Bahşiş','Ağırlama Giderleri','Burs ve Yardımlar','Müşteriye İadeler','Yatırım'];
  var dahilOlmayanTop = dahilOlmayanKatlar.reduce(function(s, k) { return s + katTop(k); }, 0);
  if(dahilOlmayanTop > 0){
    var doRenk = '#6b7280';
    var doHtml = '<div style="background:#fff;border:1px solid #e0e0db;border-radius:10px;overflow:hidden;margin-bottom:16px">' +
      '<div style="background:' + doRenk + ';color:#fff;padding:8px 12px;display:flex;justify-content:space-between;align-items:center">' +
        '<span style="font-size:12px;font-weight:700">RAPORA DAHİL OLMAYAN GİDERLER</span>' +
        '<span style="font-size:18px;font-weight:800">' + para(dahilOlmayanTop) + '</span>' +
      '</div>';
    dahilOlmayanKatlar.forEach(function(kat){
      var v = katTop(kat);
      if(!v) return;
      var ko = topGelir > 0 ? (v / topGelir * 100).toFixed(1) : 0;
      var uid = 'mal_do_' + kat.replace(/[^a-zA-Z0-9]/g,'_');
      var kayitlarKat = gid.filter(function(k){ return k.kat === kat; });
      var kayitGruplar = {};
      kayitlarKat.forEach(function(k){
        var rawAnahtar = (k.aciklama && k.aciklama.trim()) ? k.aciklama.trim() : (k.firma && k.firma.trim() ? k.firma.trim() : 'Diğer');
        kayitGruplar[rawAnahtar] = (kayitGruplar[rawAnahtar] || 0) + Number(k.tutar);
      });
      var sortedKeys = Object.keys(kayitGruplar).sort(function(a,b){ return kayitGruplar[b]-kayitGruplar[a]; });
      doHtml += '<div style="border-bottom:1px solid #f5f5f3">' +
        '<div onclick="accordionToggle(\'' + uid + '\')" style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;cursor:pointer">' +
          '<div style="display:flex;align-items:center;gap:6px">' +
            '<span id="' + uid + '_icon" style="color:#bbb;font-size:10px">&#9658;</span>' +
            '<span style="font-size:12px;color:#555">' + kat + '</span>' +
          '</div>' +
          '<div style="display:flex;gap:10px;align-items:center">' +
            '<span style="font-size:11px;color:#aaa">%' + ko + '</span>' +
            '<span style="font-size:12px;font-weight:600;color:' + doRenk + '">' + para(v) + '</span>' +
          '</div>' +
        '</div>';
      if(sortedKeys.length){
        doHtml += '<div id="' + uid + '" style="display:none;background:#fafaf9;border-top:1px solid #f0f0ec">';
        sortedKeys.forEach(function(key){
          var pct = v > 0 ? ((kayitGruplar[key]/v)*100).toFixed(0) : 0;
          doHtml += '<div style="display:flex;justify-content:space-between;padding:4px 12px 4px 28px;font-size:11px;color:#777">' +
            '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px">' + key + '</span>' +
            '<div style="display:flex;gap:8px"><span style="color:#ccc">%' + pct + '</span>' +
            '<span style="color:' + doRenk + '">' + para(kayitGruplar[key]) + '</span></div>' +
          '</div>';
        });
        doHtml += '</div>';
      }
      doHtml += '</div>';
    });
    doHtml += '</div>';
    html += doHtml;
  }

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

  // ── KARLILIK & ÇEKİMLER ─────────────────────────────────────
  var dag = list.filter(function(k) { return k.tur === 'dagitim'; });
  var topDag = dag.reduce(function(s, k) { return s + Number(k.tutar); }, 0);
  var kasadaKalan = netKar - topDag;

  var ortakDag = {};
  dag.forEach(function(k) {
    var isim = (k.firma && k.firma.trim()) || (k.aciklama && k.aciklama.trim()) || 'Diğer';
    ortakDag[isim] = (ortakDag[isim] || 0) + Number(k.tutar);
  });

  var klRenk = karMarji >= 30 ? '#166534' : karMarji >= 15 ? '#92400e' : '#dc2626';
  html += '<div style="background:#fff;border:1px solid #e0e0db;border-radius:10px;overflow:hidden;margin-bottom:16px">' +
    '<div style="background:#1a1a2e;color:#fff;padding:8px 12px;font-size:12px;font-weight:700">KARLILIK & ÇEKİMLER</div>' +
    '<div class="tw"><table><tbody>';

  html += '<tr style="background:#f9f9f8">' +
    '<td style="font-weight:600">Toplam Gelir</td>' +
    '<td style="text-align:right;font-weight:700;color:#166534">' + para(topGelir) + '</td>' +
    '<td style="text-align:right;color:#aaa;font-size:11px"></td>' +
  '</tr>' +
  '<tr>' +
    '<td style="color:#555">İşletme Maliyeti</td>' +
    '<td style="text-align:right;color:#D85A30">− ' + para(topMaliyet) + '</td>' +
    '<td style="text-align:right;color:#aaa;font-size:11px">%' + (topGelir > 0 ? (topMaliyet/topGelir*100).toFixed(1) : 0) + '</td>' +
  '</tr>' +
  '<tr style="border-top:2px solid #e0e0db;background:#f0fdf4">' +
    '<td style="font-weight:700">NET KAR</td>' +
    '<td style="text-align:right;font-weight:800;font-size:16px;color:' + klRenk + '">' + para(netKar) + '</td>' +
    '<td style="text-align:right;font-weight:700;color:' + klRenk + '">%' + karMarji.toFixed(1) + '</td>' +
  '</tr>';

  if (topDag > 0) {
    html += '<tr style="background:#fffbeb;border-top:2px solid #e0e0db">' +
      '<td style="font-weight:600;color:#92400e">Ortaklara Çekilen (Toplam)</td>' +
      '<td style="text-align:right;font-weight:700;color:#b45309">− ' + para(topDag) + '</td>' +
      '<td style="text-align:right;color:#aaa;font-size:11px">%' + (netKar > 0 ? (topDag/netKar*100).toFixed(1) : 0) + ' (kardan)</td>' +
    '</tr>';
    Object.keys(ortakDag).sort().forEach(function(isim) {
      html += '<tr>' +
        '<td style="padding-left:24px;font-size:12px;color:#666">↳ ' + isim + '</td>' +
        '<td style="text-align:right;font-size:12px;color:#b45309">' + para(ortakDag[isim]) + '</td>' +
        '<td></td>' +
      '</tr>';
    });
    html += '<tr style="border-top:2px solid #e0e0db;background:' + (kasadaKalan >= 0 ? '#f0fdf4' : '#fef2f2') + '">' +
      '<td style="font-weight:700">KASADA KALAN</td>' +
      '<td style="text-align:right;font-weight:800;font-size:16px;color:' + (kasadaKalan >= 0 ? '#166534' : '#dc2626') + '">' + para(kasadaKalan) + '</td>' +
      '<td></td>' +
    '</tr>';
  } else {
    html += '<tr style="background:#f9f9f8"><td colspan="3" style="color:#aaa;font-size:12px;text-align:center">Bu dönemde ortak çekimi kaydedilmemiş</td></tr>';
  }

  html += '</tbody></table></div></div>';

  el.innerHTML = html;
}

// ── ORTAK PDF RAPORU ─────────────────────────────────────────

function maliyetRaporuYazdir() {
  var tip = document.getElementById('m-tip').value;
  var bas = '', son = '';
  if (tip === 'yukseksezon') {
    bas = '2025-10-15'; son = '2026-03-31';
  } else if (tip === 'dusuksezon') {
    bas = ''; son = '';
  } else if (tip === 'aralik') {
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
