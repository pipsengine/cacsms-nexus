CREATE TABLE IF NOT EXISTS mt5_symbol_sync_status (
  id uuid PRIMARY KEY,
  symbol_id uuid NOT NULL REFERENCES mt5_symbols(id),
  broker_id uuid NOT NULL REFERENCES mt5_brokers(id),
  server_name varchar(180) NOT NULL,
  broker_symbol varchar(80) NOT NULL,
  normalized_symbol varchar(80) NOT NULL,
  asset_class varchar(60) NOT NULL,
  spread numeric(16,6) NOT NULL,
  rolling_spread numeric(16,6) NOT NULL,
  mapping_status varchar(30) NOT NULL,
  feed_status varchar(30) NOT NULL,
  trading_allowed boolean NOT NULL DEFAULT false,
  data_feed_active boolean NOT NULL DEFAULT false,
  market_open boolean NOT NULL DEFAULT false,
  last_tick_at timestamptz,
  last_sync_at timestamptz,
  tick_delay_seconds integer NOT NULL DEFAULT 0,
  gap_count integer NOT NULL DEFAULT 0,
  mismatch_reason text,
  risk_level varchar(30) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_symbol_sync_issues (
  id uuid PRIMARY KEY,
  symbol_id uuid NOT NULL REFERENCES mt5_symbols(id),
  issue_type varchar(60) NOT NULL,
  severity varchar(30) NOT NULL,
  detail text NOT NULL,
  recommended_action text NOT NULL,
  detected_at timestamptz NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_symbol_sync_ai_diagnostics (
  id uuid PRIMARY KEY,
  symbol_id uuid NOT NULL REFERENCES mt5_symbols(id),
  issue_type varchar(120) NOT NULL,
  severity varchar(30) NOT NULL,
  root_cause text NOT NULL,
  trading_impact text NOT NULL,
  recommendation text NOT NULL,
  confidence_score numeric(5,4) NOT NULL,
  auto_fix_eligible boolean NOT NULL DEFAULT false,
  auto_fix_status varchar(40) NOT NULL,
  escalation_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_symbol_sync_risk ON mt5_symbol_sync_status (risk_level, mapping_status, feed_status, last_sync_at DESC);
CREATE INDEX IF NOT EXISTS idx_symbol_sync_feed ON mt5_symbol_sync_status (data_feed_active, last_tick_at DESC);
CREATE INDEX IF NOT EXISTS idx_symbol_sync_issues_open ON mt5_symbol_sync_issues (severity, resolved, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_symbol_sync_diagnostics_open ON mt5_symbol_sync_ai_diagnostics (severity, resolved_at);
