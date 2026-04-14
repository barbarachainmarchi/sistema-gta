-- Rastreia de qual combo/serviço cada item de venda veio
ALTER TABLE venda_itens ADD COLUMN IF NOT EXISTS servico_id uuid REFERENCES servicos(id) ON DELETE SET NULL;
