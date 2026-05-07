// ==========================================================
// ADİSYON ↔ KASA EŞLEŞTİRME (Simpra CSV)
// ==========================================================

var _esTarih = null;
var _esCsvAdisyon = [];      // Simpra'dan parse edilmiş kapalı adisyonlar
var _esCsvIptal = [];        // İptal adisyonlar (gösterim için)
var _esCsvFilename = '';
var _esKasaKayitlar = [];    // O günün kasa gelir kayıtları (Kapora dahil ayrımlı)
var _esEslesmeler = [];      // [{kasa_id, simpra_cek_no:[], kasa_tutar, simpra_tutar, fark, durum, manuel, not}]
var _esTolerans = 5;         // ₺ — yuvarlama farkı eşiği
var _esKayitliId = null;     // adisyon_eslestirme tablosundaki kayıt id

function eslestirmeAc(){
  var bugun = ldStr(new Date());
  var tarihEl = document.getElementById('es-tarih');
  if(!tarihEl.value) tarihEl.value = bugun;
  _esTarih = tarihEl.value;
  esTarihDegisti();
}

async function esTarihDegisti(){
  _esTarih = document.getElementById('es-tarih').value;
  if(!_esTarih) return;
  // Daha önce kaydedilmiş eşleştirme var mı?
  var prev = await dbGet('adisyon_eslestirme','select=*&tarih=eq.'+_esTarih);
  if(prev && prev[0]){
    _esKayitliId = prev[0].id;
    _esEslesmeler = prev[0].eslesmeler || [];
    _esCsvFilename = prev[0].csv_filename || '';
    _esCsvAdisyon = prev[0].simpra_data || [];
    _esCsvIptal = prev[0].simpra_iptal || [];
    document.getElementById('es-info-kayit').innerHTML =
      '<span class="es-pill green">✓ Kayıtlı eşleştirme yüklendi</span> '+
      ' <span class="small">'+(prev[0].csv_filename||'')+' · son güncelleme '+(prev[0].updated_at||'').slice(0,16).replace('T',' ')+'</span>';
    if(prev[0].notlar) document.getElementById('es-notlar').value = prev[0].notlar;
  } else {
    _esKayitliId = null;
    _esEslesmeler = [];
    _esCsvFilename = '';
    _esCsvAdisyon = [];
    _esCsvIptal = [];
    document.getElementById('es-notlar').value = '';
    document.getElementById('es-info-kayit').innerHTML = '<span class="small">Bu tarih için kayıtlı eşleştirme yok.</span>';
  }
  await esKasaYukle();
  esRender();
}

async function esKasaYukle(){
  // Bu tarihin gelir kayıtlarını çek
  var q = 'tarih=eq.'+_esTarih+'&tur=eq.gelir&order=id';
  _esKasaKayitlar = (await dbGetAll('kayitlar', q)) || [];
}

function esCsvSec(){
  var inp = document.getElementById('es-csv-input');
  inp.value = '';
  inp.click();
}

function esCsvYuklendi(ev){
  var f = ev.target.files && ev.target.files[0];
  if(!f) return;
  _esCsvFilename = f.name;
  var rd = new FileReader();
  rd.onload = function(e){
    esCsvParse(e.target.result);
    esOtoEslestir();
    esRender();
  };
  rd.readAsText(f);
}

function esCsvParse(text){
  // Basit CSV parser — virgülle ayrılmış, çift tırnak içinde virgüle izin verir
  var lines = text.split(/\r?\n/).filter(function(l){return l.trim();});
  if(lines.length < 2){ _esCsvAdisyon=[]; _esCsvIptal=[]; return; }
  var hdr = csvSatir(lines[0]);
  function idx(name){ for(var i=0;i<hdr.length;i++) if(hdr[i].trim().toLowerCase()===name.toLowerCase()) return i; return -1; }
  var iCek=idx('Çek Numarası'), iGun=idx('İş Günü'), iDur=idx('Durum'),
      iCal=idx('Çalışan'), iMas=idx('Masa'), iKuv=idx('Kuver'),
      iTut=idx('Toplam Tutar'), iOde=idx('Ödeme Tipi'), iOlu=idx('Oluşturma Tarihi');
  var ad=[], ip=[];
  for(var n=1; n<lines.length; n++){
    var c = csvSatir(lines[n]);
    if(c.length < hdr.length-2) continue;
    var cek = (c[iCek]||'').trim();
    if(!cek || cek.toLowerCase().indexOf('toplam')===0) continue;
    var dur = (c[iDur]||'').trim();
    if(!dur && !c[iCal]) continue; // boş özet satırı
    var rec = {
      cek: cek,
      tarih: (c[iGun]||'').trim(),
      durum: dur,
      calisan: (c[iCal]||'').trim(),
      masa: (c[iMas]||'').trim(),
      kuver: parseInt(c[iKuv]||'0',10) || 0,
      tutar: csvNumara(c[iTut]||'0'),
      odeme: (c[iOde]||'').trim(),
      olusturma: (c[iOlu]||'').trim()
    };
    if(rec.durum==='Kapalı') ad.push(rec);
    else if(rec.durum==='İptal') ip.push(rec);
  }
  _esCsvAdisyon = ad;
  _esCsvIptal = ip;
}

