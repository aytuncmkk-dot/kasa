// ============================================================
// VALIDASYON — FAZ 1 / Adım 2
// Veri doğrulama katmanı: tarih, tutar, zorunlu alan
// DB hata mesajlarını Türkçeleştirme
// ============================================================

function validTarih(tarih){
  if(!tarih) return {ok:false, msg:'Tarih zorunludur.'};
  var bugun = ldStr(new Date());
  if(tarih > bugun) return {ok:false, msg:'İleri tarihli kayıt yapılamaz. Tarih bugünden sonra olamaz.'};
  if(tarih < '2020-01-01') return {ok:false, msg:'Tarih 2020-01-01 tarihinden önce olamaz.'};
  return {ok:true};
}

function validTutar(tutar, alanAdi){
  alanAdi = alanAdi || 'Tutar';
  var t = parseFloat(tutar);
  if(isNaN(t)) return {ok:false, msg:alanAdi + ' sayısal bir değer olmalıdır.'};
  if(t <= 0) return {ok:false, msg:alanAdi + ' sıfırdan büyük olmalıdır. Negatif veya sıfır tutar girilemez.'};
  return {ok:true};
}

function validZorunlu(deger, alanAdi){
  if(!deger || !String(deger).trim()) return {ok:false, msg:alanAdi + ' alanı boş bırakılamaz.'};
  return {ok:true};
}

// Birden çok validasyonu çalıştırır, hata listesi döner
function validCalistir(kontroller){
  var hatalar = [];
  for(var i = 0; i < kontroller.length; i++){
    if(!kontroller[i].ok) hatalar.push(kontroller[i].msg);
  }
  return hatalar;
}

// Supabase DB hatalarını Türkçeleştir
function dbHataMesaji(hataMetni){
  if(!hataMetni) return 'Bilinmeyen hata.';
  var h = String(hataMetni).toLowerCase();
  if(h.indexOf('duplicate_kayit') >= 0) return 'DUPLICATE';
  if(h.indexOf('chk_') >= 0 && h.indexOf('tutar_pozitif') >= 0) return 'Tutar sıfırdan büyük olmalıdır.';
  if(h.indexOf('chk_') >= 0 && h.indexOf('tarih_gecerli') >= 0) return 'Tarih geçersiz. (2020-bugün arası olmalı)';
  if(h.indexOf('chk_') >= 0 && h.indexOf('tur_gecerli') >= 0) return 'Tür alanı yalnızca gelir/gider olabilir.';
  if(h.indexOf('chk_') >= 0 && h.indexOf('odeme_dolu') >= 0) return 'Ödeme tipi boş olamaz.';
  if(h.indexOf('chk_') >= 0 && h.indexOf('miktar_pozitif') >= 0) return 'Miktar sıfırdan büyük olmalıdır.';
  return hataMetni;
}

// Hata kutusunu göster
function hataGoster(kutuId, hatalar){
  var el = document.getElementById(kutuId);
  if(!el) { alert('Hata:\n- ' + hatalar.join('\n- ')); return; }
  el.innerHTML = '<strong>Kayıt yapılamadı:</strong><ul>' +
    hatalar.map(function(h){ return '<li>' + h + '</li>'; }).join('') +
    '</ul>';
  el.classList.add('show');
  // 5 saniye sonra otomatik gizle
  clearTimeout(el._hataTimer);
  el._hataTimer = setTimeout(function(){ hataTemizle(kutuId); }, 8000);
}

function hataTemizle(kutuId){
  var el = document.getElementById(kutuId);
  if(!el) return;
  el.innerHTML = '';
  el.classList.remove('show');
}

// Duplicate uyarısı — kullanıcıya sor
function duplicateUyari(){
  return confirm('⚠️ DUPLICATE UYARISI\n\nBu kayıt daha önce girilmiş olabilir.\nAynı tarih, firma, tutar ve ödeme tipine sahip bir kayıt mevcut.\n\nYine de kaydetmek istiyor musunuz?');
}
