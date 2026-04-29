-- Produtos manuais por facção — itens específicos que vendemos para essa facção
-- mas que não fazem parte do catálogo global de items.
CREATE TABLE IF NOT EXISTS faccao_produto_extra (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  faccao_id uuid NOT NULL REFERENCES faccoes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  valor_sujo numeric,
  valor_limpo numeric,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS faccao_produto_extra_faccao_idx ON faccao_produto_extra(faccao_id);

ALTER TABLE faccao_produto_extra ENABLE ROW LEVEL SECURITY;
CREATE POLICY "autenticados podem tudo em faccao_produto_extra"
  ON faccao_produto_extra FOR ALL TO authenticated USING (true) WITH CHECK (true);
