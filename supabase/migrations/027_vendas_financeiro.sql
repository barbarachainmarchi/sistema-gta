-- Vincula contas financeiras a facções (para auto-criar conta ao entregar venda)
ALTER TABLE financeiro_contas
  ADD COLUMN IF NOT EXISTS faccao_id uuid REFERENCES faccoes(id) ON DELETE SET NULL;

-- Vincula lançamentos a vendas
ALTER TABLE financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS venda_id uuid REFERENCES vendas(id) ON DELETE SET NULL;

-- Permite conta_id nulo para lançamentos do tipo 'venda' sem facção configurada
ALTER TABLE financeiro_lancamentos
  ALTER COLUMN conta_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS financeiro_contas_faccao_idx     ON financeiro_contas(faccao_id);
CREATE INDEX IF NOT EXISTS financeiro_lancamentos_venda_idx ON financeiro_lancamentos(venda_id);

-- Trigger para atualizar saldo automaticamente ao inserir/excluir lançamento
CREATE OR REPLACE FUNCTION financeiro_atualizar_saldo()
RETURNS TRIGGER AS $$
DECLARE
  delta_sujo  numeric := 0;
  delta_limpo numeric := 0;
BEGIN
  -- Calcular delta baseado no tipo
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.tipo IN ('entrada', 'venda') THEN
      IF NEW.tipo_dinheiro = 'sujo'  THEN delta_sujo  :=  NEW.valor; END IF;
      IF NEW.tipo_dinheiro = 'limpo' THEN delta_limpo :=  NEW.valor; END IF;
    ELSIF NEW.tipo = 'saida' THEN
      IF NEW.tipo_dinheiro = 'sujo'  THEN delta_sujo  := -NEW.valor; END IF;
      IF NEW.tipo_dinheiro = 'limpo' THEN delta_limpo := -NEW.valor; END IF;
    END IF;
    IF NEW.conta_id IS NOT NULL THEN
      UPDATE financeiro_contas
        SET saldo_sujo  = saldo_sujo  + delta_sujo,
            saldo_limpo = saldo_limpo + delta_limpo
        WHERE id = NEW.conta_id;
    END IF;
  END IF;

  -- Reverter delta do registro antigo em UPDATE
  IF TG_OP = 'UPDATE' THEN
    delta_sujo := 0; delta_limpo := 0;
    IF OLD.tipo IN ('entrada', 'venda') THEN
      IF OLD.tipo_dinheiro = 'sujo'  THEN delta_sujo  := -OLD.valor; END IF;
      IF OLD.tipo_dinheiro = 'limpo' THEN delta_limpo := -OLD.valor; END IF;
    ELSIF OLD.tipo = 'saida' THEN
      IF OLD.tipo_dinheiro = 'sujo'  THEN delta_sujo  :=  OLD.valor; END IF;
      IF OLD.tipo_dinheiro = 'limpo' THEN delta_limpo :=  OLD.valor; END IF;
    END IF;
    IF OLD.conta_id IS NOT NULL THEN
      UPDATE financeiro_contas
        SET saldo_sujo  = saldo_sujo  + delta_sujo,
            saldo_limpo = saldo_limpo + delta_limpo
        WHERE id = OLD.conta_id;
    END IF;
  END IF;

  -- Reverter ao excluir
  IF TG_OP = 'DELETE' THEN
    IF OLD.tipo IN ('entrada', 'venda') THEN
      IF OLD.tipo_dinheiro = 'sujo'  THEN delta_sujo  := -OLD.valor; END IF;
      IF OLD.tipo_dinheiro = 'limpo' THEN delta_limpo := -OLD.valor; END IF;
    ELSIF OLD.tipo = 'saida' THEN
      IF OLD.tipo_dinheiro = 'sujo'  THEN delta_sujo  :=  OLD.valor; END IF;
      IF OLD.tipo_dinheiro = 'limpo' THEN delta_limpo :=  OLD.valor; END IF;
    END IF;
    IF OLD.conta_id IS NOT NULL THEN
      UPDATE financeiro_contas
        SET saldo_sujo  = saldo_sujo  + delta_sujo,
            saldo_limpo = saldo_limpo + delta_limpo
        WHERE id = OLD.conta_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS financeiro_lancamentos_saldo_trig ON financeiro_lancamentos;
CREATE TRIGGER financeiro_lancamentos_saldo_trig
  AFTER INSERT OR UPDATE OR DELETE ON financeiro_lancamentos
  FOR EACH ROW EXECUTE FUNCTION financeiro_atualizar_saldo();
