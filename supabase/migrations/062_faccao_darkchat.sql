-- Marca facções que operam no Darkchat
ALTER TABLE faccoes ADD COLUMN IF NOT EXISTS is_darkchat boolean NOT NULL DEFAULT false;
