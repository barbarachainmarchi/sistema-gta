-- Quem adicionou cada item na cotação
ALTER TABLE cotacao_itens ADD COLUMN IF NOT EXISTS adicionado_por uuid;
ALTER TABLE cotacao_itens ADD COLUMN IF NOT EXISTS adicionado_por_nome text;
