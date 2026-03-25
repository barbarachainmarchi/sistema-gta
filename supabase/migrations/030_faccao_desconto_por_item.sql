-- Desconto específico por item para cada facção compradora.
-- Sobrescreve desconto_padrao_pct para o item específico.
CREATE TABLE IF NOT EXISTS faccao_desconto_por_item (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  faccao_id uuid NOT NULL REFERENCES faccoes(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  desconto_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (desconto_pct >= 0 AND desconto_pct <= 100),
  created_at timestamptz DEFAULT now(),
  UNIQUE(faccao_id, item_id)
);

CREATE INDEX IF NOT EXISTS faccao_desconto_por_item_faccao_idx ON faccao_desconto_por_item(faccao_id);
CREATE INDEX IF NOT EXISTS faccao_desconto_por_item_item_idx ON faccao_desconto_por_item(item_id);
