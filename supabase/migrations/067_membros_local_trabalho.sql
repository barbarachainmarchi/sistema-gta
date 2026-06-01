-- Adiciona local de trabalho (loja) no cadastro de membros da investigação
ALTER TABLE membros
  ADD COLUMN IF NOT EXISTS local_trabalho_loja_id uuid REFERENCES lojas(id) ON DELETE SET NULL;
