// ==========================================================
// KAYIT İNCELEME MODÜLÜ - v2 (Modern UI)
// ==========================================================

var _incelemeKayitlar = [];
var _incelemeKategoriler = [];
var _incelemeSonuc = [];

async function incelemeSekmeAc(){
  var kats = await dbGet('kategoriler','select=*&order=tur.asc,ad.asc');
  _incelemeKategoriler = kats || [];
  incelemeKategoriDoldur();

  var geriBtn = document.getElementById('inc-geri-btn');
  if(window._incAcGun){
    var t = window._incAcGun;
    window._incAcGun = null;
    document.getElementById('inc-bas').value = t;
    document.getElementById('inc-bit').value = t;
    document.querySelectorAll('.inc-chip').forEach(function(c){ c.classList.remove('active'); });
    if(geriBtn) geriBtn.style.display = '';
  } else {
    if(geriBtn) geriBtn.style.display = 'none';
    var bitis = new Date();
    var baslangic = new Date();
    baslangic.setDate(baslangic.getDate() - 30);
    document.getElementById('inc-bas').value = baslangic.toISOString().slice(0,10);
    document.getElementById('inc-bit').value = bitis.toISOString().slice(0,10);
    var btn30 = document.querySelector('.inc-chip[data-tip="30gun"]');
    if(btn30) btn30.classList.add('active');
  }

  incelemeAra();
}

function incelemeKategoriDoldur(){
  var sel = document.getElementById('inc-kat');
  sel.innerHTML = '<option value="">Tüm kategoriler</option>';
  _incelemeKategoriler.forEach(function(k){
    var opt = document.createElement('option');
    opt.value = k.ad;
    opt.textContent = k.ad;
    sel.appendChild(opt);
  });
}

async function incelemeAra(){
  var bas = document.getElementById('inc-bas').value;
  var bit = document.getElementById('inc-bit').value;
  if(!bas || !bit){ alert('Tarih aralığı seçin'); return; }
  if(bas > bit){ alert('Başlangıç tarihi bitiş tarihinden büyük olamaz'); return; }

  document.getElementById('inc-tbody').innerHTML = '<tr><td colspan="5" class="inc-loading">Yükleniyor...</td></tr>';

  var kayitlar = await dbGet('kayitlar','tarih=gte.'+bas+'&tarih=lte.'+bit+'&order=tarih.desc,id.desc');
  _incelemeKayitlar = kayitlar || [];
  incelemeFiltreleVeGoster();
}

function incelemeFiltreleVeGoster(){
  var tur = document.getElementById('inc-tur').value;
  var kat = document.getElementById('inc-kat').value;
  var firma = (document.getElementById('inc-firma').value||'').trim().toLocaleLowerCase('tr');
  var odeme = document.getElementById('inc-odeme').value;
  var arama = (document.getElementById('inc-arama').value||'').trim().toLocaleLowerCase('tr');

  _incelemeSonuc = _incelemeKayitlar.filter(function(k){
    if(tur && k.tur !== tur) return false;
    if(kat && k.kat !== kat) return false;
    if(odeme && k.odeme !== odeme) return false;
    if(firma){
      var kfirma = (k.firma||'').toLocaleLowerCase('tr');
      if(kfirma.indexOf(firma) === -1) return false;
    }
    if(arama){
      var metin = ((k.firma||'') + ' ' + (k.aciklama||'') + ' ' + (k.kat||'')).toLocaleLowerCase('tr');
      if(metin.indexOf(arama) === -1) return false;
    }
    return true;
  });

  incelemeRender(_incelemeSonuc);
  incelemeOzet(_incelemeSonuc);
}

function incelemeRender(liste){
  var tbody = document.getElementById('inc-tbody');
  if(liste.length === 0){
    tbody.innerHTML = '<tr><td colspan="5" class="inc-empty"><div class="inc-empty-icon">📭</div><div class="inc-empty-title">Kayıt bulunamadı</div><div class="inc-empty-sub">Tarih aralığını veya filtreleri değiştirin</div></td></tr>';
    document.getElementById('inc-sayac').textContent = '0';
    return;
  }

  var html = '';
  liste.forEach(function(k){
    var isGelir = k.tur === 'gelir';
    var tarihGoster = k.tarih ? k.tarih.split('-') : ['','',''];
    var gun = tarihGoster[2]||'';
    var ay = tarihAy(tarihGoster[1]||'');
    html += '<tr class="inc-row '+(isGelir?'inc-gelir':'inc-gider')+'">'+
      '<td class="inc-tarih-col"><div class="inc-gun">'+gun+'</div><div class="inc-ay">'+ay+'</div></td>'+
      '<td class="inc-aciklama-col">'+
        '<div class="inc-firma-line">'+(k.firma||'<span class="inc-muted">—</span>')+'</div>'+
        '<div class="inc-alt-line">'+
          '<span class="inc-tag inc-tag-'+(isGelir?'in':'out')+'">'+(isGelir?'Gelir':'Gider')+'</span>'+
          (k.kat?'<span class="inc-sep">·</span><span class="inc-kat">'+k.kat+'</span>':'')+
          (k.aciklama?'<span class="inc-sep">·</span><span class="inc-desc">'+k.aciklama+'</span>':'')+
        '</div>'+
      '</td>'+
      '<td class="inc-odeme-col"><span class="inc-pill inc-pill-'+odemeKlas(k.odeme)+'">'+(k.odeme||'-')+'</span></td>'+
      '<td class="inc-tutar-col '+(isGelir?'inc-pos':'inc-neg')+'">'+(isGelir?'+':'−')+' '+para(k.tutar)+'</td>'+
      '<td class="inc-islem-col">'+
        '<button class="inc-btn inc-btn-edit" onclick="incelemeDuzenle('+k.id+')" title="Düzenle">✎</button>'+
        '<button class="inc-btn inc-btn-del" onclick="incelemeSil('+k.id+')" title="Sil">✕</button>'+
      '</td>'+
    '</tr>';
  });
  tbody.innerHTML = html;
  document.getElementById('inc-sayac').textContent = liste.length;
}

