-- Adiciona campo origem como texto livre (em vez do enum origem_tipo)
ALTER TABLE financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS origem text;
