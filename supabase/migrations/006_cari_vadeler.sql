-- ============================================================
-- 006 — Cari Vade Takip Tablosu
-- Cariler için vade/borç takibi ve bütçe planlaması
-- ============================================================

CREATE TABLE IF NOT EXISTS cari_vadeler (
  id            BIGSERIAL PRIMARY KEY,
  cari_id       BIGINT NOT NULL,
  tutar         NUMERIC(12,2) NOT NULL,
  vade_tarihi   DATE NOT NULL,
  fatura_no     TEXT,
  aciklama      TEXT,
  odendi        BOOLEAN NOT NULL DEFAULT FALSE,
  odeme_tarihi  DATE,
  odeme_notu    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cvadeler_cari    ON cari_vadeler(cari_id);
CREATE INDEX IF NOT EXISTS idx_cvadeler_tarih   ON cari_vadeler(vade_tarihi);
CREATE INDEX IF NOT EXISTS idx_cvadeler_odendi  ON cari_vadeler(odendi, vade_tarihi);

ALTER TABLE cari_vadeler ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_all ON cari_vadeler FOR ALL USING (true) WITH CHECK (true);
