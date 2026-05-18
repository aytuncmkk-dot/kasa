-- ============================================================
-- 007 — Cari Hesap Hareketleri
-- Borç ve ödeme kayıtları, cari bazlı bakiye hesabı
-- ============================================================

CREATE TABLE IF NOT EXISTS cari_hareketler (
  id          BIGSERIAL PRIMARY KEY,
  cari_id     BIGINT NOT NULL,
  tarih       DATE NOT NULL,
  tip         TEXT NOT NULL CHECK (tip IN ('borc', 'odeme')),
  tutar       NUMERIC(12,2) NOT NULL,
  aciklama    TEXT,
  belge_no    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chareket_cari  ON cari_hareketler(cari_id);
CREATE INDEX IF NOT EXISTS idx_chareket_tarih ON cari_hareketler(tarih);

ALTER TABLE cari_hareketler ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_all ON cari_hareketler FOR ALL USING (true) WITH CHECK (true);
