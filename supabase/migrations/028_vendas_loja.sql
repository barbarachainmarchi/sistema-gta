-- Add loja_id to vendas
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS loja_id uuid REFERENCES lojas(id) ON DELETE SET NULL;

-- Add loja_id to financeiro_contas (for auto-creating conta per loja)
ALTER TABLE financeiro_contas ADD COLUMN IF NOT EXISTS loja_id uuid REFERENCES lojas(id) ON DELETE SET NULL;

-- Add 'loja' to financeiro_contas tipo check
ALTER TABLE financeiro_contas DROP CONSTRAINT IF EXISTS financeiro_contas_tipo_check;
ALTER TABLE financeiro_contas ADD CONSTRAINT financeiro_contas_tipo_check
  CHECK (tipo IN ('faccao', 'loja', 'membro', 'caixa', 'setor', 'outro'));

CREATE INDEX IF NOT EXISTS vendas_loja_idx ON vendas(loja_id);
CREATE INDEX IF NOT EXISTS financeiro_contas_loja_idx ON financeiro_contas(loja_id);
