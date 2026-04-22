// ============================================================
// APP — Uygulama çekirdeği (yukle, switchTab, kategori listeleri)
// ============================================================

async function yukle(){
  try{
    setBag(false);
    kayitlar     = await dbGet('kayitlar','select=*&order=tarih.desc,id.desc');
    faturalar    = await dbGet('faturalar','select=*&order=tarih.desc');
    fonHareketler= await dbGet('yedek_fon','select=*&order=tarih.desc');
    stoklar      = await dbGet('stoklar','select=*&order=adi.asc');
    stokHareketleri = await dbGet('stok_hareketler','select=*&order=tarih.desc,id.desc');
    var katList  = await dbGet('kategoriler','select=*&order=tur.asc,ad.asc');
    ortaklar     = await dbGet('ortaklar','select=*&order=hisse_yuzdesi.desc');
    gelirKatlar  = katList.filter(function(x){return x.tur==='gelir';}).map(function(x){return {id:x.id,ad:x.ad};});
    giderKatlar  = katList.filter(function(x){return x.tur==='gider';}).map(function(x){return {id:x.id,ad:x.ad};});
    setBag(true);
    hepsiniYenile();
  }catch(e){
    setBag(false);
    console.error(e);
  }
}

function hepsiniYenile(){
  doldurKatListeleri();
  updateFirmaList();
  renderOzet();
  renderKasa();
  renderFaturalar();
  renderFon();
  renderKarDagilim();
}

function switchTab(t){
  var tabs=['kasa','fatura','yedekfon','rapor','kardagilim','stok','maliyet','ozelrapor'];
  document.querySelectorAll('.tab').forEach(function(el,i){el.classList.toggle('active',tabs[i]===t);});
  document.querySelectorAll('.page').forEach(function(el){el.classList.remove('active');});
  document.getElementById('pg-'+t).classList.add('active');
  if(t==='rapor')renderRapor();
  if(t==='kardagilim')renderKarDagilim();
  if(t==='maliyet')renderMaliyet();
  if(t==='finans')renderFinansAnaliz();
  if(t==='denetim')renderDenetim();
  if(t==='cariler'){ if(typeof cariSekmeAc==='function') cariSekmeAc(); }
  if(t==='denetim')renderDenetim();
  if(t==='cariler'){ if(typeof cariSekmeAc==='function') cariSekmeAc(); }
  if(t==='denetim')renderDenetim();
  if(t==='cariler'){ if(typeof cariSekmeAc==='function') cariSekmeAc(); }
  if(t==='ozelrapor'){ozelRaporKatListesi();renderOzelRapor();}
}

function doldurKatListeleri(){
  var gSel=document.getElementById('gi-kat');
  var gAd=gSel.value;
  var gOnchange=gSel.onchange;
  gSel.innerHTML='<option value="">— Seçiniz —</option>'+giderKatlar.map(function(k){return '<option value="'+k.ad+'"'+(k.ad===gAd?' selected':'')+'>'+k.ad+'</option>';}).join('');
  gSel.onchange=function(){giderKatSec(this.value);};
  var fSel=document.getElementById('fat-kat');
  fSel.innerHTML='<option value="">— Seçiniz —</option>'+giderKatlar.map(function(k){return '<option value="'+k.ad+'">'+k.ad+'</option>';}).join('');
  var fKat=document.getElementById('f-kat');
  fKat.innerHTML='<option value="">Tüm kategoriler</option>'+gelirKatlar.concat(giderKatlar).map(function(k){return '<option value="'+k.ad+'">'+k.ad+'</option>';}).join('');
}

function updateFirmaList(){
  var firmalar={};
  kayitlar.forEach(function(k){if(k.firma&&k.firma.trim())firmalar[k.firma.trim()]=1;});
  faturalar.forEach(function(f){if(f.firma&&f.firma.trim())firmalar[f.firma.trim()]=1;});
  var dl=document.getElementById('firma-list');
  if(dl)dl.innerHTML=Object.keys(firmalar).sort().map(function(f){return '<option value="'+f+'"></option>';}).join('');
}


// ============================================================
// STUB'lar — HTML'den çağrılan ama orijinal kodda eksik fonksiyonlar
// (İlgili modüller tamamlandıkça bunlar gerçek hallerine kavuşacak)
// ============================================================

function aramaTemizle(){
  var el = document.getElementById('f-ara');
  if(el) el.value = '';
  if(typeof renderKasa === 'function') renderKasa();
}

function tarihSecildi(){
  // Tarih seçimi sonrası yapılacaklar (şimdilik boş)
}

function kdTipDegisti(){
  var tip = document.getElementById('kd-tip').value;
  var ay = document.getElementById('kd-ay');
  var ar = document.getElementById('kd-aralik');
  if(ay) ay.style.display = (tip === 'ay') ? '' : 'none';
  if(ar) ar.style.display = (tip === 'aralik') ? 'flex' : 'none';
  if(typeof renderKarDagilim === 'function') renderKarDagilim();
}

function maliyetTipDegisti(){
  var tip = document.getElementById('m-tip').value;
  var ay = document.getElementById('m-ay');
  var ar = document.getElementById('m-aralik-wrap');
  var yil = document.getElementById('m-yil');
  if(ay) ay.style.display = (tip === 'ay') ? '' : 'none';
  if(ar) ar.style.display = (tip === 'aralik') ? 'flex' : 'none';
  if(yil) yil.style.display = (tip === 'yil') ? '' : 'none';
  if(typeof renderMaliyet === 'function') renderMaliyet();
}

function exportCSV(){
  // CSV indirme (ileride eklenecek)
  alert('CSV indirme özelliği henüz aktif değil.');
}

function karDagilimPDF(){
  window.print();
}

// Stok modülü placeholder'ları — ileride stok.js'te gerçek halleri olacak
function stokEkle(){ alert('Stok modülü henüz aktif değil.'); }
function stokHareket(){ alert('Stok hareket modülü henüz aktif değil.'); }
function katEkle(tur){ alert('Kategori ekleme ayarlar sayfası henüz aktif değil.'); }
