-- NuevaMente · Espejo de solo lectura de Supabase (public.*) en Oracle Autonomous Database.
-- Ejecutar en Database Actions > SQL como el usuario ESPEJO (no como ADMIN), una sola vez.
-- Lo llena backend/app/espejo (python -m app.espejo); la app nunca escribe aquí.
--
-- Diferencias deliberadas con Supabase:
--   * Sin claves foráneas, CHECK ni UNIQUE: Supabase ya los impone; el espejo no rechaza filas.
--   * uuid → VARCHAR2(36); jsonb → CLOB IS JSON; timestamptz → TIMESTAMP en UTC.
--   * generation_tasks.resource → resource_name (RESOURCE es palabra reservada en Oracle).
--   * espejado_en: cuándo se copió la fila por última vez (UTC).

CREATE TABLE profiles (
  id                  VARCHAR2(36) PRIMARY KEY,
  display_name        VARCHAR2(4000),
  avatar_url          VARCHAR2(4000),
  created_at          TIMESTAMP(6),
  updated_at          TIMESTAMP(6),
  espejado_en         TIMESTAMP(6)
);

CREATE TABLE documents (
  id                  VARCHAR2(36) PRIMARY KEY,
  user_id             VARCHAR2(36),
  title               VARCHAR2(4000),
  original_filename   VARCHAR2(4000),
  mime_type           VARCHAR2(4000),
  source_text         CLOB,
  storage_provider    VARCHAR2(4000),
  storage_path        VARCHAR2(4000),
  size_bytes          NUMBER,
  content_hash        VARCHAR2(4000),
  created_at          TIMESTAMP(6),
  updated_at          TIMESTAMP(6),
  espejado_en         TIMESTAMP(6)
);

CREATE TABLE learning_packages (
  id                  VARCHAR2(36) PRIMARY KEY,
  user_id             VARCHAR2(36),
  document_id         VARCHAR2(36),
  title               VARCHAR2(4000),
  parameters          CLOB CHECK (parameters IS JSON),
  payload             CLOB CHECK (payload IS JSON),
  storage_provider    VARCHAR2(4000),
  storage_path        VARCHAR2(4000),
  created_at          TIMESTAMP(6),
  updated_at          TIMESTAMP(6),
  espejado_en         TIMESTAMP(6)
);

CREATE TABLE learning_progress (
  user_id             VARCHAR2(36),
  package_id          VARCHAR2(36),
  current_step        NUMBER,
  active_station_index NUMBER,
  completed_stations  CLOB CHECK (completed_stations IS JSON),
  quiz_answers        CLOB CHECK (quiz_answers IS JSON),
  cognitive_shields   NUMBER,
  created_at          TIMESTAMP(6),
  updated_at          TIMESTAMP(6),
  espejado_en         TIMESTAMP(6),
  PRIMARY KEY (user_id, package_id)
);

CREATE TABLE user_state (
  user_id             VARCHAR2(36) PRIMARY KEY,
  xp                  NUMBER,
  streak_days         NUMBER,
  last_activity_at    TIMESTAMP(6),
  achievements        CLOB CHECK (achievements IS JSON),
  preferences         CLOB CHECK (preferences IS JSON),
  created_at          TIMESTAMP(6),
  updated_at          TIMESTAMP(6),
  espejado_en         TIMESTAMP(6)
);

CREATE TABLE generation_tasks (
  id                  VARCHAR2(36) PRIMARY KEY,
  user_id             VARCHAR2(36),
  document_id         VARCHAR2(36),
  resource_name       VARCHAR2(4000),
  task                VARCHAR2(4000),
  content_hash        VARCHAR2(4000),
  status              VARCHAR2(4000),
  verification        VARCHAR2(4000),
  model               VARCHAR2(4000),
  attempts            NUMBER,
  latency_s           NUMBER,
  result              CLOB CHECK (result IS JSON),
  result_storage_path VARCHAR2(4000),
  error_code          VARCHAR2(4000),
  error_message       VARCHAR2(4000),
  started_at          TIMESTAMP(6),
  finished_at         TIMESTAMP(6),
  created_at          TIMESTAMP(6),
  updated_at          TIMESTAMP(6),
  espejado_en         TIMESTAMP(6)
);

-- Estado de la sincronización: hasta dónde se copió cada tabla y cómo fue la última pasada.
CREATE TABLE espejo_marcas (
  tabla               VARCHAR2(64) PRIMARY KEY,
  marca_updated_at    VARCHAR2(40),   -- updated_at tal cual lo devuelve PostgREST
  marca_clave         VARCHAR2(400),  -- clave primaria de la última fila copiada (JSON)
  filas_copiadas      NUMBER DEFAULT 0 NOT NULL,
  ultima_ejecucion    TIMESTAMP(6),
  ultimo_error        VARCHAR2(500)
);

CREATE INDEX documents_user_idx ON documents(user_id, created_at);
CREATE INDEX packages_user_idx ON learning_packages(user_id, created_at);
CREATE INDEX tasks_user_idx ON generation_tasks(user_id, document_id);
