#ifndef CACSMS_NEXUS_CONFIG_MQH
#define CACSMS_NEXUS_CONFIG_MQH

#define CACSMS_EA_VERSION "2.1.1"
#define CACSMS_EA_BUILD 212
#define CACSMS_PAYLOAD_SCHEMA "1.0"
#define CACSMS_MAX_PROCESSED_COMMANDS 128

struct NexusBridgeConfig
{
   string baseUrl;
   string instanceId;
   string ingestionToken;
   string signingSecret;
   int heartbeatIntervalSeconds;
   int snapshotIntervalSeconds;
   int positionIntervalSeconds;
   int orderIntervalSeconds;
   int commandPollIntervalSeconds;
   int httpTimeoutMs;
   int httpRetryCount;
   int httpRetryDelayMs;
   double maxCommandVolume;
   bool pollApprovedCommands;
   bool enableCommandExecution;
   string symbolScopeCsv;
};

struct NexusRuntimeState
{
   datetime lastHeartbeatAt;
   datetime lastSnapshotAt;
   datetime lastPositionAt;
   datetime lastOrderAt;
   datetime lastCommandPollAt;
   int consecutiveHttpFailures;
   string processedCommandUuids[];
   int processedCommandCount;
};

NexusBridgeConfig g_nexusConfig;
NexusRuntimeState g_nexusState;

string NexusTrimString(const string value)
{
   string trimmed = value;
   StringTrimLeft(trimmed);
   StringTrimRight(trimmed);
   return trimmed;
}

string NexusNormalizeBaseUrl(string base_url)
{
   base_url = NexusTrimString(base_url);
   while(StringLen(base_url) > 0 && StringGetCharacter(base_url, StringLen(base_url) - 1) == '/')
      base_url = StringSubstr(base_url, 0, StringLen(base_url) - 1);

   if(StringFind(base_url, "://localhost") >= 0)
   {
      StringReplace(base_url, "://localhost", "://127.0.0.1");
      Print("Nexus Bridge normalized localhost to 127.0.0.1. Allow http://127.0.0.1:3000 in MT5 WebRequest settings.");
   }
   return base_url;
}

string NexusJoinUrl(const string base_url, const string path)
{
   string normalized = NexusNormalizeBaseUrl(base_url);
   if(StringLen(path) == 0)
      return normalized;
   if(StringGetCharacter(path, 0) == '/')
      return normalized + path;
   return normalized + "/" + path;
}

void NexusResetRuntimeState()
{
   g_nexusState.lastHeartbeatAt = 0;
   g_nexusState.lastSnapshotAt = 0;
   g_nexusState.lastPositionAt = 0;
   g_nexusState.lastOrderAt = 0;
   g_nexusState.lastCommandPollAt = 0;
   g_nexusState.consecutiveHttpFailures = 0;
   ArrayResize(g_nexusState.processedCommandUuids, 0);
   g_nexusState.processedCommandCount = 0;
}

bool NexusSymbolInScope(const string symbol)
{
   if(StringLen(g_nexusConfig.symbolScopeCsv) == 0)
      return true;

   string scope = g_nexusConfig.symbolScopeCsv;
   StringReplace(scope, " ", "");
   string parts[];
   int count = StringSplit(scope, ',', parts);
   for(int index = 0; index < count; index++)
   {
      if(StringCompare(parts[index], symbol, false) == 0)
         return true;
   }
   return false;
}

bool NexusHasProcessedCommand(const string commandUuid)
{
   for(int index = 0; index < g_nexusState.processedCommandCount; index++)
   {
      if(g_nexusState.processedCommandUuids[index] == commandUuid)
         return true;
   }
   return false;
}

void NexusRememberProcessedCommand(const string commandUuid)
{
   if(NexusHasProcessedCommand(commandUuid))
      return;

   if(g_nexusState.processedCommandCount >= CACSMS_MAX_PROCESSED_COMMANDS)
   {
      for(int index = 1; index < g_nexusState.processedCommandCount; index++)
         g_nexusState.processedCommandUuids[index - 1] = g_nexusState.processedCommandUuids[index];
      g_nexusState.processedCommandCount--;
      ArrayResize(g_nexusState.processedCommandUuids, g_nexusState.processedCommandCount);
   }

   ArrayResize(g_nexusState.processedCommandUuids, g_nexusState.processedCommandCount + 1);
   g_nexusState.processedCommandUuids[g_nexusState.processedCommandCount] = commandUuid;
   g_nexusState.processedCommandCount++;
}

#endif
