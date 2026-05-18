-- ============================================================
-- 008 — kayitlar ve faturalar tablolarına cari_id kolonu
-- ============================================================

ALTER TABLE kayitlar ADD COLUMN IF NOT EXISTS cari_id BIGINT;
ALTER TABLE faturalar ADD COLUMN IF NOT EXISTS cari_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_kayitlar_cari ON kayitlar(cari_id);
CREATE INDEX IF NOT EXISTS idx_faturalar_cari ON faturalar(cari_id);
