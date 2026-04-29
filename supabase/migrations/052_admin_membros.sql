-- Adiciona módulo admin_membros ao perfil Fantasma
DO $$
DECLARE
  fantasma_id uuid;
BEGIN
  SELECT id INTO fantasma_id FROM perfis_acesso WHERE nome = 'Fantasma';
  IF fantasma_id IS NOT NULL THEN
    DELETE FROM perfil_permissoes WHERE perfil_id = fantasma_id AND modulo = 'admin_membros';
    INSERT INTO perfil_permissoes (perfil_id, modulo, pode_ver, pode_editar, pode_excluir)
    VALUES (fantasma_id, 'admin_membros', true, true, true);
  END IF;
END $$;
