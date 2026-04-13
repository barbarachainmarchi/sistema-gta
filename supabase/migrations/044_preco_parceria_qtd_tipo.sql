-- Tipo de parceria: 'fixo' (valor direto) ou 'percentual' (% de desconto)
ALTER TABLE faccao_item_precos ADD COLUMN IF NOT EXISTS parceria_tipo        TEXT DEFAULT 'fixo';
ALTER TABLE faccao_item_precos ADD COLUMN IF NOT EXISTS parceria_pct         NUMERIC;

-- Tipo de desconto por quantidade: 'percentual' ou 'fixo' (valor direto)
ALTER TABLE faccao_item_precos ADD COLUMN IF NOT EXISTS desconto_qtd_tipo    TEXT DEFAULT 'percentual';
ALTER TABLE faccao_item_precos ADD COLUMN IF NOT EXISTS desconto_qtd_preco_sujo  NUMERIC;
ALTER TABLE faccao_item_precos ADD COLUMN IF NOT EXISTS desconto_qtd_preco_limpo NUMERIC;
