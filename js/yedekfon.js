// ============================================================
// YEDEKFON — Yedek fon hareketleri
// ============================================================

async function fonKaydet(){
  var tarih=document.getElementById('fon-tarih').value;
  var tutar=parseFloat(document.getElementById('fon-tutar').value);
  if(!tarih||isNaN(tutar)||tutar<=0){alert('Tarih ve tutar zorunludur.');return;}
  var yeni={tarih:tarih,islem:document.getElementById('fon-islem').value,tutar:tutar,aciklama:document.getElementById('fon-aciklama').value.trim()};
  var r=await dbPost('yedek_fon',[yeni]);
  if(!r.ok){alert('Kayıt hatası!');return;}
  try{ await auditLog('EKLE','yedek_fon',null,null,yeni,'Yedek fon hareketi'); }catch(e){}
  document.getElementById('fon-tutar').value='';
  document.getElementById('fon-aciklama').value='';
  await yukle();
}

function renderFon(){
  var bakiye=0;
  var satirlar=fonHareketler.slice().reverse();
  var tbody=document.getElementById('fon-tablo'),emp=document.getElementById('fon-empty');
  if(!fonHareketler.length){tbody.innerHTML='';emp.style.display='block';document.getElementById('fon-bakiye-val').textContent=para(0);return;}
  emp.style.display='none';
  // Bakiye hesapla
  satirlar.forEach(function(h){bakiye+=h.islem==='giris'?Number(h.tutar):-Number(h.tutar);});
  document.getElementById('fon-bakiye-val').textContent=para(bakiye);
  // Ters sıralı göster
  var cumBakiye=0;
  var rows=fonHareketler.slice().reverse().map(function(h){
    cumBakiye+=h.islem==='giris'?Number(h.tutar):-Number(h.tutar);
    return h;
  }).reverse();
  cumBakiye=bakiye;
  tbody.innerHTML=fonHareketler.map(function(h){
    var isG=h.islem==='giris';
    return '<tr>'+
      '<td>'+fmtT(h.tarih)+'</td>'+
      '<td><span class="badge" style="background:'+(isG?'#E1F5EE':'#FAECE7')+';color:'+(isG?'#0F6E56':'#993C1D')+'">'+(isG?'Giriş':'Çıkış')+'</span></td>'+
      '<td style="text-align:right;font-weight:500;color:'+(isG?'#1D9E75':'#D85A30')+'">'+para(h.tutar)+'</td>'+
      '<td style="color:#888">'+(h.aciklama||'-')+'</td>'+
      '<td style="text-align:right;color:#185FA5;font-weight:500">'+para(bakiye)+'</td>'+
    '</tr>';
  }).join('');
}

