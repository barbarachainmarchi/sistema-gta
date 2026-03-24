-- Telefone e desconto padrão nas facções (para integração com vendas)
ALTER TABLE faccoes
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS desconto_padrao_pct numeric NOT NULL DEFAULT 0
    CHECK (desconto_padrao_pct >= 0 AND desconto_padrao_pct <= 100);

-- Estoque de itens (matéria-prima e produto final)
CREATE TABLE IF NOT EXISTS estoque (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id     uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  tipo        text NOT NULL DEFAULT 'produto_final'
              CHECK (tipo IN ('materia_prima', 'produto_final')),
  quantidade  numeric NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(item_id, tipo)
);

-- Vendas / Pedidos
CREATE TABLE IF NOT EXISTS vendas (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  faccao_id         uuid REFERENCES faccoes(id) ON DELETE SET NULL,
  cliente_nome      text NOT NULL,
  cliente_telefone  text,
  tipo_dinheiro     text NOT NULL DEFAULT 'limpo'
                    CHECK (tipo_dinheiro IN ('sujo', 'limpo')),
  desconto_pct      numeric NOT NULL DEFAULT 0
                    CHECK (desconto_pct >= 0 AND desconto_pct <= 100),
  status            text NOT NULL DEFAULT 'fabricando'
                    CHECK (status IN ('fabricando','encomenda','separado','pronto','entregue','cancelado')),
  data_encomenda    date,
  notas             text,
  criado_por        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_por_nome   text,
  entregue_por      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entregue_por_nome text,
  entregue_em       timestamptz,
  estoque_descontado boolean NOT NULL DEFAULT false,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Itens de cada pedido
CREATE TABLE IF NOT EXISTS venda_itens (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  venda_id   uuid NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  item_id    uuid REFERENCES items(id) ON DELETE SET NULL,
  item_nome  text NOT NULL,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  preco_unit numeric NOT NULL DEFAULT 0 CHECK (preco_unit >= 0),
  origem     text NOT NULL DEFAULT 'fabricar'
             CHECK (origem IN ('fabricar', 'estoque'))
);

DROP TRIGGER IF EXISTS vendas_updated_at ON vendas;
CREATE TRIGGER vendas_updated_at BEFORE UPDATE ON vendas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS estoque_updated_at ON estoque;
CREATE TRIGGER estoque_updated_at BEFORE UPDATE ON estoque
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
