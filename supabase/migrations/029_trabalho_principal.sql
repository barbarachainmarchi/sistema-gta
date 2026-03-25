-- Indica qual é o trabalho principal quando o usuário tem loja E facção cadastrados
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS trabalho_principal text
  CHECK (trabalho_principal IN ('loja', 'faccao'));
