-- Facção principal do servidor (usada para auto-associar membros na investigação)
INSERT INTO config_sistema (chave, valor)
VALUES ('faccao_servidor_id', '')
ON CONFLICT (chave) DO NOTHING;
