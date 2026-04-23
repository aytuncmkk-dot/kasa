// ============================================================
// AUDIT — Denetim log (audit_log)
// ============================================================

async function denetimKayitAc(kayitId){
  if(!kayitId) return;
  if(typeof kayitlar === 'undefined') window.kayitlar = [];
  var found = kayitlar.find(function(k){ return k.id == kayitId; });
  if(!found){
    var list = await dbGet('kayitlar', 'id=eq.'+kayitId);
    if(!list || !list.length){ alert('Bu kayıt artık mevcut değil (silinmiş olabilir).'); return; }
    kayitlar.push(list[0]);
  }
  kasaDuzenle(kayitId);
}

async function auditYukle(){
  try{
    auditLoglar = await dbGet('audit_log', '?order=islem_zamani.desc&limit=1000');
  }catch(e){
    console.error('Audit yukleme hatasi:', e);
    auditLoglar = [];
  }
}

function denetimTemizle(){
  document.getElementById('d-kul').value='';
  document.getElementById('d-tablo').value='';
  document.getElementById('d-islem').value='';
  document.getElementById('d-bas').value='';
  document.getElementById('d-bit').value='';
  renderDenetim();
}

async function auditLog(islemTipi, tabloAdi, kayitId, eskiDeger, yeniDeger, aciklama){
  try {
    var email = (mevcutKullanici && mevcutKullanici.email || 'BILINMEYEN').toUpperCase();
    await dbPost('audit_log', {
      kullanici_email: email,
      islem_tipi: islemTipi,
      tablo_adi: tabloAdi,
      kayit_id: kayitId || null,
      eski_deger: eskiDeger || null,
      yeni_deger: yeniDeger || null,
      aciklama: aciklama || null
    });
  } catch(e) {
    console.error('Audit log hatasi:', e);
  }
}

async function renderDenetim(){
  if(!isAdmin){
    document.getElementById('denetim-icerik').innerHTML='<div class="empty">Bu sekme sadece admin kullanicilari icindir.</div>';
    return;
  }
  try {
    var logs = await dbGet('audit_log?order=islem_zamani.desc&limit=500');
    if(!logs || !logs.length){
      document.getElementById('denetim-icerik').innerHTML='<div class="empty">Henuz denetim kaydi yok.</div>';
      return;
    }
    var html = '<div style="background:#1a1a1a;color:#fff;border-radius:10px;padding:12px 16px;margin-bottom:12px">';
    html += '<div style="font-size:11px;color:#aaa;margin-bottom:2px">DENETİM KAYITLARI</div>';
    html += '<div style="font-size:16px;font-weight:600">Son '+logs.length+' islem</div></div>';
    html += '<div class="tw"><table><thead><tr>';
    html += '<th style="width:140px">Tarih/Saat</th>';
    html += '<th>Kullanici</th>';
    html += '<th style="width:90px">Islem</th>';
    html += '<th style="width:100px">Tablo</th>';
    html += '<th>Detay</th>';
    html += '<th style="width:50px"></th>';
    html += '</tr></thead><tbody>';
    logs.forEach(function(l){
      var t = new Date(l.islem_zamani);
      var tStr = t.toLocaleDateString('tr-TR')+' '+t.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
      var islemRenk = {'EKLE':'#1D9E75','GUNCELLE':'#185FA5','SIL':'#D85A30'}[l.islem_tipi] || '#888';
      var detay = l.aciklama || '';
      if(l.yeni_deger && l.yeni_deger.tutar) detay += ' ('+para(l.yeni_deger.tutar)+')';
      var islemBtn = '';
      if(l.kayit_id && l.tablo_adi === 'kayitlar'){
        if(l.islem_tipi === 'SIL'){
          islemBtn = '<button style="background:none;border:1px solid #e5e7eb;color:#9ca3af;padding:2px 7px;border-radius:5px;font-size:11px;cursor:default" title="Kayıt silindi" disabled>✕</button>';
        } else {
          islemBtn = '<button onclick="denetimKayitAc('+l.kayit_id+')" style="background:none;border:1px solid #3b82f6;color:#3b82f6;padding:2px 7px;border-radius:5px;font-size:11px;cursor:pointer" title="Kaydı düzenle">✎</button>';
        }
      }
      html += '<tr>';
      html += '<td style="font-size:11px;color:#666">'+tStr+'</td>';
      html += '<td style="font-size:11px">'+l.kullanici_email+'</td>';
      html += '<td><span style="background:'+islemRenk+';color:#fff;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600">'+l.islem_tipi+'</span></td>';
      html += '<td style="font-size:11px;color:#666">'+l.tablo_adi+'</td>';
      html += '<td style="font-size:12px">'+detay+'</td>';
      html += '<td style="text-align:center">'+islemBtn+'</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    document.getElementById('denetim-icerik').innerHTML = html;
  } catch(e) {
    document.getElementById('denetim-icerik').innerHTML='<div class="empty">Hata: '+e.message+'</div>';
  }
}

