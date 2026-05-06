-- Migration 065: Controle de presenças/ausências por membro

CREATE TABLE presencas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membro_id uuid NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
  data date NOT NULL,
  presente boolean NOT NULL DEFAULT true,
  motivo text DEFAULT NULL,           -- obrigatório quando presente=false
  registrado_por_user_id text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(membro_id, data)
);

ALTER TABLE presencas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON presencas FOR ALL TO authenticated USING (true) WITH CHECK (true);
