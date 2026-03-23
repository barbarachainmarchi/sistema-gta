-- Remove FK constraint que causava 409, adiciona nome do criador como texto
ALTER TABLE cotacoes DROP CONSTRAINT IF EXISTS cotacoes_created_by_fkey;
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS criado_por_nome text;
