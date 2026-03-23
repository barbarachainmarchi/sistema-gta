-- Membros da própria equipe/empresa, com controle de entrada/saída
ALTER TABLE membros ADD COLUMN membro_proprio boolean DEFAULT false NOT NULL;
ALTER TABLE membros ADD COLUMN data_entrada date;
ALTER TABLE membros ADD COLUMN data_saida date;
