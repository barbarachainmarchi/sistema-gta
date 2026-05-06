-- Migration 066: Permite deletar registros de sistema_solicitacoes
-- Sem essa política, o RLS bloqueava deletes silenciosamente (sem erro, sem efeito)
CREATE POLICY "sol_delete" ON sistema_solicitacoes FOR DELETE TO authenticated USING (true);
