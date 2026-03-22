-- Reciclagem de itens: o que se obtém ao reciclar um item
ALTER TABLE items ADD COLUMN IF NOT EXISTS tem_reciclagem boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS item_reciclagem (
  id            UUID     PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id       UUID     NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  resultado_id  UUID     NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantidade    NUMERIC  NOT NULL CHECK (quantidade > 0),
  UNIQUE(item_id, resultado_id)
);

CREATE INDEX IF NOT EXISTS item_reciclagem_item_idx ON item_reciclagem(item_id);
