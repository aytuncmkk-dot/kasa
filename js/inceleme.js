// ==========================================================
// KAYIT İNCELEME MODÜLÜ
// Kasa kayıtlarını tarih aralığı ve diğer filtrelerle görüntüle
// ==========================================================

var _incelemeKayitlar = [];
var _incelemeKategoriler = [];

// İlk açılışta filtreleri hazırla ve son 30 günü getir
async function incelemeSekmeAc(){
  // Kategorileri yükle (filtre dropdown'u için)
  var kats = await dbGet('kategoriler','aktif=eq.true&order=ad.asc');
  _incelemeKategoriler = kats || [];
  incelemeKategoriDoldur();

  // Varsayılan tarih: son 30 gün
  var bitis = new Date();
  var baslangic = new Date();
  baslangic.setDate(baslangic.getDate() - 30);
  document.getElementById('inc-bas').value = baslangic.toISOString().slice(0,10);
  document.getElementById('inc-bit').value = bitis.toISOString().slice(0,10);

  // İlk arama
  incelemeAra();
}

function incelemeKategoriDoldur(){
  var sel = document.getElementById('inc-kat');
  sel.innerHTML = '<option value="">— Tüm Kategoriler —</option>';
  _incelemeKategoriler.forEach(function(k){
    var opt = document.createElement('option');
    opt.value = k.ad;
    opt.textContent = k.ad + ' (' + k.tur + ')';
    sel.appendChild(opt);
  });
}

async function incelemeAra(){
  var bas = document.getElementById('inc-bas').value;
  var bit = document.getElementById('inc-bit').value;
  if(!bas || !bit){ alert('Tarih aralığı seçin'); return; }
  if(bas > bit){ alert('Başlangıç tarihi bitiş tarihinden büyük olamaz'); return; }

  document.getElementById('inc-durum').textContent = 'Yükleniyor...';

  // Tarih filtresi Supabase'de, diğerleri client-side
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

  var sonuc = _incelemeKayitlar.filter(function(k){
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

  incelemeRender(sonuc);
  incelemeOzet(sonuc);
}

function incelemeRender(liste){
  var tbody = document.getElementById('inc-tbody');
  if(liste.length === 0){
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:#888">Kayıt bulunamadı</td></tr>';
    document.getElementById('inc-durum').textContent = '0 kayıt';
    return;
  }

  var html = '';
  liste.forEach(function(k){
    var isGelir = k.tur === 'gelir';
    var renk = isGelir ? '#1D9E75' : '#D85A30';
    var tarihGoster = k.tarih ? k.tarih.split('-').reverse().join('.') : '';
    html += '<tr>'+
      '<td>'+tarihGoster+'</td>'+
      '<td><span style="padding:2px 8px;border-radius:4px;background:'+(isGelir?'#E8F5EE':'#FDEBE3')+';color:'+renk+';font-size:11px;font-weight:600">'+(isGelir?'GELİR':'GİDER')+'</span></td>'+
      '<td>'+(k.kat||'-')+'</td>'+
      '<td>'+(k.firma||'-')+'</td>'+
      '<td>'+(k.odeme||'-')+'</td>'+
      '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+(k.aciklama||'').replace(/"/g,'&quot;')+'">'+(k.aciklama||'-')+'</td>'+
      '<td style="text-align:right;font-weight:600;color:'+renk+'">'+(isGelir?'+':'−')+' '+para(k.tutar)+'</td>'+
      '<td style="white-space:nowrap">'+
        '<button class="edit-btn" onclick="kasaDuzenle('+k.id+')" title="Düzenle">✎</button>'+
        '<button class="del-btn" onclick="incelemeSil('+k.id+')" title="Sil">✕</button>'+
      '</td>'+
    '</tr>';
  });
  tbody.innerHTML = html;
  document.getElementById('inc-durum').textContent = liste.length + ' kayıt gösteriliyor';
}

function incelemeOzet(liste){
  var gelir = 0, gider = 0;
  liste.forEach(function(k){
    if(k.tur === 'gelir') gelir += Number(k.tutar)||0;
    else gider += Number(k.tutar)||0;
  });
  var net = gelir - gider;
  document.getElementById('inc-ozet-gelir').textContent = para(gelir);
  document.getElementById('inc-ozet-gider').textContent = para(gider);
  document.getElementById('inc-ozet-net').textContent = para(net);
  document.getElementById('inc-ozet-net').style.color = net >= 0 ? '#1D9E75' : '#D85A30';
}

// Sil — mevcut kasaSil'i çağır, sonra listeyi yenile
async function incelemeSil(id){
  if(!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
  var r = await dbDelete('kayitlar','id',id);
  if(!r.ok){ alert('Silme hatası: '+r.status); return; }
  try{ await auditLog('SIL','kayitlar',id,null,null,'Kayıt silindi (inceleme)'); }catch(e){}
  // Yerel listeden de çıkar
  _incelemeKayitlar = _incelemeKayitlar.filter(function(k){ return k.id !== id; });
  incelemeFiltreleVeGoster();
  // Kasa tablosu açıksa onu da tazele
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

// Hızlı tarih ön ayarları
function incelemeHizliTarih(tip){
  var bitis = new Date();
  var baslangic = new Date();
  if(tip === 'bugun'){ /* aynı gün */ }
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
  incelemeAra();
}
