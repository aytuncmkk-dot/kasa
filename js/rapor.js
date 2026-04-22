// ============================================================
// RAPOR — Genel rapor (kar/zarar, accordion)
// ============================================================

function raporTipDegisti(){
  var tip=document.getElementById('r-tip').value;
  document.getElementById('r-ay').style.display=tip==='ay'?'':'none';
  document.getElementById('r-aralik-wrap').style.display=tip==='aralik'?'flex':'none';
  document.getElementById('r-yil').style.display=tip==='yil'?'':'none';
  renderRapor();
}

function getRaporListe(){
  var tip=document.getElementById('r-tip').value;
  return kayitlar.filter(function(k){
    if(tip==='ay')return k.tarih.startsWith(document.getElementById('r-ay').value);
    if(tip==='aralik'){var b=document.getElementById('r-bas').value,s=document.getElementById('r-son').value;if(b&&s)return k.tarih>=b&&k.tarih<=s;return true;}
    if(tip==='yil')return k.tarih.startsWith(document.getElementById('r-yil').value);
    return true;
  });
}

function accordionToggle(uid){
  var el=document.getElementById(uid);
  var icon=document.getElementById(uid+'_icon');
  if(!el)return;
  if(el.style.display==='none'||el.style.display===''){
    el.style.display='block';
    if(icon)icon.innerHTML='&#9660;';
  }else{
    el.style.display='none';
    if(icon)icon.innerHTML='&#9658;';
  }
}

function accordionSatir(uid, baslik, toplam, oran, renk, detaylar){
  var d='';
  detaylar.forEach(function(item){
    d+='<div style="display:flex;justify-content:space-between;padding:6px 14px 6px 36px;border-bottom:1px solid #f0f0ec">'+
      '<span style="font-size:12px;color:#666">'+item.key+'</span>'+
      '<div style="display:flex;gap:10px">'+
        '<span style="font-size:11px;color:#aaa">%'+item.pct+'</span>'+
        '<span style="font-size:12px;font-weight:500;color:'+renk+'">'+para(item.val)+'</span>'+
      '</div>'+
    '</div>';
  });
  return '<div style="border-bottom:1px solid #f0f0ec">'+
    '<div id="btn_'+uid+'" onclick="accordionToggle("'+uid+'")" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;cursor:pointer">'+
      '<div style="display:flex;align-items:center;gap:8px">'+
        '<span id="'+uid+'_icon" style="color:#888;font-size:12px">&#9658;</span>'+
        '<span style="font-size:13px;color:#444">'+baslik+'</span>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:12px">'+
        '<span style="font-size:11px;color:#888">%'+oran+'</span>'+
        '<span style="font-weight:500;color:'+renk+'">'+para(toplam)+'</span>'+
      '</div>'+
    '</div>'+
    '<div id="'+uid+'" style="display:none;background:#f9f9f8;border-top:1px solid #f0f0ec">'+d+'</div>'+
  '</div>';
}

