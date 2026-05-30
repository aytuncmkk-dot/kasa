-- ============================================================
-- 009 — Fatura-Ödeme Eşleştirme Tablosu
-- Her fatura birden fazla gider kaydıyla eşleştirilebilir (N:M)
-- Kısmi ödeme ve toplu ödeme desteği
-- ============================================================

CREATE TABLE IF NOT EXISTS fatura_odeme_eslestirme (
  id             BIGSERIAL PRIMARY KEY,
  fatura_id      BIGINT NOT NULL,
  kayit_id       BIGINT NOT NULL,
  odeme_tutari   NUMERIC(12,2) NOT NULL,
  onaylandi      BOOLEAN NOT NULL DEFAULT TRUE,
  kaynak         TEXT NOT NULL DEFAULT 'manuel',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fatura_id, kayit_id)
);

CREATE INDEX IF NOT EXISTS idx_foe_fatura ON fatura_odeme_eslestirme(fatura_id);
CREATE INDEX IF NOT EXISTS idx_foe_kayit  ON fatura_odeme_eslestirme(kayit_id);

ALTER TABLE fatura_odeme_eslestirme ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_all ON fatura_odeme_eslestirme FOR ALL USING (true) WITH CHECK (true);
