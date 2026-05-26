#property strict
#property version   "1.00"
#property description "Cacsms Nexus signed MT5 telemetry bridge."

input string NexusBaseUrl = "http://localhost:3000";
input string EaInstanceId = "ea-ld4-01";
input string IngestionToken = "";
input string SigningSecret = "";
input int HeartbeatIntervalSeconds = 10;
input int SnapshotIntervalSeconds = 15;
input bool PollApprovedCommands = false;
input bool EnableCommandExecution = false;

datetime last_snapshot_at = 0;

string JsonEscape(string value)
{
   StringReplace(value, "\\", "\\\\");
   StringReplace(value, "\"", "\\\"");
   StringReplace(value, "\r", "\\r");
   StringReplace(value, "\n", "\\n");
   return value;
}

string BoolJson(bool value)
{
   return value ? "true" : "false";
}

string IsoUtc()
{
   string timestamp = TimeToString(TimeGMT(), TIME_DATE | TIME_SECONDS);
   StringReplace(timestamp, ".", "-");
   StringReplace(timestamp, " ", "T");
   return timestamp + "Z";
}

string MakeNonce()
{
   return StringFormat("%s-%I64d-%u", EaInstanceId, (long)TimeGMT(), GetTickCount());
}

void StringBytes(string value, uchar &output[])
{
   int copied = StringToCharArray(value, output, 0, WHOLE_ARRAY, CP_UTF8);
   if(copied > 0)
      ArrayResize(output, copied - 1);
}

string HexEncode(const uchar &value[])
{
   string encoded = "";
   for(int index = 0; index < ArraySize(value); index++)
      encoded += StringFormat("%02x", value[index]);
   return encoded;
}

string HmacSha256(string secret, string value)
{
   uchar key[], data[], empty[], key_hash[];
   StringBytes(secret, key);
   StringBytes(value, data);
   if(ArraySize(key) > 64)
   {
      if(CryptEncode(CRYPT_HASH_SHA256, key, empty, key_hash) <= 0)
         return "";
      ArrayCopy(key, key_hash);
   }

   ArrayResize(key, 64);
   uchar inner_pad[64], outer_pad[64];
   for(int index = 0; index < 64; index++)
   {
      inner_pad[index] = key[index] ^ 0x36;
      outer_pad[index] = key[index] ^ 0x5c;
   }

   uchar inner_source[], inner_hash[], outer_source[], digest[];
   ArrayResize(inner_source, 64 + ArraySize(data));
   ArrayCopy(inner_source, inner_pad, 0, 0, 64);
   ArrayCopy(inner_source, data, 64, 0, ArraySize(data));
   if(CryptEncode(CRYPT_HASH_SHA256, inner_source, empty, inner_hash) <= 0)
      return "";

   ArrayResize(outer_source, 64 + ArraySize(inner_hash));
   ArrayCopy(outer_source, outer_pad, 0, 0, 64);
   ArrayCopy(outer_source, inner_hash, 64, 0, ArraySize(inner_hash));
   if(CryptEncode(CRYPT_HASH_SHA256, outer_source, empty, digest) <= 0)
      return "";
   return HexEncode(digest);
}

string EndpointFor(string message_type)
{
   if(message_type == "Heartbeat") return "/api/mt5/ea-bridge/ingest/heartbeat";
   if(message_type == "Account Snapshot") return "/api/mt5/ea-bridge/ingest/account-snapshot";
   if(message_type == "Position Update") return "/api/mt5/ea-bridge/ingest/positions";
   if(message_type == "Pending Order Update") return "/api/mt5/ea-bridge/ingest/orders";
   if(message_type == "Trade Execution Result") return "/api/mt5/ea-bridge/ingest/execution-feedback";
   if(message_type == "Command Poll") return "/api/mt5/ea-bridge/instances/" + EaInstanceId + "/pending-commands";
   return "";
}

