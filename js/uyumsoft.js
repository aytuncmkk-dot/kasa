// ================================================================
// UYUMSOFT ENTEGRASYONU
// Gelen fatura CSV'sini okur, kasa defterine yükler
// ================================================================

// -----------------------------------------------
// CSV PARSE — Türkçe ayırıcılar ve BOM destekli
// -----------------------------------------------
function uyumCsvParse(csvText) {
  // BOM'u temizle
  if (csvText.charCodeAt(0) === 0xFEFF) {
    csvText = csvText.substr(1);
  }
  
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { hatali: true, mesaj: 'CSV boş veya geçersiz' };
  
  const headers = lines[0].split(';').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';');
    if (values.length < 8) continue; // Geçersiz satır
    
    const row = {};
    headers.forEach((h, idx) => {
      let v = (values[idx] || '').trim();
      // Baştaki tek tırnağı temizle ('HKZ... → HKZ...)
      if (v.startsWith("'")) v = v.substr(1);
      row[h] = v;
    });
    rows.push(row);
  }
  
  return { hatali: false, headers, rows };
}

// -----------------------------------------------
// Uyumsoft CSV'sini kasa formatına çevir
// -----------------------------------------------
function uyumFaturaYapilandir(csvRow) {
  // Fatura Tarihi: "21.04.2026 10:49:04" → "2026-04-21"
  const tarihParts = (csvRow['Fatura Tarihi'] || '').split(' ')[0].split('.');
  let tarih = '';
  if (tarihParts.length === 3) {
    tarih = `${tarihParts[2]}-${tarihParts[1]}-${tarihParts[0]}`;
  }
  
  // Tutar: "16472,0000" → 16472.00
  const tutarStr = (csvRow['Ödenecek Tutar'] || '0').replace(',', '.');
  const tutar = parseFloat(tutarStr) || 0;
  
  return {
    tarih: tarih,
    firma: csvRow['Gönderici'] || '',
    vkn: csvRow['Gönderici VKN/TCKN'] || '',
    fatura_no: csvRow['Fatura No'] || '',
    ettn: csvRow['Doküman No'] || '',
    tutar: tutar,
    durum: csvRow['Fatura Durumu'] || 'Bilinmiyor',
    fatura_tipi: csvRow['Fatura Tipi'] || '',
    senaryo: csvRow['Senaryo Tipi'] || '',
    kaynak: 'uyumsoft'
  };
}

// -----------------------------------------------
// Kasa kayıtlarında eşleşen gider ara
// Fuzzy match: ±7 gün, %1 tutar toleransı
// -----------------------------------------------
// VERİ BÜTÜNLÜĞÜ: hata artık YUTULMUYOR. Eskiden 401/ağ hatası boş dizi dönüyordu →
// "kasada eşleşme yok" sanılıp mükerrer gider kaydı açılabiliyordu.
// Artık hata fırlatılır; çağıran (uyumSonrakiFatura) yüklemeyi durdurur.
async function uyumKasaEslesenAra(fatura) {
  const baslangic = new Date(fatura.tarih);
  baslangic.setDate(baslangic.getDate() - 7);
  const bitis = new Date(fatura.tarih);
  bitis.setDate(bitis.getDate() + 7);

  const bas = ldStr(baslangic);
  const bit = ldStr(bitis);

  const alanlar = 'id,tarih,firma,tutar,odeme,aciklama,fatura_id';
  const url = `${SB_URL}/rest/v1/kayitlar?select=${alanlar}&tur=eq.gider&tarih=gte.${bas}&tarih=lte.${bit}`;

  const res = await sbFetch(url, null, null);
  if (!res.ok) throw new Error('Kasa eşleşme araması başarısız: ' + res.status);

  const data = await res.json();
  // Tutar toleransı: %1
  const tolerans = Math.max(fatura.tutar * 0.01, 1);

  return data.filter(k => {
    const fark = Math.abs(parseFloat(k.tutar) - fatura.tutar);
    return fark <= tolerans;
  });
}

