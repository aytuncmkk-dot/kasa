// =========================================
// CARİLER — Cari hesap ve takma ad yönetimi
// FAZ: Cari Hesap Modülü - Aşama A (Takma Ad Tablosu)
// Bağımlılık: db.js (dbGet/dbPost/dbPatch/dbDelete), utils.js (para), audit.js (auditLog)
// =========================================

// State
var cariler = [];          // [{id, ad, telefon, vergi_no, notlar, aktif}]
var cariAliases = [];      // [{id, cari_id, alias, onaylandi, kaynak}]
var _cariDuzId = null;     // Düzenleme modu için

// ---------- YÜKLEME ----------
async function carilerYukle(){
  try{
    var c = await dbGet('cariler','aktif=eq.true&order=ad.asc');
    cariler = Array.isArray(c) ? c : [];
    var a = await dbGet('cari_aliases','order=alias.asc');
    cariAliases = Array.isArray(a) ? a : [];
  }catch(e){ console.error('Cariler yüklenemedi:', e); cariler=[]; cariAliases=[]; }
}

// ---------- NORMALIZASYON ----------
// Türkçe karakter, büyük/küçük, fazla boşluk temizle
function normalizeCariMetin(s){
  if(!s) return '';
  return String(s)
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g,'i').replace(/İ/g,'i')
    .replace(/ş/g,'s').replace(/Ş/g,'s')
    .replace(/ğ/g,'g').replace(/Ğ/g,'g')
    .replace(/ü/g,'u').replace(/Ü/g,'u')
    .replace(/ö/g,'o').replace(/Ö/g,'o')
    .replace(/ç/g,'c').replace(/Ç/g,'c')
    .replace(/[^a-z0-9\s]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

// Jenerik kelimeler (eşleşmede zayıf sayılacak)
var JENERIK_KELIMELER = [
  'ltd','sti','a.s','as','san','tic','ticaret','sanayi','limited','sirketi',
  'gida','manav','market','kasap','bakkal','sarkuteri','tuketim','mallari',
  'pazarlama','dagitim','lojistik','tasimacilik','hizmetleri','yoresel',
  've','ile','icin','her','tum','genel','merkez','subesi','dis','ic'
];

function anlamliTokenlar(metin){
  var n = normalizeCariMetin(metin);
  return n.split(' ').filter(function(t){
    return t.length > 1 && JENERIK_KELIMELER.indexOf(t) === -1;
  });
}

// ---------- BENZERLİK SKORU ----------
// Levenshtein mesafesi
function levenshtein(a, b){
  if(a.length === 0) return b.length;
  if(b.length === 0) return a.length;
  var m = [];
  for(var i = 0; i <= b.length; i++) m[i] = [i];
  for(var j = 0; j <= a.length; j++) m[0][j] = j;
  for(i = 1; i <= b.length; i++){
    for(j = 1; j <= a.length; j++){
      if(b.charAt(i-1) === a.charAt(j-1)) m[i][j] = m[i-1][j-1];
      else m[i][j] = Math.min(m[i-1][j-1]+1, Math.min(m[i][j-1]+1, m[i-1][j]+1));
    }
  }
  return m[b.length][a.length];
}

// Token bazlı Jaccard benzerliği (0-1)
function tokenJaccard(a, b){
  var ta = anlamliTokenlar(a);
  var tb = anlamliTokenlar(b);
  if(!ta.length || !tb.length) return 0;
  var setA = {}; ta.forEach(function(t){ setA[t]=1; });
  var kesisim = 0;
  tb.forEach(function(t){ if(setA[t]) kesisim++; });
  var birlesim = ta.length + tb.length - kesisim;
  return birlesim ? kesisim / birlesim : 0;
}

// Hibrit benzerlik skoru (0-100)
function cariBenzerlik(a, b){
  var na = normalizeCariMetin(a), nb = normalizeCariMetin(b);
  if(!na || !nb) return 0;
  if(na === nb) return 100;

  // Levenshtein oranı
  var maxLen = Math.max(na.length, nb.length);
  var levScore = maxLen ? (1 - levenshtein(na, nb) / maxLen) : 0;

  // Token Jaccard (anlamlı kelimeler)
  var tokScore = tokenJaccard(a, b);

  // Biri diğerini içeriyor mu? (substring bonus)
  var icerikBonus = 0;
  if(na.indexOf(nb) !== -1 || nb.indexOf(na) !== -1) icerikBonus = 0.15;

  // Ağırlıklı: %40 lev, %50 token, %10 içerik
  var skor = (levScore * 0.4 + tokScore * 0.5 + icerikBonus) * 100;
  return Math.min(100, Math.round(skor));
}

// ---------- EŞLEŞMEMİŞ FATURA FİRMALARINI BUL ----------
// Faturalardaki tüm benzersiz firma isimlerini, aliases'da olmayanları döner
function eslesmemisFirmalar(){
  if(!window.faturalar || !faturalar.length) return [];
  var hamFirmalar = {};
  faturalar.forEach(function(f){
    var fi = (f.firma || '').trim();
    if(fi) hamFirmalar[fi] = (hamFirmalar[fi]||0) + 1;
  });
  var atanmisAliaslar = {};
  cariAliases.forEach(function(a){ atanmisAliaslar[a.alias] = 1; });
  var sonuc = [];
  Object.keys(hamFirmalar).forEach(function(firma){
    if(!atanmisAliaslar[firma]){
      sonuc.push({ firma: firma, sayi: hamFirmalar[firma] });
    }
  });
  sonuc.sort(function(a,b){ return b.sayi - a.sayi; });
  return sonuc;
}

// ---------- ÖNERİ ÜRET ----------
// Verilen ham isim için benzer carileri/aliasları önerir (skor ≥ 70)
function cariOnerileri(hamIsim){
  var oneriler = [];
  // 1) Mevcut carilerle karşılaştır
  cariler.forEach(function(c){
    var skor = cariBenzerlik(hamIsim, c.ad);
    if(skor >= 70) oneriler.push({ tip:'cari', cari_id:c.id, ad:c.ad, skor:skor });
  });
  // 2) Mevcut aliaslarla karşılaştır (onaylananlar)
  cariAliases.forEach(function(a){
    if(!a.onaylandi) return;
    var skor = cariBenzerlik(hamIsim, a.alias);
    if(skor >= 75){
      var cari = cariler.find(function(c){ return c.id === a.cari_id; });
      if(cari){
        oneriler.push({
          tip:'alias', cari_id:a.cari_id, ad:cari.ad,
          aliasMetin:a.alias, skor:skor
        });
      }
    }
  });
  // Skor büyükten küçüğe, cari_id bazında tekille
  oneriler.sort(function(a,b){ return b.skor - a.skor; });
  var gorulen = {}, tekil = [];
  oneriler.forEach(function(o){
    if(!gorulen[o.cari_id]){ gorulen[o.cari_id]=1; tekil.push(o); }
  });
  return tekil.slice(0, 3);
}

// ---------- CARİ CRUD ----------
async function cariKaydet(){
  var ad = document.getElementById('cari-ad').value.trim();
  var telefon = document.getElementById('cari-telefon').value.trim();
  var vergi = document.getElementById('cari-vergi').value.trim();
  var notlar = document.getElementById('cari-notlar').value.trim();
  if(!ad){ alert('Cari adı zorunludur.'); return; }

  try{
    if(_cariDuzId){
      var r = await dbPatch('cariler','id',_cariDuzId,{ad:ad, telefon:telefon, vergi_no:vergi, notlar:notlar});
      if(r===false || r===null || (r && r.ok===false)){ alert('Güncelleme hatası.'); return; }
      try{ await auditLog('GUNCELLE','cariler',_cariDuzId,null,{ad:ad},'Cari güncellendi'); }catch(e){}
    }else{
      var yeni = {ad:ad, telefon:telefon, vergi_no:vergi, notlar:notlar, aktif:true};
      var r2 = await dbPost('cariler',[yeni]);
      if(r2===false || r2===null || (r2 && r2.ok===false)){ alert('Kayıt hatası.'); return; }
      try{ await auditLog('EKLE','cariler',null,null,yeni,'Yeni cari'); }catch(e){}
    }
    document.getElementById('cari-ad').value='';
    document.getElementById('cari-telefon').value='';
    document.getElementById('cari-vergi').value='';
    document.getElementById('cari-notlar').value='';
    _cariDuzId = null;
    document.getElementById('cari-kaydet-btn').textContent = 'Cari Kaydet';
    await carilerYukle();
    renderCariler();
    renderEslesmemisFirmalar();
  }catch(e){ alert('Hata: '+e.message); }
}

function cariDuzenle(id){
  var c = cariler.find(function(x){ return x.id === id; });
  if(!c) return;
  _cariDuzId = id;
  document.getElementById('cari-ad').value = c.ad || '';
  document.getElementById('cari-telefon').value = c.telefon || '';
  document.getElementById('cari-vergi').value = c.vergi_no || '';
  document.getElementById('cari-notlar').value = c.notlar || '';
  document.getElementById('cari-kaydet-btn').textContent = 'Güncelle';
  document.getElementById('cari-ad').focus();
}

async function cariSil(id){
  if(!confirm('Bu cari pasif edilecek. Emin misiniz?\n\nTakma adları ve hareketler korunacak.')) return;
  try{
    var r = await dbPatch('cariler','id',id,{aktif:false});
    if(r===false || r===null || (r && r.ok===false)){ alert('Silme hatası.'); return; }
    try{ await auditLog('SIL','cariler',id,null,null,'Cari pasif edildi'); }catch(e){}
    await carilerYukle();
    renderCariler();
    renderEslesmemisFirmalar();
  }catch(e){ alert('Hata: '+e.message); }
}

// ---------- ALIAS ATAMA ----------
async function aliasAta(hamIsim, cariId, kaynak){
  kaynak = kaynak || 'manuel';
  try{
    var yeni = { cari_id: cariId, alias: hamIsim, onaylandi: true, kaynak: kaynak };
    var r = await dbPost('cari_aliases',[yeni]);
    if(r===false || r===null || (r && r.ok===false)){
      // UNIQUE constraint ihlali olursa (zaten atanmış)
      alert('"'+hamIsim+'" zaten bir cariye atanmış.');
      return false;
    }
    try{ await auditLog('EKLE','cari_aliases',null,null,yeni,'Takma ad eşleştirildi'); }catch(e){}
    await carilerYukle();
    renderEslesmemisFirmalar();
    renderCariler();
    return true;
  }catch(e){ alert('Hata: '+e.message); return false; }
}

async function aliasKaldir(aliasId){
  if(!confirm('Bu takma ad eşleşmesi kaldırılacak. Emin misiniz?')) return;
  try{
    var r = await dbDelete('cari_aliases','id',aliasId);
    if(r===false || r===null || (r && r.ok===false)){ alert('Kaldırma hatası.'); return; }
    try{ await auditLog('SIL','cari_aliases',aliasId,null,null,'Takma ad kaldırıldı'); }catch(e){}
    await carilerYukle();
    renderEslesmemisFirmalar();
    renderCariler();
  }catch(e){ alert('Hata: '+e.message); }
}

// Yeni cari + ilk alias (tek adımda)
async function cariOlusturVeAta(hamIsim){
  var ad = prompt('Yeni cari adı:', hamIsim);
  if(!ad || !ad.trim()) return;
  ad = ad.trim();
  try{
    var yeniCari = {ad:ad, aktif:true};
    var r = await dbPost('cariler',[yeniCari]);
    if(r===false || r===null || (r && r.ok===false)){ alert('Cari oluşturulamadı.'); return; }
    // Yeni kaydı geri al
    var c = await dbGet('cariler','ad=eq.'+encodeURIComponent(ad)+'&order=id.desc&limit=1');
    if(!Array.isArray(c) || !c.length){ alert('Cari bulunamadı.'); return; }
    var yeniId = c[0].id;
    try{ await auditLog('EKLE','cariler',yeniId,null,yeniCari,'Yeni cari (ham isimden)'); }catch(e){}
    await aliasAta(hamIsim, yeniId, 'manuel');
  }catch(e){ alert('Hata: '+e.message); }
}

// ---------- RENDER: CARİ LİSTESİ ----------
function renderCariler(){
  var tbody = document.getElementById('cari-tablo');
  var emp = document.getElementById('cari-empty');
  if(!tbody) return;
  if(!cariler.length){
    tbody.innerHTML = '';
    if(emp) emp.style.display = 'block';
    return;
  }
  if(emp) emp.style.display = 'none';

  // Her cari için: alias sayısı + toplam fatura tutarı
  var html = cariler.map(function(c){
    var aliaslar = cariAliases.filter(function(a){ return a.cari_id===c.id; });
    var aliasListe = aliaslar.map(function(a){
      return '<span class="alias-tag">'+htmlEsc(a.alias)+
             ' <a href="#" onclick="aliasKaldir('+a.id+');return false;" title="Kaldır">✕</a></span>';
    }).join(' ');
    var faturaSayi = 0, faturaTop = 0;
    if(window.faturalar){
      aliaslar.forEach(function(a){
        faturalar.forEach(function(f){
          if(f.firma === a.alias){
            faturaSayi++;
            faturaTop += Number(f.tutar)||0;
          }
        });
      });
    }
    return '<tr>'+
      '<td><strong>'+htmlEsc(c.ad)+'</strong>'+
        (c.telefon?'<br><small>'+htmlEsc(c.telefon)+'</small>':'')+'</td>'+
      '<td>'+(aliaslar.length||0)+'</td>'+
      '<td>'+(aliasListe||'<em style="color:#888">—</em>')+'</td>'+
      '<td style="text-align:right">'+faturaSayi+'</td>'+
      '<td style="text-align:right">'+(window.para?para(faturaTop):faturaTop.toFixed(2))+'</td>'+
      '<td>'+
        '<button onclick="cariDuzenle('+c.id+')" class="btn-sm">✏️</button> '+
        '<button onclick="cariSil('+c.id+')" class="btn-sm" style="color:red">🗑</button>'+
      '</td>'+
    '</tr>';
  }).join('');
  tbody.innerHTML = html;
}

// ---------- RENDER: EŞLEŞMEMİŞ FİRMALAR ----------
function renderEslesmemisFirmalar(){
  var tbody = document.getElementById('eslesmemis-tablo');
  var emp = document.getElementById('eslesmemis-empty');
  var sayac = document.getElementById('eslesmemis-sayi');
  if(!tbody) return;

  var liste = eslesmemisFirmalar();
  if(sayac) sayac.textContent = liste.length;

  if(!liste.length){
    tbody.innerHTML = '';
    if(emp) emp.style.display = 'block';
    return;
  }
  if(emp) emp.style.display = 'none';

  var html = liste.map(function(item, idx){
    var oneriler = cariOnerileri(item.firma);
    var oneriHtml = '';
    if(oneriler.length){
      oneriHtml = oneriler.map(function(o){
        var renk = o.skor >= 90 ? '#0a7' : (o.skor >= 80 ? '#b80' : '#888');
        return '<button onclick="aliasAta(\''+jsEsc(item.firma)+'\','+o.cari_id+',\'fuzzy\')" '+
               'class="oneri-btn" style="border-color:'+renk+'" '+
               'title="Benzerlik %'+o.skor+'">'+
               htmlEsc(o.ad)+' <small>(%'+o.skor+')</small></button>';
      }).join(' ');
    }else{
      oneriHtml = '<em style="color:#888">Öneri yok</em>';
    }

    // Mevcut carilerden seçim dropdown'ı
    var dropdown = '<select id="ata-select-'+idx+'" class="ata-select">'+
      '<option value="">— Cari seç —</option>'+
      cariler.map(function(c){
        return '<option value="'+c.id+'">'+htmlEsc(c.ad)+'</option>';
      }).join('')+
    '</select> '+
    '<button onclick="aliasAtaFromSelect(\''+jsEsc(item.firma)+'\','+idx+')" class="btn-sm">Ata</button>';

    return '<tr>'+
      '<td><strong>'+htmlEsc(item.firma)+'</strong></td>'+
      '<td style="text-align:center">'+item.sayi+'</td>'+
      '<td>'+oneriHtml+'</td>'+
      '<td>'+dropdown+'</td>'+
      '<td><button onclick="cariOlusturVeAta(\''+jsEsc(item.firma)+'\')" '+
          'class="btn-sm btn-primary">+ Yeni Cari</button></td>'+
    '</tr>';
  }).join('');
  tbody.innerHTML = html;
}

// Dropdown'dan cari seçip atama
function aliasAtaFromSelect(hamIsim, idx){
  var sel = document.getElementById('ata-select-'+idx);
  if(!sel || !sel.value){ alert('Lütfen bir cari seçin.'); return; }
  aliasAta(hamIsim, Number(sel.value), 'manuel');
}

// ---------- TOPLU OTOMATIK EŞLEŞTIRME ----------
// Skor ≥ 90 olanları tek tıkla onayla
async function topluOtoEslestir(){
  var liste = eslesmemisFirmalar();
  var adaylar = [];
  liste.forEach(function(item){
    var oneriler = cariOnerileri(item.firma);
    if(oneriler.length && oneriler[0].skor >= 90){
      adaylar.push({firma:item.firma, cari_id:oneriler[0].cari_id, ad:oneriler[0].ad, skor:oneriler[0].skor});
    }
  });
  if(!adaylar.length){ alert('Yüksek güvenilirlikte (≥%90) öneri bulunamadı.'); return; }

  var onay = 'Aşağıdaki '+adaylar.length+' eşleşme otomatik onaylanacak:\n\n'+
    adaylar.map(function(a){ return '• '+a.firma+'  →  '+a.ad+' (%'+a.skor+')'; }).join('\n')+
    '\n\nDevam edilsin mi?';
  if(!confirm(onay)) return;

  var basarili = 0, hata = 0;
  for(var i=0; i<adaylar.length; i++){
    var ok = await aliasAta(adaylar[i].firma, adaylar[i].cari_id, 'fuzzy');
    if(ok) basarili++; else hata++;
  }
  alert(basarili+' eşleşme onaylandı.'+(hata?' '+hata+' hata.':''));
}

// ---------- HELPERS ----------
function htmlEsc(s){
  if(s==null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function jsEsc(s){
  if(s==null) return '';
  return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'\\"');
}

// ---------- AÇILIŞ ----------
async function cariSekmeAc(){
  await carilerYukle();
  renderCariler();
  renderEslesmemisFirmalar();
}