bool SendSignedEnvelope(string message_type, string payload_json, string &response_body)
{
   string endpoint = EndpointFor(message_type);
   if(endpoint == "")
      return false;

   string timestamp = IsoUtc();
   string nonce = MakeNonce();
   string canonical = EaInstanceId + "\n" + message_type + "\n" + timestamp + "\n" + nonce + "\n" + payload_json;
   string signature = HmacSha256(SigningSecret, canonical);
   if(signature == "")
   {
      Print("Nexus Bridge could not calculate message signature.");
      return false;
   }

   string body = "{\"instanceId\":\"" + JsonEscape(EaInstanceId) +
      "\",\"messageType\":\"" + JsonEscape(message_type) +
      "\",\"timestamp\":\"" + timestamp +
      "\",\"nonce\":\"" + JsonEscape(nonce) +
      "\",\"payloadJson\":\"" + JsonEscape(payload_json) +
      "\",\"signature\":\"" + signature + "\"}";
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + IngestionToken + "\r\n";
   char request_body[], response[];
   string response_headers;
   StringToCharArray(body, request_body, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(request_body, ArraySize(request_body) - 1);
   ResetLastError();
   int status = WebRequest("POST", NexusBaseUrl + endpoint, headers, 5000, request_body, response, response_headers);
   response_body = CharArrayToString(response, 0, WHOLE_ARRAY, CP_UTF8);
   if(status < 200 || status >= 300)
   {
      PrintFormat("Nexus Bridge POST %s returned HTTP %d (%d): %s", endpoint, status, GetLastError(), response_body);
      return false;
   }
   return true;
}

void SendHeartbeat()
{
   MqlTick tick;
   bool has_tick = SymbolInfoTick(_Symbol, tick);
   string account_login = StringFormat("%I64d", AccountInfoInteger(ACCOUNT_LOGIN));
   string payload = "{\"terminalName\":\"" + JsonEscape(TerminalInfoString(TERMINAL_NAME)) +
      "\",\"accountLogin\":\"" + account_login +
      "\",\"brokerConnected\":" + BoolJson((bool)TerminalInfoInteger(TERMINAL_CONNECTED)) +
      ",\"marketDataActive\":" + BoolJson(has_tick) +
      ",\"tradingEnabled\":" + BoolJson((bool)AccountInfoInteger(ACCOUNT_TRADE_ALLOWED)) +
      ",\"latencyMs\":" + IntegerToString((int)(TerminalInfoInteger(TERMINAL_PING_LAST) / 1000)) + "}";
   string response;
   SendSignedEnvelope("Heartbeat", payload, response);
}

void SendAccountSnapshot()
{
   string account_login = StringFormat("%I64d", AccountInfoInteger(ACCOUNT_LOGIN));
   string payload = "{\"accountLogin\":\"" + account_login +
      "\",\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) +
      ",\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) +
      ",\"credit\":" + DoubleToString(AccountInfoDouble(ACCOUNT_CREDIT), 2) +
      ",\"margin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN), 2) +
      ",\"freeMargin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_FREE), 2) +
      ",\"marginLevel\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_LEVEL), 2) +
      ",\"floatingProfitLoss\":" + DoubleToString(AccountInfoDouble(ACCOUNT_PROFIT), 2) +
      ",\"openPositionsCount\":" + IntegerToString(PositionsTotal()) +
      ",\"pendingOrdersCount\":" + IntegerToString(OrdersTotal()) +
      ",\"tradingAllowed\":" + BoolJson((bool)AccountInfoInteger(ACCOUNT_TRADE_ALLOWED)) +
      ",\"expertTradingAllowed\":" + BoolJson((bool)MQLInfoInteger(MQL_TRADE_ALLOWED)) + "}";
   string response;
   SendSignedEnvelope("Account Snapshot", payload, response);
}

void PollCommands()
{
   string response;
   if(SendSignedEnvelope("Command Poll", "{}", response) && StringLen(response) > 0)
   {
      Print("Nexus command poll response: ", response);
      if(EnableCommandExecution)
         Print("Command execution remains blocked in this telemetry connector until validated order handling is installed.");
   }
}

int OnInit()
{
   if(IngestionToken == "" || SigningSecret == "")
   {
      Print("Nexus Bridge requires IngestionToken and SigningSecret inputs.");
      return INIT_PARAMETERS_INCORRECT;
   }
   EventSetTimer(MathMax(1, HeartbeatIntervalSeconds));
   Print("Nexus Bridge EA initialized for ", EaInstanceId, ". Approved command execution is disabled in this baseline connector.");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   SendHeartbeat();
   if(TimeCurrent() - last_snapshot_at >= SnapshotIntervalSeconds)
   {
      SendAccountSnapshot();
      last_snapshot_at = TimeCurrent();
   }
   if(PollApprovedCommands)
      PollCommands();
}

void OnTradeTransaction(const MqlTradeTransaction &transaction, const MqlTradeRequest &request, const MqlTradeResult &result)
{
   SendAccountSnapshot();
}
