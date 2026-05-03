// ============================================================
// UTILS — Yardımcı fonksiyonlar (para, tarih formatı)
// ============================================================

function para(v){return 'TL '+Number(v||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});}

// Yerel tarih string'i — toISOString() UTC'ye çevirdiği için timezone kayması yapar, bu kullanılmalı
function ldStr(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}

function fmtT(s){try{return new Date(s+'T00:00:00').toLocaleDateString('tr-TR');}catch(e){return s||'';}}

function uid(){return Math.floor(Math.random()*900000000)+100000000;}

// Personel kaydı firma adındaki ödeme yöntemi eklerini temizler
// "APO - BANKA", "apo elden", "GARSONLAR BANKA" → "APO", "APO", "GARSONLAR"
function normalizePersonelAdi(str) {
  if (!str || !str.trim()) return 'Diğer';
  var s = str.toUpperCase().trim();
  s = s.replace(/\s*[-–]\s*(BANKA|ELDEN|AVANS|MAAŞ)$/i, '');
  s = s.replace(/\s+(BANKA|ELDEN|AVANS|MAAŞ)$/i, '');
  s = s.trim();
  if (s === 'KEREM SELVİ') s = 'KEREM SELVİLİ';
  if (s === 'SERHAR OSGB' || s === 'SERHAT - OSGB') s = 'SERHAT OSGB';
  return s || 'Diğer';
}

function setBag(ok){
  document.getElementById('dot').className='dot '+(ok?'ok':'err');
  document.getElementById('conn-txt').textContent=ok?'Bağlı':'Bağlantı yok';
}

