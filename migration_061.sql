-- Migration 061: Módulo de Ação
-- Rodar no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS acao_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  min_participantes int NOT NULL DEFAULT 1,
  max_participantes int DEFAULT NULL,
  descricao text DEFAULT NULL,
  regras text DEFAULT NULL,
  conta_pontuacao boolean NOT NULL DEFAULT false,
  pontos_valor int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_id uuid REFERENCES acao_tipos(id) ON DELETE SET NULL,
  tipo_nome text,
  data_hora timestamptz NOT NULL,
  observacoes text DEFAULT NULL,
  para_caixa_faccao boolean NOT NULL DEFAULT false,
  conta_pontuacao boolean NOT NULL DEFAULT true,
  created_by text,
  created_by_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS acao_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id uuid NOT NULL REFERENCES acoes(id) ON DELETE CASCADE,
  membro_id uuid NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
  membro_nome text,
  pontos_atribuidos int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(acao_id, membro_id)
);

CREATE TABLE IF NOT EXISTS escalacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_id uuid REFERENCES acao_tipos(id) ON DELETE SET NULL,
  tipo_nome text,
  data_hora_prevista timestamptz NOT NULL,
  modo text NOT NULL DEFAULT 'manual',
  observacoes text DEFAULT NULL,
  status text NOT NULL DEFAULT 'pendente',
  acao_id uuid REFERENCES acoes(id) ON DELETE SET NULL,
  created_by text,
  created_by_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS escalacao_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escalacao_id uuid NOT NULL REFERENCES escalacoes(id) ON DELETE CASCADE,
  membro_id uuid NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
  membro_nome text,
  status text NOT NULL DEFAULT 'convocado',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(escalacao_id, membro_id)
);

ALTER TABLE acao_tipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE acoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE acao_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalacao_participantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON acao_tipos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON acoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON acao_participantes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON escalacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON escalacao_participantes FOR ALL TO authenticated USING (true) WITH CHECK (true);
