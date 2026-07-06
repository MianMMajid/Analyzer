-- Durable source of truth for generated impact reports and their supporting evidence.
-- Apply this migration to the Railway PostgreSQL service before enabling DB-backed reads.

create table if not exists impact_reports (
  id bigserial primary key,
  repository text not null,
  analysis_window_days integer not null check (analysis_window_days > 0),
  window_started_at timestamptz not null,
  window_ended_at timestamptz not null,
  generated_at timestamptz not null default now(),
  status text not null check (status in ('running', 'completed', 'failed')),
  summary_json jsonb not null,
  data_version text not null default 'v1',
  created_at timestamptz not null default now(),
  check (window_started_at <= window_ended_at)
);

create index if not exists impact_reports_latest_completed_idx
  on impact_reports (repository, analysis_window_days, generated_at desc)
  where status = 'completed';

create table if not exists engineers (
  id bigserial primary key,
  repository text not null,
  canonical_login text not null,
  display_name text not null,
  primary_email_hash text,
  github_user_id bigint,
  aliases_json jsonb not null default '[]'::jsonb,
  is_bot boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (repository, canonical_login)
);

create index if not exists engineers_github_user_id_idx
  on engineers (github_user_id)
  where github_user_id is not null;

create table if not exists evidence (
  id bigserial primary key,
  report_id bigint not null references impact_reports (id) on delete cascade,
  engineer_id bigint not null references engineers (id) on delete cascade,
  source_type text not null,
  source_id text not null,
  impact_dimension text not null,
  occurred_at timestamptz not null,
  title text not null,
  url text,
  weight numeric(8, 4) not null default 1,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (report_id, engineer_id, source_type, source_id, impact_dimension)
);

create index if not exists evidence_report_engineer_idx
  on evidence (report_id, engineer_id);

create index if not exists evidence_occurred_at_idx
  on evidence (occurred_at desc);

create index if not exists evidence_payload_gin_idx
  on evidence using gin (payload_json);

create table if not exists ingestion_runs (
  id bigserial primary key,
  repository text not null,
  source text not null,
  status text not null check (status in ('running', 'completed', 'failed')),
  since_at timestamptz not null,
  until_at timestamptz not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  cursor_json jsonb not null default '{}'::jsonb,
  stats_json jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  check (since_at <= until_at),
  check (finished_at is null or started_at <= finished_at)
);

create index if not exists ingestion_runs_recent_idx
  on ingestion_runs (repository, source, started_at desc);

create index if not exists ingestion_runs_status_idx
  on ingestion_runs (status, started_at desc);
