-- Tabela de convites para cadastro via link
CREATE TABLE IF NOT EXISTS convites (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token      TEXT        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  criado_por UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  usado_em   TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Apenas o service role acessa esta tabela (RLS ativado mas sem policies públicas)
ALTER TABLE convites ENABLE ROW LEVEL SECURITY;

-- Atualiza a coluna status da tabela usuarios para aceitar 'pendente'
ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_status_check;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_status_check
  CHECK (status IN ('ativo', 'inativo', 'pendente'));