function tarihAy(ay){
  var aylar = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  return aylar[parseInt(ay,10)-1] || ay;
}

function odemeKlas(o){
  if(!o) return 'diger';
  if(o.toLowerCase().indexOf('nakit')>=0) return 'nakit';
  if(o.toLowerCase().indexOf('kart')>=0) return 'kart';
  if(o.toLowerCase().indexOf('havale')>=0) return 'havale';
  return 'diger';
}

function incelemeOzet(liste){
  var gelir = 0, gider = 0;
  liste.forEach(function(k){
    if(k.tur === 'gelir') gelir += Number(k.tutar)||0;
    else gider += Number(k.tutar)||0;
  });
  var net = gelir - gider;
  document.getElementById('inc-k-gelir').textContent = para(gelir);
  document.getElementById('inc-k-gider').textContent = para(gider);
  document.getElementById('inc-k-net').textContent = para(net);
  var netKart = document.getElementById('inc-k-net-kart');
  if(netKart){
    netKart.classList.remove('inc-kpi-pos','inc-kpi-neg');
    netKart.classList.add(net>=0?'inc-kpi-pos':'inc-kpi-neg');
  }
}

async function incelemeSil(id){
  if(!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
  var r = await dbDelete('kayitlar','id',id);
  if(!r.ok){ alert('Silme hatası: '+r.status); return; }
  try{ await auditLog('SIL','kayitlar',id,null,null,'Kayıt silindi (inceleme)'); }catch(e){}
  _incelemeKayitlar = _incelemeKayitlar.filter(function(k){ return k.id !== id; });
  incelemeFiltreleVeGoster();
  if(typeof renderKasa === 'function') renderKasa();
  if(typeof renderOzet === 'function') renderOzet();
}

function incelemeTemizle(){
  document.getElementById('inc-tur').value = '';
  document.getElementById('inc-kat').value = '';
  document.getElementById('inc-firma').value = '';
  document.getElementById('inc-odeme').value = '';
  document.getElementById('inc-arama').value = '';
  incelemeFiltreleVeGoster();
}

function incelemeHizliTarih(tip){
  var bitis = new Date();
  var baslangic = new Date();
  if(tip === 'bugun'){}
  else if(tip === '7gun'){ baslangic.setDate(baslangic.getDate() - 7); }
  else if(tip === '30gun'){ baslangic.setDate(baslangic.getDate() - 30); }
  else if(tip === 'buay'){ baslangic = new Date(bitis.getFullYear(), bitis.getMonth(), 1); }
  else if(tip === 'gecenay'){
    baslangic = new Date(bitis.getFullYear(), bitis.getMonth()-1, 1);
    bitis = new Date(bitis.getFullYear(), bitis.getMonth(), 0);
  }
  else if(tip === 'buyil'){ baslangic = new Date(bitis.getFullYear(), 0, 1); }
  document.getElementById('inc-bas').value = baslangic.toISOString().slice(0,10);
  document.getElementById('inc-bit').value = bitis.toISOString().slice(0,10);

  document.querySelectorAll('.inc-chip').forEach(function(c){ c.classList.remove('active'); });
  var btn = document.querySelector('.inc-chip[data-tip="'+tip+'"]');
  if(btn) btn.classList.add('active');

  incelemeAra();
}

async function incelemeDuzenle(id){
  if(typeof kayitlar === 'undefined'){ window.kayitlar = []; }
  var found = kayitlar.find(function(k){ return k.id===id; });
  if(!found){
    var kayit = _incelemeKayitlar.find(function(k){ return k.id===id; });
    if(kayit) kayitlar.push(kayit);
  }
  kasaDuzenle(id);
}
