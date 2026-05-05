-- Adiciona flag e observação de parceria na tabela de facções
alter table faccoes
  add column if not exists tem_parceria boolean not null default false,
  add column if not exists parceria_obs text;
