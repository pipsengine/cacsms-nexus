CREATE TABLE IF NOT EXISTS mt5_broker_connections (
  id uuid PRIMARY KEY,
  broker_id uuid NOT NULL REFERENCES mt5_brokers(id),
  broker_name varchar(180) NOT NULL,
  broker_code varchar(40) NOT NULL,
  mt5_server_name varchar(180) NOT NULL,
  server_region varchar(100) NOT NULL,
  connection_mode varchar(60) NOT NULL,
  connection_status varchar(30) NOT NULL,
  login_status varchar(30) NOT NULL,
  data_feed_status varchar(30) NOT NULL,
  execution_status varchar(30) NOT NULL,
  average_latency_ms numeric(10,2),
  packet_loss_percent numeric(6,3),
  heartbeat_delay_seconds integer,
  uptime_percent numeric(6,3),
  spread_stability_score numeric(6,2),
  slippage_score numeric(6,2),
  requote_rate numeric(6,3),
  rejection_rate numeric(6,3),
  fill_quality_score numeric(6,2),
  execution_enabled boolean NOT NULL DEFAULT false,
  last_connected_at timestamptz,
  last_disconnected_at timestamptz,
  last_error_message text,
  risk_level varchar(30) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_broker_connection_tests (
  id uuid PRIMARY KEY,
  broker_id uuid NOT NULL REFERENCES mt5_brokers(id),
  test_type varchar(60) NOT NULL,
  test_status varchar(30) NOT NULL,
  latency_ms numeric(10,2),
  login_success boolean NOT NULL DEFAULT false,
  data_feed_success boolean NOT NULL DEFAULT false,
  execution_gateway_success boolean NOT NULL DEFAULT false,
  symbol_sync_success boolean NOT NULL DEFAULT false,
  account_sync_success boolean NOT NULL DEFAULT false,
  failure_reason text,
  tested_by varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_broker_incidents (
  id uuid PRIMARY KEY,
  broker_id uuid NOT NULL REFERENCES mt5_brokers(id),
  server_name varchar(180) NOT NULL,
  account_id uuid REFERENCES mt5_accounts(id),
  incident_type varchar(60) NOT NULL,
  severity varchar(30) NOT NULL,
  error_code varchar(60),
  error_message text NOT NULL,
  root_cause text NOT NULL,
  action_taken text NOT NULL,
  auto_resolved boolean NOT NULL DEFAULT false,
  resolution_status varchar(30) NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_broker_latency_logs (
  id uuid PRIMARY KEY,
  broker_id uuid NOT NULL REFERENCES mt5_brokers(id),
  latency_ms numeric(10,2) NOT NULL,
  packet_loss_percent numeric(6,3),
  heartbeat_delay_seconds integer,
  server_reachable boolean NOT NULL,
  measured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_broker_spread_logs (
  id uuid PRIMARY KEY,
  broker_id uuid NOT NULL REFERENCES mt5_brokers(id),
  symbol varchar(80) NOT NULL,
  spread_points numeric(16,6) NOT NULL,
  average_spread_points numeric(16,6) NOT NULL,
  spread_stability_score numeric(6,2),
  abnormal_spread_detected boolean NOT NULL DEFAULT false,
  measured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_broker_execution_quality (
  id uuid PRIMARY KEY,
  broker_id uuid NOT NULL REFERENCES mt5_brokers(id),
  account_id uuid REFERENCES mt5_accounts(id),
  symbol varchar(80) NOT NULL,
  order_type varchar(40) NOT NULL,
  execution_time_ms numeric(10,2),
  slippage_points numeric(16,6),
  requote_detected boolean NOT NULL DEFAULT false,
  rejected boolean NOT NULL DEFAULT false,
  rejection_reason text,
  fill_quality_score numeric(6,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_broker_ai_diagnostics (
  id uuid PRIMARY KEY,
  broker_id uuid NOT NULL REFERENCES mt5_brokers(id),
  issue_type varchar(120) NOT NULL,
  severity varchar(30) NOT NULL,
  root_cause text NOT NULL,
  trading_impact text NOT NULL,
  recommendation text NOT NULL,
  confidence_score numeric(5,4) NOT NULL,
  auto_remediation_available boolean NOT NULL DEFAULT false,
  auto_remediation_status varchar(40) NOT NULL,
  escalation_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_broker_connections_health ON mt5_broker_connections (risk_level, connection_status, execution_status);
CREATE INDEX IF NOT EXISTS idx_broker_connection_tests_recent ON mt5_broker_connection_tests (broker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broker_incidents_unresolved ON mt5_broker_incidents (severity, resolution_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broker_latency_recent ON mt5_broker_latency_logs (broker_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_broker_spreads_anomaly ON mt5_broker_spread_logs (broker_id, abnormal_spread_detected, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_broker_execution_quality_recent ON mt5_broker_execution_quality (broker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broker_ai_diagnostics_open ON mt5_broker_ai_diagnostics (severity, resolved_at);
