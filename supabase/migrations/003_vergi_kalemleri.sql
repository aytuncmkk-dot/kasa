-- Vergi Takip & Projeksiyon modülü tabloları
-- Supabase Dashboard → SQL Editor'de çalıştırın

CREATE TABLE IF NOT EXISTS vergi_kalemleri (
  id         bigserial PRIMARY KEY,
  donem      text NOT NULL,         -- "2025-09" veya "2025-Q4"
  tur        text NOT NULL,         -- kdv | kdv2 | muhtasar | sgk | gecici | kurumlar | diger
  tutar      numeric NOT NULL DEFAULT 0,
  odeme_tarihi date,
  aciklama   text,
  kayit_id   bigint,                -- kayitlar.id ile opsiyonel bağlantı
  kaynak     text DEFAULT 'manuel', -- otomatik | manuel | excel
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vergi_ayarlar (
  anahtar    text PRIMARY KEY,      -- "proj_kdv_2026-05" veya "yemek_oran_global"
  deger      text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Permissive RLS (mevcut tablolarla aynı yaklaşım)
ALTER TABLE vergi_kalemleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE vergi_ayarlar   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='vergi_kalemleri' AND policyname='anon_all'
  ) THEN
    CREATE POLICY anon_all ON vergi_kalemleri FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='vergi_ayarlar' AND policyname='anon_all'
  ) THEN
    CREATE POLICY anon_all ON vergi_ayarlar FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
