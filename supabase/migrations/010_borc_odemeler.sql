-- ============================================================
-- 010 — borc_odemeler: Fatura-Ödeme N:M Eşleştirme Tablosu
-- (fatura_odeme_eslestirme yerine, cari_id kolonu ekli)
-- ============================================================

CREATE TABLE IF NOT EXISTS borc_odemeler (
  id             BIGSERIAL PRIMARY KEY,
  fatura_id      BIGINT NOT NULL,
  kayit_id       BIGINT NOT NULL,
  odeme_tutari   NUMERIC(12,2) NOT NULL,
  onaylandi      BOOLEAN NOT NULL DEFAULT TRUE,
  kaynak         TEXT NOT NULL DEFAULT 'manuel',
  cari_id        BIGINT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fatura_id, kayit_id)
);

CREATE INDEX IF NOT EXISTS idx_bo_fatura ON borc_odemeler(fatura_id);
CREATE INDEX IF NOT EXISTS idx_bo_kayit  ON borc_odemeler(kayit_id);
CREATE INDEX IF NOT EXISTS idx_bo_cari   ON borc_odemeler(cari_id);

ALTER TABLE borc_odemeler ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_all ON borc_odemeler FOR ALL USING (true) WITH CHECK (true);
