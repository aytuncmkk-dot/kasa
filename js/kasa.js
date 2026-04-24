// ============================================================
// KASA — Gelir/gider formu, tablo, düzenleme, filtre
// ============================================================

function ozTemizle(){
  renderOzet();
  renderKasa();
}

function getOzetAralik(){
  var bas=document.getElementById('oz-bas').value;
  var bit=document.getElementById('oz-bit').value;
  if(!bas&&!bit){
    // Seçim yoksa son ay
    bas=thisMonth+'-01';
    var simdi=new Date();
    bit=simdi.getFullYear()+'-'+String(simdi.getMonth()+1).padStart(2,'0')+'-'+String(new Date(simdi.getFullYear(),simdi.getMonth()+1,0).getDate()).padStart(2,'0');
  }
  return {bas:bas,bit:bit};
}

function renderOzet(){
  var aralik=getOzetAralik();
  var bas=aralik.bas,bit=aralik.bit;
  // Kayit listesini ozet araligıyla senkronize et
  if(!document.getElementById('f-bas').value&&!document.getElementById('f-bit').value){
    document.getElementById('f-bas').value=bas;
    document.getElementById('f-bit').value=bit;
  }
  var liste=kayitlar.filter(function(k){
    if(bas&&k.tarih<bas)return false;
    if(bit&&k.tarih>bit)return false;
    return true;
  });
  var topGelir=liste.filter(function(k){return k.tur==='gelir';}).reduce(function(s,k){return s+Number(k.tutar);},0);
  var isletmeGider=liste.filter(function(k){return k.tur==='gider';}).reduce(function(s,k){return s+Number(k.tutar);},0);
  var ortakOdenen=liste.filter(function(k){return k.tur==='dagitim';}).reduce(function(s,k){return s+Number(k.tutar);},0);
  var netKar=topGelir-isletmeGider;
  var kasadaKalan=netKar-ortakOdenen;
  var topKarlilik=topGelir>0?((netKar/topGelir)*100):0;
  // Kişi sayısını grupla: aynı tarih+firma grubu için tek kişi sayısı al
  var gelirler=liste.filter(function(k){return k.tur==='gelir';});
  var gruplar={};
  gelirler.forEach(function(k){
    var key=k.tarih+'|'+(k.firma||'');
    if(!gruplar[key])gruplar[key]={kisi:0,tutar:0};
    gruplar[key].tutar+=Number(k.tutar);
    if(Number(k.kisi_sayisi)>0)gruplar[key].kisi+=Number(k.kisi_sayisi);
  });
  var topKisi=0,kisiBazliGelir=0;
  Object.keys(gruplar).forEach(function(key){
    topKisi+=gruplar[key].kisi;
    if(gruplar[key].kisi>0)kisiBazliGelir+=gruplar[key].tutar;
  });
  var topBahsis=liste.filter(function(k){return (k.tur==='gider')&&k.kat==='Adisyon Bahsis';}).reduce(function(s,k){return s+Number(k.tutar);},0);
  var kisiBasiOrt=topKisi>0?((kisiBazliGelir-topBahsis)/topKisi):0;
  var nakitGelir=liste.filter(function(k){return k.tur==='gelir'&&k.odeme==='Nakit';}).reduce(function(s,k){return s+Number(k.tutar);},0);
  var kkGelir=liste.filter(function(k){return k.tur==='gelir'&&k.odeme==='Kredi Karti';}).reduce(function(s,k){return s+Number(k.tutar);},0);
  document.getElementById('oz-nakit').textContent=para(nakitGelir);
  document.getElementById('oz-kk').textContent=para(kkGelir);
  document.getElementById('oz-gelir').textContent=para(topGelir);
  document.getElementById('oz-gider').textContent=para(isletmeGider);
  document.getElementById('oz-kar').textContent=para(netKar);
  document.getElementById('oz-kar').style.color=netKar>=0?'#1D9E75':'#D85A30';
  document.getElementById('oz-ortak').textContent=para(ortakOdenen);
  var elKalan=document.getElementById('oz-kalan');
  if(elKalan){elKalan.textContent=para(kasadaKalan);elKalan.style.color=kasadaKalan>=0?'#1e40af':'#dc2626';}
  document.getElementById('oz-karlilik').textContent=topKarlilik.toFixed(1)+'%';
  document.getElementById('oz-karlilik').style.color=topKarlilik>=0?'#1D9E75':'#D85A30';
  document.getElementById('oz-kisi').textContent=topKisi>0?topKisi:'—';
  document.getElementById('oz-kisi-basi').textContent=topKisi>0?para(kisiBasiOrt):'—';
  if(typeof setTT==='function'){
    setTT('oz-gelir','Nakit: '+para(nakitGelir)+'\nKart: '+para(kkGelir),'.ok');
    setTT('oz-gider','Ortaklara Ödenen hariç\ntüm işletme giderleri','.ok');
    setTT('oz-kar',para(topGelir)+' Gelir\n− '+para(isletmeGider)+' İşletme Gideri','.ok');
    setTT('oz-ortak','Ortaklara Ödenen\nkategorisindeki toplam ödemeler','.ok');
    setTT('oz-kalan',para(netKar)+' Net Kar\n− '+para(ortakOdenen)+' Ortaklara Ödenen','.ok');
  }
}

