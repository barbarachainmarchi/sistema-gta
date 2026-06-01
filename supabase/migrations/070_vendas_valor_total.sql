-- Valor total imutável gravado no momento da confirmação do pedido.
-- Nenhum evento posterior (editar, entregar, financeiro) recalcula — lê este campo.
ALTER TABLE vendas
  ADD COLUMN IF NOT EXISTS valor_total NUMERIC;
