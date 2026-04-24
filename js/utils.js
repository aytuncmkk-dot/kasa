// ============================================================
// UTILS — Yardımcı fonksiyonlar (para, tarih formatı)
// ============================================================

function para(v){return 'TL '+Number(v||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});}

// Yerel tarih string'i — toISOString() UTC'ye çevirdiği için timezone kayması yapar, bu kullanılmalı
function ldStr(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}

function fmtT(s){try{return new Date(s+'T00:00:00').toLocaleDateString('tr-TR');}catch(e){return s||'';}}

function uid(){return Math.floor(Math.random()*900000000)+100000000;}

function setBag(ok){
  document.getElementById('dot').className='dot '+(ok?'ok':'err');
  document.getElementById('conn-txt').textContent=ok?'Bağlı':'Bağlantı yok';
}

