// ============================================================
// DB — Supabase REST çağrıları
// ============================================================

// ANON FALLBACK YOK. Token yoksa istek atılmaz, hata fırlatılır (fail-loud).
// Eskiden: 'Bearer '+(t||SB_KEY) → token ölünce istek sessizce anon rolüyle gidiyordu.
function getSBH(){
  var t=localStorage.getItem('sb_access_token');
  if(!t){
    if(typeof oturumaDon==='function')oturumaDon('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
    throw new Error('Oturum yok — istek gönderilmedi.');
  }
  return {'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+t};
}

// İstek öncesi token hazırlığı: yoksa hata, süresi dolmak üzereyse yenile.
// tokenYenile() (auth.js) in-flight guard'lıdır → 15 paralel çağrı tek refresh isteği atar.
async function sbTokenHazirla(){
  var t=localStorage.getItem('sb_access_token');
  if(!t){
    if(typeof oturumaDon==='function')oturumaDon('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
    throw new Error('Oturum yok — istek gönderilmedi.');
  }
  if(typeof tokenSuresiDoluyor==='function'&&tokenSuresiDoluyor()){
    var ok=(typeof tokenYenile==='function')?await tokenYenile():false;
    if(!ok){
      if(typeof oturumaDon==='function')oturumaDon('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
      throw new Error('Oturum yenilenemedi — istek gönderilmedi.');
    }
  }
}

// Tek fetch denemesi — header'ı her seferinde yeniden üretir (yenilenmiş token'ı alsın diye)
function sbGonder(url,opt,ekHeader){
  var o={};
  if(opt&&opt.method)o.method=opt.method;
  if(opt&&opt.body!==undefined)o.body=opt.body;
  o.headers=Object.assign({},getSBH(),ekHeader||{});
  return fetch(url,o);
}

// Tüm REST istekleri buradan geçer.
// 401 gelirse EN FAZLA 1 kez yenile + tekrar dene; yine 401 ise oturumu düşür.
// Retry bayrağı yok — ikinci deneme sonrası döngü kapanır, sonsuz döngü imkânsız.
async function sbFetch(url,opt,ekHeader){
  await sbTokenHazirla();
  var r=await sbGonder(url,opt,ekHeader);
  if(r.status!==401)return r;
  var ok=await tokenYenile();
  if(!ok){
    oturumaDon('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
    throw new Error('Oturum sona erdi (401).');
  }
  r=await sbGonder(url,opt,ekHeader);
  if(r.status===401){
    oturumaDon('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');
    throw new Error('Oturum sona erdi (401, yenileme sonrası).');
  }
  return r;
}

async function dbGet(tablo,params){
  var r=await sbFetch(SB_URL+'/rest/v1/'+tablo+'?'+params,null,null);
  if(!r.ok)throw new Error(tablo+' okuma hatası: '+r.status);
  return await r.json();
}

async function dbGetAll(tablo,params){
  var all=[],from=0,pageSize=1000;
  while(true){
    var EK={'Range-Unit':'items','Range':from+'-'+(from+pageSize-1)};
    var r=await sbFetch(SB_URL+'/rest/v1/'+tablo+'?'+params,null,EK);
    if(r.status===416)break;
    if(!r.ok)throw new Error(tablo+' okuma hatası: '+r.status);
    var rows=await r.json();
    all=all.concat(rows);
    if(rows.length<pageSize)break;
    from+=pageSize;
  }
  return all;
}

async function dbPost(tablo,data){
  // Tek obje gonder - array degil
  var obj=Array.isArray(data)?data[0]:data;
  var body=JSON.stringify(obj);
  var r=await sbFetch(SB_URL+'/rest/v1/'+tablo,{method:'POST',body:body},{'Prefer':'return=minimal'});
  if(!r.ok){var t=await r.text();console.error('dbPost hata:',tablo,r.status,t);}
  return r;
}

async function dbPatch(tablo,col,val,data){
  var r=await sbFetch(SB_URL+'/rest/v1/'+tablo+'?'+col+'=eq.'+val,{method:'PATCH',body:JSON.stringify(data)},null);
  return r;
}

async function dbDelete(tablo,col,val){
  var r=await sbFetch(SB_URL+'/rest/v1/'+tablo+'?'+col+'=eq.'+val,{method:'DELETE'},null);
  return r;
}
