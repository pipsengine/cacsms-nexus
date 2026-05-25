CREATE TABLE IF NOT EXISTS mt5_terminal_status (
  id uuid PRIMARY KEY,
  terminal_id uuid NOT NULL REFERENCES mt5_terminals(id),
  terminal_uuid varchar(120) NOT NULL,
  terminal_name varchar(180) NOT NULL,
  broker_id uuid REFERENCES mt5_brokers(id),
  account_id uuid REFERENCES mt5_accounts(id),
  server_name varchar(180) NOT NULL,
  host_machine varchar(180) NOT NULL,
  ip_address inet,
  operating_system varchar(120),
  terminal_version varchar(40),
  build_number integer,
  process_status varchar(30) NOT NULL,
  process_id integer,
  connection_status varchar(30) NOT NULL,
  heartbeat_status varchar(30) NOT NULL,
  last_heartbeat_at timestamptz,
  heartbeat_delay_seconds integer NOT NULL DEFAULT 0,
  missed_heartbeat_count integer NOT NULL DEFAULT 0,
  cpu_usage_percent numeric(5,2),
  memory_usage_percent numeric(5,2),
  disk_usage_percent numeric(5,2),
  network_latency_ms numeric(10,2),
  packet_loss_percent numeric(5,2),
  uptime_seconds bigint NOT NULL DEFAULT 0,
  trading_enabled boolean NOT NULL DEFAULT false,
  expert_advisors_enabled boolean NOT NULL DEFAULT false,
  dll_imports_enabled boolean NOT NULL DEFAULT false,
  account_trade_allowed boolean NOT NULL DEFAULT false,
  market_data_active boolean NOT NULL DEFAULT false,
  open_positions_count integer NOT NULL DEFAULT 0,
  pending_orders_count integer NOT NULL DEFAULT 0,
  last_error_code varchar(60),
  last_error_message text,
  risk_level varchar(30) NOT NULL,
  health_score numeric(5,2) NOT NULL,
  restart_required boolean NOT NULL DEFAULT false,
  maintenance_mode boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (terminal_id)
);

CREATE TABLE IF NOT EXISTS mt5_terminal_heartbeat_logs (
  id uuid PRIMARY KEY,
  terminal_id uuid NOT NULL REFERENCES mt5_terminals(id),
  heartbeat_received_at timestamptz NOT NULL,
  expected_interval_seconds integer NOT NULL,
  delay_seconds integer NOT NULL,
  status varchar(30) NOT NULL,
  cpu_usage_percent numeric(5,2),
  memory_usage_percent numeric(5,2),
  disk_usage_percent numeric(5,2),
  network_latency_ms numeric(10,2),
  process_running boolean NOT NULL,
  broker_connected boolean NOT NULL,
  market_data_active boolean NOT NULL,
  trading_enabled boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_terminal_events (
  id uuid PRIMARY KEY,
  terminal_id uuid NOT NULL REFERENCES mt5_terminals(id),
  broker_id uuid REFERENCES mt5_brokers(id),
  account_id uuid REFERENCES mt5_accounts(id),
  event_type varchar(80) NOT NULL,
  severity varchar(30) NOT NULL,
  source_module varchar(80) NOT NULL,
  message text NOT NULL,
  previous_status varchar(30),
  new_status varchar(30),
  triggered_by varchar(120) NOT NULL,
  action_taken text,
  result text,
  auto_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_terminal_error_logs (
  id uuid PRIMARY KEY,
  terminal_id uuid NOT NULL REFERENCES mt5_terminals(id),
  broker_id uuid REFERENCES mt5_brokers(id),
  account_id uuid REFERENCES mt5_accounts(id),
  error_code varchar(60) NOT NULL,
  error_message text NOT NULL,
  severity varchar(30) NOT NULL,
  source_module varchar(80) NOT NULL,
  repeat_count integer NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  ai_explanation text,
  suggested_fix text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_terminal_ai_diagnostics (
  id uuid PRIMARY KEY,
  terminal_id uuid NOT NULL REFERENCES mt5_terminals(id),
  issue_type varchar(120) NOT NULL,
  anomaly_detected text NOT NULL,
  severity varchar(30) NOT NULL,
  root_cause text NOT NULL,
  business_impact text NOT NULL,
  recommendation text NOT NULL,
  confidence_score numeric(5,4) NOT NULL,
  failure_probability numeric(5,2) NOT NULL,
  auto_fix_eligible boolean NOT NULL DEFAULT false,
  auto_fix_status varchar(40) NOT NULL,
  escalation_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_terminal_status_risk ON mt5_terminal_status (risk_level, restart_required);
CREATE INDEX IF NOT EXISTS idx_terminal_heartbeat_terminal_received ON mt5_terminal_heartbeat_logs (terminal_id, heartbeat_received_at DESC);
CREATE INDEX IF NOT EXISTS idx_terminal_events_terminal_created ON mt5_terminal_events (terminal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_terminal_errors_unresolved ON mt5_terminal_error_logs (terminal_id, resolved, severity);
CREATE INDEX IF NOT EXISTS idx_terminal_diagnostics_active ON mt5_terminal_ai_diagnostics (terminal_id, resolved_at, severity);
