-- Rastreia quando o usuário acessou o sistema por último (para status online)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_acesso timestamptz;
