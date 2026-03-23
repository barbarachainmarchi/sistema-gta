-- Funcionários/membros vinculados a uma loja
CREATE TABLE loja_membros (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  loja_id    UUID        NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  membro_id  UUID        NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
  cargo      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(loja_id, membro_id)
);

CREATE INDEX loja_membros_loja_idx   ON loja_membros(loja_id);
CREATE INDEX loja_membros_membro_idx ON loja_membros(membro_id);
