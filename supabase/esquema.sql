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
  fim text not null default '',
  -- Receita informada pelo salário bruto: o app simula o líquido até ele ser confirmado.
  bruto numeric(12, 2) not null default 0 check (bruto >= 0),
  regime text not null default 'clt' check (regime in ('clt', 'outro')),
  dependentes integer not null default 0 check (dependentes between 0 and 20),
  outros_descontos numeric(12, 2) not null default 0 check (outros_descontos >= 0),
  -- Conta da casa ou assinatura; cobrança mensal ou anual (no mês mes_anual).
  natureza text not null default 'conta' check (natureza in ('conta', 'assinatura')),
  periodicidade text not null default 'mensal' check (periodicidade in ('mensal', 'anual')),
  mes_anual integer not null default 0 check (mes_anual between 0 and 12),
  constraint fixas_anual_tem_mes check (periodicidade = 'mensal' or mes_anual between 1 and 12)
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

-- Quem pode entrar no app. As senhas ficam só como hash scrypt, gerado pelo próprio app.
create table public.usuarios (
  email text primary key check (email = lower(email)),
  pessoa text not null unique check (pessoa in ('a', 'b')),
  senha_hash text not null,
  falhas integer not null default 0,
  bloqueado_ate timestamptz
);

alter table public.usuarios enable row level security;
grant select, update on public.usuarios to anon;
create policy app_com_segredo on public.usuarios for all to anon
  using ((select privado.pedido_autorizado())) with check ((select privado.pedido_autorizado()));

-- Comprovantes (fotos e PDFs) anexados a um lançamento, ou à compra inteira quando parcelada.
create table public.comprovantes (
  id text primary key check (id ~ '^[a-f0-9]{16,32}$'),
  -- id do lançamento, ou o grupo das parcelas
  dono text not null check (length(dono) between 1 and 40),
  nome text not null default '' check (length(nome) <= 120),
  tipo text not null check (tipo in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf')),
  tamanho integer not null check (tamanho between 1 and 3200000),
  -- o arquivo em base64
  conteudo text not null,
  criado_em timestamptz not null default now(),
  criado_por text not null default '' check (criado_por in ('', 'a', 'b'))
);
create index comprovantes_dono on public.comprovantes (dono);

alter table public.comprovantes enable row level security;
grant select, insert, delete on public.comprovantes to anon;
-- Comprovante não se edita: só se cria e se apaga.
revoke update, truncate, references, trigger on public.comprovantes from anon, authenticated;
create policy app_com_segredo on public.comprovantes for all to anon
  using ((select privado.pedido_autorizado())) with check ((select privado.pedido_autorizado()));

-- Tudo o que cada um fez no app. Só se inclui e se lê: o histórico não se altera nem se apaga.
create table public.atividades (
  id text primary key check (id ~ '^[a-f0-9]{16,32}$'),
  quando timestamptz not null default now(),
  quem text not null check (quem in ('a', 'b')),
  tipo text not null check (length(tipo) between 1 and 40),
  resumo text not null check (length(resumo) <= 400),
  mudancas jsonb not null default '[]'::jsonb,
  alvo text not null default '' check (length(alvo) <= 60)
);
create index atividades_quando on public.atividades (quando desc, id desc);

alter table public.atividades enable row level security;
revoke all on public.atividades from anon, authenticated;
grant select, insert on public.atividades to anon;
create policy app_com_segredo on public.atividades for all to anon
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
