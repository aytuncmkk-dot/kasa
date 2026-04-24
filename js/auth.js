// ============================================================
// AUTH — Google giriş/çıkış & oturum kontrolü
// ============================================================

function googleGiris(){
  var redirectTo=encodeURIComponent('https://aytuncmkk-dot.github.io/kasa/');
  window.location.href=SB_AUTH_URL+'/auth/v1/authorize?provider=google&redirect_to='+redirectTo;
}

function cikisYap(){
  localStorage.removeItem('sb_access_token');
  localStorage.removeItem('sb_refresh_token');
  window.location.reload();
}

async function oturumKontrol(){
  var hash=window.location.hash;
  var params=new URLSearchParams(hash.replace('#',''));
  var accessToken=params.get('access_token');
  if(accessToken){
    localStorage.setItem('sb_access_token',accessToken);
    window.history.replaceState(null,'',window.location.pathname);
  }else{
    accessToken=localStorage.getItem('sb_access_token');
  }
  if(!accessToken){
    document.getElementById('giris-ekrani').style.display='flex';
    return false;
  }
  try{
    var r=await fetch(SB_AUTH_URL+'/auth/v1/user',{
      headers:{'apikey':SB_AUTH_KEY,'Authorization':'Bearer '+accessToken}
    });
    if(!r.ok){
      localStorage.removeItem('sb_access_token');
      document.getElementById('giris-ekrani').style.display='flex';
      return false;
    }
    var user=await r.json();
    mevcutKullanici=user;
    isAdmin=ADMIN_EMAILS.indexOf(user.email)>=0;
    // Izinli degil ise engelle
    if(IZINLI_EMAILS.indexOf(user.email)<0){
      localStorage.removeItem('sb_access_token');
      document.getElementById('giris-ekrani').style.display='flex';
      document.getElementById('giris-hata').textContent='Bu hesap ile giris yapma yetkiniz yok.';
      document.getElementById('giris-hata').style.display='block';
      return false;
    }
    document.getElementById('conn-txt').textContent=(isAdmin?'Admin: ':'Kullanici: ')+user.email;
    SB_H['Authorization']='Bearer '+accessToken;
    if(isAdmin){
      var td=document.getElementById('tab-denetim');if(td)td.style.display='inline-block';
      var mp=document.getElementById('migrasyon-panel');if(mp)mp.style.display='block';
    }
    if(!isAdmin){
      // Sadece rapor ve kar dagilim goster
      var gizlenecek=['kasa','fatura','yedekfon','stok','maliyet','denetim'];
      gizlenecek.forEach(function(t){
        var btn=document.querySelector('.tab[onclick*="'+t+'"]');
        if(btn)btn.style.display='none';
      });
      // Formları gizle
      document.querySelectorAll('.fb').forEach(function(el){el.style.display='none';});
      switchTab('rapor');
    }
    // Çıkış butonu
    var cb=document.createElement('button');
    cb.textContent='Çıkış';
    cb.className='btn';
    cb.style.cssText='font-size:11px;padding:4px 8px';
    cb.onclick=cikisYap;
    var tb=document.querySelector('.topbar');
    if(tb)tb.appendChild(cb);
    document.getElementById('giris-ekrani').style.display='none';
    return true;
  }catch(e){
    localStorage.removeItem('sb_access_token');
    document.getElementById('giris-ekrani').style.display='flex';
    return false;
  }
}

