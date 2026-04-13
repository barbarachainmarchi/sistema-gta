-- Faixas de preço por quantidade por produto por facção
CREATE TABLE IF NOT EXISTS faccao_item_preco_faixas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faccao_id     uuid NOT NULL REFERENCES faccoes(id) ON DELETE CASCADE,
  item_id       uuid NOT NULL REFERENCES items(id)   ON DELETE CASCADE,
  quantidade_min INTEGER NOT NULL,
  preco_sujo    NUMERIC,
  preco_limpo   NUMERIC,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE faccao_item_preco_faixas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "faixas_all" ON faccao_item_preco_faixas FOR ALL USING (true) WITH CHECK (true);
