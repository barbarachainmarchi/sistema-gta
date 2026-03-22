-- =============================================
-- CONFIGURAÇÕES DO SISTEMA
-- =============================================
create table config_sistema (
  chave text primary key,
  valor text not null,
  updated_at timestamptz default now()
);

-- Tema padrão
insert into config_sistema (chave, valor) values
  ('tema', '{"accentH":0,"accentS":0,"accentL":90,"nomeSistema":"Sistema GTA"}');
