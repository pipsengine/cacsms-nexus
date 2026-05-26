create table if not exists mt5_module_states (
  module_key text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_mt5_module_states_updated_at
  on mt5_module_states (updated_at desc);