function odemeEkle(){
  odemeSatirlari.push({tip:'Kredi Karti',tutar:''});
  renderOdemeSatirlari();
}

function odemeSil(i){
  odemeSatirlari.splice(i,1);
  renderOdemeSatirlari();
}

function renderOdemeSatirlari(){
  var div=document.getElementById('odeme-satirlar');
  div.innerHTML=odemeSatirlari.map(function(o,i){
    return '<div class="odeme-satir">'+
      '<div class="field"><select onchange="odemeDeg('+i+',\'tip\',this.value)" style="border:1px solid #e0e0db;border-radius:8px;padding:7px 9px;font-size:13px;background:#fff;outline:none">'+
        '<option value=""'+(o.tip===''?'':'')+'>— Ödeme Türü —</option>'+
        '<option value="Nakit"'+(o.tip==='Nakit'?' selected':'')+'>Nakit</option>'+
        '<option value="Kredi Karti"'+(o.tip===''||o.tip==='Kredi Karti'?' selected':'')+'>Kredi Kartı</option>'+
        '<option value="Havale/EFT"'+(o.tip==='Havale/EFT'?' selected':'')+'>Havale / EFT</option>'+
      '</select></div>'+
      '<div class="field"><input type="number" placeholder="Tutar..." value="'+(o.tutar||'')+'" min="0" step="0.01" onchange="odemeDeg('+i+',\'tutar\',this.value)" oninput="toplamGuncelle()" style="border:1px solid #e0e0db;border-radius:8px;padding:7px 9px;font-size:13px;outline:none;width:100%"></div>'+
      '<div></div>'+
      '<button class="del-btn" onclick="odemeSil('+i+')" style="font-size:16px">×</button>'+
    '</div>';
  }).join('');
  toplamGuncelle();
}

function odemeDeg(i,alan,val){
  odemeSatirlari[i][alan]=val;
  toplamGuncelle();
}

function toplamGuncelle(){
  var top=odemeSatirlari.reduce(function(s,o){return s+(parseFloat(o.tutar)||0);},0);
  document.getElementById('odeme-toplam').textContent=para(top);
  var kisi=parseInt(document.getElementById('g-kisi').value)||0;
  var avgEl=document.getElementById('kisi-basi-avg');
  var avgWrap=document.getElementById('kisi-basi-wrap');
  if(kisi>0&&top>0){
    avgEl.textContent=para(top/kisi);
    avgWrap.style.display='inline';
  }else{
    avgWrap.style.display='none';
  }
}

function adisyonYukle(){
  var f=document.getElementById('g-adisyon').files[0];
  if(!f){_adisyonData=null;document.getElementById('adisyon-onizleme').style.display='none';return;}
  var rd=new FileReader();
  rd.onload=function(e){
    _adisyonData=e.target.result;
    document.getElementById('adisyon-onizleme').style.display='block';
    document.getElementById('adisyon-bilgi').textContent='Adisyon fotoğrafı hazır — kaydet butonuna basınca stok analizi yapılacak.';
  };
  rd.readAsDataURL(f);
}

