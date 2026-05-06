-- Migration 060: tags visuais, campos cancelamento e permissão exclusão suprema
-- Rodar no Supabase SQL Editor

ALTER TABLE vendas ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cancelado_por text DEFAULT NULL;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cancelado_por_nome text DEFAULT NULL;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cancelado_em timestamptz DEFAULT NULL;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS exclusao_suprema boolean DEFAULT false;
