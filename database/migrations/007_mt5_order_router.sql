CREATE TABLE IF NOT EXISTS mt5_order_routes (
  id uuid PRIMARY KEY,
  route_uuid uuid NOT NULL UNIQUE,
  order_id varchar(120) NOT NULL,
  signal_id varchar(120) NOT NULL,
  strategy_id varchar(120) NOT NULL,
  account_id uuid NOT NULL REFERENCES mt5_accounts(id),
  broker_id uuid NOT NULL REFERENCES mt5_brokers(id),
  terminal_id uuid NOT NULL REFERENCES mt5_terminals(id),
  ea_instance_id uuid NOT NULL REFERENCES mt5_ea_instances(id),
  symbol varchar(80) NOT NULL,
  normalized_symbol varchar(80) NOT NULL,
  broker_symbol varchar(80) NOT NULL,
  direction varchar(10) NOT NULL,
  order_type varchar(30) NOT NULL,
  volume numeric(18,8) NOT NULL,
  entry_price numeric(18,8) NOT NULL,
  stop_loss numeric(18,8),
  take_profit numeric(18,8),
  expiry_time timestamptz,
  time_in_force varchar(30) NOT NULL,
  routing_priority varchar(30) NOT NULL,
  fallback_route_available boolean NOT NULL DEFAULT false,
  risk_status varchar(30) NOT NULL,
  account_readiness_status varchar(30) NOT NULL,
  broker_readiness_status varchar(30) NOT NULL,
  symbol_mapping_status varchar(30) NOT NULL,
  duplicate_check_status varchar(30) NOT NULL,
  margin_check_status varchar(30) NOT NULL,
  market_condition_status varchar(30) NOT NULL,
  routing_status varchar(30) NOT NULL,
  delivery_status varchar(30) NOT NULL,
  execution_status varchar(30) NOT NULL,
  routing_latency_ms integer NOT NULL DEFAULT 0,
  execution_response_time_ms integer NOT NULL DEFAULT 0,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_routing_channels (
  id uuid PRIMARY KEY,
  channel_uuid uuid NOT NULL UNIQUE,
  ea_instance_id uuid NOT NULL REFERENCES mt5_ea_instances(id),
  terminal_id uuid NOT NULL REFERENCES mt5_terminals(id),
  broker_id uuid NOT NULL REFERENCES mt5_brokers(id),
  account_id uuid NOT NULL REFERENCES mt5_accounts(id),
  symbol_scope text[] NOT NULL DEFAULT '{}',
  channel_status varchar(30) NOT NULL,
  trading_enabled boolean NOT NULL DEFAULT false,
  message_latency_ms integer NOT NULL DEFAULT 0,
  command_success_rate numeric(7,4) NOT NULL DEFAULT 0,
  queue_backlog_count integer NOT NULL DEFAULT 0,
  last_command_at timestamptz,
  risk_level varchar(30) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_blocked_orders (
  id uuid PRIMARY KEY,
  order_id varchar(120) NOT NULL,
  signal_id varchar(120) NOT NULL,
  account_id uuid NOT NULL REFERENCES mt5_accounts(id),
  broker_id uuid NOT NULL REFERENCES mt5_brokers(id),
  symbol varchar(80) NOT NULL,
  direction varchar(10) NOT NULL,
  volume numeric(18,8) NOT NULL,
  block_reason text NOT NULL,
  risk_rule_triggered varchar(180) NOT NULL,
  risk_severity varchar(30) NOT NULL,
  required_action text NOT NULL,
  ai_explanation text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_execution_feedback (
  id uuid PRIMARY KEY,
  route_id uuid NOT NULL REFERENCES mt5_order_routes(id),
  order_id varchar(120) NOT NULL,
  account_id uuid NOT NULL REFERENCES mt5_accounts(id),
  broker_id uuid NOT NULL REFERENCES mt5_brokers(id),
  symbol varchar(80) NOT NULL,
  command_sent_at timestamptz NOT NULL,
  delivered_at timestamptz,
  executed_at timestamptz,
  mt5_ticket varchar(120),
  requested_price numeric(18,8) NOT NULL,
  executed_price numeric(18,8),
  slippage_points numeric(18,6),
  execution_time_ms integer NOT NULL DEFAULT 0,
  mt5_response_code varchar(80) NOT NULL,
  response_message text NOT NULL,
  execution_status varchar(30) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_order_router_logs (
  id uuid PRIMARY KEY,
  route_id uuid REFERENCES mt5_order_routes(id),
  order_id varchar(120) NOT NULL,
  event_type varchar(60) NOT NULL,
  severity varchar(30) NOT NULL,
  source_module varchar(120) NOT NULL,
  message text NOT NULL,
  action_taken text NOT NULL,
  result text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_order_router_ai_diagnostics (
  id uuid PRIMARY KEY,
  route_id uuid REFERENCES mt5_order_routes(id),
  order_id varchar(120),
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

CREATE INDEX IF NOT EXISTS idx_order_routes_queue ON mt5_order_routes (routing_status, risk_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_routes_duplicate_guard ON mt5_order_routes (signal_id, strategy_id, account_id, symbol, direction, order_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_routing_channels_readiness ON mt5_routing_channels (trading_enabled, channel_status, risk_level);
CREATE INDEX IF NOT EXISTS idx_blocked_orders_open ON mt5_blocked_orders (resolved, risk_severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_feedback_order ON mt5_execution_feedback (order_id, execution_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_router_logs_unresolved ON mt5_order_router_logs (resolved, severity, created_at DESC);
