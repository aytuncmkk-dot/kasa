// ============================================================
// KARDAGILIM — Ortaklara kar dağılım raporu
// ============================================================

function renderKarDagilim(){
  var tip=document.getElementById('kd-tip').value;
  function filtrele(list){
    if(tip==='hafta'){var d=new Date();d.setDate(d.getDate()-7);var hw=d.toISOString().split('T')[0];return list.filter(function(k){return k.tarih>=hw;});}
    if(tip==='ay'){var ay=document.getElementById('kd-ay').value;return list.filter(function(k){return k.tarih.startsWith(ay);});}
    if(tip==='aralik'){var b=document.getElementById('kd-bas').value,s=document.getElementById('kd-bit').value;if(b&&s)return list.filter(function(k){return k.tarih>=b&&k.tarih<=s;});}
    return list;
  }
  var donemKayitlar=filtrele(kayitlar);kdBakiyeGuncelle(donemKayitlar);
  var donemGelir=donemKayitlar.filter(function(k){return k.tur==='gelir';});
  var donemGider=donemKayitlar.filter(function(k){return k.tur==='gider';});
  var totGelir=donemGelir.reduce(function(s,k){return s+Number(k.tutar);},0);
  var isletmeGider=donemGider.filter(function(k){return k.kat!=='Ortaklara Ödenen';}).reduce(function(s,k){return s+Number(k.tutar);},0);
  var ortakOdenen=donemGider.filter(function(k){return k.kat==='Ortaklara Ödenen';}).reduce(function(s,k){return s+Number(k.tutar);},0);
  var netKar=totGelir-isletmeGider;
  var donemOdemeler=donemGider.filter(function(k){return k.kat==='Ortaklara Ödenen';});
  var ortakCekilen={};
  donemOdemeler.forEach(function(k){var ad=(k.firma||'').trim();ortakCekilen[ad]=(ortakCekilen[ad]||0)+Number(k.tutar);});
  var donemAvanslar=filtrele(avansHareketler);
  var html='';
  // Dönem bilgisi
  var donemStr='';
  if(tip==='hafta')donemStr='Son 7 Gün';
  else if(tip==='ay')donemStr=document.getElementById('kd-ay').value;
  else if(tip==='aralik'){var kb=document.getElementById('kd-bas').value,ks=document.getElementById('kd-bit').value;donemStr=(kb&&ks)?fmtT(kb)+' — '+fmtT(ks):'Tarih Aralığı';}
  else donemStr='Tüm Zamanlar';
  html+='<div style="background:#1a1a1a;color:#fff;border-radius:10px;padding:12px 16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">';
  html+='<div><div style="font-size:11px;color:#aaa;margin-bottom:2px">KAR DAĞILIM RAPORU</div><div style="font-size:16px;font-weight:600">'+donemStr+'</div></div>';
  html+='<div style="font-size:11px;color:#aaa">'+new Date().toLocaleDateString("tr-TR")+'</div></div>';
  // Özet
  html+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">';
  html+='<div class="ok"><div class="ok-label">DÖNEM GELİRİ</div><div class="ok-val gc">'+para(totGelir)+'</div></div>';
  html+='<div class="ok"><div class="ok-label">DÖNEM GİDERİ</div><div class="ok-val rc">'+para(isletmeGider)+'</div></div>';
  html+='<div class="ok"><div class="ok-label">NET KAR</div><div class="ok-val '+(netKar>=0?'gc':'rc')+'">'+para(netKar)+'</div></div>';
  html+='<div class="ok"><div class="ok-label">TOPLAM DAĞITILAN</div><div class="ok-val bc">'+para(ortakOdenen)+'</div></div>';
  html+='</div>';
  // Ortak kartları
  html+='<div style="display:grid;grid-template-columns:repeat('+Math.min(ortaklar.length,3)+',1fr);gap:10px;margin-bottom:12px">';
  ortaklar.forEach(function(o){
    var hakEdilen=netKar*(o.hisse_yuzdesi/100);
    var cekilen=ortakCekilen[(o.ad||'').trim()]||0;
    var ortakAvans=donemAvanslar.filter(function(h){return (h.personel_isim||'').toUpperCase()===(o.ad||'').toUpperCase();});
    var topAvans=ortakAvans.filter(function(h){return h.islem==='avans';}).reduce(function(s,h){return s+Number(h.tutar);},0);
    var topMahsup=ortakAvans.filter(function(h){return h.islem==='mahsup';}).reduce(function(s,h){return s+Number(h.tutar);},0);
    var netAvans=topAvans-topMahsup;
    var kalanHak=hakEdilen-cekilen-netAvans;
    html+='<div style="background:#fff;border:1px solid #e0e0db;border-radius:10px;padding:12px">';
    html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
    html+='<div style="font-size:13px;font-weight:700">'+o.ad+'</div>';
    html+='<div style="font-size:11px;color:#888;background:#f5f5f3;padding:2px 8px;border-radius:10px">%'+o.hisse_yuzdesi+'</div></div>';
    html+='<div style="background:#E6F1FB;border-radius:7px;padding:8px;margin-bottom:8px">';
    html+='<div style="font-size:10px;color:#0C447C;margin-bottom:2px">HAK EDİŞ</div>';
    html+='<div style="font-size:17px;font-weight:700;color:#185FA5">'+para(hakEdilen)+'</div></div>';
    if(cekilen>0)html+='<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span>Çekilen</span><span style="color:#D85A30">- '+para(cekilen)+'</span></div>';
    if(topAvans>0)html+='<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span>Avans</span><span style="color:#D85A30">- '+para(topAvans)+'</span></div>';
    html+='<div style="margin-top:8px;padding:8px;border-radius:7px;background:'+(kalanHak>=0?'#E1F5EE':'#FAECE7')+'">';
    html+='<div style="font-size:10px;color:'+(kalanHak>=0?'#0F6E56':'#993C1D')+';margin-bottom:2px">'+(kalanHak>=0?'ÇEKEBİLECEĞİ':'FAZLA ÇEKİM')+'</div>';
    html+='<div style="font-size:17px;font-weight:700;color:'+(kalanHak>=0?'#1D9E75':'#D85A30')+'">'+para(Math.abs(kalanHak))+'</div></div></div>';
  });
  html+='</div>';
  // Ödeme tablosu
  if(donemOdemeler.length){
    html+='<div class="tw"><table><thead><tr><th>Tarih</th><th>Ortak</th><th style="text-align:right">Tutar</th><th>Açıklama</th></tr></thead><tbody>';
    html+=donemOdemeler.sort(function(a,b){return b.tarih.localeCompare(a.tarih);}).map(function(k){
      return '<tr><td>'+fmtT(k.tarih)+'</td><td>'+(k.firma||'-')+'</td><td style="text-align:right;color:#1D9E75">'+para(k.tutar)+'</td><td>'+(k.aciklama||'-')+'</td></tr>';
    }).join('');
    html+='</tbody></table></div>';
  }
  document.getElementById('kd-icerik').innerHTML=html;
}


