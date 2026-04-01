-- ── Estoque ──────────────────────────────────────────────────────────────────

-- Itens que serão controlados no estoque (opt-in por item)
CREATE TABLE IF NOT EXISTS estoque_itens_controlados (
  item_id        uuid PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  criado_por_nome text,
  created_at     timestamptz DEFAULT now()
);

-- Snapshots manuais de saldo (cada "Atualizar Saldo" cria um registro)
CREATE TABLE IF NOT EXISTS estoque_atualizacoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantidade      numeric NOT NULL CHECK (quantidade >= 0),
  criado_por      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_por_nome text NOT NULL DEFAULT '',
  nota            text,
  created_at      timestamptz DEFAULT now()
);

-- Movimentos manuais de entrada e saída
CREATE TABLE IF NOT EXISTS estoque_movimentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  tipo          text NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  quantidade    numeric NOT NULL CHECK (quantidade > 0),
  motivo        text,
  usuario_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_nome  text NOT NULL DEFAULT '',
  referencia    text,
  created_at    timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE estoque_itens_controlados ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_atualizacoes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_movimentos        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estoque_controlados_autenticado"
  ON estoque_itens_controlados FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "estoque_atualizacoes_autenticado"
  ON estoque_atualizacoes FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "estoque_movimentos_autenticado"
  ON estoque_movimentos FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_estoque_atu_item_created  ON estoque_atualizacoes(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_item_created  ON estoque_movimentos(item_id, created_at DESC);
