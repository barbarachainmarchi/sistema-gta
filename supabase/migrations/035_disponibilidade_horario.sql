-- Horário de disponibilidade do membro
ALTER TABLE usuarios_disponibilidade
  ADD COLUMN IF NOT EXISTS hora_inicio time,
  ADD COLUMN IF NOT EXISTS hora_fim time;
