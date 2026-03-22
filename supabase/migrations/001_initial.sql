-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- CATEGORIAS DE ITEM
-- =============================================
create table categorias_item (
  id uuid primary key default uuid_generate_v4(),
  nome text not null unique,
  descricao text,
  created_at timestamptz default now()
);

-- =============================================
-- ITEMS (produtos, materiais, tudo)
-- =============================================
create table items (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  descricao text,
  categoria_id uuid references categorias_item(id) on delete set null,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  tem_craft boolean not null default false,
  eh_meu_produto boolean not null default false,
  eh_compravel boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index items_nome_idx on items(nome);
create index items_status_idx on items(status);

-- =============================================
-- RECEITA DE CRAFT
-- =============================================
create table item_receita (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references items(id) on delete cascade,
  ingrediente_id uuid not null references items(id) on delete cascade,
  quantidade numeric not null check (quantidade > 0),
  unique(item_id, ingrediente_id)
);

-- =============================================
-- PREÇOS DOS NOSSOS PRODUTOS (com histórico)
-- =============================================
create table item_precos (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references items(id) on delete cascade,
  preco_sujo numeric check (preco_sujo >= 0),
  preco_limpo numeric check (preco_limpo >= 0),
  data_inicio date not null,
  criado_por uuid,
  created_at timestamptz default now()
);

create index item_precos_item_data_idx on item_precos(item_id, data_inicio desc);

-- View para pegar o preço vigente de cada item
create or replace view item_preco_vigente as
select distinct on (item_id)
  item_id,
  preco_sujo,
  preco_limpo,
  data_inicio
from item_precos
where data_inicio <= current_date
order by item_id, data_inicio desc;

-- =============================================
-- LOJAS / FORNECEDORES EXTERNOS
-- =============================================
create table lojas (
  id uuid primary key default uuid_generate_v4(),
  nome text not null unique,
  localizacao text,
  tipo text,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz default now()
);

create table loja_item_precos (
  id uuid primary key default uuid_generate_v4(),
  loja_id uuid not null references lojas(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  preco numeric not null check (preco >= 0),
  atualizado_por uuid,
  updated_at timestamptz default now(),
  unique(loja_id, item_id)
);

-- =============================================
-- INVESTIGAÇÃO
-- =============================================
create table faccoes (
  id uuid primary key default uuid_generate_v4(),
  nome text not null unique,
  descricao text,
  territorio text,
  cor_tag text default '#6366f1',
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table membros (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  vulgo text,
  telefone text,
  faccao_id uuid references faccoes(id) on delete set null,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index membros_faccao_idx on membros(faccao_id);
create index membros_nome_idx on membros(nome);

create table veiculos (
  id uuid primary key default uuid_generate_v4(),
  placa text not null unique,
  modelo text,
  cor text,
  proprietario_tipo text check (proprietario_tipo in ('membro', 'faccao', 'desconhecido')),
  proprietario_id uuid,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- USUÁRIOS E PERMISSÕES
-- =============================================
create table perfis_acesso (
  id uuid primary key default uuid_generate_v4(),
  nome text not null unique,
  descricao text,
  created_at timestamptz default now()
);

create table perfil_permissoes (
  id uuid primary key default uuid_generate_v4(),
  perfil_id uuid not null references perfis_acesso(id) on delete cascade,
  modulo text not null,
  pode_ver boolean not null default false,
  pode_editar boolean not null default false,
  unique(perfil_id, modulo)
);

create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  cargo text,
  perfil_id uuid references perfis_acesso(id) on delete set null,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz default now()
);

-- =============================================
-- LOGS DO SISTEMA
-- =============================================
create table logs (
  id uuid primary key default uuid_generate_v4(),
  usuario_id uuid references usuarios(id) on delete set null,
  usuario_nome text,
  acao text not null,
  modulo text not null,
  entidade_tipo text,
  entidade_id text,
  detalhes jsonb,
  created_at timestamptz default now()
);

create index logs_created_at_idx on logs(created_at desc);
create index logs_modulo_idx on logs(modulo);

-- =============================================
-- TRIGGER: updated_at automático
-- =============================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger items_updated_at before update on items
  for each row execute function update_updated_at();

create trigger faccoes_updated_at before update on faccoes
  for each row execute function update_updated_at();

create trigger membros_updated_at before update on membros
  for each row execute function update_updated_at();

-- =============================================
-- DADOS INICIAIS
-- =============================================
insert into categorias_item (nome) values
  ('Armas'),
  ('Munições'),
  ('Materiais'),
  ('Drogas'),
  ('Eletrônicos'),
  ('Veículos'),
  ('Outros');

insert into perfis_acesso (nome, descricao) values
  ('admin', 'Acesso total ao sistema'),
  ('vendedor', 'Acesso a vendas e cadastros'),
  ('consultor', 'Apenas visualização');

insert into perfil_permissoes (perfil_id, modulo, pode_ver, pode_editar)
select id, modulo, pode_ver, pode_editar
from perfis_acesso, (values
  ('admin', 'investigacao', true, true),
  ('admin', 'vendas', true, true),
  ('admin', 'encomendas', true, true),
  ('admin', 'ferramentas', true, true),
  ('admin', 'interno', true, true),
  ('admin', 'metas', true, true),
  ('admin', 'financeiro', true, true),
  ('admin', 'admin', true, true),
  ('vendedor', 'vendas', true, true),
  ('vendedor', 'ferramentas', true, false),
  ('vendedor', 'investigacao', true, false),
  ('consultor', 'vendas', true, false),
  ('consultor', 'ferramentas', true, false)
) as perms(perfil_nome, modulo, pode_ver, pode_editar)
where perfis_acesso.nome = perms.perfil_nome;
