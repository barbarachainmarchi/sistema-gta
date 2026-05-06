-- Migration 063: Módulo de Ação (tabelas, competições, permissões)

-- Tipos de ação
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

-- Registros de ação
CREATE TABLE IF NOT EXISTS acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_id uuid REFERENCES acao_tipos(id) ON DELETE SET NULL,
  tipo_nome text,
  data_hora timestamptz NOT NULL,
  observacoes text DEFAULT NULL,
  para_caixa_faccao boolean NOT NULL DEFAULT false,
  conta_pontuacao boolean NOT NULL DEFAULT true,
  competicao_id uuid DEFAULT NULL,  -- FK adicionada após criar acao_competicoes
  equipe_id uuid DEFAULT NULL,       -- FK adicionada após criar acao_competicao_equipes
  quantidade_item int DEFAULT NULL,
  created_by text,
  created_by_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Participantes de ação
CREATE TABLE IF NOT EXISTS acao_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id uuid NOT NULL REFERENCES acoes(id) ON DELETE CASCADE,
  membro_id uuid NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
  membro_nome text,
  pontos_atribuidos int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(acao_id, membro_id)
);

-- Escalações
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

-- Participantes de escalação
CREATE TABLE IF NOT EXISTS escalacao_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escalacao_id uuid NOT NULL REFERENCES escalacoes(id) ON DELETE CASCADE,
  membro_id uuid NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
  membro_nome text,
  status text NOT NULL DEFAULT 'convocado',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(escalacao_id, membro_id)
);

-- Competições
CREATE TABLE IF NOT EXISTS acao_competicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text DEFAULT NULL,
  tipo_acao_id uuid REFERENCES acao_tipos(id) ON DELETE SET NULL,
  tipo_acao_nome text,
  modo_progresso text NOT NULL DEFAULT 'pontuacao', -- 'pontuacao' | 'item'
  item_nome text DEFAULT NULL,                       -- obrigatório se modo_progresso = 'item'
  tipo_encerramento text NOT NULL DEFAULT 'prazo',   -- 'prazo' | 'meta' | 'prazo_ou_meta'
  prazo timestamptz DEFAULT NULL,
  meta_valor int DEFAULT NULL,
  status text NOT NULL DEFAULT 'ativa',              -- 'ativa' | 'encerrada' | 'cancelada'
  vencedor_equipe_id uuid DEFAULT NULL,
  vencedor_equipe_nome text DEFAULT NULL,
  created_by text,
  created_by_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Equipes de competição
CREATE TABLE IF NOT EXISTS acao_competicao_equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competicao_id uuid NOT NULL REFERENCES acao_competicoes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#6b7280',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Membros por equipe
CREATE TABLE IF NOT EXISTS acao_competicao_equipe_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id uuid NOT NULL REFERENCES acao_competicao_equipes(id) ON DELETE CASCADE,
  membro_id uuid NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
  membro_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(equipe_id, membro_id)
);

-- FKs na tabela acoes (após criação das tabelas acima)
ALTER TABLE acoes ADD CONSTRAINT acoes_competicao_fk
  FOREIGN KEY (competicao_id) REFERENCES acao_competicoes(id) ON DELETE SET NULL;
ALTER TABLE acoes ADD CONSTRAINT acoes_equipe_fk
  FOREIGN KEY (equipe_id) REFERENCES acao_competicao_equipes(id) ON DELETE SET NULL;

-- FK na tabela acao_competicoes (vencedor)
ALTER TABLE acao_competicoes ADD CONSTRAINT acao_competicoes_vencedor_fk
  FOREIGN KEY (vencedor_equipe_id) REFERENCES acao_competicao_equipes(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE acao_tipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE acoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE acao_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalacao_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE acao_competicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE acao_competicao_equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE acao_competicao_equipe_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON acao_tipos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON acoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON acao_participantes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON escalacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON escalacao_participantes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON acao_competicoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON acao_competicao_equipes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON acao_competicao_equipe_membros FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Permissão no catálogo (para aparecer no painel de perfis)
-- O módulo 'acao' já existe no sidebar; basta o admin criar a permissão no painel de perfis.
