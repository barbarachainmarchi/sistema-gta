-- Add pode_criar column to perfil_permissoes
ALTER TABLE perfil_permissoes ADD COLUMN IF NOT EXISTS pode_criar BOOLEAN NOT NULL DEFAULT false;

-- Grant all permissions (including criar) to Fantasma profile
UPDATE perfil_permissoes
SET pode_criar = true
WHERE perfil_id = (
  SELECT id FROM perfis_acesso WHERE nome = 'Fantasma' AND is_sistema = true LIMIT 1
);
