-- Cotações (rascunho de compras)
CREATE TABLE cotacoes (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo          text,
  fornecedor_tipo text NOT NULL CHECK (fornecedor_tipo IN ('faccao', 'loja', 'livre')),
  fornecedor_id   uuid,
  fornecedor_nome text NOT NULL,
  modo_preco      text NOT NULL DEFAULT 'limpo' CHECK (modo_preco IN ('sujo', 'limpo')),
  status          text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'finalizada', 'cancelada')),
  created_by      uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Pessoas dentro de uma cotação
CREATE TABLE cotacao_pessoas (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cotacao_id  uuid NOT NULL REFERENCES cotacoes(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  membro_id   uuid REFERENCES membros(id) ON DELETE SET NULL,
  criado_at   timestamptz DEFAULT now()
);

-- Itens de cada pessoa
CREATE TABLE cotacao_itens (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cotacao_id  uuid NOT NULL REFERENCES cotacoes(id) ON DELETE CASCADE,
  pessoa_id   uuid REFERENCES cotacao_pessoas(id) ON DELETE CASCADE,
  item_nome   text NOT NULL,
  item_id     uuid REFERENCES items(id) ON DELETE SET NULL,
  quantidade  numeric NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  preco_unit  numeric NOT NULL DEFAULT 0 CHECK (preco_unit >= 0),
  criado_at   timestamptz DEFAULT now()
);

CREATE TRIGGER cotacoes_updated_at BEFORE UPDATE ON cotacoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
