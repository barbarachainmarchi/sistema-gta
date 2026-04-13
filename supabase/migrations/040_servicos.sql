-- Serviços / Combos: agrupamento de itens com preço especial de kit
CREATE TABLE IF NOT EXISTS servicos (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome         text NOT NULL,
  descricao    text,
  preco_sujo   numeric CHECK (preco_sujo >= 0),
  preco_limpo  numeric CHECK (preco_limpo >= 0),
  desconto_pct numeric NOT NULL DEFAULT 0
               CHECK (desconto_pct >= 0 AND desconto_pct <= 100),
  status       text NOT NULL DEFAULT 'ativo'
               CHECK (status IN ('ativo', 'inativo')),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- Itens que compõem cada serviço/combo
CREATE TABLE IF NOT EXISTS servico_itens (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  servico_id uuid NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
  item_id    uuid NOT NULL REFERENCES items(id)    ON DELETE CASCADE,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  UNIQUE(servico_id, item_id)
);

DROP TRIGGER IF EXISTS servicos_updated_at ON servicos;
CREATE TRIGGER servicos_updated_at BEFORE UPDATE ON servicos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