async function gelirKaydet(){
  var __auditVeri = null;
  var tarih=document.getElementById('g-tarih').value;
  var firma=document.getElementById('g-firma').value.trim().toLocaleUpperCase('tr-TR');
  var kisi=parseInt(document.getElementById('g-kisi').value)||0;
  var bahsis=0;
  // Validasyon
  var hatalar=[];
  if(!tarih)hatalar.push('Tarih');
  // Firma zorunlu değil, varsayılan 'Müşteri'
  // kisi_sayisi opsiyonel
  if(odemeSatirlari.length===0)hatalar.push('En az bir ödeme yöntemi');
  var gecersizOdeme=odemeSatirlari.filter(function(o){return !o.tip||!(parseFloat(o.tutar)>0);});
  if(gecersizOdeme.length>0)hatalar.push('Tüm ödeme satırlarını doldurun');
  if(hatalar.length>0){alert('Zorunlu alanlar eksik:\n- '+hatalar.join('\n- '));return;}
  // Her ödeme yöntemi için ayrı kayıt
  var topTutar=odemeSatirlari.reduce(function(s,o){return s+(parseFloat(o.tutar)||0);},0);
  var kayitArr=[];
  odemeSatirlari.forEach(function(o,i){
    kayitArr.push({
      tarih:tarih,
      tur:'gelir',
      kat:'Masa Geliri',
      odeme:o.tip,
      firma:firma,
      aciklama:i===0&&bahsis>0?'Adisyon Bahsis: TL '+bahsis:'',
      tutar:parseFloat(o.tutar)||0,
      kisi_sayisi:i===0?kisi:0,
      fatura_var:false,
      adisyon_var:_adisyonData?true:false
    });
  });
  // Bahşiş ayrı kayıt DEĞİL - ilk kayda not olarak eklendi
  // Her kaydı tek tek gönder
  for(var i=0;i<kayitArr.length;i++){
    var r=await dbPost('kayitlar',kayitArr[i]);
    if(!r.ok){alert('Kayıt hatası: '+r.status);return;}
    try{ await auditLog('EKLE','kayitlar',null,null,kayitArr[i],'Gelir kaydı'); }catch(e){}
  }
  // Formu temizle
  document.getElementById('g-firma').value='';
  document.getElementById('g-kisi').value='';
  document.getElementById('g-adisyon').value='';
  document.getElementById('adisyon-onizleme').style.display='none';
  odemeSatirlari=[];
  renderOdemeSatirlari();
  _adisyonData=null;
  await yukle();
  // Filtreleri temizle, tüm kayıtları yeniden tarih sırasıyla göster
  renderKasa();
}

async function giderKaydet(){
  var __auditVeri = null;
  var tarih=document.getElementById('gi-tarih').value;
  var kat=document.getElementById('gi-kat').value;
  var firma=document.getElementById('gi-firma').value.trim().toLocaleUpperCase('tr-TR');
  var odeme='Nakit';
  var aciklama=document.getElementById('gi-aciklama').value.trim().toLocaleUpperCase('tr-TR');
  var tutar=parseFloat(document.getElementById('gi-tutar').value);
  // Ortaklara Ödenen seçilince ortak seçimi zorunlu
  if(kat==='Ortaklara Ödenen'){
    var ortakSec=document.getElementById('gi-ortak').value;
    if(ortakSec)document.getElementById('gi-firma').value=ortakSec;
  }
  var firma=document.getElementById('gi-firma').value.trim().toLocaleUpperCase('tr-TR');
  var hatalar=[];
  if(!tarih)hatalar.push('Tarih');
  if(!kat)hatalar.push('Kategori');
  if(kat==='Ortaklara Ödenen'&&!firma)hatalar.push('Ortak seçiniz');
  if(isNaN(tutar)||tutar<=0)hatalar.push('Tutar');
  if(hatalar.length>0){alert('Zorunlu alanlar eksik:\n- '+hatalar.join('\n- '));return;}
  var kayitTur=(dagitimKatlar&&dagitimKatlar.some(function(k){return k.ad===kat;})) ? 'dagitim' : 'gider';
  var r=await dbPost('kayitlar',[{tarih:tarih,tur:kayitTur,kat:kat,odeme:odeme,firma:firma,aciklama:aciklama,tutar:tutar,kisi_sayisi:0,fatura_var:false}]);
  try{ await auditLog('EKLE','kayitlar',null,null,{tarih:tarih,tur:kayitTur,kat:kat,tutar:tutar,firma:firma,aciklama:aciklama},'Gider/Dagitim kaydı'); }catch(e){}
  if(!r.ok){alert('Kayıt hatası: '+r.status);return;}
  document.getElementById('gi-firma').value='';
  document.getElementById('gi-aciklama').value='';
  document.getElementById('gi-tutar').value='';
  document.getElementById('gi-kat').value='';
  await yukle();
  // Filtreleri temizle, tüm kayıtları yeniden tarih sırasıyla göster
  renderKasa();
}