function renderRapor(){
  var list=getRaporListe();
  var gel=list.filter(function(k){return k.tur==='gelir';});
  var gid=list.filter(function(k){return k.tur==='gider';});
  var totGelir=gel.reduce(function(s,k){return s+Number(k.tutar);},0);
  var isletmeGider=gid.filter(function(k){return k.kat!=='Ortaklara Ödenen';}).reduce(function(s,k){return s+Number(k.tutar);},0);
  var netKar=totGelir-isletmeGider;
  var karMarji=totGelir>0?((netKar/totGelir)*100):0;

  function bolum(icerik){return '<div style="background:#fff;border:1px solid #e0e0db;border-radius:10px;overflow:hidden;margin-bottom:10px">'+icerik+'</div>';}
  function baslik(lbl){return '<div style="padding:8px 14px 4px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;background:#f9f9f8;border-bottom:1px solid #e8e8e4">'+lbl+'</div>';}
  function satir(lbl,val,renk,kalin){
    var b=kalin?'font-weight:600':'';
    return '<div style="display:flex;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #f0f0ec;'+b+'">'+
      '<span style="font-size:13px;color:#555;'+b+'">'+lbl+'</span>'+
      '<span style="font-size:13px;'+b+';color:'+renk+'">'+para(val)+'</span>'+
    '</div>';
  }

  var html='';

  // Özet
  var ozet=satir('TOPLAM GELİR',totGelir,'#1D9E75',true);
  ozet+=satir('TOPLAM GİDER',isletmeGider,'#D85A30',true);
  ozet+=satir('NET KAR',netKar,netKar>=0?'#1D9E75':'#D85A30',true);
  ozet+='<div style="display:flex;justify-content:space-between;padding:10px 14px;background:'+(netKar>=0?'#E1F5EE':'#FAECE7')+'">'+
    '<span style="font-size:13px;font-weight:600;color:'+(netKar>=0?'#0F6E56':'#993C1D')+'">KAR MARJI</span>'+
    '<span style="font-size:16px;font-weight:700;color:'+(netKar>=0?'#1D9E75':'#D85A30')+'">'+karMarji.toFixed(1)+'%</span>'+
  '</div>';
  html+=bolum(ozet);

  // Gelir detayı
  var gelirIcerik=baslik('GELİR DETAYI');
  gelirKatlar.forEach(function(kat){
    var kayitlar_kat=gel.filter(function(k){return k.kat===kat.ad;});
    var toplam=kayitlar_kat.reduce(function(s,k){return s+Number(k.tutar);},0);
    if(toplam===0)return;
    var oran=totGelir>0?((toplam/totGelir)*100).toFixed(1):0;
    var uid='g_'+kat.ad.replace(/[^a-zA-Z0-9]/g,'_');
    var gruplar={};
    kayitlar_kat.forEach(function(k){
      var key=k.firma&&k.firma.trim()?k.firma.trim():'Diger';
      gruplar[key]=(gruplar[key]||0)+Number(k.tutar);
    });
    var detaylar=Object.keys(gruplar).sort(function(a,b){return gruplar[b]-gruplar[a];}).slice(0,20).map(function(key){
      return {key:key,val:gruplar[key],pct:0};
    });
    gelirIcerik+=accordionSatir(uid,kat.ad,toplam,oran,'#1D9E75',detaylar);
  });
  html+=bolum(gelirIcerik);

  // Gider detayı
  var giderIcerik=baslik('GİDER KATEGORİLERİ');
  giderKatlar.filter(function(k){return k.ad!=='Ortaklara Ödenen';}).forEach(function(kat){
    var kayitlar_kat=gid.filter(function(k){return k.kat===kat.ad;});
    var toplam=kayitlar_kat.reduce(function(s,k){return s+Number(k.tutar);},0);
    if(toplam===0)return;
    var oran=totGelir>0?((toplam/totGelir)*100).toFixed(1):0;
    var uid='d_'+kat.ad.replace(/[^a-zA-Z0-9]/g,'_');
    var gruplar={};
    kayitlar_kat.forEach(function(k){
      var key=(k.aciklama&&k.aciklama.trim())?k.aciklama.trim():(k.firma&&k.firma.trim()?k.firma.trim():'Diger');
      gruplar[key]=(gruplar[key]||0)+Number(k.tutar);
    });
    var detaylar=Object.keys(gruplar).sort(function(a,b){return gruplar[b]-gruplar[a];}).map(function(key){
      return {key:key,val:gruplar[key],pct:toplam>0?((gruplar[key]/toplam)*100).toFixed(0):0};
    });
    giderIcerik+=accordionSatir(uid,kat.ad,toplam,oran,'#D85A30',detaylar);
  });
  html+=bolum(giderIcerik);

  document.getElementById('r-karzarar').innerHTML=html;
}

function katAccordion(katAdi, katListesi, kayitListesi, totGelir, renk){
  var html='';
  katListesi.forEach(function(kat){
    var kayitlar_kat=kayitListesi.filter(function(k){return k.kat===kat;});
    var toplam=kayitlar_kat.reduce(function(s,k){return s+Number(k.tutar);},0);
    if(toplam===0)return;
    var oran=totGelir>0?((toplam/totGelir)*100).toFixed(1):0;
    var uid='acc_'+kat.replace(/[^a-zA-Z0-9]/g,'_');
    var gruplar={};
    kayitlar_kat.forEach(function(k){
      var key=(k.aciklama&&k.aciklama.trim())?k.aciklama.trim():(k.firma&&k.firma.trim()?k.firma.trim():'Diger');
      gruplar[key]=(gruplar[key]||0)+Number(k.tutar);
    });
    var detaylar=Object.keys(gruplar).sort(function(a,b){return gruplar[b]-gruplar[a];}).map(function(key){
      return {key:key,val:gruplar[key],pct:toplam>0?((gruplar[key]/toplam)*100).toFixed(0):0};
    });
    html+=accordionSatir(uid,kat,toplam,oran,renk||'#D85A30',detaylar);
  });
  return html;
}

function raporSekme(sekme){
  document.getElementById('r-genel-icerik').style.display=sekme==='genel'?'block':'none';
  document.getElementById('r-ozel-icerik').style.display=sekme==='ozel'?'block':'none';
  document.getElementById('r-tab-genel').style.borderBottomColor=sekme==='genel'?'#1a1a1a':'transparent';
  document.getElementById('r-tab-genel').style.color=sekme==='genel'?'#1a1a1a':'#888';
  document.getElementById('r-tab-ozel').style.borderBottomColor=sekme==='ozel'?'#1a1a1a':'transparent';
  document.getElementById('r-tab-ozel').style.color=sekme==='ozel'?'#1a1a1a':'#888';
  if(sekme==='ozel')ozelRaporKatGuncelle();
}

