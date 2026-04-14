-- Adiciona campo categoria aos serviços/combos
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS categoria text;
