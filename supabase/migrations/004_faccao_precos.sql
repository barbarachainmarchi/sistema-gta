-- Preços de parceria por facção
CREATE TABLE faccao_item_precos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  faccao_id   UUID        NOT NULL REFERENCES faccoes(id) ON DELETE CASCADE,
  item_id     UUID        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  tipo        TEXT        NOT NULL DEFAULT 'fixo' CHECK (tipo IN ('percentual', 'fixo')),
  percentual  NUMERIC,                               -- positivo = desconto, negativo = acréscimo
  preco_sujo  NUMERIC     CHECK (preco_sujo >= 0),   -- usado quando tipo = 'fixo'
  preco_limpo NUMERIC     CHECK (preco_limpo >= 0),
  observacoes TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(faccao_id, item_id)
);

CREATE INDEX faccao_item_precos_faccao_idx ON faccao_item_precos(faccao_id);
