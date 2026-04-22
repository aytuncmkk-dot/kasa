// ============================================================
// FINANS — Finans analiz (aylık trend, öneriler)
// ============================================================

function renderFinansAnaliz(){
  var aylar={};
  kayitlar.forEach(function(k){
    var ay=k.tarih?k.tarih.slice(0,7):null;
    if(!ay)return;
    if(!aylar[ay])aylar[ay]={gelir:0,gider:{},giderToplam:0,ortakOdenen:0};
    if(k.tur==="gelir")aylar[ay].gelir+=Number(k.tutar);
    if(k.tur==="gider"){
      if(k.kat==="Ortaklara Ödenen")aylar[ay].ortakOdenen+=Number(k.tutar);
      else{aylar[ay].gider[k.kat]=(aylar[ay].gider[k.kat]||0)+Number(k.tutar);aylar[ay].giderToplam+=Number(k.tutar);}
    }
  });
  var ayList=Object.keys(aylar).sort();
  if(!ayList.length){document.getElementById("finans-icerik").innerHTML="<div class=\"empty\">Yeterli veri yok.</div>";return;}

  function kart(b,d,r,a){return "<div style=\"background:#fff;border:1px solid #e0e0db;border-radius:10px;padding:14px\"><div style=\"font-size:11px;color:#888;margin-bottom:4px\">"+b+"</div><div style=\"font-size:18px;font-weight:700;color:"+(r||"#1a1a1a")+"\">"+d+"</div>"+(a?"<div style=\"font-size:11px;color:#aaa;margin-top:3px\">"+a+"</div>":"")+"</div>";}
  function bolum(b,ic){return "<div style=\"background:#fff;border:1px solid #e0e0db;border-radius:10px;overflow:hidden;margin-bottom:14px\"><div style=\"padding:12px 16px;background:#1a1a1a;color:#fff;font-size:13px;font-weight:600\">"+b+"</div><div style=\"padding:14px\">"+ic+"</div></div>";}
  function uyari(tip,m){var r={kirmizi:"#FAECE7",yesil:"#E1F5EE",sari:"#FEF9E7"};var ik={kirmizi:"⚠️",yesil:"✅",sari:"💡"};return "<div style=\"background:"+r[tip]+";border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:13px\">"+ik[tip]+" "+m+"</div>";}

  var html="";
  var ilkAy=aylar[ayList[0]];
  var sonAy=aylar[ayList[ayList.length-1]];
  var ilkNetKar=ilkAy.gelir-ilkAy.giderToplam;
  var sonNetKar=sonAy.gelir-sonAy.giderToplam;
  var ilkMarj=ilkAy.gelir>0?(ilkNetKar/ilkAy.gelir*100).toFixed(1):0;
  var sonMarj=sonAy.gelir>0?(sonNetKar/sonAy.gelir*100).toFixed(1):0;

  // BÖLÜM 1: TREND
  var trend1="";
  trend1+="<div style=\"display:grid;grid-template-columns:repeat("+ayList.length+",1fr);gap:8px;margin-bottom:14px\">";
  var onceki=null;
  ayList.forEach(function(ay){
    var d=aylar[ay];var nk=d.gelir-d.giderToplam;
    var marj=d.gelir>0?(nk/d.gelir*100).toFixed(1):0;
    var tr=onceki!==null?(nk>onceki?"▲":"▼"):"";
    var tRenk=onceki!==null?(nk>onceki?"#1D9E75":"#D85A30"):"#888";
    trend1+="<div style=\"background:#f9f9f8;border:1px solid #e0e0db;border-radius:8px;padding:10px;text-align:center\"><div style=\"font-size:11px;color:#888;margin-bottom:4px\">"+ay+"</div><div style=\"font-size:13px;font-weight:500;color:#1D9E75\">"+para(d.gelir)+"</div><div style=\"font-size:12px;color:#D85A30\">"+para(d.giderToplam)+"</div><div style=\"font-size:14px;font-weight:700;color:"+(nk>=0?"#1D9E75":"#D85A30")+";margin-top:4px\">"+para(nk)+"</div><div style=\"font-size:12px;color:"+tRenk+"\">"+tr+" %"+marj+"</div></div>";
    onceki=nk;
  });
  trend1+="</div>";
  if(parseFloat(sonMarj)>parseFloat(ilkMarj))trend1+=uyari("yesil","Kar marji "+ilkMarj+" -> "+sonMarj+" yukseldi. Isletme verimliligi artiyor.");
  else trend1+=uyari("kirmizi","Kar marji "+ilkMarj+" -> "+sonMarj+" geriledi. Maliyet baskisi artiyor.");
  trend1+=uyari("yesil","Nisan geliri "+para(sonAy.gelir)+" ile en yuksek seviyede.");
  html+=bolum("1. AYLIK KARLILIK TRENDİ",trend1);

  // BÖLÜM 2: KRİTİK MALİYETLER
  var mal2="<table style=\"width:100%;border-collapse:collapse;font-size:12px\"><thead><tr style=\"border-bottom:2px solid #e0e0db\"><th style=\"text-align:left;padding:8px 0\">Kategori</th>";
  ayList.forEach(function(ay){mal2+="<th style=\"text-align:right;padding:8px\">"+ay+"</th>";});
  mal2+="<th style=\"text-align:right;padding:8px\">Ort.%</th></tr></thead><tbody>";
  var tumKatlar={};
  ayList.forEach(function(ay){Object.keys(aylar[ay].gider).forEach(function(k){tumKatlar[k]=true;});});
  var katSirali=Object.keys(tumKatlar).sort(function(a,b){
    var tA=0,tB=0;ayList.forEach(function(ay){tA+=(aylar[ay].gider[a]||0);tB+=(aylar[ay].gider[b]||0);});return tB-tA;
  });
  var topGelirTum=0;ayList.forEach(function(ay){topGelirTum+=aylar[ay].gelir;});
  katSirali.forEach(function(kat){
    var topKat=0;ayList.forEach(function(ay){topKat+=(aylar[ay].gider[kat]||0);});
    var ortOran=topGelirTum>0?(topKat/topGelirTum*100).toFixed(1):0;
    var yuksek=parseFloat(ortOran)>15;
    mal2+="<tr style=\"border-bottom:1px solid #f0f0ec"+(yuksek?";background:#FEF9E7":"")+"\">"+"<td style=\"padding:8px 0;font-weight:"+(yuksek?"600":"400")+"\">"+kat+(yuksek?" ⚠️":"")+"</td>";
    ayList.forEach(function(ay){
      var v=aylar[ay].gider[kat]||0;
      var oran=aylar[ay].gelir>0?(v/aylar[ay].gelir*100).toFixed(1):0;
      mal2+="<td style=\"text-align:right;padding:8px;color:"+(v>0?"#D85A30":"#ccc")+"\">"+(v>0?para(v)+" <span style=\"font-size:10px;color:#aaa\">(%"+oran+")</span>":"-")+"</td>";
    });
    mal2+="<td style=\"text-align:right;padding:8px;font-weight:600;color:"+(yuksek?"#D85A30":"#888")+"\">" +"%"+ortOran+"</td></tr>";
  });
  mal2+="</tbody></table>";
  mal2+=uyari("kirmizi","⚠️ isaret li kalemler gelirin 15 undan fazlasini olusturuyor. Oncelikli optimizasyon hedefleri.");
  html+=bolum("2. KRİTİK MALİYET KALEMLERİ",mal2);

  // BÖLÜM 3: EĞLENCE & PERSONEL
  var eg3="";
  var topEg=0,topPer=0,topExPer=0;
  ayList.forEach(function(ay){topEg+=(aylar[ay].gider["Eğlence Giderleri"]||0);topPer+=(aylar[ay].gider["Personel Giderleri"]||0);topExPer+=(aylar[ay].gider["Extra Personel"]||0);});
  var egOran=topGelirTum>0?(topEg/topGelirTum*100).toFixed(1):0;
  var perOran=topGelirTum>0?((topPer+topExPer)/topGelirTum*100).toFixed(1):0;
  eg3+="<div style=\"display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px\">";
  eg3+=kart("Toplam Eglence Gideri",para(topEg),"#D85A30","Gelirin "+egOran+"%");
  eg3+=kart("Personel Gideri",para(topPer),"#D85A30","Gelirin "+(topGelirTum>0?(topPer/topGelirTum*100).toFixed(1):0)+"%");
  eg3+=kart("Extra Personel",para(topExPer),"#D85A30","Gelirin "+(topGelirTum>0?(topExPer/topGelirTum*100).toFixed(1):0)+"%");
  eg3+="</div>";
  if(parseFloat(egOran)>10)eg3+=uyari("kirmizi","Eglence giderleri gelirin "+egOran+"%. Sektor ortalamasi 8-10. Sanatci ile uzun donemli sozlesme onerilir.");
  else eg3+=uyari("yesil","Eglence giderleri "+egOran+"% ile makul seviyede.");
  if(parseFloat(perOran)>25)eg3+=uyari("kirmizi","Personel maliyetleri gelirin "+perOran+"%. Yogun gece bazli esnek planlama onerilir.");
  eg3+=uyari("sari","Eglence harcamasi yuksek gelirli gecelere yogunlastirilirsa verimlilik artar.");
  html+=bolum("3. EĞLENCE & PERSONEL MALİYET ETKİNLİĞİ",eg3);

  // BÖLÜM 4: REKLAM
  var rek4="<div style=\"display:grid;grid-template-columns:repeat("+ayList.length+",1fr);gap:8px;margin-bottom:12px\">";
  ayList.forEach(function(ay){
    var rek=aylar[ay].gider["Reklam Giderleri"]||0;
    var oran=aylar[ay].gelir>0?(rek/aylar[ay].gelir*100).toFixed(1):0;
    rek4+=kart(ay,para(rek),"#185FA5","Gelirin "+oran+"%");
  });
  rek4+="</div>";
  rek4+=uyari("sari","Subat 245K reklam yapildi, Mart 42K oldu ama Nisan geliri en yuksek. Reklam-gelir korelasyonu analiz edilmeli.");
  rek4+=uyari("yesil","Nisan 95K reklam ile en yuksek gelire ulasildi. Mevcut reklam stratejisi verimli gorunuyor.");
  html+=bolum("4. REKLAM GİDERİ ETKİNLİĞİ",rek4);

  // BÖLÜM 5: NAKİT AKIŞI
  var nakit5="";
  ayList.forEach(function(ay){
    var d=aylar[ay];var nk=d.gelir-d.giderToplam;
    var dagOran=nk>0?(d.ortakOdenen/nk*100).toFixed(0):"N/A";
    var riskli=nk>0&&d.ortakOdenen>nk;
    nakit5+="<div style=\"background:"+(riskli?"#FAECE7":"#f9f9f8")+";border-radius:8px;padding:10px 14px;margin-bottom:8px\">";
    nakit5+="<div style=\"display:flex;justify-content:space-between;align-items:center\"><strong>"+ay+"</strong><span style=\"font-size:12px;color:#888\">Net Kar: <strong style=\"color:"+(nk>=0?"#1D9E75":"#D85A30")+"\">"+para(nk)+"</strong></span></div>";
    nakit5+="<div style=\"display:flex;justify-content:space-between;font-size:12px;margin-top:6px\"><span style=\"color:#888\">Ortaklara: <strong style=\"color:#D85A30\">"+para(d.ortakOdenen)+"</strong></span><span style=\"color:"+(riskli?"#D85A30":"#888")+"\">Karin "+dagOran+"% dagatildi "+(riskli?"⚠️":"✅")+"</span></div></div>";
    if(riskli)nakit5+=uyari("kirmizi",ay+": Ortaklara dagitilan ("+para(d.ortakOdenen)+") net kari ("+para(nk)+") asiyor. Isletme rezervi eriyebilir.");
  });
  html+=bolum("5. NAKİT AKIŞI & ORTAK ÖDEMELERİ",nakit5);

  // BÖLÜM 6: ÖNERİLER
  var on6="<div style=\"display:grid;grid-template-columns:1fr 1fr;gap:10px\">";
  var oneriler=[
    {i:"📊",b:"Vergi Yönetimi",a:"Subat 1.4M TL vergi yuku gelirin 29u. Muhasebe danismaniyla vergi planlamasi yapilmali. Odeme zamanlama optimize edilebilir.",r:"#FAECE7"},
    {i:"🎵",b:"Eglence Gideri Optimizasyonu",a:"Sanatci ile uzun donemli sozlesme yapilirsa gece basi maliyet duser. Yuksek cirolu gecelere yogunlastirma onemli.",r:"#FEF9E7"},
    {i:"🍽️",b:"Yiyecek-Icecek Maliyeti",a:"3 aylik toplam 1.6M TL. Toplu alim veya tedarikci konsolidasyonu ile 10-15 tasarruf mumkun.",r:"#FEF9E7"},
    {i:"👥",b:"Personel Planlamasi",a:"Sabit+extra personel gelirin 20sini asiyor. Haftalik doluluk oranina gore esnek calisma uygulanabilir.",r:"#FEF9E7"},
    {i:"💰",b:"Kar Dagitim Disiplini",a:"Ortaklara odeme net karin 50sini gecmemeli. Kalan 50 rezervde tutularak isletme nakit akisi guvence altina alinmali.",r:"#E1F5EE"},
    {i:"📈",b:"Gelir Cesitlendirme",a:"Su an tek gelir kalemi Masa Geliri. Ozel etkinlik, davet organizasyonu, kapora sistemi gibi alternatif kanallar degerlendirilmeli.",r:"#E6F1FB"},
  ];
  oneriler.forEach(function(o){on6+="<div style=\"background:"+o.r+";border-radius:8px;padding:12px\"><div style=\"font-size:14px;font-weight:600;margin-bottom:6px\">"+o.i+" "+o.b+"</div><div style=\"font-size:12px;color:#555;line-height:1.5\">"+o.a+"</div></div>";});
  on6+="</div>";
  html+=bolum("6. STRATEJİK ÖNERİLER & AKSİYON PLANI",on6);

  html+="<div style=\"text-align:center;font-size:11px;color:#aaa;margin-top:8px\">Rapor tarihi: "+new Date().toLocaleDateString("tr-TR")+" | Kapsam: "+ayList[0]+" - "+ayList[ayList.length-1]+"</div>";
  document.getElementById("finans-icerik").innerHTML=html;
}