async function kdBakiyeGuncelle(donemKayitlar){
  // Dönem: Net Kar − Ortaklara Ödenen = Kasada Kalan
  var donemGelir=0, donemIsletme=0, donemOrtak=0;
  (donemKayitlar||[]).forEach(function(k){
    if(k.tur==='gelir') donemGelir+=Number(k.tutar)||0;
    else if(k.tur==='gider'){
      if(k.kat==='Ortaklara Ödenen') donemOrtak+=Number(k.tutar)||0;
      else donemIsletme+=Number(k.tutar)||0;
    }
  });
  var donemKalan=donemGelir-donemIsletme-donemOrtak;
  var el1=document.getElementById('kd-donem-bakiye');
  if(el1){
    el1.textContent=para(donemKalan); el1.style.color=donemKalan>=0?'#059669':'#dc2626';
    if(typeof setTT==='function') setTT('kd-donem-bakiye',para(donemGelir)+' Dönem Geliri\n− '+para(donemIsletme)+' İşletme Gideri\n− '+para(donemOrtak)+' Ortaklara Ödenen');
  }
  // Tüm zamanlar: in-memory kayitlar kullan (dbGetAll ile yüklendi)
  try{
    var tumu=typeof kayitlar!=='undefined'?kayitlar:(await dbGetAll('kayitlar','select=tur,tutar,kat'));
    var tg=0,tIsletme=0,tOrtak=0;
    (tumu||[]).forEach(function(k){
      if(k.tur==='gelir') tg+=Number(k.tutar)||0;
      else if(k.tur==='gider'){
        if(k.kat==='Ortaklara Ödenen') tOrtak+=Number(k.tutar)||0;
        else tIsletme+=Number(k.tutar)||0;
      }
    });
    var tplm=tg-tIsletme-tOrtak;
    var el2=document.getElementById('kd-toplam-bakiye');
    if(el2){
      el2.textContent=para(tplm); el2.style.color=tplm>=0?'#1e40af':'#dc2626';
      if(typeof setTT==='function') setTT('kd-toplam-bakiye',para(tg)+' Toplam Gelir\n− '+para(tIsletme)+' İşletme Gideri\n− '+para(tOrtak)+' Ortaklara Ödenen');
    }
  }catch(e){ console.error('Toplam bakiye hatasi',e); }
}
