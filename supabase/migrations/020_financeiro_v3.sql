-- ── financeiro_contas ────────────────────────────────────────────────────────

-- Expandir tipo para incluir caixa, setor, outro
ALTER TABLE financeiro_contas
  DROP CONSTRAINT IF EXISTS financeiro_contas_tipo_check;
ALTER TABLE financeiro_contas
  ADD CONSTRAINT financeiro_contas_tipo_check
  CHECK (tipo IN ('faccao', 'membro', 'caixa', 'setor', 'outro'));

-- Adicionar saldo separado por tipo de dinheiro
ALTER TABLE financeiro_contas
  ADD COLUMN IF NOT EXISTS saldo_sujo  numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_limpo numeric NOT NULL DEFAULT 0;

-- Migrar saldo existente (best effort)
UPDATE financeiro_contas SET saldo_sujo  = COALESCE(saldo, 0) WHERE subtipo = 'sujo';
UPDATE financeiro_contas SET saldo_limpo = COALESCE(saldo, 0) WHERE subtipo = 'limpo';
UPDATE financeiro_contas SET
  saldo_sujo  = COALESCE(saldo, 0) / 2,
  saldo_limpo = COALESCE(saldo, 0) / 2
WHERE subtipo = 'misto' OR subtipo IS NULL;

-- Remover colunas antigas
ALTER TABLE financeiro_contas
  DROP COLUMN IF EXISTS subtipo,
  DROP COLUMN IF EXISTS saldo;

-- ── financeiro_lancamentos ───────────────────────────────────────────────────

ALTER TABLE financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS tipo_dinheiro  text CHECK (tipo_dinheiro IN ('sujo', 'limpo')),
  ADD COLUMN IF NOT EXISTS data           date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS origem_tipo    text CHECK (origem_tipo IN ('faccao', 'loja', 'pessoa')),
  ADD COLUMN IF NOT EXISTS item_descricao text,
  ADD COLUMN IF NOT EXISTS preco          numeric,
  ADD COLUMN IF NOT EXISTS quantidade     numeric,
  ADD COLUMN IF NOT EXISTS total          numeric;

-- Categoria vira texto livre (sem enum)
ALTER TABLE financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS financeiro_lancamentos_categoria_check;

-- Expandir tipo para incluir venda (futuro)
ALTER TABLE financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS financeiro_lancamentos_tipo_check;
ALTER TABLE financeiro_lancamentos
  ADD CONSTRAINT financeiro_lancamentos_tipo_check
  CHECK (tipo IN ('entrada', 'saida', 'transferencia', 'venda'));

-- ── financeiro_lavagem ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS financeiro_lavagem (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  conta_id        uuid        NOT NULL REFERENCES financeiro_contas(id) ON DELETE RESTRICT,
  conversao_tipo  text        NOT NULL CHECK (conversao_tipo IN ('sujo_para_limpo', 'limpo_para_sujo')),
  valor_origem    numeric     NOT NULL CHECK (valor_origem > 0),
  valor_destino   numeric     NOT NULL CHECK (valor_destino > 0),
  taxa_percentual numeric,
  data            date        DEFAULT CURRENT_DATE,
  descricao       text,
  created_by      uuid        REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financeiro_lavagem_conta_idx ON financeiro_lavagem(conta_id);
CREATE INDEX IF NOT EXISTS financeiro_lavagem_data_idx  ON financeiro_lavagem(data DESC);
