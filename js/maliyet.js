// ============================================================
// MALIYET — Operasyonel maliyet raporu
// ============================================================

function renderMaliyet(){
  var tip=document.getElementById('m-tip').value;
  var list=kayitlar.filter(function(k){
    if(tip==='ay')return k.tarih.startsWith(document.getElementById('m-ay').value);
    if(tip==='aralik'){var b=document.getElementById('m-bas').value,s=document.getElementById('m-son').value;if(b&&s)return k.tarih>=b&&k.tarih<=s;return true;}
    if(tip==='yil')return k.tarih.startsWith(document.getElementById('m-yil').value);
    return true;
  });
  var gel=list.filter(function(k){return k.tur==='gelir';});
  var gid=list.filter(function(k){return k.tur==='gider';});
  var topGelir=gel.reduce(function(s,k){return s+Number(k.tutar);},0);
  function katTop(kat){return gid.filter(function(k){return k.kat===kat;}).reduce(function(s,k){return s+Number(k.tutar);},0);}
  var gruplar=[
    {baslik:'YİYECEK & İÇECEK',katlar:['Yiyecek Giderleri','İçecek Giderleri']},
    {baslik:'PERSONEL',katlar:['Personel Giderleri','Extra Personel']},
    {baslik:'EĞLENCE',katlar:['Eğlence Giderleri']},
    {baslik:'SABİT GİDERLER',katlar:['Sabit Giderler','Kadıköy Belediyesi','Banka Giderleri','Kredi Ödemeleri','İletişim Giderleri','Muhasebe Giderleri','MÜYAP','Reklam Giderleri','Temizlik Giderleri','Tamir & Tadilat']},
  ];
  var topMaliyet=0;
  gruplar.forEach(function(g){g.katlar.forEach(function(k){topMaliyet+=katTop(k);});});
  var netKar=topGelir-topMaliyet;
  var karMarji=topGelir>0?((netKar/topGelir)*100):0;
  var html='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">';
  html+='<div class="ok"><div class="ok-label">Toplam Gelir</div><div class="ok-val gc">'+para(topGelir)+'</div></div>';
  html+='<div class="ok"><div class="ok-label">Toplam Maliyet</div><div class="ok-val rc">'+para(topMaliyet)+'</div></div>';
  html+='<div class="ok"><div class="ok-label">Net Kar</div><div class="ok-val '+(netKar>=0?'gc':'rc')+'">'+para(netKar)+'</div></div>';
  html+='<div class="ok"><div class="ok-label">Kar Marjı</div><div class="ok-val '+(karMarji>=0?'gc':'rc')+'">'+karMarji.toFixed(1)+'%</div></div>';
  html+='</div>';
  html+='<div class="tw"><table><thead><tr><th>Kategori</th><th style="text-align:right;width:130px">Tutar</th><th style="text-align:right;width:100px">Gelire Oran</th></tr></thead><tbody>';
  gruplar.forEach(function(grup){
    var grupTop=grup.katlar.reduce(function(s,k){return s+katTop(k);},0);
    var grupOran=topGelir>0?((grupTop/topGelir)*100).toFixed(1):0;
    html+='<tr style="background:#f5f5f3"><td style="font-weight:700;font-size:12px;color:#555">'+grup.baslik+'</td><td style="text-align:right;font-weight:700;color:#D85A30">'+para(grupTop)+'</td><td style="text-align:right;font-weight:700">%'+grupOran+'</td></tr>';
    grup.katlar.forEach(function(k){
      var v=katTop(k);
      if(v===0)return;
      var oran=topGelir>0?((v/topGelir)*100).toFixed(1):0;
      html+='<tr><td style="padding-left:24px;font-size:12px;color:#555">'+k+'</td><td style="text-align:right;color:#D85A30">'+para(v)+'</td><td style="text-align:right;color:#888">%'+oran+'</td></tr>';
    });
  });
  html+='<tr style="border-top:2px solid #e0e0db;background:#f9f9f8"><td style="font-weight:700">TOPLAM MALİYET</td><td style="text-align:right;font-weight:700;color:#D85A30">'+para(topMaliyet)+'</td><td style="text-align:right;font-weight:700">%'+(topGelir>0?((topMaliyet/topGelir)*100).toFixed(1):0)+'</td></tr>';
  html+='<tr style="background:'+(netKar>=0?'#E1F5EE':'#FAECE7')+'"><td style="font-weight:700;color:'+(netKar>=0?'#0F6E56':'#993C1D')+'">NET KAR</td><td style="text-align:right;font-weight:700;color:'+(netKar>=0?'#1D9E75':'#D85A30')+'">'+para(netKar)+'</td><td style="text-align:right;font-weight:700;color:'+(netKar>=0?'#1D9E75':'#D85A30')+'">%'+karMarji.toFixed(1)+'</td></tr>';
  html+='</tbody></table></div>';
  document.getElementById('m-icerik').innerHTML=html;
}

