-- Vincula usuário do sistema a um membro da investigação
ALTER TABLE usuarios ADD COLUMN membro_id uuid REFERENCES membros(id) ON DELETE SET NULL;
