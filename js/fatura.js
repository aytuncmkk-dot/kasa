// ============================================================
// FATURA — Fatura girişi ve listesi
// ============================================================

async function faturaKaydet(){
  var tarih=document.getElementById('fat-tarih').value;
  var firma=document.getElementById('fat-firma').value.trim();
  var kat=document.getElementById('fat-kat').value;
  var tutar=parseFloat(document.getElementById('fat-tutar').value);
  var hatalar=[];
  if(!tarih)hatalar.push('Tarih');
  if(!firma)hatalar.push('Firma');
  if(!kat)hatalar.push('Kategori');
  if(isNaN(tutar)||tutar<=0)hatalar.push('Tutar');
  if(hatalar.length>0){alert('Zorunlu alanlar:\n- '+hatalar.join('\n- '));return;}
  var kdvTutar=parseFloat(document.getElementById('fat-kdv').value)||0;
  var yeni={tarih:tarih,firma:firma,fatura_no:document.getElementById('fat-no').value.trim(),vade:document.getElementById('fat-vade').value,kat:kat,aciklama:document.getElementById('fat-aciklama').value.trim(),tutar:tutar,kdv_tutar:kdvTutar,durum:'bekliyor'};
  var r=await dbPost('faturalar',[yeni]);
  if(!r.ok){alert('Fatura kayıt hatası: '+r.status);return;}
  try{ await auditLog('EKLE','faturalar',null,null,yeni,'Fatura kaydı'); }catch(e){}
  faturalar.unshift(yeni);
  ['fat-firma','fat-no','fat-vade','fat-aciklama','fat-tutar','fat-kdv'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('fat-kat').value='';
  renderFaturalar();updateFirmaList();
}

async function faturaOde(id){
  if(!confirm('Bu fatura ödendi olarak işaretlensin mi?'))return;
  var __eskiFat = faturalar.find(function(f){return f.id===id;});
  await dbPatch('faturalar','id',id,{durum:'odendi'});
  try{ await auditYaz('GUNCELLE','faturalar',id,__eskiFat,{durum:'odendi'},'Fatura ödendi olarak işaretlendi'); }catch(e){}
  var f=faturalar.find(function(x){return x.id==id;});
  if(f)f.durum='odendi';
  renderFaturalar();
}

async function faturaSil(id){
  if(!confirm('Bu faturayı silmek istediğinize emin misiniz?'))return;
  var silinen=faturalar.find(function(f){return f.id===id;});
  await dbDelete('faturalar','id',id);
  await auditLog('SIL','faturalar',id,silinen,null,'Fatura silindi');
  faturalar=faturalar.filter(function(f){return f.id!==id;});
  renderFaturalar();
}

function renderFaturalar(){
  var fD=document.getElementById('fat-f-durum').value;
  var fA=document.getElementById('fat-f-ay').value;
  var fil=faturalar.filter(function(f){
    return(!fD||f.durum===fD)&&(!fA||f.tarih.startsWith(fA));
  });
  var bekTop=faturalar.filter(function(f){return f.durum==='bekliyor';}).reduce(function(s,f){return s+Number(f.tutar);},0);
  var odeTop=faturalar.filter(function(f){return f.durum==='odendi';}).reduce(function(s,f){return s+Number(f.tutar);},0);
  var tbody=document.getElementById('fatura-tablo'),emp=document.getElementById('fatura-empty');
  if(!fil.length){tbody.innerHTML='';emp.style.display='block';return;}
  emp.style.display='none';
  tbody.innerHTML=fil.map(function(f){
    var bek=f.durum==='bekliyor';
    var vadeGec=bek&&f.vade&&f.vade<today;
    return '<tr>'+
      '<td>'+fmtT(f.tarih)+'</td>'+
      '<td><strong>'+f.firma+'</strong></td>'+
      '<td style="color:#888">'+(f.fatura_no||'-')+'</td>'+
      '<td style="color:#666;font-size:11px">'+(f.kat||'-')+'</td>'+
      '<td style="color:#888;font-size:11px">'+(f.aciklama||'-')+'</td>'+
      '<td style="color:'+(vadeGec?'#D85A30':'#888')+'">'+(f.vade?fmtT(f.vade)+(vadeGec?' (GEÇTİ)':''):'-')+'</td>'+
      '<td><span class="badge" style="background:'+(bek?'#FAECE7':'#E1F5EE')+';color:'+(bek?'#993C1D':'#0F6E56')+'">'+( bek?'Bekliyor':'Ödendi')+'</span></td>'+
      '<td style="text-align:right;font-weight:500;color:#D85A30">'+para(f.tutar)+'</td>'+
      '<td style="text-align:right;font-size:11px;color:#888">'+(f.kdv_tutar>0?para(f.kdv_tutar):'-')+'</td>'+
      '<td style="white-space:nowrap">'+
        (bek?'<button class="btn-sm btn-sm-b" onclick="faturaOde('+f.id+')" style="margin-right:4px">Ödendi</button>':'')+
        '<button class="btn-sm btn-sm-r" onclick="faturaSil('+f.id+')">Sil</button>'+
      '</td>'+
    '</tr>';
  }).join('');
}

