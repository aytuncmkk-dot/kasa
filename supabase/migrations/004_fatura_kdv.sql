-- Fatura tablosuna KDV tutarı kolonu ekle
ALTER TABLE faturalar ADD COLUMN IF NOT EXISTS kdv_tutar numeric DEFAULT 0;
