-- Itens favoritos por usuário (personalizável na Calculadora)
CREATE TABLE usuario_favoritos (
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  item_id    uuid NOT NULL REFERENCES items(id)    ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, item_id)
);
