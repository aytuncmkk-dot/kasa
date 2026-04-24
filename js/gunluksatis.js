// ==========================================================
// GÜNLÜK SATIŞ RAPORU
// ==========================================================

var _gsGelir = [];
var _gsGider = [];
var _gsSortKol = 'tarih';
var _gsSortAsc = false;
var _gsGeriDon = false;

async function gunlukSatisAc(){
  if(_gsGeriDon){ _gsGeriDon = false; return; }
  var bitis = new Date();
  var baslangic = new Date();
  baslangic.setDate(baslangic.getDate() - 30);
  document.getElementById('gs-bas').value = baslangic.toISOString().slice(0,10);
  document.getElementById('gs-bit').value = bitis.toISOString().slice(0,10);
  gunlukSatisYukle();
}

function gsGeriDon(){
  _gsGeriDon = true;
  switchTab('gunluksatis');
}

async function gunlukSatisYukle(){
  var bas = document.getElementById('gs-bas').value;
  var bit = document.getElementById('gs-bit').value;
  if(!bas || !bit){ alert('Tarih aralığı seçin'); return; }
  if(bas > bit){ alert('Başlangıç > bitiş olamaz'); return; }

  document.getElementById('gs-tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:#6b7280">Yükleniyor...</td></tr>';

  var q = 'tarih=gte.'+bas+'&tarih=lte.'+bit+'&order=tarih.desc';
  var sonuclar = await Promise.all([
    dbGet('kayitlar', q+'&tur=eq.gelir'),
    dbGet('kayitlar', q+'&tur=eq.gider')
  ]);
  _gsGelir = sonuclar[0] || [];
  _gsGider = sonuclar[1] || [];
  gunlukSatisRender();
}

function gunlukSatisRender(){
  var gelirGrup = {};
  _gsGelir.forEach(function(k){
    var t = k.tarih;
    if(!gelirGrup[t]) gelirGrup[t] = { nakit:0, kart:0, havale:0, diger:0, kisi:0, _ids:{} };
    var g = gelirGrup[t];
    var tutar = Number(k.tutar)||0;
    var odeme = (k.odeme||'').toLowerCase();
    if(odeme.indexOf('nakit')>=0)       g.nakit  += tutar;
    else if(odeme.indexOf('kart')>=0)   g.kart   += tutar;
    else if(odeme.indexOf('havale')>=0) g.havale += tutar;
    else                                g.diger  += tutar;
    if(Number(k.kisi_sayisi)>0 && !g._ids[k.id]){
      g.kisi += Number(k.kisi_sayisi);
      g._ids[k.id] = true;
    }
  });

  var giderGrup = {};
  _gsGider.forEach(function(k){
    var t = k.tarih;
    if(!giderGrup[t]) giderGrup[t] = 0;
    giderGrup[t] += Number(k.tutar)||0;
  });

  var tumTarihler = {};
  Object.keys(gelirGrup).forEach(function(t){ tumTarihler[t]=1; });
  Object.keys(giderGrup).forEach(function(t){ tumTarihler[t]=1; });

  var satirlar = Object.keys(tumTarihler).map(function(tarih){
    var g = gelirGrup[tarih] || { nakit:0, kart:0, havale:0, diger:0, kisi:0 };
    var gid = giderGrup[tarih] || 0;
    var gelir = g.nakit + g.kart + g.havale + g.diger;
    return { tarih:tarih, nakit:g.nakit, kart:g.kart, gelir:gelir, gider:gid, kisi:g.kisi };
  });

  satirlar.sort(function(a,b){
    var v = _gsSortKol === 'tarih' ? a.tarih.localeCompare(b.tarih)
          : (a[_gsSortKol]||0) - (b[_gsSortKol]||0);
    return _gsSortAsc ? v : -v;
  });

  // Header ok göstergeleri güncelle
  ['tarih','nakit','kart','gelir','gider','kisi'].forEach(function(kol){
    var el = document.getElementById('gs-th-'+kol);
    if(!el) return;
    var ok = kol === _gsSortKol ? (_gsSortAsc ? ' ▲' : ' ▼') : '';
    el.dataset.label = el.dataset.label || el.textContent.replace(/ [▲▼]$/,'');
    el.textContent = el.dataset.label + ok;
  });

  var tbody = document.getElementById('gs-tbody');
  if(satirlar.length === 0){
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#9ca3af">Bu aralıkta kayıt yok</td></tr>';
    ['gs-toplam-nakit','gs-toplam-kart','gs-toplam-gelir','gs-toplam-gider'].forEach(function(id){
      document.getElementById(id).textContent = para(0);
    });
    document.getElementById('gs-toplam-kisi').textContent = '0';
    document.getElementById('gs-gun-sayisi').textContent = '0';
    return;
  }

  var tN=0, tK=0, tGelir=0, tGider=0, tKisi=0;
  var html = '';
  satirlar.forEach(function(s){
    tN += s.nakit; tK += s.kart; tGelir += s.gelir; tGider += s.gider; tKisi += s.kisi;
    var tarihStr = s.tarih.split('-').reverse().join('.');
    var gun = ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'][new Date(s.tarih).getDay()];
    html += '<tr style="border-bottom:1px solid #f3f4f6;cursor:pointer" onclick="gsGunuAc(\''+s.tarih+'\')">'+
      '<td style="padding:10px 12px"><div style="font-weight:600">'+tarihStr+'</div><div style="font-size:11px;color:#6b7280">'+gun+'</div></td>'+
      '<td style="padding:10px 12px;text-align:right;font-variant-numeric:tabular-nums;color:#166534">'+para(s.nakit)+'</td>'+
      '<td style="padding:10px 12px;text-align:right;font-variant-numeric:tabular-nums;color:#1e40af">'+para(s.kart)+'</td>'+
      '<td style="padding:10px 12px;text-align:right;font-weight:600;font-variant-numeric:tabular-nums">'+para(s.gelir)+'</td>'+
      '<td style="padding:10px 12px;text-align:right;font-variant-numeric:tabular-nums;color:#dc2626">'+para(s.gider)+'</td>'+
      '<td style="padding:10px 12px;text-align:center;color:#6b7280">'+(s.kisi||'-')+'</td>'+
    '</tr>';
  });
  tbody.innerHTML = html;

  document.getElementById('gs-toplam-nakit').textContent  = para(tN);
  document.getElementById('gs-toplam-kart').textContent   = para(tK);
  document.getElementById('gs-toplam-gelir').textContent  = para(tGelir);
  document.getElementById('gs-toplam-gider').textContent  = para(tGider);
  document.getElementById('gs-toplam-kisi').textContent   = tKisi;
  document.getElementById('gs-gun-sayisi').textContent    = satirlar.length;
}

function gsGunuAc(tarih){
  window._incAcGun = tarih;
  switchTab('inceleme');
}

function gsSirala(kol){
  if(_gsSortKol === kol){ _gsSortAsc = !_gsSortAsc; }
  else { _gsSortKol = kol; _gsSortAsc = kol !== 'tarih'; }
  gunlukSatisRender();
}

function gsHizliTarih(tip){
  var bitis = new Date();
  var baslangic = new Date();
  if(tip==='7gun')       baslangic.setDate(baslangic.getDate()-7);
  else if(tip==='30gun') baslangic.setDate(baslangic.getDate()-30);
  else if(tip==='buay')  baslangic = new Date(bitis.getFullYear(), bitis.getMonth(), 1);
  else if(tip==='gecenay'){
    baslangic = new Date(bitis.getFullYear(), bitis.getMonth()-1, 1);
    bitis     = new Date(bitis.getFullYear(), bitis.getMonth(), 0);
  }
  else if(tip==='buyil') baslangic = new Date(bitis.getFullYear(), 0, 1);
  document.getElementById('gs-bas').value = baslangic.toISOString().slice(0,10);
  document.getElementById('gs-bit').value = bitis.toISOString().slice(0,10);
  gunlukSatisYukle();
}
