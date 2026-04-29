// ============================================================
// YEDEKFON — Yedek fon hareketleri
// ============================================================

var _fonDuzId=null;

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

async function fonSil(id){
  if(!confirm('Bu hareketi silmek istediğinize emin misiniz?'))return;
  var eski=fonHareketler.find(function(h){return h.id===id;});
  var r=await dbDelete('yedek_fon','id',id);
  if(!r.ok){alert('Silme hatası!');return;}
  try{ await auditLog('SIL','yedek_fon',id,eski,null,'Yedek fon hareketi silindi'); }catch(e){}
  fonHareketler=fonHareketler.filter(function(h){return h.id!==id;});
  renderFon();
}

function fonDuzenle(id){
  var h=fonHareketler.find(function(x){return x.id===id;});
  if(!h)return;
  _fonDuzId=id;
  document.getElementById('fon-duz-tarih').value=h.tarih||'';
  document.getElementById('fon-duz-islem').value=h.islem||'giris';
  document.getElementById('fon-duz-tutar').value=h.tutar||'';
  document.getElementById('fon-duz-aciklama').value=h.aciklama||'';
  document.getElementById('fon-duz-modal').classList.add('open');
}

function fonDuzKapat(){
  document.getElementById('fon-duz-modal').classList.remove('open');
  _fonDuzId=null;
}

async function fonDuzKaydet(){
  if(!_fonDuzId)return;
  var tarih=document.getElementById('fon-duz-tarih').value;
  var tutar=parseFloat(document.getElementById('fon-duz-tutar').value);
  if(!tarih||isNaN(tutar)||tutar<=0){alert('Tarih ve tutar zorunludur.');return;}
  var gunc={tarih:tarih,islem:document.getElementById('fon-duz-islem').value,tutar:tutar,aciklama:document.getElementById('fon-duz-aciklama').value.trim()};
  var eski=fonHareketler.find(function(h){return h.id===_fonDuzId;});
  var r=await dbPatch('yedek_fon','id',_fonDuzId,gunc);
  if(!r.ok){alert('Güncelleme hatası!');return;}
  try{ await auditLog('GUNCELLE','yedek_fon',_fonDuzId,eski,gunc,'Yedek fon hareketi güncellendi'); }catch(e){}
  var idx=fonHareketler.findIndex(function(x){return x.id===_fonDuzId;});
  if(idx>=0)Object.assign(fonHareketler[idx],gunc);
  fonDuzKapat();
  renderFon();
}

function renderFon(){
  var bakiye=0;
  var tbody=document.getElementById('fon-tablo'),emp=document.getElementById('fon-empty');
  if(!fonHareketler.length){tbody.innerHTML='';emp.style.display='block';document.getElementById('fon-bakiye-val').textContent=para(0);return;}
  emp.style.display='none';
  fonHareketler.forEach(function(h){bakiye+=h.islem==='giris'?Number(h.tutar):-Number(h.tutar);});
  document.getElementById('fon-bakiye-val').textContent=para(bakiye);
  var cumBakiye=0;
  tbody.innerHTML=fonHareketler.map(function(h){
    var isG=h.islem==='giris';
    cumBakiye+=isG?Number(h.tutar):-Number(h.tutar);
    return '<tr>'+
      '<td>'+fmtT(h.tarih)+'</td>'+
      '<td><span class="badge" style="background:'+(isG?'#E1F5EE':'#FAECE7')+';color:'+(isG?'#0F6E56':'#993C1D')+'">'+(isG?'Giriş':'Çıkış')+'</span></td>'+
      '<td style="text-align:right;font-weight:500;color:'+(isG?'#1D9E75':'#D85A30')+'">'+para(h.tutar)+'</td>'+
      '<td style="color:#888">'+(h.aciklama||'-')+'</td>'+
      '<td style="text-align:right;color:#185FA5;font-weight:500">'+para(cumBakiye)+'</td>'+
      '<td style="text-align:right;white-space:nowrap">'+
        '<button onclick="fonDuzenle('+h.id+')" style="background:none;border:none;cursor:pointer;color:#185FA5;font-size:12px;padding:2px 6px;border-radius:4px" title="Düzenle">✏️</button>'+
        '<button onclick="fonSil('+h.id+')" style="background:none;border:none;cursor:pointer;color:#D85A30;font-size:12px;padding:2px 6px;border-radius:4px" title="Sil">🗑️</button>'+
      '</td>'+
    '</tr>';
  }).join('');
}
