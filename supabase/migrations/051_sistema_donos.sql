-- Marca perfis protegidos do sistema (não atribuíveis via UI)
ALTER TABLE perfis_acesso ADD COLUMN IF NOT EXISTS is_sistema boolean NOT NULL DEFAULT false;

-- Cria o perfil Fantasma com acesso total
DO $$
DECLARE
  fantasma_id uuid;
BEGIN
  INSERT INTO perfis_acesso (nome, descricao, is_sistema)
  VALUES ('Fantasma', 'Dono do servidor — acesso total, não atribuível via UI', true)
  ON CONFLICT (nome) DO UPDATE SET is_sistema = true, descricao = EXCLUDED.descricao
  RETURNING id INTO fantasma_id;

  IF fantasma_id IS NULL THEN
    SELECT id INTO fantasma_id FROM perfis_acesso WHERE nome = 'Fantasma';
  END IF;

  DELETE FROM perfil_permissoes WHERE perfil_id = fantasma_id;

  INSERT INTO perfil_permissoes (perfil_id, modulo, pode_ver, pode_editar, pode_excluir)
  SELECT fantasma_id, m.modulo, true, true, true
  FROM (VALUES
    ('admin_cadastros'), ('admin_usuarios'), ('admin_layout'), ('admin_logs'),
    ('admin_integracoes'), ('admin_backup'), ('investigacao'), ('vendas'),
    ('encomendas'), ('vendas_concluidas'), ('vendas_excluir_concluida'),
    ('calculadora'), ('cotacao'), ('metas'), ('estoque'), ('acao'), ('financeiro')
  ) AS m(modulo);
END $$;

-- Chave para dono secundário (Babi) — valor = user_id do Supabase
INSERT INTO config_sistema (chave, valor) VALUES ('dono_secundario_id', '')
ON CONFLICT (chave) DO NOTHING;
