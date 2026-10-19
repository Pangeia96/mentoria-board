-- mentoria-board · schema inicial (migration 0001)
-- Postgres no Supabase. Horários em timestamptz (UTC).
--
-- Decisão central: os OBJETOS do quadro (stickies, formas, setas, traços, frames)
-- NÃO viram linhas de tabela. Eles vivem num documento Yjs (CRDT) por quadro,
-- salvo como binário em board_docs. Isso dá merge sem conflito, desfazer por usuário
-- e offline curto de graça. O Postgres guarda o que precisa de consulta/permissão:
-- quadros, membros, links, visitantes, comentários, arquivos.
--
-- Acesso:
--   * Mentor (logado no Supabase Auth): RLS nas tabelas abaixo.
--   * Visitante (sem conta): NUNCA fala direto com o Supabase. Tudo passa por
--     server actions do Next.js com a service role + checagem explícita do
--     token do link/visitante, e pelo servidor Hocuspocus (onAuthenticate).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- helpers
create or replace function set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- profiles
-- 1:1 com auth.users (só mentores e, no futuro, clientes que criarem conta)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on profiles
  for each row execute function set_updated_at();

-- cria o profile automaticamente no cadastro
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
          new.raw_user_meta_data->>'avatar_url');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------- boards
create table boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  client_name text check (client_name is null or length(client_name) <= 120),
  thumbnail_path text,                     -- caminho no Storage, gerado em job
  deleted_at timestamptz,                  -- lixeira: some do painel, apagado de vez em 30 dias
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index boards_owner_recent on boards (owner_id, updated_at desc) where deleted_at is null;
create index boards_owner_client on boards (owner_id, client_name) where deleted_at is null;
create index boards_deleted on boards (deleted_at) where deleted_at is not null;
create trigger boards_updated before update on boards
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- membros com conta
create table board_members (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('owner','editor','commenter','viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, user_id)
);
create index board_members_user on board_members (user_id);
create trigger board_members_updated before update on board_members
  for each row execute function set_updated_at();

-- o dono vira membro 'owner' automaticamente
create or replace function add_owner_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.board_members (board_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end $$;
create trigger boards_add_owner after insert on boards
  for each row execute function add_owner_member();

-- ---------------------------------------------------------------- links de compartilhamento
create table share_links (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  role text not null default 'editor' check (role in ('editor','commenter','viewer')),
  ask_visitor_name boolean not null default true,
  enabled boolean not null default true,
  expires_at timestamptz,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- no máximo um link ATIVO por quadro (reaproveita em vez de criar vários)
create unique index share_links_one_active on share_links (board_id) where enabled;
create index share_links_board on share_links (board_id);
create index share_links_created_by on share_links (created_by);
create trigger share_links_updated before update on share_links
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- visitantes (sem conta)
-- Um registro por navegador que entrou pelo link. Permite: nome no cursor,
-- autoria de comentário, e "remover pessoa" (revoked_at) sem matar o link.
create table board_guests (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  share_link_id uuid not null references share_links(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 60),
  color text not null check (color ~ '^p[1-8]$'),  -- token de presença (tokens.json → presence.p1..p8)
  revoked_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index board_guests_board on board_guests (board_id, last_seen_at desc);
create index board_guests_link on board_guests (share_link_id);
create trigger board_guests_updated before update on board_guests
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- documento do quadro (Yjs)
create table board_docs (
  board_id uuid primary key references boards(id) on delete cascade,
  ydoc bytea not null,                     -- Y.encodeStateAsUpdate(doc)
  version bigint not null default 0,       -- incrementa a cada store do Hocuspocus
  size_bytes integer generated always as (octet_length(ydoc)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger board_docs_updated before update on board_docs
  for each row execute function set_updated_at();

-- Gravação atômica pelo servidor de tempo real (service role). version++ a cada store.
create or replace function store_board_doc(b uuid, doc bytea) returns bigint
language sql set search_path = '' as $$
  insert into public.board_docs (board_id, ydoc, version) values (b, doc, 1)
  on conflict (board_id) do update set ydoc = excluded.ydoc, version = public.board_docs.version + 1
  returning version
$$;
revoke execute on function store_board_doc(uuid, bytea) from public, anon, authenticated;
grant execute on function store_board_doc(uuid, bytea) to service_role;

-- snapshots para histórico de versões / recuperação (should/could)
create table board_snapshots (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  ydoc bytea not null,
  reason text not null default 'auto' check (reason in ('auto','manual','before_restore')),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index board_snapshots_board on board_snapshots (board_id, created_at desc);
create index board_snapshots_created_by on board_snapshots (created_by);

-- ---------------------------------------------------------------- comentários
create table comment_threads (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  item_id text,                            -- id do objeto dentro do Yjs (nullable = pino solto)
  x double precision not null,             -- posição no canvas (fallback se o item sumir)
  y double precision not null,
  resolved_at timestamptz,
  created_by_user uuid references profiles(id) on delete set null,
  created_by_guest uuid references board_guests(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comment_threads_board on comment_threads (board_id, resolved_at, created_at desc);
create index comment_threads_user on comment_threads (created_by_user);
create index comment_threads_guest on comment_threads (created_by_guest);
create trigger comment_threads_updated before update on comment_threads
  for each row execute function set_updated_at();

create table comments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references comment_threads(id) on delete cascade,
  author_user uuid references profiles(id) on delete set null,
  author_guest uuid references board_guests(id) on delete set null,
  author_name text not null,               -- congelado: o nome continua se o visitante for apagado
  body text not null check (length(trim(body)) between 1 and 5000),
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_thread on comments (thread_id, created_at);
create index comments_author_user on comments (author_user);
create index comments_author_guest on comments (author_guest);
create trigger comments_updated before update on comments
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------- arquivos (imagens no quadro)
create table board_assets (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  storage_path text not null unique,       -- bucket 'board-assets'/<board_id>/<id>.<ext>
  mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp','image/gif','image/svg+xml')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),  -- 10 MB
  width integer, height integer,
  uploaded_by_user uuid references profiles(id) on delete set null,
  uploaded_by_guest uuid references board_guests(id) on delete set null,
  created_at timestamptz not null default now()
);
create index board_assets_board on board_assets (board_id);
create index board_assets_user on board_assets (uploaded_by_user);
create index board_assets_guest on board_assets (uploaded_by_guest);

-- ================================================================ RLS
-- Mentor/membro logado acessa pelo client do Supabase com estas regras.
-- Visitantes: só via service role no servidor (RLS não se aplica), com checagem no código.

create or replace function board_role(b uuid) returns text
language sql stable security definer set search_path = '' as $$
  select role from public.board_members where board_id = b and user_id = (select auth.uid())
$$;
revoke execute on function board_role(uuid) from anon;

alter table profiles        enable row level security;
alter table boards          enable row level security;
alter table board_members   enable row level security;
alter table share_links     enable row level security;
alter table board_guests    enable row level security;
alter table board_docs      enable row level security;
alter table board_snapshots enable row level security;
alter table comment_threads enable row level security;
alter table comments        enable row level security;
alter table board_assets    enable row level security;

create policy "ver próprio perfil" on profiles for select using (id = (select auth.uid()));
create policy "editar próprio perfil" on profiles for update using (id = (select auth.uid()));

create policy "membros veem o quadro" on boards for select
  using (owner_id = (select auth.uid()) or board_role(id) is not null);
create policy "mentor cria quadro" on boards for insert
  with check (owner_id = (select auth.uid()));
create policy "dono altera quadro" on boards for update
  using (owner_id = (select auth.uid()));
create policy "dono apaga quadro" on boards for delete
  using (owner_id = (select auth.uid()));

create policy "membros veem membros" on board_members for select
  using (board_role(board_id) is not null);
create policy "dono gerencia membros" on board_members for all
  using (board_role(board_id) = 'owner') with check (board_role(board_id) = 'owner');

create policy "dono gerencia links" on share_links for all
  using (board_role(board_id) = 'owner') with check (board_role(board_id) = 'owner');

create policy "membros veem visitantes" on board_guests for select
  using (board_role(board_id) is not null);
create policy "dono revoga visitantes" on board_guests for update
  using (board_role(board_id) = 'owner');

-- board_docs: só o servidor Hocuspocus (service role) lê/escreve. Sem policy = negado ao client.

create policy "membros veem snapshots" on board_snapshots for select
  using (board_role(board_id) in ('owner','editor'));

create policy "membros veem threads" on comment_threads for select
  using (board_role(board_id) is not null);
create policy "comentaristas criam threads" on comment_threads for insert
  with check (board_role(board_id) in ('owner','editor','commenter') and created_by_user = (select auth.uid()));
create policy "comentaristas resolvem threads" on comment_threads for update
  using (board_role(board_id) in ('owner','editor','commenter'));

create policy "membros veem comentários" on comments for select
  using (exists (select 1 from comment_threads t where t.id = thread_id and board_role(t.board_id) is not null));
create policy "comentaristas comentam" on comments for insert
  with check (author_user = (select auth.uid()) and exists (
    select 1 from comment_threads t where t.id = thread_id
      and board_role(t.board_id) in ('owner','editor','commenter')));
create policy "autor edita comentário" on comments for update
  using (author_user = (select auth.uid()));
create policy "autor apaga comentário" on comments for delete
  using (author_user = (select auth.uid()));

create policy "membros veem arquivos" on board_assets for select
  using (board_role(board_id) is not null);
create policy "editores sobem arquivos" on board_assets for insert
  with check (board_role(board_id) in ('owner','editor') and uploaded_by_user = (select auth.uid()));
