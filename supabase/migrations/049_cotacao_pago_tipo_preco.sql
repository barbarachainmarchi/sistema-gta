-- cotacao_pessoas: status de pagamento
ALTER TABLE cotacao_pessoas ADD COLUMN IF NOT EXISTS pago boolean DEFAULT false;
ALTER TABLE cotacao_pessoas ADD COLUMN IF NOT EXISTS pago_por text;

-- cotacao_itens: tipo de preço (sujo/limpo) por item
ALTER TABLE cotacao_itens ADD COLUMN IF NOT EXISTS tipo_preco text CHECK (tipo_preco IN ('sujo', 'limpo'));
