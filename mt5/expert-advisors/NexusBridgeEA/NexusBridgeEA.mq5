// Legacy path — canonical source: services/cacsms-ea/Experts/NexusBridgeEA/
// Self-contained folder includes Cacsms/*.mqh — no separate MQL5/Include copy required.

#property strict
#property version   "2.10"
#property description "Cacsms Nexus signed MT5 telemetry and guarded command bridge."

#include "Cacsms/NexusConfig.mqh"
#include "Cacsms/NexusTelemetry.mqh"
#include "Cacsms/NexusCommands.mqh"

input string NexusBaseUrl = "http://127.0.0.1:3000";
input string EaInstanceId = "ea-cacsms-mt5-0001";
input string IngestionToken = "";
input string SigningSecret = "";
input int HeartbeatIntervalSeconds = 10;
input int SnapshotIntervalSeconds = 15;
input int PositionIntervalSeconds = 20;
input int OrderIntervalSeconds = 20;
input int CommandPollIntervalSeconds = 5;
input int HttpTimeoutMs = 8000;
input int HttpRetryCount = 2;
input int HttpRetryDelayMs = 750;
input double MaxCommandVolume = 1.0;
input string SymbolScope = "";
input bool PollApprovedCommands = false;
input bool EnableCommandExecution = false;

int OnInit()
{
   if(IngestionToken == "" || SigningSecret == "")
   {
      Alert("Nexus Bridge EA: open EA Properties and paste IngestionToken and SigningSecret from your MT5 Control Center onboarding receipt. The EA cannot run without them.");
      Print("Nexus Bridge requires IngestionToken and SigningSecret inputs from the onboarding receipt.");
      return INIT_PARAMETERS_INCORRECT;
   }

   g_nexusConfig.baseUrl = NexusNormalizeBaseUrl(NexusTrimString(NexusBaseUrl));
   g_nexusConfig.instanceId = NexusTrimString(EaInstanceId);
   g_nexusConfig.ingestionToken = NexusTrimString(IngestionToken);
   g_nexusConfig.signingSecret = NexusTrimString(SigningSecret);
   g_nexusConfig.heartbeatIntervalSeconds = MathMax(1, HeartbeatIntervalSeconds);
   g_nexusConfig.snapshotIntervalSeconds = MathMax(1, SnapshotIntervalSeconds);
   g_nexusConfig.positionIntervalSeconds = MathMax(1, PositionIntervalSeconds);
   g_nexusConfig.orderIntervalSeconds = MathMax(1, OrderIntervalSeconds);
   g_nexusConfig.commandPollIntervalSeconds = MathMax(1, CommandPollIntervalSeconds);
   g_nexusConfig.httpTimeoutMs = MathMax(1000, HttpTimeoutMs);
   g_nexusConfig.httpRetryCount = MathMax(0, HttpRetryCount);
   g_nexusConfig.httpRetryDelayMs = MathMax(100, HttpRetryDelayMs);
   g_nexusConfig.maxCommandVolume = MathMax(0.01, MaxCommandVolume);
   g_nexusConfig.symbolScopeCsv = SymbolScope;
   g_nexusConfig.pollApprovedCommands = PollApprovedCommands;
   g_nexusConfig.enableCommandExecution = EnableCommandExecution;
   NexusResetRuntimeState();

   int timerSeconds = MathMin(g_nexusConfig.heartbeatIntervalSeconds, g_nexusConfig.commandPollIntervalSeconds);
   EventSetTimer(MathMax(1, timerSeconds));

   PrintFormat("Nexus Bridge EA v%s (build %d) initialized for %s. Command execution=%s.",
      CACSMS_EA_VERSION, CACSMS_EA_BUILD, EaInstanceId, EnableCommandExecution ? "enabled" : "disabled");
   if(EnableCommandExecution)
      Print("WARNING: Live order execution is enabled. Ensure Nexus risk approval and trading channel policies are active.");

   NexusSendHeartbeat();
   NexusPushFullTelemetry();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   if(NexusIntervalElapsed(g_nexusState.lastHeartbeatAt, g_nexusConfig.heartbeatIntervalSeconds))
      NexusSendHeartbeat();

   if(NexusIntervalElapsed(g_nexusState.lastSnapshotAt, g_nexusConfig.snapshotIntervalSeconds))
      NexusSendAccountSnapshot();

   if(NexusIntervalElapsed(g_nexusState.lastPositionAt, g_nexusConfig.positionIntervalSeconds))
      NexusSendPositionUpdate();

   if(NexusIntervalElapsed(g_nexusState.lastOrderAt, g_nexusConfig.orderIntervalSeconds))
      NexusSendPendingOrderUpdate();

   if(g_nexusConfig.pollApprovedCommands &&
      NexusIntervalElapsed(g_nexusState.lastCommandPollAt, g_nexusConfig.commandPollIntervalSeconds))
   {
      NexusPollApprovedCommands();
   }
}

void OnTradeTransaction(const MqlTradeTransaction &transaction,
   const MqlTradeRequest &request,
   const MqlTradeResult &result)
{
   if(transaction.type == TRADE_TRANSACTION_DEAL_ADD ||
      transaction.type == TRADE_TRANSACTION_ORDER_ADD ||
      transaction.type == TRADE_TRANSACTION_ORDER_UPDATE ||
      transaction.type == TRADE_TRANSACTION_ORDER_DELETE ||
      transaction.type == TRADE_TRANSACTION_POSITION)
   {
      NexusPushFullTelemetry();
   }
}
