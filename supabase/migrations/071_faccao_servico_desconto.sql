CREATE TABLE IF NOT EXISTS faccao_servico_desconto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faccao_id uuid NOT NULL REFERENCES faccoes(id) ON DELETE CASCADE,
  servico_id uuid NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
  desconto_pct numeric NOT NULL DEFAULT 0,
  modo text NOT NULL DEFAULT 'pct',
  preco_especial numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE(faccao_id, servico_id)
);

ALTER TABLE faccao_servico_desconto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON faccao_servico_desconto
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
