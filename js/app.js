// ============================================================
// APP — Uygulama çekirdeği (yukle, switchTab, kategori listeleri)
// ============================================================

async function yukle(){
  try{
    setBag(false);
    kayitlar     = await dbGetAll('kayitlar','select=*&order=tarih.desc,id.desc');
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
  document.querySelectorAll('.tab').forEach(function(el){
    var oc = el.getAttribute('onclick') || '';
    el.classList.toggle('active', oc.indexOf("'"+t+"'") !== -1);
  });
  document.querySelectorAll('details.tab-grup').forEach(function(d){ d.open = false; });
  document.querySelectorAll('.page').forEach(function(el){el.classList.remove('active');});
  document.getElementById('pg-'+t).classList.add('active');
  if(t==='rapor')renderRapor();
  if(t==='kardagilim')renderKarDagilim();
  if(t==='maliyet')renderMaliyet();
  if(t==='finans')renderFinansAnaliz();
  if(t==='denetim')renderDenetim();
  if(t==='cariler'){ if(typeof cariSekmeAc==='function') cariSekmeAc(); }
  if(t==='gunluksatis'){ if(typeof gunlukSatisAc==='function') gunlukSatisAc(); }
  if(t==='inceleme'){ if(typeof incelemeSekmeAc==='function') incelemeSekmeAc(); }
  if(t==='ozelrapor'){if(typeof ozelRaporKatGuncelle==='function')ozelRaporKatGuncelle();if(typeof renderOzelRapor==='function')renderOzelRapor();}
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
  var kaynak = document.activeElement && document.activeElement.id;
  if(kaynak==='g-tarih' || kaynak==='gi-tarih'){
    var deger = document.getElementById(kaynak).value;
    if(deger){
      var at = document.getElementById('aktif-tarih');
      if(at) at.value = deger;
      try{ localStorage.setItem('kasa_aktif_tarih', deger); }catch(e){}
    }
  }
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

function exportXLSX(){
  if(!kayitlar||!kayitlar.length){alert('Henüz yüklenmiş kayıt yok.');return;}
  if(typeof XLSX==='undefined'){alert('Excel kütüphanesi yüklenemedi. İnternet bağlantısını kontrol edin.');return;}
  var sirali=kayitlar.slice().sort(function(a,b){
    return a.tarih<b.tarih?-1:a.tarih>b.tarih?1:(a.id||0)-(b.id||0);
  });
  var veriler=[['Tarih','Tür','Kategori','Firma','Açıklama','Ödeme Tipi','Tutar','Kişi Sayısı']];
  sirali.forEach(function(k){
    veriler.push([
      k.tarih||'',
      k.tur||'',
      k.kat||'',
      k.firma||'',
      k.aciklama||'',
      k.odeme||'',
      Number(k.tutar)||0,
      Number(k.kisi_sayisi)||0
    ]);
  });
  var ws=XLSX.utils.aoa_to_sheet(veriler);
  // Sütun genişlikleri
  ws['!cols']=[{wch:12},{wch:8},{wch:22},{wch:22},{wch:28},{wch:14},{wch:14},{wch:10}];
  // Tutar sütununu (G) sayı formatına al
  var aralik=XLSX.utils.decode_range(ws['!ref']);
  for(var r=1;r<=aralik.e.r;r++){
    var tutarH=XLSX.utils.encode_cell({r:r,c:6});
    if(ws[tutarH])ws[tutarH].z='#,##0.00';
  }
  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Kayıtlar');
  XLSX.writeFile(wb,'kasa_kayitlar_'+new Date().toISOString().slice(0,10)+'.xlsx');
}

function karDagilimPDF(){
  window.print();
}

// Stok modülü placeholder'ları — ileride stok.js'te gerçek halleri olacak
function stokEkle(){ alert('Stok modülü henüz aktif değil.'); }
function stokHareket(){ alert('Stok hareket modülü henüz aktif değil.'); }
function katEkle(tur){ alert('Kategori ekleme ayarlar sayfası henüz aktif değil.'); }

// =========================================
// AKTİF TARİH mekaniği (Nisan 2026 eklendi)
// =========================================
function aktifTarihDegisti(){
  var t = document.getElementById('aktif-tarih');
  if(!t || !t.value) return;
  ['g-tarih','gi-tarih','fat-tarih','fon-tarih'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.value = t.value;
  });
  try{ localStorage.setItem('kasa_aktif_tarih', t.value); }catch(e){}
}

function aktifTarihDegistir(gun){
  var at = document.getElementById('aktif-tarih');
  if(!at) return;
  var mevcut = at.value || new Date().toISOString().split('T')[0];
  var d = new Date(mevcut);
  d.setDate(d.getDate() + gun);
  at.value = d.toISOString().split('T')[0];
  aktifTarihDegisti();
}

function aktifTarihBugun(){
  var at = document.getElementById('aktif-tarih');
  if(!at) return;
  at.value = new Date().toISOString().split('T')[0];
  aktifTarihDegisti();
}

function aktifTarihYukle(){
  var at = document.getElementById('aktif-tarih');
  if(!at) return;
  var kayitli = null;
  try{ kayitli = localStorage.getItem('kasa_aktif_tarih'); }catch(e){}
  at.value = kayitli || new Date().toISOString().split('T')[0];
  aktifTarihDegisti();
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', aktifTarihYukle);
}else{
  setTimeout(aktifTarihYukle, 200);
}

document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('details.tab-grup').forEach(function(det){
    det.addEventListener('toggle', function(){
      if(this.open){
        document.querySelectorAll('details.tab-grup').forEach(function(d){
          if(d !== det) d.open = false;
        });
      }
    });
  });
});

// Tooltip sistemi
var _ttTimeout=null;
function setTT(id,txt,sel){
  var el=document.getElementById(id);
  if(!el)return;
  var card=sel?el.closest(sel):el.parentElement;
  if(!card)return;
  card.dataset.tooltip=txt;
  card.addEventListener('mouseenter',function(e){
    var tt=document.getElementById('kasa-tt');
    if(!tt)return;
    tt.textContent=txt;
    tt.style.display='block';
    _ttKonumla(e);
  });
  card.addEventListener('mousemove',_ttKonumla);
  card.addEventListener('mouseleave',function(){
    var tt=document.getElementById('kasa-tt');
    if(tt)tt.style.display='none';
  });
}
function _ttKonumla(e){
  var tt=document.getElementById('kasa-tt');
  if(!tt||tt.style.display==='none')return;
  var tx=e.clientX+16;
  if(tx+270>window.innerWidth)tx=e.clientX-276;
  tt.style.left=tx+'px';
  tt.style.top=(e.clientY+14)+'px';
}
