ALTER TABLE faccao_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE loja_servicos   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faccao_servicos_all" ON faccao_servicos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "loja_servicos_all"   ON loja_servicos   FOR ALL TO authenticated USING (true) WITH CHECK (true);
