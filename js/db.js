// ============================================================
// DB — Supabase REST çağrıları
// ============================================================

function getSBH(){var t=localStorage.getItem('sb_access_token');return {'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+(t||SB_KEY)};}

async function dbGet(tablo,params){
  var r=await fetch(SB_URL+'/rest/v1/'+tablo+'?'+params,{headers:getSBH()});
  if(!r.ok)throw new Error(tablo+' okuma hatası: '+r.status);
  return await r.json();
}

async function dbPost(tablo,data){
  var H=Object.assign({},getSBH(),{'Prefer':'return=minimal'});
  // Tek obje gonder - array degil
  var obj=Array.isArray(data)?data[0]:data;
  var body=JSON.stringify(obj);
  var r=await fetch(SB_URL+'/rest/v1/'+tablo,{method:'POST',headers:H,body:body});
  if(!r.ok){var t=await r.text();console.error('dbPost hata:',tablo,r.status,t);}
  return r;
}

async function dbPatch(tablo,col,val,data){
  var r=await fetch(SB_URL+'/rest/v1/'+tablo+'?'+col+'=eq.'+val,{method:'PATCH',headers:getSBH(),body:JSON.stringify(data)});
  return r;
}

async function dbDelete(tablo,col,val){
  var r=await fetch(SB_URL+'/rest/v1/'+tablo+'?'+col+'=eq.'+val,{method:'DELETE',headers:getSBH()});
  return r;
}

