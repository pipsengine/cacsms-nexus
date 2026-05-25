CREATE TABLE IF NOT EXISTS mt5_ea_instances (
  id uuid PRIMARY KEY,
  ea_instance_uuid varchar(120) NOT NULL UNIQUE,
  terminal_id uuid NOT NULL REFERENCES mt5_terminals(id),
  broker_id uuid NOT NULL REFERENCES mt5_brokers(id),
  account_id uuid NOT NULL REFERENCES mt5_accounts(id),
  ea_name varchar(180) NOT NULL,
  ea_version varchar(40) NOT NULL,
  build_number integer NOT NULL,
  symbol_scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  bridge_token_hash text NOT NULL,
  token_status varchar(30) NOT NULL,
  connection_status varchar(30) NOT NULL,
  heartbeat_status varchar(30) NOT NULL,
  last_heartbeat_at timestamptz,
  message_count bigint NOT NULL DEFAULT 0,
  failed_message_count bigint NOT NULL DEFAULT 0,
  average_latency_ms numeric(10,2),
  trading_channel_enabled boolean NOT NULL DEFAULT false,
  risk_level varchar(30) NOT NULL,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_ea_bridge_sessions (
  id uuid PRIMARY KEY,
  session_uuid varchar(120) NOT NULL UNIQUE,
  ea_instance_id uuid NOT NULL REFERENCES mt5_ea_instances(id),
  terminal_id uuid NOT NULL REFERENCES mt5_terminals(id),
  account_id uuid NOT NULL REFERENCES mt5_accounts(id),
  ip_address inet NOT NULL,
  protocol varchar(40) NOT NULL,
  auth_status varchar(30) NOT NULL,
  connection_started_at timestamptz NOT NULL,
  last_message_at timestamptz,
  session_duration_seconds bigint NOT NULL DEFAULT 0,
  message_rate_per_minute numeric(12,2),
  latency_ms numeric(10,2),
  status varchar(30) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_ea_bridge_messages (
  id uuid PRIMARY KEY,
  message_uuid varchar(120) NOT NULL UNIQUE,
  ea_instance_id uuid NOT NULL REFERENCES mt5_ea_instances(id),
  session_id uuid NOT NULL REFERENCES mt5_ea_bridge_sessions(id),
  message_type varchar(60) NOT NULL,
  source varchar(100) NOT NULL,
  destination varchar(100) NOT NULL,
  payload_hash text NOT NULL,
  schema_version varchar(30) NOT NULL,
  status varchar(30) NOT NULL,
  retry_count integer NOT NULL DEFAULT 0,
  processing_time_ms numeric(10,2),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);

CREATE TABLE IF NOT EXISTS mt5_trade_commands (
  id uuid PRIMARY KEY,
  command_uuid varchar(120) NOT NULL UNIQUE,
  ea_instance_id uuid NOT NULL REFERENCES mt5_ea_instances(id),
  account_id uuid NOT NULL REFERENCES mt5_accounts(id),
  symbol varchar(80) NOT NULL,
  command_type varchar(40) NOT NULL,
  direction varchar(10) NOT NULL,
  volume numeric(14,4) NOT NULL,
  requested_price numeric(20,10),
  stop_loss numeric(20,10),
  take_profit numeric(20,10),
  risk_approval_status varchar(30) NOT NULL,
  delivery_status varchar(30) NOT NULL,
  execution_status varchar(30) NOT NULL,
  response_time_ms numeric(10,2),
  rejection_reason text,
  signal_timestamp timestamptz NOT NULL,
  strategy_id varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz
);

CREATE TABLE IF NOT EXISTS mt5_ea_bridge_logs (
  id uuid PRIMARY KEY,
  ea_instance_id uuid NOT NULL REFERENCES mt5_ea_instances(id),
  terminal_id uuid REFERENCES mt5_terminals(id),
  account_id uuid REFERENCES mt5_accounts(id),
  log_type varchar(40) NOT NULL,
  severity varchar(30) NOT NULL,
  message text NOT NULL,
  technical_details text,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_ea_bridge_ai_diagnostics (
  id uuid PRIMARY KEY,
  ea_instance_id uuid NOT NULL REFERENCES mt5_ea_instances(id),
  issue_type varchar(120) NOT NULL,
  severity varchar(30) NOT NULL,
  root_cause text NOT NULL,
  business_impact text NOT NULL,
  recommendation text NOT NULL,
  confidence_score numeric(5,4) NOT NULL,
  auto_fix_eligible boolean NOT NULL DEFAULT false,
  auto_fix_status varchar(40) NOT NULL,
  escalation_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ea_instances_health ON mt5_ea_instances (risk_level, heartbeat_status, connection_status);
CREATE INDEX IF NOT EXISTS idx_ea_sessions_last_message ON mt5_ea_bridge_sessions (ea_instance_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_ea_messages_delivery ON mt5_ea_bridge_messages (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_command_duplicate_window ON mt5_trade_commands (account_id, symbol, command_type, direction, volume, strategy_id, signal_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ea_bridge_logs_unresolved ON mt5_ea_bridge_logs (severity, resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ea_bridge_diagnostics_open ON mt5_ea_bridge_ai_diagnostics (severity, resolved_at);
