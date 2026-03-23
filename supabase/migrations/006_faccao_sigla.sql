-- Sigla/abreviação para identificação rápida da facção
ALTER TABLE faccoes ADD COLUMN IF NOT EXISTS sigla text;
