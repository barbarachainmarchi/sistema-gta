-- Tabela de log de eventos do sistema
CREATE TABLE IF NOT EXISTS sistema_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          text NOT NULL,
  referencia_id   uuid,
  referencia_tipo text,
  descricao     text,
  usuario_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_nome  text,
  dados         jsonb,
  created_at    timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE sistema_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log_select" ON sistema_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "log_insert" ON sistema_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Tabela de solicitações (cancelamentos, transferências pendentes)
CREATE TABLE IF NOT EXISTS sistema_solicitacoes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo              text NOT NULL CHECK (tipo IN ('cancelamento_cotacao', 'cancelamento_venda', 'transferencia_financeiro')),
  status            text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  referencia_id     uuid,
  referencia_tipo   text,
  descricao         text,
  solicitante_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  solicitante_nome  text,
  aprovador_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovador_nome    text,
  dados             jsonb,
  created_at        timestamptz DEFAULT now() NOT NULL,
  resolved_at       timestamptz
);

ALTER TABLE sistema_solicitacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sol_select" ON sistema_solicitacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "sol_insert" ON sistema_solicitacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sol_update" ON sistema_solicitacoes FOR UPDATE TO authenticated USING (true);
