-- Rastreia qual usuário marcou o item como "meu produto"
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS meu_produto_usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Local de trabalho do usuário (loja ou facção onde ele vende seus produtos)
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS local_trabalho_tipo text CHECK (local_trabalho_tipo IN ('loja', 'faccao')),
  ADD COLUMN IF NOT EXISTS local_trabalho_id uuid;
