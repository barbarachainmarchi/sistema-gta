-- Serviços/combos vinculados a facções e lojas
CREATE TABLE faccao_servicos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  faccao_id UUID NOT NULL REFERENCES faccoes(id) ON DELETE CASCADE,
  servico_id UUID NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
  UNIQUE(faccao_id, servico_id)
);

CREATE TABLE loja_servicos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
  servico_id UUID NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
  UNIQUE(loja_id, servico_id)
);
