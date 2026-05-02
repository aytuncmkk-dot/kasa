// ============================================================
// APP — Uygulama çekirdeği (yukle, switchTab, kategori listeleri)
// ============================================================

async function yukle(){
  try{
    setBag(false);
    kayitlar     = await dbGetAll('kayitlar','select=*&order=tarih.desc,id.desc');
    faturalar    = await dbGetAll('faturalar','select=*&order=tarih.desc');
    fonHareketler= await dbGetAll('yedek_fon','select=*&order=tarih.desc');
    stoklar      = await dbGet('stoklar','select=*&order=adi.asc');
    stokHareketleri = await dbGetAll('stok_hareketler','select=*&order=tarih.desc,id.desc');
    var katList  = await dbGet('kategoriler','select=*&order=tur.asc,ad.asc');
    ortaklar     = await dbGet('ortaklar','select=*&order=hisse_yuzdesi.desc');
    gelirKatlar   = katList.filter(function(x){return x.tur==='gelir';}).map(function(x){return {id:x.id,ad:x.ad};});
    giderKatlar   = katList.filter(function(x){return x.tur==='gider';}).map(function(x){return {id:x.id,ad:x.ad};});
    dagitimKatlar = katList.filter(function(x){return x.tur==='dagitim';}).map(function(x){return {id:x.id,ad:x.ad};});
    await otomatikDagitimMigrasyonu();
    setBag(true);
    hepsiniYenile();
  }catch(e){
    setBag(false);
    console.error(e);
  }
}