// -----------------------------------------------
// ETTN zaten var mı kontrol (kesin duplicate)
// -----------------------------------------------
// VERİ BÜTÜNLÜĞÜ: null SADECE "bu ETTN veritabanında yok" demektir.
// Hata (401/ağ/5xx) durumunda null DÖNMEZ, fırlatır — aksi halde çağıran
// "duplicate yok" sanıp aynı faturayı ikinci kez yazardı.
async function uyumEttnVarMi(ettn) {
  if (!ettn) return null;
  const url = `${SB_URL}/rest/v1/faturalar?select=id,firma,tarih,tutar&ettn=eq.${encodeURIComponent(ettn)}`;
  const res = await sbFetch(url, null, null);
  if (!res.ok) throw new Error('ETTN mükerrer kontrolü başarısız: ' + res.status);
  const data = await res.json();
  return data.length > 0 ? data[0] : null;
}

// -----------------------------------------------
// Faturayı kaydet
// -----------------------------------------------
async function uyumFaturaKaydet(fatura, kasaKayitId) {
  const payload = {
    tarih: fatura.tarih,
    firma: fatura.firma,
    fatura_no: fatura.fatura_no,
    ettn: fatura.ettn,
    vkn: fatura.vkn,
    tutar: fatura.tutar,
    durum: fatura.durum === 'Onaylandı' ? 'onayli' : 'bekliyor',
    kaynak: 'uyumsoft',
    odendi_mi: kasaKayitId ? true : false,
    odeme_kayit_id: kasaKayitId || null,
    kat: '',
    vade: '',
    aciklama: `${fatura.fatura_tipi} / ${fatura.senaryo}`.trim()
  };
  
  const res = await sbFetch(`${SB_URL}/rest/v1/faturalar`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }, { 'Prefer': 'return=representation' });

  if (!res.ok) {
    const hata = await res.text();
    throw new Error(hata);
  }

  const yeni = await res.json();
  const faturaId = Array.isArray(yeni) ? yeni[0].id : yeni.id;

  // Eğer kasa kaydı ile eşleştirilmişse, kayıtta da fatura_id'yi güncelle
  // VERİ BÜTÜNLÜĞÜ: res.ok kontrol edilir. 4xx dönerse bağ KURULMAMIŞTIR —
  // sessizce "eşleştirildi" saymak yerine hata fırlatılır. Hata nesnesine
  // faturaId iliştirilir ki çağıran yarım kalan fatura satırını geri alabilsin.
  if (kasaKayitId && faturaId) {
    var pRes = await sbFetch(`${SB_URL}/rest/v1/kayitlar?id=eq.${kasaKayitId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fatura_id: faturaId })
    }, null);
    if (!pRes.ok) {
      var pErr = new Error('Kasa kaydına fatura bağı yazılamadı (HTTP ' + pRes.status + ')');
      pErr.faturaId = faturaId;
      throw pErr;
    }
  }

  // Audit log
  if (typeof auditLog === 'function') {
    auditLog('fatura_eklendi', 'faturalar', faturaId, null, payload);
  }
  
  return faturaId;
}

// -----------------------------------------------
// Yeni kasa gideri oluştur (fatura için)
// -----------------------------------------------
async function uyumKasaGiderEkle(fatura, faturaId) {
  const payload = {
    tarih: fatura.tarih,
    firma: fatura.firma,
    tutar: fatura.tutar,
    tur: 'gider',
    odeme: 'Nakit',
    aciklama: `Uyumsoft: ${fatura.fatura_no}`,
    fatura_id: faturaId
  };
  
  const res = await sbFetch(`${SB_URL}/rest/v1/kayitlar`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }, { 'Prefer': 'return=representation' });

  if (!res.ok) throw new Error(await res.text());

  const yeni = await res.json();
  const kayitId = Array.isArray(yeni) ? yeni[0].id : yeni.id;

  // Faturayı ödendi olarak işaretle
  // VERİ BÜTÜNLÜĞÜ: res.ok kontrol edilir. Bu noktada kasa gideri ZATEN YAZILDI —
  // hata nesnesine kayitOlustu bayrağı iliştirilir; çağıran faturayı GERİ ALMAMALIDIR
  // (alırsa gider kaydı öksüz fatura_id ile kalır).
  if (kayitId && faturaId) {
    var fRes = await sbFetch(`${SB_URL}/rest/v1/faturalar?id=eq.${faturaId}`, {
      method: 'PATCH',
      body: JSON.stringify({ odendi_mi: true, odeme_kayit_id: kayitId })
    }, null);
    if (!fRes.ok) {
      var fErr = new Error('Fatura "ödendi" işareti güncellenemedi (HTTP ' + fRes.status + ')');
      fErr.kayitOlustu = true;
      fErr.kayitId = kayitId;
      throw fErr;
    }
  }

  if (typeof auditLog === 'function') {
    auditLog('kayit_eklendi', 'kayitlar', kayitId, null, payload);
  }
  
  return kayitId;
}

// -----------------------------------------------
// ANA İŞLEM: CSV dosyasını yükle
// -----------------------------------------------
let uyumState = {
  faturalar: [],
  currentIdx: 0,
  sonuc: { eklendi: 0, atlandi: 0, zatenVar: 0, esleştirildi: 0, hata: 0 }
};

async function uyumDosyaSec() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv';
  input.onchange = async (e) => {
    const dosya = e.target.files[0];
    if (!dosya) return;
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const csvText = evt.target.result;
      const parsed = uyumCsvParse(csvText);
      
      if (parsed.hatali) {
        alert('❌ CSV okunamadı: ' + parsed.mesaj);
        return;
      }
      
      // Yapılandır
      const faturalar = parsed.rows.map(uyumFaturaYapilandir).filter(f => f.tarih && f.fatura_no);
      
      if (faturalar.length === 0) {
        alert('⚠️ CSV\'de geçerli fatura bulunamadı');
        return;
      }
      
      // Önizleme bilgisi
      const toplam = faturalar.reduce((s, f) => s + f.tutar, 0);
      const devam = confirm(
        `📥 UYUMSOFT CSV YÜKLEME\n\n` +
        `Bulunan fatura: ${faturalar.length}\n` +
        `Toplam tutar: ${toplam.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL\n\n` +
        `Tarih aralığı: ${faturalar[faturalar.length-1].tarih} - ${faturalar[0].tarih}\n\n` +
        `Her faturayı tek tek onaylayacaksın. Devam?`
      );
      
      if (!devam) return;
      
      // State'i başlat
      uyumState.faturalar = faturalar;
      uyumState.currentIdx = 0;
      uyumState.sonuc = { eklendi: 0, atlandi: 0, zatenVar: 0, esleştirildi: 0, hata: 0 };
      
      // İlk faturayı göster
      uyumSonrakiFatura();
    };
    reader.readAsText(dosya, 'UTF-8');
  };
  input.click();
}

// -----------------------------------------------
// Güvenli durdurma: duplicate kontrolü yapılamadığında yüklemeyi kes
// (sessizce devam edip mükerrer kayıt yazmaktansa dur)
// -----------------------------------------------
function uyumYuklemeDurdur(neden, fatura, e, ekNot) {
  uyumState.sonuc.hata++;
  var mesaj = (e && e.message) ? e.message : String(e);
  var no = (fatura && fatura.fatura_no) ? fatura.fatura_no : '(no yok)';
  alert('❌ ' + neden + ' — yükleme durduruldu.\n\n' +
    'Fatura: ' + no + '\n' +
    'Hata: ' + mesaj + '\n\n' +
    (ekNot ? (ekNot + '\n\n') : '') +
    'Aynı faturanın ikinci kez yazılmaması için işlem durduruldu. ' +
    'Oturum/bağlantı düzeldikten sonra CSV\'yi yeniden yükleyin.');
  uyumSonucGoster();
}

// -----------------------------------------------
// Modal kapat (yardımcı)
// -----------------------------------------------
function uyumModalKapat() {
  var m = document.getElementById('uyumModal');
  if (m) m.remove();
}

// -----------------------------------------------
// GERİ ALMA: SADECE bu işlemde YENİ oluşturulmuş fatura satırını siler.
// ⚠ Tek satır, ID ile. Toplu/filtreli silme YOK.
// Dönüş: true = geri alındı, false = geri alınamadı (elle müdahale gerekir)
// -----------------------------------------------
async function uyumFaturaGeriAl(faturaId) {
  if (faturaId === null || faturaId === undefined || faturaId === '') return false;
  try {
    var res = await sbFetch(`${SB_URL}/rest/v1/faturalar?id=eq.${encodeURIComponent(String(faturaId))}`, {
      method: 'DELETE'
    }, null);
    if (!res.ok) return false;
    if (typeof auditLog === 'function') {
      auditLog('fatura_geri_alindi', 'faturalar', faturaId, null, { neden: 'kasa gideri yazilamadi - yarim kayit geri alindi' });
    }
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

// -----------------------------------------------
// YARIM KAYIT: geri alınamadı ya da geri alınmamalı.
// Yüklemeyi durdurur ve kullanıcıdan ELLE kontrol ister.
// -----------------------------------------------
function uyumYarimKaldiUyar(fatura, faturaId, kayitId, e) {
  uyumState.sonuc.hata++;
  var mesaj = (e && e.message) ? e.message : String(e);
  var no = (fatura && fatura.fatura_no) ? fatura.fatura_no : '(no yok)';
  var detay;
  if (kayitId) {
    detay = 'Fatura ve kasa kaydı VAR, ama aralarındaki "ödendi/fatura" bağı kurulamadı.\n' +
      'Fatura sekmesinden bu faturayı ilgili kasa kaydıyla ELLE eşleştir.';
  } else {
    detay = 'Fatura yazıldı ama kasa gideri YAZILAMADI ve fatura otomatik geri alınamadı.\n' +
      'Bu faturayı Fatura sekmesinden ELLE sil, ya da gideri Kasa\'ya ELLE gir.\n' +
      'Aksi halde defterde bu gider EKSİK kalır ve CSV yeniden yüklendiğinde fatura "zaten kayıtlı" sayılıp atlanır.';
  }
  alert('🔴 YARIM KAYIT — ELLE KONTROL GEREKİYOR\n\n' +
    'Fatura: ' + no + '\n' +
    'faturalar.id: ' + faturaId + '\n' +
    (kayitId ? ('kayitlar.id: ' + kayitId + '\n') : '') +
    'Hata: ' + mesaj + '\n\n' +
    detay + '\n\n' +
    'Yükleme durduruldu.');
  uyumSonucGoster();
}

// -----------------------------------------------
// Fatura + yeni kasa gideri — YARIM YAZMA BIRAKMAZ.
// Gider yazılamazsa, bu işlemde oluşturulan fatura satırı ID ile geri alınır.
// Dönüş: true = başarılı, false = yükleme durduruldu (currentIdx İLERLETİLMEZ)
// -----------------------------------------------
async function uyumFaturaVeGiderYaz(fatura) {
  var faturaId = null;
  try {
    faturaId = await uyumFaturaKaydet(fatura, null);
  } catch (e) {
    console.error(e);
    uyumModalKapat();
    uyumYuklemeDurdur('Fatura kaydedilemedi', fatura, e,
      'Bu faturaya ait hiçbir kayıt yazılmadı — defter tutarlı.');
    return false;
  }

  try {
    await uyumKasaGiderEkle(fatura, faturaId);
  } catch (e) {
    console.error(e);
    uyumModalKapat();
    // Gider kaydı yazıldıysa faturayı SİLME — gider öksüz fatura_id ile kalırdı.
    if (e && e.kayitOlustu) {
      uyumYarimKaldiUyar(fatura, faturaId, e.kayitId, e);
      return false;
    }
    var geriAlindi = await uyumFaturaGeriAl(faturaId);
    if (!geriAlindi) {
      uyumYarimKaldiUyar(fatura, faturaId, null, e);
      return false;
    }
    uyumYuklemeDurdur('Kasa gideri yazılamadı', fatura, e,
      'Defterde yarım kayıt kalmaması için bu faturanın kaydı GERİ ALINDI (faturalar #' + faturaId + ' silindi).');
    return false;
  }

  uyumState.sonuc.eklendi++;
  return true;
}

// -----------------------------------------------
// Bir sonraki faturayı işle
// -----------------------------------------------
async function uyumSonrakiFatura() {
  if (uyumState.currentIdx >= uyumState.faturalar.length) {
    uyumSonucGoster();
    return;
  }
  
  const fatura = uyumState.faturalar[uyumState.currentIdx];

  // ETTN kontrolü (kesin duplicate)
  // Hata = "duplicate yok" DEĞİLDİR. Kontrol yapılamıyorsa yükleme durdurulur;
  // aksi halde aynı fatura ikinci kez yazılabilir.
  var mevcut;
  try {
    mevcut = await uyumEttnVarMi(fatura.ettn);
  } catch (e) {
    uyumYuklemeDurdur('Mükerrer fatura (ETTN) kontrolü yapılamadı', fatura, e);
    return;
  }
  if (mevcut) {
    uyumState.sonuc.zatenVar++;
    uyumState.currentIdx++;
    uyumSonrakiFatura();
    return;
  }

  // Kasa'da olası eşleşme var mı?
  // Hata = "eşleşme yok" DEĞİLDİR — boş liste mükerrer gider kaydına yol açar.
  var eslesenler;
  try {
    eslesenler = await uyumKasaEslesenAra(fatura);
  } catch (e) {
    uyumYuklemeDurdur('Kasa eşleşme araması yapılamadı', fatura, e);
    return;
  }

  // Modal göster
  uyumModalGoster(fatura, eslesenler);
}

// -----------------------------------------------
// Onay Modal'ını göster
// -----------------------------------------------
function uyumModalGoster(fatura, eslesenler) {
  // Mevcut modal varsa temizle
  const eski = document.getElementById('uyumModal');
  if (eski) eski.remove();
  
  const toplamFatura = uyumState.faturalar.length;
  const currentNo = uyumState.currentIdx + 1;
  
  let eslesmeHtml = '';
  if (eslesenler.length > 0) {
    eslesmeHtml = `
      <div style="background:#fff3cd;border:2px solid #ffc107;border-radius:8px;padding:12px;margin:12px 0;">
        <b style="color:#856404;">⚠️ KASA'DA BENZER GİDER BULUNDU (${eslesenler.length} adet)</b>
        <div style="margin-top:8px;">
    `;
    eslesenler.forEach((e, i) => {
      const eT = new Date(e.tarih);
      const fT = new Date(fatura.tarih);
      const gunFark = Math.round((fT - eT) / (1000 * 60 * 60 * 24));
      const zatenBagli = e.fatura_id ? '🔗' : '';
      eslesmeHtml += `
        <label style="display:block;padding:8px;margin:4px 0;background:white;border-radius:4px;cursor:pointer;border:1px solid #ddd;">
          <input type="radio" name="eslesme" value="${e.id}" ${i === 0 ? 'checked' : ''} />
          <b>${zatenBagli} ${e.firma || '(firma yok)'}</b> - ${parseFloat(e.tutar).toLocaleString('tr-TR')} TL
          <br><small>📅 ${e.tarih} (${gunFark > 0 ? '+' : ''}${gunFark} gün) · 💰 ${e.odeme || ''} · ${e.aciklama || ''}</small>
        </label>
      `;
    });
    eslesmeHtml += `
        <label style="display:block;padding:8px;margin:4px 0;background:#e7f5ff;border-radius:4px;cursor:pointer;border:1px solid #339af0;">
          <input type="radio" name="eslesme" value="yeni" />
          <b>➕ Hiçbiri - Yeni gider olarak ekle</b>
          <br><small>Kasa'da yeni bir gider kaydı oluştur</small>
        </label>
        </div>
      </div>
    `;
  }
  
  const modal = document.createElement('div');
  modal.id = 'uyumModal';
  modal.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    background:rgba(0,0,0,0.7);z-index:10000;
    display:flex;align-items:center;justify-content:center;
  `;
  
  modal.innerHTML = `
    <div style="background:white;border-radius:12px;padding:24px;max-width:600px;width:90%;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h2 style="margin:0;color:#333;">📄 Fatura ${currentNo} / ${toplamFatura}</h2>
        <div style="background:#e7f5ff;padding:4px 12px;border-radius:20px;font-size:13px;color:#1971c2;">
          ✅ ${uyumState.sonuc.eklendi} | ⏭ ${uyumState.sonuc.atlandi} | 🔗 ${uyumState.sonuc.esleştirildi}
        </div>
      </div>
      
      <div style="background:#f8f9fa;padding:16px;border-radius:8px;margin-bottom:12px;">
        <div><b>📅 Tarih:</b> ${fatura.tarih}</div>
        <div><b>🏢 Firma:</b> ${fatura.firma}</div>
        <div><b>🔢 VKN:</b> ${fatura.vkn}</div>
        <div><b>📋 Fatura No:</b> ${fatura.fatura_no}</div>
        <div><b>💰 Tutar:</b> <span style="color:#c92a2a;font-size:18px;font-weight:bold;">${fatura.tutar.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL</span></div>
        <div><b>📊 Durum:</b> ${fatura.durum}</div>
        <div><small>${fatura.fatura_tipi} / ${fatura.senaryo}</small></div>
      </div>
      
      ${eslesmeHtml}
      
      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;">
        <button onclick="uyumIslemEkleSadece()" style="flex:1;min-width:120px;padding:12px;background:#4dabf7;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">
          ✅ Sadece Fatura Ekle
        </button>
        ${eslesenler.length > 0 ? `
          <button onclick="uyumIslemEslestir()" style="flex:1;min-width:120px;padding:12px;background:#51cf66;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">
            🔗 Eşleştir ve Kaydet
          </button>
        ` : `
          <button onclick="uyumIslemYeniGider()" style="flex:1;min-width:120px;padding:12px;background:#51cf66;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">
            ➕ Fatura + Yeni Gider
          </button>
        `}
        <button onclick="uyumIslemAtla()" style="flex:1;min-width:100px;padding:12px;background:#ffa94d;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">
          ⏭ Atla
        </button>
        <button onclick="uyumIslemIptal()" style="padding:12px;background:#e03131;color:white;border:none;border-radius:8px;cursor:pointer;">
          ❌ İptal
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// -----------------------------------------------
// Modal aksiyonları
// -----------------------------------------------

// Sadece faturayı ekle (kasa kaydı ile bağlama)
async function uyumIslemEkleSadece() {
  const fatura = uyumState.faturalar[uyumState.currentIdx];
  try {
    await uyumFaturaKaydet(fatura, null);
    uyumState.sonuc.eklendi++;
  } catch (e) {
    console.error(e);
    uyumState.sonuc.hata++;
    alert('❌ Kayıt hatası: ' + e.message);
  }
  uyumState.currentIdx++;
  document.getElementById('uyumModal')?.remove();
  uyumSonrakiFatura();
}

// Kasa kaydı ile eşleştir ve ekle
async function uyumIslemEslestir() {
  const secili = document.querySelector('input[name="eslesme"]:checked');
  if (!secili) {
    alert('⚠️ Lütfen bir eşleşme seç');
    return;
  }
  
  const fatura = uyumState.faturalar[uyumState.currentIdx];

  if (secili.value === 'yeni') {
    // Fatura ekle + yeni kasa gideri oluştur (yarım yazma bırakmaz)
    var ok = await uyumFaturaVeGiderYaz(fatura);
    if (!ok) return; // yükleme durduruldu — sonraki faturaya GEÇME
  } else {
    // Mevcut kasa kaydı ile eşleştir
    var kasaId = parseInt(secili.value, 10);
    try {
      await uyumFaturaKaydet(fatura, kasaId);
    } catch (e) {
      console.error(e);
      uyumModalKapat();
      if (e && e.faturaId) {
        // Fatura satırı YAZILDI ama kayitlar.fatura_id bağı kurulamadı → faturayı geri al.
        // ⚠ Kasa kaydı bize ait değil (kullanıcının mevcut kaydı) — ona ASLA dokunulmaz.
        var geriAlindi = await uyumFaturaGeriAl(e.faturaId);
        if (!geriAlindi) {
          uyumYarimKaldiUyar(fatura, e.faturaId, kasaId, e);
          return;
        }
        uyumYuklemeDurdur('Kasa kaydı fatura ile bağlanamadı', fatura, e,
          'Defterde yarım bağ kalmaması için fatura kaydı GERİ ALINDI (faturalar #' + e.faturaId + ' silindi). Kasa kaydına dokunulmadı.');
        return;
      }
      uyumYuklemeDurdur('Fatura kaydedilemedi', fatura, e,
        'Bu faturaya ait hiçbir kayıt yazılmadı — defter tutarlı.');
      return;
    }
    uyumState.sonuc.esleştirildi++;
  }

  uyumState.currentIdx++;
  uyumModalKapat();
  uyumSonrakiFatura();
}

// Fatura + otomatik yeni gider
async function uyumIslemYeniGider() {
  const fatura = uyumState.faturalar[uyumState.currentIdx];
  var ok = await uyumFaturaVeGiderYaz(fatura);
  if (!ok) return; // yükleme durduruldu — sonraki faturaya GEÇME
  uyumState.currentIdx++;
  uyumModalKapat();
  uyumSonrakiFatura();
}

// Atla
function uyumIslemAtla() {
  uyumState.sonuc.atlandi++;
  uyumState.currentIdx++;
  document.getElementById('uyumModal')?.remove();
  uyumSonrakiFatura();
}

// İptal
function uyumIslemIptal() {
  if (!confirm('⚠️ İşlemi iptal etmek istediğine emin misin?\nBu noktaya kadar olan kayıtlar kalıcı olacak.')) return;
  document.getElementById('uyumModal')?.remove();
  uyumSonucGoster();
}

// -----------------------------------------------
// Sonuç özeti
// -----------------------------------------------
function uyumSonucGoster() {
  const s = uyumState.sonuc;
  const toplam = s.eklendi + s.esleştirildi + s.atlandi + s.zatenVar + s.hata;
  
  alert(
    `🎉 UYUMSOFT YÜKLEME TAMAMLANDI\n\n` +
    `✅ Eklenen (sadece fatura): ${s.eklendi}\n` +
    `🔗 Eşleştirilen (kasa ile): ${s.esleştirildi}\n` +
    `⏭️ Atlanan: ${s.atlandi}\n` +
    `♻️ Zaten kayıtlı: ${s.zatenVar}\n` +
    `❌ Hata: ${s.hata}\n\n` +
    `Toplam işlenen: ${toplam}`
  );
  
  // Fatura listesini yenile
  if (typeof renderFaturalar === 'function') renderFaturalar();
  if (typeof renderKasa === 'function') renderKasa();
}