async function kasaSil(id){
  if(!confirm('Bu kaydı silmek istediğinize emin misiniz?'))return;
  var silinenKayit=kayitlar.find(function(k){return k.id===id;});
  await dbDelete('kayitlar','id',id);
  await auditLog('SIL','kayitlar',id,silinenKayit,null,'Silindi: '+(silinenKayit?silinenKayit.kat+' '+silinenKayit.tutar:id));
  kayitlar=kayitlar.filter(function(k){return k.id!==id;});
  renderKasa();renderOzet();
}

function kasaDuzenle(id){
  var k=kayitlar.find(function(x){return x.id==id;});
  if(!k)return;
  _duzId=id;
  document.getElementById('duz-tarih').value=k.tarih||'';
  document.getElementById('duz-tur').value=k.tur||'gelir';
  duzKatGuncelle();
  setTimeout(function(){document.getElementById('duz-kat').value=k.kat||'';},50);
  document.getElementById('duz-odm').value=k.odeme||'Nakit';
  document.getElementById('duz-firma').value=k.firma||'';
  document.getElementById('duz-aciklama').value=k.aciklama||'';
  document.getElementById('duz-kisi').value=k.kisi_sayisi||0;
  document.getElementById('duz-tutar').value=k.tutar||0;
  document.getElementById('duz-modal').classList.add('open');
}

function duzKatGuncelle(){
  var tur=document.getElementById('duz-tur').value;
  var list=tur==='gelir'?gelirKatlar:tur==='dagitim'?dagitimKatlar:giderKatlar;
  document.getElementById('duz-kat').innerHTML=list.map(function(k){return '<option value="'+k.ad+'">'+k.ad+'</option>';}).join('');
}

function duzKapat(){document.getElementById('duz-modal').classList.remove('open');_duzId=null;}

async function duzKaydet(){
  if(!_duzId)return;
  var gunc={
    tarih:document.getElementById('duz-tarih').value,
    tur:document.getElementById('duz-tur').value,
    kat:document.getElementById('duz-kat').value,
    odeme:document.getElementById('duz-odm').value,
    firma:document.getElementById('duz-firma').value.trim().toLocaleUpperCase('tr-TR'),
    aciklama:document.getElementById('duz-aciklama').value.trim().toLocaleUpperCase('tr-TR'),
    kisi_sayisi:parseInt(document.getElementById('duz-kisi').value)||0,
    tutar:parseFloat(document.getElementById('duz-tutar').value)||0
  };
  var __eskiKayit = kayitlar.find(function(k){return k.id===_duzId;});
  var r=await dbPatch('kayitlar','id',_duzId,gunc);
  var _aciklama = window._duzKaynak === 'denetim' ? 'Kayıt güncellendi (denetim ekranından)' : 'Kayıt güncellendi';
  try{ await auditYaz('GUNCELLE','kayitlar',_duzId,__eskiKayit,gunc,_aciklama); }catch(e){}
  window._duzKaynak = null;
  if(!r.ok){alert('Güncelleme hatası!');return;}
  var idx=kayitlar.findIndex(function(x){return x.id==_duzId;});
  if(idx>=0)Object.assign(kayitlar[idx],gunc);
  var _guncelId=_duzId;
  duzKapat();
  renderKasa();renderOzet();
  if(typeof incelemeKayitGuncelle==='function') incelemeKayitGuncelle(_guncelId,gunc);
}

