-- Adiciona permissão de exclusão nos perfis de acesso
ALTER TABLE perfil_permissoes
  ADD COLUMN IF NOT EXISTS pode_excluir boolean NOT NULL DEFAULT false;
