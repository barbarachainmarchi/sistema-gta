-- Placa do veículo passa a ser opcional
ALTER TABLE veiculos ALTER COLUMN placa DROP NOT NULL;

-- Campos extras em membros
ALTER TABLE membros ADD COLUMN IF NOT EXISTS instagram text;
ALTER TABLE membros ADD COLUMN IF NOT EXISTS deep text;

-- Campo deep em facções
ALTER TABLE faccoes ADD COLUMN IF NOT EXISTS deep text;
