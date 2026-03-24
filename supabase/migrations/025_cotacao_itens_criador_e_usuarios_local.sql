-- Colunas do criador em cotacao_itens (migration 018 pode não ter sido rodada)
ALTER TABLE cotacao_itens ADD COLUMN IF NOT EXISTS adicionado_por uuid;
ALTER TABLE cotacao_itens ADD COLUMN IF NOT EXISTS adicionado_por_nome text;

-- Colunas de local de trabalho em usuarios (migrations 022/023/024 podem não ter sido rodadas)
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS meu_produto_usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS local_trabalho_loja_id uuid REFERENCES lojas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS local_trabalho_faccao_id uuid REFERENCES faccoes(id) ON DELETE SET NULL;

ALTER TABLE usuarios
  DROP COLUMN IF EXISTS local_trabalho_tipo,
  DROP COLUMN IF EXISTS local_trabalho_id;
