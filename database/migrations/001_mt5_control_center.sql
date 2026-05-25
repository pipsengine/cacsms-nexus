CREATE TABLE IF NOT EXISTS mt5_brokers (
  id uuid PRIMARY KEY,
  broker_name varchar(180) NOT NULL,
  broker_code varchar(60) NOT NULL UNIQUE,
  mt5_server_name varchar(180) NOT NULL,
  server_region varchar(100),
  connection_mode varchar(60) NOT NULL,
  api_supported boolean NOT NULL DEFAULT false,
  status varchar(30) NOT NULL,
  average_latency_ms numeric(10,2),
  average_spread numeric(12,5),
  execution_quality_score numeric(5,2),
  data_feed_quality_score numeric(5,2),
  last_connected_at timestamptz,
  last_disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_terminals (
  id uuid PRIMARY KEY,
  terminal_uuid varchar(120) NOT NULL UNIQUE,
  terminal_name varchar(180) NOT NULL,
  broker_id uuid REFERENCES mt5_brokers(id),
  server_name varchar(180) NOT NULL,
  terminal_path text,
  terminal_version varchar(80),
  host_machine varchar(180),
  ip_address inet,
  operating_system varchar(120),
  status varchar(30) NOT NULL,
  cpu_usage numeric(5,2),
  memory_usage numeric(5,2),
  disk_usage numeric(5,2),
  uptime_seconds bigint NOT NULL DEFAULT 0,
  last_heartbeat_at timestamptz,
  auto_restart_enabled boolean NOT NULL DEFAULT true,
  trading_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_accounts (
  id uuid PRIMARY KEY,
  broker_id uuid NOT NULL REFERENCES mt5_brokers(id),
  terminal_id uuid REFERENCES mt5_terminals(id),
  account_login varchar(80) NOT NULL,
  account_name varchar(180),
  account_type varchar(40) NOT NULL,
  currency char(3) NOT NULL,
  balance numeric(20,2) NOT NULL DEFAULT 0,
  equity numeric(20,2) NOT NULL DEFAULT 0,
  margin numeric(20,2) NOT NULL DEFAULT 0,
  free_margin numeric(20,2) NOT NULL DEFAULT 0,
  leverage varchar(20),
  trade_allowed boolean NOT NULL DEFAULT false,
  investor_password_enabled boolean NOT NULL DEFAULT false,
  sync_status varchar(30) NOT NULL,
  last_sync_at timestamptz,
  status varchar(30) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broker_id, account_login)
);

CREATE TABLE IF NOT EXISTS mt5_symbols (
  id uuid PRIMARY KEY,
  broker_id uuid NOT NULL REFERENCES mt5_brokers(id),
  broker_symbol varchar(80) NOT NULL,
  normalized_symbol varchar(80) NOT NULL,
  asset_class varchar(50) NOT NULL,
  digits integer NOT NULL,
  contract_size numeric(20,6) NOT NULL,
  tick_size numeric(20,10),
  tick_value numeric(20,6),
  min_lot numeric(12,4),
  max_lot numeric(12,4),
  lot_step numeric(12,4),
  spread numeric(12,5),
  trading_allowed boolean NOT NULL DEFAULT false,
  data_feed_active boolean NOT NULL DEFAULT false,
  mapping_status varchar(30) NOT NULL,
  last_tick_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broker_id, broker_symbol)
);

CREATE TABLE IF NOT EXISTS mt5_connection_events (
  id uuid PRIMARY KEY,
  terminal_id uuid REFERENCES mt5_terminals(id),
  broker_id uuid REFERENCES mt5_brokers(id),
  account_id uuid REFERENCES mt5_accounts(id),
  event_type varchar(80) NOT NULL,
  severity varchar(30) NOT NULL,
  status_before varchar(30),
  status_after varchar(30),
  message text NOT NULL,
  root_cause text,
  auto_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_execution_quality (
  id uuid PRIMARY KEY,
  broker_id uuid NOT NULL REFERENCES mt5_brokers(id),
  account_id uuid REFERENCES mt5_accounts(id),
  symbol varchar(80) NOT NULL,
  order_type varchar(40) NOT NULL,
  requested_price numeric(20,10),
  executed_price numeric(20,10),
  slippage_points numeric(12,4),
  execution_time_ms numeric(10,2),
  rejection_reason text,
  requote_detected boolean NOT NULL DEFAULT false,
  spread_at_execution numeric(12,5),
  liquidity_score numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_ai_diagnostics (
  id uuid PRIMARY KEY,
  issue_type varchar(100) NOT NULL,
  affected_component varchar(100) NOT NULL,
  affected_component_id uuid,
  severity varchar(30) NOT NULL,
  root_cause_analysis text NOT NULL,
  recommendation text NOT NULL,
  confidence_score numeric(5,4) NOT NULL,
  auto_remediation_available boolean NOT NULL DEFAULT false,
  auto_remediation_status varchar(40) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS mt5_audit_logs (
  id uuid PRIMARY KEY,
  user_id varchar(120) NOT NULL,
  action varchar(120) NOT NULL,
  module varchar(80) NOT NULL,
  entity_id varchar(120) NOT NULL,
  old_value jsonb,
  new_value jsonb,
  ip_address inet,
  user_agent text,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mt5_terminals_heartbeat ON mt5_terminals (status, last_heartbeat_at);
CREATE INDEX IF NOT EXISTS idx_mt5_events_created ON mt5_connection_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mt5_execution_broker_created ON mt5_execution_quality (broker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mt5_diagnostics_open ON mt5_ai_diagnostics (severity, resolved_at);
CREATE INDEX IF NOT EXISTS idx_mt5_audit_timestamp ON mt5_audit_logs (timestamp DESC);
