-- Disponibilidade de membros para operações (usado no Dashboard pessoal)
CREATE TABLE IF NOT EXISTS usuarios_disponibilidade (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  data        date NOT NULL DEFAULT CURRENT_DATE,
  disponivel  boolean NOT NULL DEFAULT true,
  observacao  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(usuario_id, data)
);

CREATE INDEX IF NOT EXISTS usuarios_disponibilidade_usuario_idx ON usuarios_disponibilidade(usuario_id);
CREATE INDEX IF NOT EXISTS usuarios_disponibilidade_data_idx    ON usuarios_disponibilidade(data);

ALTER TABLE usuarios_disponibilidade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth" ON usuarios_disponibilidade FOR ALL TO authenticated USING (true);

DROP TRIGGER IF EXISTS usuarios_disponibilidade_updated_at ON usuarios_disponibilidade;
CREATE TRIGGER usuarios_disponibilidade_updated_at
  BEFORE UPDATE ON usuarios_disponibilidade
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
