-- Adisyon (Simpra) ↔ Kasa eşleştirme tablosu
-- Bir gün için tek satır; eslesmeler JSON dizisi olarak tüm eşleştirmeleri tutar.

CREATE TABLE IF NOT EXISTS adisyon_eslestirme (
  id BIGSERIAL PRIMARY KEY,
  tarih DATE NOT NULL UNIQUE,
  csv_filename TEXT,
  simpra_toplam NUMERIC NOT NULL DEFAULT 0,
  simpra_adisyon_sayisi INT NOT NULL DEFAULT 0,
  kasa_toplam NUMERIC NOT NULL DEFAULT 0,
  kasa_kayit_sayisi INT NOT NULL DEFAULT 0,
  fark NUMERIC NOT NULL DEFAULT 0,
  simpra_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  simpra_iptal JSONB NOT NULL DEFAULT '[]'::jsonb,
  eslesmeler JSONB NOT NULL DEFAULT '[]'::jsonb,
  notlar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adisyon_eslestirme_tarih ON adisyon_eslestirme(tarih DESC);

-- updated_at otomatik güncellensin
CREATE OR REPLACE FUNCTION trg_adisyon_eslestirme_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS adisyon_eslestirme_updated_at ON adisyon_eslestirme;
CREATE TRIGGER adisyon_eslestirme_updated_at
  BEFORE UPDATE ON adisyon_eslestirme
  FOR EACH ROW EXECUTE FUNCTION trg_adisyon_eslestirme_updated();

-- Kapora kategorisi 16.04.2026'da elle eklenmiş, tablo durumunda mevcut.
-- Idempotent garanti için kontrol ediyoruz:
INSERT INTO kategoriler (tur, ad)
SELECT 'gelir', 'Kapora'
WHERE NOT EXISTS (SELECT 1 FROM kategoriler WHERE ad = 'Kapora' AND tur = 'gelir');
