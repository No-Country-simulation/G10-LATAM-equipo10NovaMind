-- NuevaMente: Google/Email Auth and private persistence per user.
-- Apply in Supabase SQL Editor as postgres. Existing OCI storage is supported.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  original_filename text,
  mime_type text,
  source_text text,
  storage_provider text check (storage_provider in ('supabase', 'oci', 'local')),
  storage_path text,
  size_bytes bigint check (size_bytes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.learning_packages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  document_id uuid,
  title text not null check (length(trim(title)) > 0),
  parameters jsonb not null default '{}'::jsonb check (jsonb_typeof(parameters) = 'object'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  storage_provider text check (storage_provider in ('supabase', 'oci', 'local')),
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (document_id, user_id) references public.documents(id, user_id)
);

create table public.learning_progress (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  package_id uuid not null,
  current_step smallint not null default 1 check (current_step between 1 and 3),
  active_station_index smallint not null default 0 check (active_station_index between 0 and 4),
  completed_stations jsonb not null default '{}'::jsonb check (jsonb_typeof(completed_stations) = 'object'),
  quiz_answers jsonb not null default '{}'::jsonb check (jsonb_typeof(quiz_answers) = 'object'),
  cognitive_shields smallint not null default 3 check (cognitive_shields between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, package_id),
  foreign key (package_id, user_id) references public.learning_packages(id, user_id) on delete cascade
);

create table public.user_state (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  xp bigint not null default 0 check (xp >= 0),
  streak_days integer not null default 0 check (streak_days >= 0),
  last_activity_at timestamptz,
  achievements jsonb not null default '[]'::jsonb check (jsonb_typeof(achievements) = 'array'),
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_user_created_idx on public.documents(user_id, created_at desc);
create index packages_user_created_idx on public.learning_packages(user_id, created_at desc);
create index packages_document_owner_idx on public.learning_packages(document_id, user_id);
create index progress_package_owner_idx on public.learning_progress(package_id, user_id);

create function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;

create function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  ) on conflict (id) do nothing;
  insert into public.user_state(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger nuevamente_user_created after insert on auth.users
for each row execute function private.handle_new_user();

-- Do not use metadata for authorization: ownership always comes from auth.uid().
alter table public.profiles enable row level security;
create policy profiles_own_rows on public.profiles for all to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare table_name text;
begin
  foreach table_name in array array['documents', 'learning_packages', 'learning_progress', 'user_state']
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy own_rows on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      table_name
    );
  end loop;
  foreach table_name in array array['profiles', 'documents', 'learning_packages', 'learning_progress', 'user_state']
  loop
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      table_name
    );
  end loop;
end;
$$;

-- Originals can remain in OCI. This optional bucket is private and uses UID/path ownership.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 20971520, array[
  'application/pdf', 'text/plain', 'text/markdown', 'text/x-markdown'
]);

create policy documents_storage_read on storage.objects for select to authenticated
using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy documents_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy documents_storage_update on storage.objects for update to authenticated
using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy documents_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

comment on table public.learning_packages is 'Full backend/frontend JSON result; only its owner can access it.';
comment on table public.learning_progress is 'Per-package stations, quiz answers and remaining shields.';
comment on table public.user_state is 'Private UI state; client-supplied XP is not an authoritative leaderboard.';

commit;
