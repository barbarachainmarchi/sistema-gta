-- ── Metas Semanais ────────────────────────────────────────────────────────────

-- Meta semanal (modelo por semana)
CREATE TABLE IF NOT EXISTS metas_semanais (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        text NOT NULL DEFAULT '',
  semana_inicio date NOT NULL,
  semana_fim    date NOT NULL,
  status        text NOT NULL DEFAULT 'ativa'
    CHECK (status IN ('ativa', 'encerrada', 'rascunho')),
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now()
);

-- Itens template da meta (base aplicada a todos os membros)
CREATE TABLE IF NOT EXISTS metas_itens_template (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id       uuid NOT NULL REFERENCES metas_semanais(id) ON DELETE CASCADE,
  item_nome     text NOT NULL,
  quantidade    numeric NOT NULL DEFAULT 0,
  tipo_dinheiro text CHECK (tipo_dinheiro IN ('limpo', 'sujo')),
  ordem         int NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- Meta individual por membro
CREATE TABLE IF NOT EXISTS metas_membros (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id        uuid NOT NULL REFERENCES metas_semanais(id) ON DELETE CASCADE,
  membro_id      uuid NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'em_andamento'
    CHECK (status IN ('em_andamento', 'completo', 'incompleto', 'justificado')),
  status_forcado boolean NOT NULL DEFAULT false,
  observacao     text,
  created_at     timestamptz DEFAULT now(),
  UNIQUE(meta_id, membro_id)
);

-- Itens da meta individual (customizáveis por membro, copiados do template)
CREATE TABLE IF NOT EXISTS metas_membros_itens (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membro_meta_id      uuid NOT NULL REFERENCES metas_membros(id) ON DELETE CASCADE,
  item_nome           text NOT NULL,
  quantidade_meta     numeric NOT NULL DEFAULT 0,
  quantidade_entregue numeric NOT NULL DEFAULT 0,
  tipo_dinheiro       text CHECK (tipo_dinheiro IN ('limpo', 'sujo')),
  ordem               int NOT NULL DEFAULT 0,
  created_at          timestamptz DEFAULT now()
);

-- Entregas parciais (log imutável)
CREATE TABLE IF NOT EXISTS metas_entregas (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membro_meta_id          uuid NOT NULL REFERENCES metas_membros(id) ON DELETE CASCADE,
  membro_meta_item_id     uuid NOT NULL REFERENCES metas_membros_itens(id) ON DELETE CASCADE,
  quantidade              numeric NOT NULL,
  tipo_dinheiro           text CHECK (tipo_dinheiro IN ('limpo', 'sujo')),
  responsavel_recebimento_nome text,
  nota                    text,
  lancado_por_nome        text,
  created_at              timestamptz DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE metas_semanais        ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas_itens_template  ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas_membros         ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas_membros_itens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas_entregas        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metas_semanais_all"       ON metas_semanais        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "metas_itens_template_all" ON metas_itens_template  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "metas_membros_all"        ON metas_membros         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "metas_membros_itens_all"  ON metas_membros_itens   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "metas_entregas_all"       ON metas_entregas         FOR ALL TO authenticated USING (true) WITH CHECK (true);