function renderKasa(){
  var fT=document.getElementById('f-tur').value;
  var fK=document.getElementById('f-kat').value;
  var fO=document.getElementById('f-odm').value;
  var fBas=document.getElementById('f-bas').value;
  var fBit=document.getElementById('f-bit').value;
  var fAra=document.getElementById('f-ara')?document.getElementById('f-ara').value.trim().toLowerCase():'';
  // Filtre yoksa özet aralığını kullan
  var ozAralik=getOzetAralik();
  var fil=kayitlar.filter(function(k){
    if(_tumKayitlar)return(!fT||k.tur===fT)&&(!fK||k.kat===fK)&&(!fO||k.odeme===fO);
    if(fBas&&k.tarih<fBas)return false;
    if(fBit&&k.tarih>fBit)return false;
    if(!fBas&&!fBit&&!fT&&!fK&&!fO&&!fAra){
      if(k.tarih<ozAralik.bas||k.tarih>ozAralik.bit)return false;
    }
    if(fAra){
      var araHaystack=((k.firma||'')+(k.aciklama||'')+(k.kat||'')+(k.odeme||'')).toLowerCase();
      if(araHaystack.indexOf(fAra)===-1)return false;
    }
    return(!fT||k.tur===fT)&&(!fK||k.kat===fK)&&(!fO||k.odeme===fO);
  });
  var tbody=document.getElementById('kasa-tablo'),emp=document.getElementById('kasa-empty');
  if(!fil.length){tbody.innerHTML='';emp.style.display='block';return;}
  emp.style.display='none';
  tbody.innerHTML=fil.map(function(k){
    var isGelir=k.tur==='gelir';
    var isDagitim=k.tur==='dagitim';
    var turBg=isGelir?'#E1F5EE':isDagitim?'#EFF6FF':'#FAECE7';
    var turRenk=isGelir?'#0F6E56':isDagitim?'#1e40af':'#993C1D';
    var turEtiket=isGelir?'Gelir':isDagitim?'Dağıtım':'Gider';
    var odmClass={'Nakit':'odm-n','Kredi Karti':'odm-k','Havale/EFT':'odm-h'}[k.odeme]||'';
    return '<tr>'+
      '<td style="white-space:nowrap">'+fmtT(k.tarih)+'</td>'+
      '<td><span class="badge" style="background:'+turBg+';color:'+turRenk+'">'+turEtiket+'</span></td>'+
      '<td style="color:#666;font-size:11px" title="'+(k.kat||'')+'">'+(k.kat||'')+'</td>'+
      '<td title="'+(k.firma||'')+'">'+(k.firma||'')+'</td>'+
      '<td><span class="badge '+odmClass+'">'+(k.odeme||'-')+'</span></td>'+
      '<td style="color:#888;font-size:11px" title="'+(k.aciklama||'')+'">'+(k.aciklama||'')+'</td>'+
      '<td style="text-align:center;color:#888">'+(k.kisi_sayisi>0?k.kisi_sayisi:'')+'</td>'+
      '<td style="text-align:right;font-weight:500;color:'+(isGelir?'#1D9E75':isDagitim?'#1e40af':'#D85A30')+'">'+(isGelir?'+ ':'-  ')+para(k.tutar)+'</td>'+
      '<td><button class="edit-btn" onclick="kasaDuzenle('+k.id+')" title="Düzenle">✎</button></td>'+
      '<td><button class="del-btn" onclick="kasaSil('+k.id+')" title="Sil">×</button></td>'+
    '</tr>';
  }).join('');
}

function filtreTemizle(){
  document.getElementById('f-ara').value='';
  document.getElementById('f-tur').value='';
  document.getElementById('f-kat').value='';
  document.getElementById('f-odeme').value='';
  document.getElementById('f-bas').value='';
  document.getElementById('f-bit').value='';
  renderKasa();
}

function giderKatSec(k){
  var fw=document.getElementById('gi-firma-wrap');
  var ow=document.getElementById('gi-ortak-wrap');
  var os=document.getElementById('gi-ortak');
  var kw=document.getElementById('gi-kirilim-wrap');
  var ks=document.getElementById('gi-kirilim');
  var KIRILIM={
    'Eğlence Giderleri':['SAZ','DANS','DJ'],
    'Extra Personel':['GÜVENLİK','BULAŞIK','BAR','KOMİ','GARSON','KASA']
  };
  if(fw)fw.style.display='block';
  if(ow)ow.style.display='none';
  if(kw)kw.style.display='none';
  document.getElementById('gi-firma').value='';
  if(k==='Ortaklara Ödenen'){
    if(os)os.innerHTML='<option value="">Seçiniz</option>'+ortaklar.map(function(o){return '<option value="'+o.ad+'">'+o.ad+'</option>';}).join('');
    if(fw)fw.style.display='none';
    if(ow)ow.style.display='block';
  }else if(KIRILIM[k]){
    if(ks)ks.innerHTML='<option value="">— Seçiniz —</option>'+KIRILIM[k].map(function(x){return '<option value="'+x+'">'+x+'</option>';}).join('');
    if(fw)fw.style.display='none';
    if(kw)kw.style.display='block';
  }
}

