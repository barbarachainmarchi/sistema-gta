-- Migration 064: Múltiplos tipos e itens por competição, tipo_dinheiro em ações

-- Tipos de ação permitidos por competição (com pontuação customizada por competição)
CREATE TABLE acao_competicao_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competicao_id uuid NOT NULL REFERENCES acao_competicoes(id) ON DELETE CASCADE,
  tipo_id uuid NOT NULL REFERENCES acao_tipos(id) ON DELETE CASCADE,
  pontos_valor int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(competicao_id, tipo_id)
);

-- Itens permitidos por competição (modo item — usa catálogo de items)
CREATE TABLE acao_competicao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competicao_id uuid NOT NULL REFERENCES acao_competicoes(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(competicao_id, item_id)
);

-- Tipo de dinheiro da ação (limpo ou sujo) para lançamentos financeiros
ALTER TABLE acoes ADD COLUMN IF NOT EXISTS tipo_dinheiro text NOT NULL DEFAULT 'sujo' CHECK (tipo_dinheiro IN ('sujo', 'limpo'));

-- Item vinculado à ação (para modo item em competições)
ALTER TABLE acoes ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES items(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE acao_competicao_tipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE acao_competicao_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON acao_competicao_tipos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON acao_competicao_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);
