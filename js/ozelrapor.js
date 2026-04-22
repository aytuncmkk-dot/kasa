// ============================================================
// OZELRAPOR — Özel kategori bazlı rapor
// ============================================================

function renderOzelRapor(){
  var seciliKatlar=[];
  document.querySelectorAll('.ozel-kat-cb:checked').forEach(function(cb){seciliKatlar.push(cb.value);});
  if(seciliKatlar.length===0){
    document.getElementById('ozel-sonuc').innerHTML='<div class="empty">Lutfen en az bir kategori secin.</div>';
    return;
  }
  var list=getRaporListe();
  var gid=list.filter(function(k){return k.tur==='gider';});
  var gel=list.filter(function(k){return k.tur==='gelir';});
  var totGelir=gel.reduce(function(s,k){return s+Number(k.tutar);},0);
  var html='<div style="background:#fff;border:1px solid #e0e0db;border-radius:10px;overflow:hidden">';
  var toplamSecili=0;
  seciliKatlar.forEach(function(kat){
    var kayitlar_kat=gid.filter(function(k){return k.kat===kat;});
    var toplam=kayitlar_kat.reduce(function(s,k){return s+Number(k.tutar);},0);
    toplamSecili+=toplam;
    var oran=totGelir>0?((toplam/totGelir)*100).toFixed(1):0;
    var uid='oz_'+kat.replace(/[^a-zA-Z0-9]/g,'_');
    var gruplar={};
    kayitlar_kat.forEach(function(k){
      var key=(k.aciklama&&k.aciklama.trim())?k.aciklama.trim():(k.firma&&k.firma.trim()?k.firma.trim():'Diger');
      gruplar[key]=(gruplar[key]||0)+Number(k.tutar);
    });
    var detaylar=Object.keys(gruplar).sort(function(a,b){return gruplar[b]-gruplar[a];}).map(function(key){
      return {key:key,val:gruplar[key],pct:toplam>0?((gruplar[key]/toplam)*100).toFixed(0):0};
    });
    html+=accordionSatir(uid,kat,toplam,oran,'#D85A30',detaylar);
  });
  html+='<div style="display:flex;justify-content:space-between;padding:10px 14px;background:#f5f5f3;font-weight:700">'+
    '<span>TOPLAM</span><span style="color:#D85A30">'+para(toplamSecili)+'</span>'+
  '</div>';
  html+='</div>';
  document.getElementById('ozel-sonuc').innerHTML=html;
}

function ozelRaporKatGuncelle(){
  var div=document.getElementById('ozel-kat-list');
  if(!div)return;
  var tumKatlar=giderKatlar.map(function(k){return k.ad;}).filter(function(k){return k!=='Ortaklara Odenen';});
  div.innerHTML=tumKatlar.map(function(k){
    return '<label style="display:flex;align-items:center;gap:6px;padding:5px 0;cursor:pointer;font-size:13px"><input type="checkbox" class="ozel-kat-cb" value="'+k+'"> '+k+'</label>';
  }).join('');
}

