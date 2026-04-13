-- Apelidos/códigos de busca nos itens
ALTER TABLE items ADD COLUMN IF NOT EXISTS apelidos TEXT;

-- Favoritos de serviços por usuário
CREATE TABLE IF NOT EXISTS usuario_favoritos_servicos (
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  servico_id uuid NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, servico_id)
);

ALTER TABLE usuario_favoritos_servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fav_serv_select" ON usuario_favoritos_servicos
  FOR SELECT USING (auth.uid() = usuario_id);
CREATE POLICY "fav_serv_insert" ON usuario_favoritos_servicos
  FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "fav_serv_delete" ON usuario_favoritos_servicos
  FOR DELETE USING (auth.uid() = usuario_id);