async function otomatikDagitimMigrasyonu(){
  var eskiler=kayitlar.filter(function(k){return k.tur==='gider'&&k.kat==='Ortaklara Ödenen';});
  if(!eskiler.length)return;
  var H=Object.assign({},getSBH(),{'Prefer':'return=minimal'});
  await fetch(SB_URL+'/rest/v1/kayitlar?kat=eq.'+encodeURIComponent('Ortaklara Ödenen')+'&tur=eq.gider',{method:'PATCH',headers:H,body:JSON.stringify({tur:'dagitim'})});
  await fetch(SB_URL+'/rest/v1/kategoriler?ad=eq.'+encodeURIComponent('Ortaklara Ödenen'),{method:'PATCH',headers:H,body:JSON.stringify({tur:'dagitim'})});
  eskiler.forEach(function(k){k.tur='dagitim';});
  // Kategori listelerini de güncelle
  var katiOrtaklar=dagitimKatlar.find(function(k){return k.ad==='Ortaklara Ödenen';});
  if(!katiOrtaklar){
    var idx=giderKatlar.findIndex(function(k){return k.ad==='Ortaklara Ödenen';});
    if(idx!==-1){dagitimKatlar.push(giderKatlar[idx]);giderKatlar.splice(idx,1);}
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
  // Aktif sekmenin bulunduğu dropdown başlığını vurgula
  document.querySelectorAll('.tab-grup-btn').forEach(function(s){ s.classList.remove('aktif-grup'); });
  var aktifBtn = document.querySelector('.tab.active');
  if(aktifBtn){
    var det = aktifBtn.closest('details.tab-grup');
    if(det){ var s = det.querySelector('.tab-grup-btn'); if(s) s.classList.add('aktif-grup'); }
  }
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
  if(t==='vergi'){if(typeof vergiSekmeAc==='function')vergiSekmeAc();}
}

function doldurKatListeleri(){
  var gSel=document.getElementById('gi-kat');
  var gAd=gSel.value;
  var giderOpts=giderKatlar.map(function(k){return '<option value="'+k.ad+'"'+(k.ad===gAd?' selected':'')+'>'+k.ad+'</option>';}).join('');
  var dagOpts=dagitimKatlar.length
    ? '<optgroup label="── Dağıtım ──">'+dagitimKatlar.map(function(k){return '<option value="'+k.ad+'"'+(k.ad===gAd?' selected':'')+'>'+k.ad+'</option>';}).join('')+'</optgroup>'
    : '';
  gSel.innerHTML='<option value="">— Seçiniz —</option>'+giderOpts+dagOpts;
  gSel.onchange=function(){giderKatSec(this.value);};
  var fSel=document.getElementById('fat-kat');
  fSel.innerHTML='<option value="">— Seçiniz —</option>'+giderKatlar.map(function(k){return '<option value="'+k.ad+'">'+k.ad+'</option>';}).join('');
  var fKat=document.getElementById('f-kat');
  fKat.innerHTML='<option value="">Tüm kategoriler</option>'+
    gelirKatlar.concat(giderKatlar).map(function(k){return '<option value="'+k.ad+'">'+k.ad+'</option>';}).join('')+
    (dagitimKatlar.length?'<optgroup label="Dağıtım">'+dagitimKatlar.map(function(k){return '<option value="'+k.ad+'">'+k.ad+'</option>';}).join('')+'</optgroup>':'');
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

async function migrasyonCalistir(){
  if(!confirm(
    'Bu işlem veritabanındaki TÜM "Ortaklara Ödenen" kayıtlarını\n'+
    '"gider" türünden "dagitim" türüne taşıyacak.\n\n'+
    'Kayıt silinmez, sadece tür güncellenir.\n\n'+
    'Devam etmek istiyor musunuz?'
  )) return;
  var btn=document.getElementById('migrasyon-btn');
  if(btn){btn.disabled=true;btn.textContent='Çalışıyor...';}
  try{
    var H=Object.assign({},getSBH(),{'Prefer':'return=representation'});
    var r1=await fetch(
      SB_URL+'/rest/v1/kategoriler?ad=eq.'+encodeURIComponent('Ortaklara Ödenen'),
      {method:'PATCH',headers:H,body:JSON.stringify({tur:'dagitim'})}
    );
    var r2=await fetch(
      SB_URL+'/rest/v1/kayitlar?kat=eq.'+encodeURIComponent('Ortaklara Ödenen')+'&tur=eq.gider',
      {method:'PATCH',headers:H,body:JSON.stringify({tur:'dagitim'})}
    );
    if(!r1.ok||!r2.ok){alert('Hata: kategoriler='+r1.status+', kayıtlar='+r2.status);return;}
    var guncellenen=await r2.json();
    alert('Migrasyon tamamlandı!\n'+
      '• kategoriler tablosu güncellendi\n'+
      '• '+(Array.isArray(guncellenen)?guncellenen.length:'?')+' kayıt "dagitim" türüne taşındı\n\n'+
      'Sayfa yenileniyor...');
    await yukle();
  }catch(e){
    alert('Migrasyon hatası: '+e.message);
    console.error(e);
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Migrasyonu Çalıştır';}
  }
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
  XLSX.writeFile(wb,'kasa_kayitlar_'+ldStr(new Date())+'.xlsx');
}

function karDagilimPDF(){
  window.print();
}

// Stok modülü placeholder'ları — ileride stok.js'te gerçek halleri olacak
function stokEkle(){ alert('Stok modülü henüz aktif değil.'); }
function stokHareket(){ alert('Stok hareket modülü henüz aktif değil.'); }
function katEkle(tur){ alert('Kategori ekleme ayarlar sayfası henüz aktif değil.'); }

// =========================================
// GLOBAL TARİH FİLTRESİ
// =========================================
function aktifTarihDegisti(){
  var at = document.getElementById('aktif-tarih');
  var atBit = document.getElementById('aktif-tarih-bit');
  if(!at) return;
  var bas = at.value || '';
  var bit = (atBit && atBit.value) ? atBit.value : (bas ? ldStr(new Date()) : '');

  // Form tarihleri = başlangıç tarihi
  ['g-tarih','gi-tarih','fat-tarih','fon-tarih'].forEach(function(id){
    var el = document.getElementById(id);
    if(el && bas) el.value = bas;
  });

  // Kasa tablo filtresi
  var fBas = document.getElementById('f-bas');
  var fBit = document.getElementById('f-bit');
  if(fBas) fBas.value = bas;
  if(fBit) fBit.value = bit;

  // Kar Dağılım
  if(bas){
    var kdTip = document.getElementById('kd-tip');
    var kdBas = document.getElementById('kd-bas');
    var kdBit = document.getElementById('kd-bit');
    if(kdTip) kdTip.value = 'aralik';
    if(kdBas) kdBas.value = bas;
    if(kdBit) kdBit.value = bit;
    if(typeof kdTipDegisti === 'function') kdTipDegisti();
  }

  // Rapor
  if(bas){
    var rTip = document.getElementById('r-tip');
    var rBas = document.getElementById('r-bas');
    var rSon = document.getElementById('r-son');
    if(rTip) rTip.value = 'aralik';
    if(rBas) rBas.value = bas;
    if(rSon) rSon.value = bit;
    if(typeof raporTipDegisti === 'function') raporTipDegisti();
  }

  try{ localStorage.setItem('kasa_aktif_tarih', bas); }catch(e){}
  try{ localStorage.setItem('kasa_aktif_tarih_bit', (atBit&&atBit.value)||''); }catch(e){}

  if(typeof hzTarihGuncelle==='function') hzTarihGuncelle();
  renderOzet();
  renderKasa();
  if(typeof renderKarDagilim === 'function') renderKarDagilim();
  if(typeof renderRapor === 'function') renderRapor();
  if(typeof renderFinansAnaliz === 'function') renderFinansAnaliz();
  if(typeof renderMaliyet === 'function') renderMaliyet();
}

function aktifTarihDegistir(gun){
  var at = document.getElementById('aktif-tarih');
  var atBit = document.getElementById('aktif-tarih-bit');
  if(!at) return;
  var bas = at.value || ldStr(new Date());
  var dBas = new Date(bas);
  dBas.setDate(dBas.getDate() + gun);
  at.value = ldStr(dBas);
  if(atBit && atBit.value){
    var dBit = new Date(atBit.value);
    dBit.setDate(dBit.getDate() + gun);
    atBit.value = ldStr(dBit);
  }
  aktifTarihDegisti();
}

function aktifTarihBugun(){
  var at = document.getElementById('aktif-tarih');
  var atBit = document.getElementById('aktif-tarih-bit');
  var bugun = ldStr(new Date());
  if(at) at.value = bugun;
  if(atBit) atBit.value = bugun;
  aktifTarihDegisti();
}

function aktifTarihBuAy(){
  var at = document.getElementById('aktif-tarih');
  var atBit = document.getElementById('aktif-tarih-bit');
  var simdi = new Date();
  var bas = simdi.getFullYear()+'-'+String(simdi.getMonth()+1).padStart(2,'0')+'-01';
  var bit = ldStr(simdi);
  if(at) at.value = bas;
  if(atBit) atBit.value = bit;
  aktifTarihDegisti();
}

function aktifTarihYukle(){
  var at = document.getElementById('aktif-tarih');
  var atBit = document.getElementById('aktif-tarih-bit');
  if(!at) return;
  var kayitliBas = null, kayitliBit = null;
  try{ kayitliBas = localStorage.getItem('kasa_aktif_tarih'); }catch(e){}
  try{ kayitliBit = localStorage.getItem('kasa_aktif_tarih_bit'); }catch(e){}
  if(!kayitliBas){
    var simdi = new Date();
    kayitliBas = simdi.getFullYear()+'-'+String(simdi.getMonth()+1).padStart(2,'0')+'-01';
    kayitliBit = ldStr(simdi);
  }
  at.value = kayitliBas;
  if(atBit) atBit.value = kayitliBit || '';
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
