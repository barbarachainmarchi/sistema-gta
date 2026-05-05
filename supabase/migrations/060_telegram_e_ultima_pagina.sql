-- Rastreia qual página o usuário acessou por último
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultima_pagina text;

-- Destinos Telegram: cada registro é um bot+chat que recebe notificações
CREATE TABLE IF NOT EXISTS telegram_destinos (
  id         uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text      NOT NULL,
  bot_token  text      NOT NULL,
  chat_id    text      NOT NULL,
  ativo      boolean   DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Quais tipos de log cada destino recebe
CREATE TABLE IF NOT EXISTS telegram_tipos_log (
  destino_id uuid    NOT NULL REFERENCES telegram_destinos(id) ON DELETE CASCADE,
  tipo       text    NOT NULL,
  ativo      boolean DEFAULT true,
  PRIMARY KEY (destino_id, tipo)
);

ALTER TABLE telegram_destinos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_tipos_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_telegram_destinos" ON telegram_destinos
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth_telegram_tipos_log" ON telegram_tipos_log
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
