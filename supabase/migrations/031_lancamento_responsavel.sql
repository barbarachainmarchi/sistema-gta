-- Guarda nome de quem entregou a venda no lançamento financeiro
ALTER TABLE financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS responsavel_nome text;
