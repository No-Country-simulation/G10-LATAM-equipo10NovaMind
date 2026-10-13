-- NuevaMente · Etapa 4: estado persistido de cada recurso de la generación paralela.
-- Ejecutar en Supabase SQL Editor (como postgres) DESPUÉS de 202610080001_auth_and_persistence.sql.
-- Idempotencia: el backend reutiliza un recurso completado si coinciden usuario, huella y recurso.
begin;

-- 1. Un documento por usuario y contenido: regenerar el mismo PDF no crea filas nuevas.
--    Las filas anteriores quedan con content_hash NULL (en Postgres los NULL no colisionan).
alter table public.documents
  add column content_hash text check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$');
alter table public.documents
  add constraint documents_user_content_hash_key unique (user_id, content_hash);

-- 2. Una fila por (usuario, huella de la tarea, recurso).
--    content_hash = sha256(documento + perfil + nicho + nivel + tema + modelo + instrucciones + esquema):
--    cambiar el modelo o el prompt invalida la reutilización automáticamente.
create table public.generation_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  document_id uuid not null,
  resource text not null check (resource in (
    'resumen', 'flashcards', 'cuestionario', 'glosario', 'objetivos',
    'guion', 'diapositivas', 'tutorial', 'diagrama', 'narracion'
  )),
  task text not null check (task in ('A', 'B1', 'B2', 'tts')),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'en_curso' check (status in ('en_curso', 'completado', 'fallido')),
  verification text check (verification in ('pendiente', 'auditada', 'no_auditada')),
  model text check (length(model) <= 100),
  attempts smallint not null default 0 check (attempts between 0 and 20),
  latency_s numeric(8, 3) check (latency_s >= 0),
  -- {campos, afirmaciones, estado}: el recurso ya validado, nunca la respuesta cruda del modelo
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  -- Binarios (audio de la etapa 6) viven en almacenamiento privado; aquí solo la ruta
  result_storage_path text check (length(result_storage_path) <= 500),
  error_code text check (length(error_code) <= 50),
  error_message text check (length(error_message) <= 300),  -- mensaje saneado, sin detalle del proveedor
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, content_hash, resource),
  foreign key (document_id, user_id) references public.documents(id, user_id) on delete cascade,
  check (status <> 'completado' or result is not null or result_storage_path is not null),
  check (status <> 'fallido' or error_code is not null),
  check (finished_at is null or finished_at >= started_at)
);

create index generation_tasks_document_owner_idx on public.generation_tasks(document_id, user_id);

alter table public.generation_tasks enable row level security;
create policy own_rows on public.generation_tasks for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on table public.generation_tasks from public, anon, authenticated;
grant select, insert, update, delete on table public.generation_tasks to authenticated;
grant all on table public.generation_tasks to service_role;

create trigger set_updated_at before update on public.generation_tasks
for each row execute function private.set_updated_at();

comment on table public.generation_tasks is
  'Estado por recurso de la generación (modelo, intentos, error saneado, resultado validado). Solo su dueño accede.';
comment on column public.documents.content_hash is
  'sha256(título + contenido). Permite reutilizar el documento y sus tareas al regenerar.';

commit;
