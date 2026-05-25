CREATE TABLE IF NOT EXISTS mt5_accounts_sync (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES mt5_accounts(id),
  broker_id uuid NOT NULL REFERENCES mt5_brokers(id),
  terminal_id uuid NOT NULL REFERENCES mt5_terminals(id),
  account_login varchar(80) NOT NULL,
  account_name varchar(180) NOT NULL,
  server_name varchar(180) NOT NULL,
  account_type varchar(60) NOT NULL,
  currency varchar(10) NOT NULL,
  leverage varchar(30) NOT NULL,
  account_group varchar(80),
  account_status varchar(30) NOT NULL,
  balance numeric(22,6) NOT NULL,
  equity numeric(22,6) NOT NULL,
  credit numeric(22,6) NOT NULL DEFAULT 0,
  margin numeric(22,6) NOT NULL,
  free_margin numeric(22,6) NOT NULL,
  margin_level numeric(12,4),
  floating_profit_loss numeric(22,6) NOT NULL DEFAULT 0,
  realized_profit_loss numeric(22,6) NOT NULL DEFAULT 0,
  daily_profit_loss numeric(22,6) NOT NULL DEFAULT 0,
  weekly_profit_loss numeric(22,6) NOT NULL DEFAULT 0,
  monthly_profit_loss numeric(22,6) NOT NULL DEFAULT 0,
  trading_allowed boolean NOT NULL DEFAULT false,
  expert_trading_allowed boolean NOT NULL DEFAULT false,
  long_trades_allowed boolean NOT NULL DEFAULT false,
  short_trades_allowed boolean NOT NULL DEFAULT false,
  hedge_mode_enabled boolean NOT NULL DEFAULT false,
  sync_status varchar(30) NOT NULL,
  last_sync_at timestamptz,
  last_successful_sync_at timestamptz,
  last_failed_sync_at timestamptz,
  sync_delay_seconds integer NOT NULL DEFAULT 0,
  sync_retry_count integer NOT NULL DEFAULT 0,
  sync_reliability_score numeric(6,2),
  data_mismatch_count integer NOT NULL DEFAULT 0,
  risk_level varchar(30) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_account_positions (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES mt5_accounts(id),
  broker_id uuid NOT NULL REFERENCES mt5_brokers(id),
  terminal_id uuid NOT NULL REFERENCES mt5_terminals(id),
  position_ticket varchar(100) NOT NULL,
  symbol varchar(80) NOT NULL,
  normalized_symbol varchar(80) NOT NULL,
  direction varchar(10) NOT NULL,
  volume numeric(16,4) NOT NULL,
  entry_price numeric(22,10) NOT NULL,
  current_price numeric(22,10) NOT NULL,
  stop_loss numeric(22,10),
  take_profit numeric(22,10),
  profit_loss numeric(22,6) NOT NULL DEFAULT 0,
  swap numeric(22,6) NOT NULL DEFAULT 0,
  commission numeric(22,6) NOT NULL DEFAULT 0,
  open_time timestamptz NOT NULL,
  sync_status varchar(30) NOT NULL,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_account_pending_orders (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES mt5_accounts(id),
  broker_id uuid NOT NULL REFERENCES mt5_brokers(id),
  terminal_id uuid NOT NULL REFERENCES mt5_terminals(id),
  order_ticket varchar(100) NOT NULL,
  symbol varchar(80) NOT NULL,
  normalized_symbol varchar(80) NOT NULL,
  order_type varchar(40) NOT NULL,
  direction varchar(10) NOT NULL,
  volume numeric(16,4) NOT NULL,
  price numeric(22,10) NOT NULL,
  stop_loss numeric(22,10),
  take_profit numeric(22,10),
  expiry_time timestamptz,
  order_status varchar(30) NOT NULL,
  sync_status varchar(30) NOT NULL,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_account_reconciliation (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES mt5_accounts(id),
  mt5_balance numeric(22,6) NOT NULL,
  nexus_balance numeric(22,6) NOT NULL,
  balance_difference numeric(22,6) NOT NULL,
  mt5_equity numeric(22,6) NOT NULL,
  nexus_equity numeric(22,6) NOT NULL,
  equity_difference numeric(22,6) NOT NULL,
  mt5_margin numeric(22,6) NOT NULL,
  nexus_margin numeric(22,6) NOT NULL,
  margin_difference numeric(22,6) NOT NULL,
  mt5_position_count integer NOT NULL,
  nexus_position_count integer NOT NULL,
  position_count_difference integer NOT NULL,
  mt5_pending_order_count integer NOT NULL,
  nexus_pending_order_count integer NOT NULL,
  pending_order_count_difference integer NOT NULL,
  profit_loss_difference numeric(22,6) NOT NULL,
  reconciliation_status varchar(40) NOT NULL,
  required_action text NOT NULL,
  reconciled_by varchar(120) NOT NULL,
  reconciled_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_account_sync_logs (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES mt5_accounts(id),
  broker_id uuid NOT NULL REFERENCES mt5_brokers(id),
  terminal_id uuid NOT NULL REFERENCES mt5_terminals(id),
  sync_type varchar(40) NOT NULL,
  sync_status varchar(30) NOT NULL,
  duration_ms numeric(10,2),
  records_processed integer NOT NULL DEFAULT 0,
  error_code varchar(60),
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  ai_explanation text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_account_exposure (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES mt5_accounts(id),
  symbol varchar(80) NOT NULL,
  normalized_symbol varchar(80) NOT NULL,
  asset_class varchar(60) NOT NULL,
  long_volume numeric(16,4) NOT NULL DEFAULT 0,
  short_volume numeric(16,4) NOT NULL DEFAULT 0,
  net_volume numeric(16,4) NOT NULL DEFAULT 0,
  notional_exposure numeric(22,6) NOT NULL DEFAULT 0,
  margin_used numeric(22,6) NOT NULL DEFAULT 0,
  floating_profit_loss numeric(22,6) NOT NULL DEFAULT 0,
  exposure_risk_score numeric(6,2),
  correlation_group varchar(80),
  measured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mt5_account_sync_ai_diagnostics (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES mt5_accounts(id),
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

CREATE INDEX IF NOT EXISTS idx_accounts_sync_health ON mt5_accounts_sync (risk_level, sync_status, last_sync_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_positions_live ON mt5_account_positions (account_id, sync_status, last_sync_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_orders_live ON mt5_account_pending_orders (account_id, order_status, last_sync_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_reconciliation_status ON mt5_account_reconciliation (reconciliation_status, reconciled_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_sync_logs_failed ON mt5_account_sync_logs (sync_status, resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_exposure_risk ON mt5_account_exposure (account_id, exposure_risk_score, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_diagnostics_open ON mt5_account_sync_ai_diagnostics (severity, resolved_at);
