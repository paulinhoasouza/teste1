-- Esquema do banco do app "A dois" (Postgres no Supabase).
-- Valores em reais com duas casas; o app trabalha em centavos e converte na borda.

create table public.categorias (
  id text primary key,
  nome text not null,
  tipo text not null check (tipo in ('despesa', 'receita')),
  orcamento numeric(12, 2) not null default 0 check (orcamento >= 0),
  ordem integer not null default 0,
  arquivada boolean not null default false
);

create table public.fixas (
  id text primary key,
  descricao text not null,
  tipo text not null check (tipo in ('despesa', 'receita')),
  valor numeric(12, 2) not null check (valor > 0),
  dia integer not null check (dia between 1 and 31),
  categoria text not null default '',
  pago_por text not null check (pago_por in ('a', 'b')),
  de_quem text not null check (de_quem in ('a', 'b', 'casal')),
  parte_a integer not null default 50 check (parte_a between 0 and 100),
  ativa boolean not null default true,
  inicio text not null default '',
  fim text not null default ''
);

create table public.lancamentos (
  id text primary key,
  data date not null,
  tipo text not null check (tipo in ('despesa', 'receita', 'acerto')),
  descricao text not null default '',
  valor numeric(12, 2) not null check (valor > 0),
  categoria text not null default '',
  pago_por text not null check (pago_por in ('a', 'b')),
  de_quem text not null check (de_quem in ('a', 'b', 'casal')),
  parte_a integer not null default 50 check (parte_a between 0 and 100),
  parcela text not null default '',
  grupo text not null default '',
  fixa_id text not null default '',
  mes_ref text not null default '',
  criado_em timestamptz not null default now(),
  criado_por text not null default ''
);

create index lancamentos_data on public.lancamentos (data);
create index lancamentos_grupo on public.lancamentos (grupo) where grupo <> '';
-- Uma conta fixa só pode ser quitada uma vez por mês.
create unique index lancamentos_fixa_do_mes on public.lancamentos (fixa_id, mes_ref) where fixa_id <> '';

-- Configuração do casal: uma linha só.
create table public.config (
  id integer primary key default 1 check (id = 1),
  nome_a text not null default '',
  nome_b text not null default '',
  cor_a text not null default 'azul',
  cor_b text not null default 'laranja',
  parte_a_padrao integer not null default 50 check (parte_a_padrao between 0 and 100)
);

-- Acesso: só passa o pedido que traz, no cabeçalho x-app-chave, o segredo do app.
-- O banco guarda apenas o SHA-256 do segredo; o valor fica na variável BANCO_SEGREDO da Vercel.
create schema if not exists privado;

create function privado.pedido_autorizado() returns boolean
language sql stable
set search_path = ''
as $$
  select encode(
    sha256(convert_to(coalesce(
      nullif(current_setting('request.headers', true), '')::json ->> 'x-app-chave', ''
    ), 'UTF8')),
    'hex'
  ) = '__SHA256_DO_BANCO_SEGREDO__';
$$;

grant usage on schema privado to anon;
grant execute on function privado.pedido_autorizado() to anon;

alter table public.categorias enable row level security;
alter table public.fixas enable row level security;
alter table public.lancamentos enable row level security;
alter table public.config enable row level security;

grant select, insert, update, delete on public.categorias, public.fixas, public.lancamentos, public.config to anon;

create policy app_com_segredo on public.categorias for all to anon
  using ((select privado.pedido_autorizado())) with check ((select privado.pedido_autorizado()));
create policy app_com_segredo on public.fixas for all to anon
  using ((select privado.pedido_autorizado())) with check ((select privado.pedido_autorizado()));
create policy app_com_segredo on public.lancamentos for all to anon
  using ((select privado.pedido_autorizado())) with check ((select privado.pedido_autorizado()));
create policy app_com_segredo on public.config for all to anon
  using ((select privado.pedido_autorizado())) with check ((select privado.pedido_autorizado()));

insert into public.config (id, nome_a, nome_b) values (1, 'Paulo', 'Giovana');

insert into public.categorias (id, nome, tipo, ordem) values
  ('mercado', 'Mercado', 'despesa', 1),
  ('restaurantes', 'Restaurantes e delivery', 'despesa', 2),
  ('transporte', 'Transporte', 'despesa', 3),
  ('moradia', 'Moradia', 'despesa', 4),
  ('contas-da-casa', 'Contas da casa', 'despesa', 5),
  ('saude', 'Saúde', 'despesa', 6),
  ('lazer', 'Lazer', 'despesa', 7),
  ('compras', 'Compras', 'despesa', 8),
  ('assinaturas', 'Assinaturas', 'despesa', 9),
  ('outros', 'Outros', 'despesa', 10),
  ('salario', 'Salário', 'receita', 11),
  ('outras-receitas', 'Outras receitas', 'receita', 12);
