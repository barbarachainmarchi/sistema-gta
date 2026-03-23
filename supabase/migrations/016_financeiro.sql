-- Contas / bolsos de dinheiro (facção sujo/limpo, membros)
CREATE TABLE financeiro_contas (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome       text NOT NULL,
  tipo       text NOT NULL CHECK (tipo IN ('faccao', 'membro')),
  subtipo    text NOT NULL DEFAULT 'misto' CHECK (subtipo IN ('sujo', 'limpo', 'misto')),
  membro_id  uuid REFERENCES membros(id) ON DELETE SET NULL,
  saldo      numeric NOT NULL DEFAULT 0,
  status     text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at timestamptz DEFAULT now()
);

-- Lançamentos financeiros
CREATE TABLE financeiro_lancamentos (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conta_id            uuid NOT NULL REFERENCES financeiro_contas(id) ON DELETE RESTRICT,
  tipo                text NOT NULL CHECK (tipo IN ('entrada', 'saida', 'transferencia')),
  valor               numeric NOT NULL CHECK (valor > 0),
  descricao           text,
  categoria           text CHECK (categoria IN ('compra', 'venda', 'reembolso', 'ajuste', 'outro')),
  cotacao_id          uuid REFERENCES cotacoes(id) ON DELETE SET NULL,
  conta_destino_id    uuid REFERENCES financeiro_contas(id) ON DELETE SET NULL,
  created_by          uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX financeiro_lancamentos_conta_idx ON financeiro_lancamentos(conta_id);
CREATE INDEX financeiro_lancamentos_created_idx ON financeiro_lancamentos(created_at DESC);
