-- Quantidade esperada (meta de estoque) por item controlado
ALTER TABLE estoque_itens_controlados
  ADD COLUMN IF NOT EXISTS quantidade_esperada numeric DEFAULT NULL;
