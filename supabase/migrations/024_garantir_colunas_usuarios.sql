-- Garante que todas as colunas adicionadas nas migrations 022 e 023 existem
-- (seguro rodar mesmo que já tenham sido aplicadas — usa IF NOT EXISTS)

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS meu_produto_usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS local_trabalho_loja_id uuid REFERENCES lojas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS local_trabalho_faccao_id uuid REFERENCES faccoes(id) ON DELETE SET NULL;

-- Remove colunas velhas se ainda existirem da migration 022
ALTER TABLE usuarios
  DROP COLUMN IF EXISTS local_trabalho_tipo,
  DROP COLUMN IF EXISTS local_trabalho_id;
