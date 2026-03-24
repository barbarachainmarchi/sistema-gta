-- Campos extras em lancamentos: referência de ação + flag se foi pra facção
ALTER TABLE financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS vai_para_faccao boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS acao_referencia text; -- texto livre por enquanto, vira FK quando módulo Ação for construído

-- Índice para buscar por referência de ação
CREATE INDEX IF NOT EXISTS financeiro_lancamentos_acao_idx ON financeiro_lancamentos(acao_referencia);
