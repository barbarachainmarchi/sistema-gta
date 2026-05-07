-- Migration 060: sincronização ação ↔ financeiro + resultado da ação
ALTER TABLE financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS acao_id uuid REFERENCES acoes(id) ON DELETE SET NULL;

ALTER TABLE acoes
  ADD COLUMN IF NOT EXISTS resultado text CHECK (resultado IN ('vencida', 'perdida'));
