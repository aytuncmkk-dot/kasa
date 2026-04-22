// ============================================================
// INIT — Uygulama başlangıcı
// ============================================================

// Sayfa yüklendiğinde oturumu kontrol et, giriş varsa verileri yükle
oturumKontrol().then(function(girisYapildi){
  if(girisYapildi) yukle();
});
