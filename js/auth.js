// ============================================================
// AUTH — Google giriş/çıkış & oturum kontrolü
// ============================================================

// Token yenileme yarış koruması (in-flight guard):
// aynı anda 15 tablo çekilirken 15 paralel refresh isteği ATILMAZ,
// hepsi tek bekleyen promise'i paylaşır.
var _tokenYenilemePromise = null;

function googleGiris(){
  var redirectTo=encodeURIComponent('https://aytuncmkk-dot.github.io/kasa/');
  window.location.href=SB_AUTH_URL+'/auth/v1/authorize?provider=google&redirect_to='+redirectTo;
}

// Oturum anahtarlarını yaz (access + refresh + bitiş zamanı)
function oturumKaydet(accessToken,refreshToken,expiresIn,expiresAt){
  if(!accessToken)return false;
  localStorage.setItem('sb_access_token',accessToken);
  if(refreshToken)localStorage.setItem('sb_refresh_token',refreshToken);
  var exp=0;
  if(expiresAt)exp=parseInt(expiresAt,10);
  else if(expiresIn)exp=Math.floor(Date.now()/1000)+parseInt(expiresIn,10);
  if(exp>0)localStorage.setItem('sb_expires_at',String(exp));
  return true;
}

// Oturum anahtarlarını sil
function oturumTemizle(){
  localStorage.removeItem('sb_access_token');
  localStorage.removeItem('sb_refresh_token');
  localStorage.removeItem('sb_expires_at');
}

// Oturumu düşür ve giriş ekranını göster (sessiz boş ekran YOK)
function oturumaDon(mesaj){
  oturumTemizle();
  var g=document.getElementById('giris-ekrani');
  if(g)g.style.display='flex';
  var h=document.getElementById('giris-hata');
  if(h){
    h.textContent=mesaj||'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.';
    h.style.display='block';
  }
  if(typeof setBag==='function')setBag(false);
}

// Token süresi doldu mu / dolmak üzere mi? (60 sn tampon)
// Bitiş zamanı bilinmiyorsa "yenilemek gerek" say — anon'a düşmek YASAK.
function tokenSuresiDoluyor(){
  var e=parseInt(localStorage.getItem('sb_expires_at')||'0',10);
  if(!e)return true;
  return (Date.now()/1000)>=(e-60);
}

// Refresh token ile yeni access token al.
// Dönüş: Promise<boolean>. Aynı anda çağrılırsa tek istek paylaşılır.
function tokenYenile(){
  if(_tokenYenilemePromise)return _tokenYenilemePromise;
  var rt=localStorage.getItem('sb_refresh_token');
  if(!rt){
    oturumTemizle();
    return Promise.resolve(false);
  }
  var p=fetch(SB_AUTH_URL+'/auth/v1/token?grant_type=refresh_token',{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':SB_AUTH_KEY},
    body:JSON.stringify({refresh_token:rt})
  }).then(function(r){
    if(!r.ok)return null;
    return r.json();
  }).then(function(j){
    if(!j||!j.access_token){
      oturumTemizle();
      return false;
    }
    oturumKaydet(j.access_token,j.refresh_token,j.expires_in,j.expires_at);
    return true;
  }).catch(function(e){
    console.error('tokenYenile hata:',e);
    oturumTemizle();
    return false;
  });
  _tokenYenilemePromise=p;
  // Promise bitince guard'ı sıfırla ki bir sonraki yenileme yapılabilsin
  p.then(function(){_tokenYenilemePromise=null;},function(){_tokenYenilemePromise=null;});
  return p;
}

function cikisYap(){
  oturumTemizle();
  window.location.reload();
}

async function oturumKontrol(){
  var hash=window.location.hash;
  var params=new URLSearchParams(hash.replace('#',''));
  var accessToken=params.get('access_token');
  if(accessToken){
    oturumKaydet(accessToken,params.get('refresh_token'),params.get('expires_in'),params.get('expires_at'));
    window.history.replaceState(null,'',window.location.pathname);
  }else{
    accessToken=localStorage.getItem('sb_access_token');
    // Süresi dolmuş/dolmak üzereyse önce yenile; olmazsa oturumsuz say
    if(accessToken&&tokenSuresiDoluyor()){
      var yenilendi=await tokenYenile();
      if(!yenilendi){
        oturumTemizle();
        accessToken=null;
      }else{
        accessToken=localStorage.getItem('sb_access_token');
      }
    }
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
      oturumTemizle();
      document.getElementById('giris-ekrani').style.display='flex';
      return false;
    }
    var user=await r.json();
    mevcutKullanici=user;
    isAdmin=ADMIN_EMAILS.indexOf(user.email)>=0;
    // Izinli degil ise engelle
    if(IZINLI_EMAILS.indexOf(user.email)<0){
      oturumTemizle();
      document.getElementById('giris-ekrani').style.display='flex';
      document.getElementById('giris-hata').textContent='Bu hesap ile giris yapma yetkiniz yok.';
      document.getElementById('giris-hata').style.display='block';
      return false;
    }
    document.getElementById('conn-txt').textContent=(isAdmin?'Admin: ':'Kullanici: ')+user.email;
    if(isAdmin){
      var td=document.getElementById('tab-denetim');if(td)td.style.display='inline-block';
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
    oturumTemizle();
    document.getElementById('giris-ekrani').style.display='flex';
    return false;
  }
}
