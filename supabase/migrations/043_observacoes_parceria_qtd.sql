-- Observação nas facções
ALTER TABLE faccoes ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- Preço parceria e desconto por quantidade nos preços de facção
ALTER TABLE faccao_item_precos ADD COLUMN IF NOT EXISTS preco_sujo_parceria  NUMERIC;
ALTER TABLE faccao_item_precos ADD COLUMN IF NOT EXISTS preco_limpo_parceria NUMERIC;
ALTER TABLE faccao_item_precos ADD COLUMN IF NOT EXISTS desconto_qtd_minima  INTEGER;
ALTER TABLE faccao_item_precos ADD COLUMN IF NOT EXISTS desconto_qtd_pct     NUMERIC;