function csvSatir(s){
  var r=[], cur='', q=false;
  for(var i=0;i<s.length;i++){
    var ch=s[i];
    if(ch==='"'){
      if(q && s[i+1]==='"'){ cur+='"'; i++; }
      else q=!q;
    } else if(ch===',' && !q){ r.push(cur); cur=''; }
    else cur+=ch;
  }
  r.push(cur);
  return r;
}

function csvNumara(s){
  s = (s||'').toString().trim().replace(/"/g,'');
  if(!s) return 0;
  // Türk formatı: 28.998,00
  s = s.replace(/\./g,'').replace(',','.');
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function esOtoEslestir(){
  // Mevcut eşleşmeleri sıfırla, kasa kayıtları üzerinden yeniden kur
  _esEslesmeler = [];
  // Kapora kayıtlarını otomatik dışla
  var kullanilan = {}; // simpra cek no'ları
  _esKasaKayitlar.forEach(function(k){
    var kapora = (k.kat||'') === 'Kapora';
    if(kapora){
      _esEslesmeler.push({
        kasa_id: k.id,
        simpra_cek_no: [],
        kasa_tutar: Number(k.tutar)||0,
        simpra_tutar: 0,
        fark: Number(k.tutar)||0,
        durum: 'kapora_haric',
        manuel: false,
        not: 'Kapora kategorisi — eşleştirmeden hariç'
      });
      return;
    }
    var hedef = Number(k.tutar)||0;
    // 1) Birebir eşleşme
    var teklik = _esCsvAdisyon.filter(function(s){ return !kullanilan[s.cek] && Math.abs(s.tutar - hedef) < 0.5; });
    if(teklik.length === 1){
      kullanilan[teklik[0].cek] = true;
      _esEslesmeler.push({
        kasa_id: k.id, simpra_cek_no: [teklik[0].cek],
        kasa_tutar: hedef, simpra_tutar: teklik[0].tutar,
        fark: hedef - teklik[0].tutar,
        durum: 'eslesir', manuel: false, not: ''
      });
      return;
    }
    if(teklik.length > 1){
      // Birden fazla aday — kullanıcı manuel seçsin
      _esEslesmeler.push({
        kasa_id: k.id, simpra_cek_no: [],
        kasa_tutar: hedef, simpra_tutar: 0,
        fark: hedef, durum: 'belirsiz', manuel: false,
        not: teklik.length+' aday adisyon var, manuel seç'
      });
      return;
    }
    // 2) İkili kombinasyon
    var bulundu = null;
    var serbest = _esCsvAdisyon.filter(function(s){ return !kullanilan[s.cek]; });
    for(var a=0; a<serbest.length && !bulundu; a++){
      for(var b=a+1; b<serbest.length && !bulundu; b++){
        if(Math.abs(serbest[a].tutar + serbest[b].tutar - hedef) <= _esTolerans){
          bulundu = [serbest[a], serbest[b]];
        }
      }
    }
    if(bulundu){
      bulundu.forEach(function(x){ kullanilan[x.cek] = true; });
      var tt = bulundu[0].tutar + bulundu[1].tutar;
      _esEslesmeler.push({
        kasa_id: k.id, simpra_cek_no: bulundu.map(function(x){return x.cek;}),
        kasa_tutar: hedef, simpra_tutar: tt,
        fark: hedef - tt,
        durum: Math.abs(hedef-tt) < 0.5 ? 'birlesik' : 'birlesik_yuvarlamali',
        manuel: false, not: 'Birleşik: '+bulundu.map(function(x){return x.masa;}).join(' + ')
      });
      return;
    }
    // 3) Üçlü kombinasyon
    bulundu = null;
    for(var a2=0; a2<serbest.length && !bulundu; a2++){
      for(var b2=a2+1; b2<serbest.length && !bulundu; b2++){
        for(var c2=b2+1; c2<serbest.length && !bulundu; c2++){
          var t3 = serbest[a2].tutar + serbest[b2].tutar + serbest[c2].tutar;
          if(Math.abs(t3 - hedef) <= _esTolerans){
            bulundu = [serbest[a2], serbest[b2], serbest[c2]];
          }
        }
      }
    }
    if(bulundu){
      bulundu.forEach(function(x){ kullanilan[x.cek] = true; });
      var tt3 = bulundu[0].tutar + bulundu[1].tutar + bulundu[2].tutar;
      _esEslesmeler.push({
        kasa_id: k.id, simpra_cek_no: bulundu.map(function(x){return x.cek;}),
        kasa_tutar: hedef, simpra_tutar: tt3,
        fark: hedef - tt3,
        durum: Math.abs(hedef-tt3) < 0.5 ? 'birlesik' : 'birlesik_yuvarlamali',
        manuel: false, not: 'Birleşik (3): '+bulundu.map(function(x){return x.masa;}).join(' + ')
      });
      return;
    }
    // Eşleşmedi
    _esEslesmeler.push({
      kasa_id: k.id, simpra_cek_no: [],
      kasa_tutar: hedef, simpra_tutar: 0,
      fark: hedef, durum: 'kasa_fazla', manuel: false,
      not: 'Simpra\'da karşılığı bulunamadı'
    });
  });
  // Hiç eşleşmeyen Simpra adisyonları
  _esCsvAdisyon.forEach(function(s){
    if(kullanilan[s.cek]) return;
    _esEslesmeler.push({
      kasa_id: null, simpra_cek_no: [s.cek],
      kasa_tutar: 0, simpra_tutar: s.tutar,
      fark: -s.tutar, durum: 'simpra_fazla', manuel: false,
      not: 'Kasada karşılığı bulunamadı'
    });
  });
}

function esRender(){
  var ozet = document.getElementById('es-ozet');
  var tbody = document.getElementById('es-tbody');
  if(!_esCsvAdisyon.length && !_esKasaKayitlar.length){
    ozet.innerHTML = '<span class="small">CSV yükleyin veya tarih seçin.</span>';
    tbody.innerHTML = '';
    return;
  }
  var simTop = _esCsvAdisyon.reduce(function(s,x){return s+x.tutar;},0);
  var kasaTop = _esKasaKayitlar.reduce(function(s,x){return s+(Number(x.tutar)||0);},0);
  var kapTop = _esKasaKayitlar.filter(function(k){return k.kat==='Kapora';}).reduce(function(s,x){return s+(Number(x.tutar)||0);},0);
  var kasaTopHaric = kasaTop - kapTop;
  var fark = kasaTopHaric - simTop;

  var sayim = { eslesir:0, birlesik:0, birlesik_yuvarlamali:0, kapora_haric:0, kasa_fazla:0, simpra_fazla:0, belirsiz:0 };
  _esEslesmeler.forEach(function(e){ sayim[e.durum] = (sayim[e.durum]||0)+1; });

  ozet.innerHTML =
    '<div class="es-ozet-grid">'+
      '<div class="es-ozet-card"><div class="lbl">Simpra Kapalı</div><div class="val">'+_esCsvAdisyon.length+' adisyon</div><div class="sub">'+para(simTop)+'</div></div>'+
      '<div class="es-ozet-card"><div class="lbl">Simpra İptal</div><div class="val">'+_esCsvIptal.length+'</div><div class="sub">—</div></div>'+
      '<div class="es-ozet-card"><div class="lbl">Kasa Gelir</div><div class="val">'+_esKasaKayitlar.length+' kayıt</div><div class="sub">'+para(kasaTop)+'</div></div>'+
      '<div class="es-ozet-card"><div class="lbl">Kapora (hariç)</div><div class="val">'+(_esKasaKayitlar.filter(function(k){return k.kat==='Kapora';}).length)+'</div><div class="sub">'+para(kapTop)+'</div></div>'+
      '<div class="es-ozet-card '+(Math.abs(fark)<0.5?'ok':'warn')+'"><div class="lbl">FARK (kasa−simpra, kapora hariç)</div><div class="val">'+para(fark)+'</div><div class="sub">'+(Math.abs(fark)<0.5?'✓ Birebir':'⚠ İncele')+'</div></div>'+
    '</div>'+
    '<div class="es-pills">'+
      '<span class="es-pill green">🟢 '+(sayim.eslesir||0)+' birebir</span>'+
      '<span class="es-pill green">🟢 '+(sayim.birlesik||0)+' birleşik</span>'+
      '<span class="es-pill yellow">🟡 '+(sayim.birlesik_yuvarlamali||0)+' birleşik (yuvarlama)</span>'+
      '<span class="es-pill blue">📌 '+(sayim.kapora_haric||0)+' kapora</span>'+
      '<span class="es-pill yellow">🟡 '+(sayim.belirsiz||0)+' belirsiz</span>'+
      '<span class="es-pill red">🔴 '+(sayim.kasa_fazla||0)+' kasa fazla</span>'+
      '<span class="es-pill red">🔴 '+(sayim.simpra_fazla||0)+' simpra fazla</span>'+
    '</div>';

  // Tablo
  var siralama = { kasa_fazla:1, simpra_fazla:2, belirsiz:3, birlesik_yuvarlamali:4, birlesik:5, kapora_haric:6, eslesir:7 };
  var sirali = _esEslesmeler.slice().sort(function(a,b){
    var sa = siralama[a.durum]||9, sb = siralama[b.durum]||9;
    if(sa !== sb) return sa - sb;
    return (b.kasa_tutar - a.kasa_tutar);
  });

  var rows = sirali.map(function(e, idx){
    var kasaK = e.kasa_id ? _esKasaKayitlar.find(function(k){return k.id===e.kasa_id;}) : null;
    var simAds = e.simpra_cek_no.map(function(c){return _esCsvAdisyon.find(function(s){return s.cek===c;});}).filter(function(x){return x;});
    var renkClass = ({
      eslesir:'es-row-green', birlesik:'es-row-green',
      birlesik_yuvarlamali:'es-row-yellow', belirsiz:'es-row-yellow',
      kapora_haric:'es-row-blue',
      kasa_fazla:'es-row-red', simpra_fazla:'es-row-red'
    })[e.durum] || '';
    var durumText = ({
      eslesir:'🟢 Birebir', birlesik:'🟢 Birleşik',
      birlesik_yuvarlamali:'🟡 Birleşik (yuvarlama)',
      belirsiz:'🟡 Belirsiz — manuel seç',
      kapora_haric:'📌 Kapora',
      kasa_fazla:'🔴 Sadece kasa',
      simpra_fazla:'🔴 Sadece simpra'
    })[e.durum] || e.durum;
    var kasaCol = kasaK
      ? '<div><b>'+(kasaK.aciklama||'(boş)')+'</b></div><div class="small">'+(kasaK.kat||'')+(kasaK.firma?' · '+kasaK.firma:'')+'</div><div class="num">'+para(e.kasa_tutar)+'</div>'
      : '<span class="small">—</span>';
    var simCol = simAds.length
      ? simAds.map(function(s){return '<div>Çek '+s.cek+' · '+s.masa+' · k='+s.kuver+' · '+para(s.tutar)+'</div>';}).join('')
      : '<span class="small">—</span>';
    var farkAbs = Math.abs(e.fark||0);
    var farkCol = farkAbs < 0.5 ? '<span class="num small">0</span>' : '<span class="num" style="color:#dc2626;font-weight:600;">'+para(e.fark)+'</span>';
    var aksiyon = '';
    if(e.durum === 'belirsiz' || e.durum === 'simpra_fazla' || e.durum === 'kasa_fazla'){
      aksiyon = '<button class="es-mini-btn" onclick="esManuelEslestir('+idx+')">Manuel</button>';
    }
    if(e.simpra_cek_no.length){
      aksiyon += ' <button class="es-mini-btn" onclick="esEslesmeKaldir('+idx+')">Kaldır</button>';
    }
    return '<tr class="'+renkClass+'"><td>'+durumText+'</td>'+
      '<td>'+kasaCol+'</td>'+
      '<td>'+simCol+'</td>'+
      '<td class="num">'+farkCol+'</td>'+
      '<td class="small">'+(e.not||'')+'</td>'+
      '<td>'+aksiyon+'</td></tr>';
  }).join('');

  tbody.innerHTML = rows || '<tr><td colspan="6" style="text-align:center;color:#6b7280;padding:20px">Hiç eşleştirme yok. CSV yükleyin.</td></tr>';
}

function esManuelEslestir(idx){
  var e = _esEslesmeler[idx];
  // Henüz başka bir kasa kaydına bağlı olmayan simpra adisyonlarını listele
  var kullanilan = {};
  _esEslesmeler.forEach(function(x, i){ if(i!==idx) x.simpra_cek_no.forEach(function(c){ kullanilan[c]=true; }); });
  var serbest = _esCsvAdisyon.filter(function(s){ return !kullanilan[s.cek]; });
  if(!serbest.length){ alert('Eşleştirilebilir serbest adisyon yok.'); return; }
  var liste = serbest.map(function(s,i){
    return (i+1)+') Çek '+s.cek+' · '+s.masa+' · '+para(s.tutar);
  }).join('\n');
  var sec = prompt('Eşleştirilecek adisyonlar (virgülle birden çok no):\n\n'+liste+
    '\n\nÇek numarası girin (örn: 509 veya 509,507):');
  if(!sec) return;
  var cekler = sec.split(',').map(function(x){return x.trim();}).filter(function(x){return x;});
  var sec_simpra = serbest.filter(function(s){ return cekler.indexOf(s.cek) !== -1; });
  if(!sec_simpra.length){ alert('Geçerli çek bulunamadı.'); return; }
  var top = sec_simpra.reduce(function(s,x){return s+x.tutar;},0);
  e.simpra_cek_no = sec_simpra.map(function(s){return s.cek;});
  e.simpra_tutar = top;
  e.fark = e.kasa_tutar - top;
  e.manuel = true;
  if(!e.kasa_id){
    e.durum = 'simpra_fazla';
  } else if(Math.abs(e.fark) < 0.5){
    e.durum = sec_simpra.length === 1 ? 'eslesir' : 'birlesik';
  } else if(Math.abs(e.fark) <= _esTolerans){
    e.durum = 'birlesik_yuvarlamali';
  } else {
    e.durum = 'kasa_fazla';
  }
  e.not = (e.not?e.not+' · ':'') + 'Manuel eşleştirildi';
  esRender();
}

function esEslesmeKaldir(idx){
  var e = _esEslesmeler[idx];
  e.simpra_cek_no = [];
  e.simpra_tutar = 0;
  e.fark = e.kasa_tutar;
  e.durum = e.kasa_id ? 'kasa_fazla' : 'simpra_fazla';
  e.manuel = true;
  esRender();
}

async function esKaydet(){
  if(!_esTarih){ alert('Önce tarih seçin'); return; }
  var simTop = _esCsvAdisyon.reduce(function(s,x){return s+x.tutar;},0);
  var kasaTop = _esKasaKayitlar.reduce(function(s,x){return s+(Number(x.tutar)||0);},0);
  var kapTop = _esKasaKayitlar.filter(function(k){return k.kat==='Kapora';}).reduce(function(s,x){return s+(Number(x.tutar)||0);},0);
  var fark = (kasaTop - kapTop) - simTop;
  var body = {
    tarih: _esTarih,
    csv_filename: _esCsvFilename || null,
    simpra_toplam: simTop,
    simpra_adisyon_sayisi: _esCsvAdisyon.length,
    kasa_toplam: kasaTop,
    kasa_kayit_sayisi: _esKasaKayitlar.length,
    fark: fark,
    simpra_data: _esCsvAdisyon,
    simpra_iptal: _esCsvIptal,
    eslesmeler: _esEslesmeler,
    notlar: document.getElementById('es-notlar').value || null
  };
  try{
    var resp;
    if(_esKayitliId){
      resp = await dbPatch('adisyon_eslestirme', 'id', _esKayitliId, body);
    } else {
      resp = await dbPost('adisyon_eslestirme', body);
    }
    if(!resp || !resp.ok){
      var msg = resp ? await resp.text() : 'Bağlantı hatası';
      alert('Kaydedilemedi: '+(resp?resp.status:'')+' '+msg);
      return;
    }
    if(!_esKayitliId){
      var rec = await dbGet('adisyon_eslestirme','select=id&tarih=eq.'+_esTarih);
      if(rec && rec[0]) _esKayitliId = rec[0].id;
    }
    alert('Eşleştirme kaydedildi.');
    document.getElementById('es-info-kayit').innerHTML = '<span class="es-pill green">✓ Kaydedildi</span>';
  }catch(err){
    alert('Hata: '+err.message);
  }
}

function esYenidenEslestir(){
  if(!_esCsvAdisyon.length){ alert('Önce CSV yükleyin.'); return; }
  if(!confirm('Mevcut eşleştirmeler sıfırlanıp yeniden otomatik eşleştirme yapılsın mı?')) return;
  esOtoEslestir();
  esRender();
}
