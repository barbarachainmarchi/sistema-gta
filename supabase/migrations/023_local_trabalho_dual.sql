-- Troca local_trabalho (tipo+id) por dois campos separados: loja e facção
-- Permite vincular a uma loja E uma facção ao mesmo tempo
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS local_trabalho_loja_id uuid REFERENCES lojas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS local_trabalho_faccao_id uuid REFERENCES faccoes(id) ON DELETE SET NULL;

-- Remove colunas antigas se existirem
ALTER TABLE usuarios
  DROP COLUMN IF EXISTS local_trabalho_tipo,
  DROP COLUMN IF EXISTS local_trabalho_id;
