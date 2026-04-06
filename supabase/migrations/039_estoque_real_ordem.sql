-- Renomear quantidade_esperada → quantidade_real
ALTER TABLE estoque_itens_controlados
  RENAME COLUMN quantidade_esperada TO quantidade_real;

-- Adicionar coluna de ordem para drag-and-drop
ALTER TABLE estoque_itens_controlados
  ADD COLUMN IF NOT EXISTS ordem integer DEFAULT 0;
