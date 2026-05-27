#ifndef CACSMS_NEXUS_TELEMETRY_MQH
#define CACSMS_NEXUS_TELEMETRY_MQH

#include "NexusConfig.mqh"
#include "NexusJson.mqh"
#include "NexusTime.mqh"
#include "NexusEnvelope.mqh"

string NexusAccountLogin()
{
   return StringFormat("%I64d", AccountInfoInteger(ACCOUNT_LOGIN));
}

string NexusPositionDirection(const long positionType)
{
   return positionType == POSITION_TYPE_BUY ? "Buy" : "Sell";
}

string NexusOrderDirectionFromType(const ENUM_ORDER_TYPE orderType)
{
   switch(orderType)
   {
      case ORDER_TYPE_BUY:
      case ORDER_TYPE_BUY_LIMIT:
      case ORDER_TYPE_BUY_STOP:
      case ORDER_TYPE_BUY_STOP_LIMIT:
         return "Buy";
      default:
         return "Sell";
   }
}

double NexusPositionCommission(const ulong positionTicket)
{
   double commission = 0.0;
   if(!HistorySelectByPosition(positionTicket))
      return commission;

   const int total = HistoryDealsTotal();
   for(int index = 0; index < total; index++)
   {
      const ulong dealTicket = HistoryDealGetTicket(index);
      if(dealTicket == 0)
         continue;
      commission += HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
   }
   return commission;
}

string NexusOrderTypeLabel(const ENUM_ORDER_TYPE orderType)
{
   switch(orderType)
   {
      case ORDER_TYPE_BUY_LIMIT: return "Buy Limit";
      case ORDER_TYPE_SELL_LIMIT: return "Sell Limit";
      case ORDER_TYPE_BUY_STOP: return "Buy Stop";
      case ORDER_TYPE_SELL_STOP: return "Sell Stop";
      case ORDER_TYPE_BUY_STOP_LIMIT: return "Buy Stop Limit";
      case ORDER_TYPE_SELL_STOP_LIMIT: return "Sell Stop Limit";
      default: return "Pending";
   }
}

bool NexusSendHeartbeat()
{
   MqlTick tick;
   bool has_tick = SymbolInfoTick(_Symbol, tick);
   string payload = "{\"terminalName\":\"" + NexusJsonEscape(TerminalInfoString(TERMINAL_NAME)) +
      "\",\"accountLogin\":\"" + NexusAccountLogin() +
      "\",\"brokerConnected\":" + NexusBoolJson((bool)TerminalInfoInteger(TERMINAL_CONNECTED)) +
      ",\"marketDataActive\":" + NexusBoolJson(has_tick) +
      ",\"tradingEnabled\":" + NexusBoolJson((bool)AccountInfoInteger(ACCOUNT_TRADE_ALLOWED)) +
      ",\"latencyMs\":" + IntegerToString(NexusTerminalLatencyMs());
   if(has_tick)
   {
      const int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
      payload += ",\"quoteSymbol\":\"" + NexusJsonEscape(_Symbol) +
         "\",\"bid\":" + NexusNumberJson(tick.bid, digits) +
         ",\"ask\":" + NexusNumberJson(tick.ask, digits);
   }
   payload += "}";
   string response;
   bool ok = NexusSendSignedEnvelope("Heartbeat", payload, response);
   if(ok)
      g_nexusState.lastHeartbeatAt = TimeCurrent();
   return ok;
}

bool NexusSendAccountSnapshot()
{
   string payload = "{\"accountLogin\":\"" + NexusAccountLogin() +
      "\",\"balance\":" + NexusNumberJson(AccountInfoDouble(ACCOUNT_BALANCE), 2) +
      ",\"equity\":" + NexusNumberJson(AccountInfoDouble(ACCOUNT_EQUITY), 2) +
      ",\"credit\":" + NexusNumberJson(AccountInfoDouble(ACCOUNT_CREDIT), 2) +
      ",\"margin\":" + NexusNumberJson(AccountInfoDouble(ACCOUNT_MARGIN), 2) +
      ",\"freeMargin\":" + NexusNumberJson(AccountInfoDouble(ACCOUNT_MARGIN_FREE), 2) +
      ",\"marginLevel\":" + NexusNumberJson(AccountInfoDouble(ACCOUNT_MARGIN_LEVEL), 2) +
      ",\"floatingProfitLoss\":" + NexusNumberJson(AccountInfoDouble(ACCOUNT_PROFIT), 2) +
      ",\"openPositionsCount\":" + IntegerToString(PositionsTotal()) +
      ",\"pendingOrdersCount\":" + IntegerToString(OrdersTotal()) +
      ",\"tradingAllowed\":" + NexusBoolJson((bool)AccountInfoInteger(ACCOUNT_TRADE_ALLOWED)) +
      ",\"expertTradingAllowed\":" + NexusBoolJson((bool)MQLInfoInteger(MQL_TRADE_ALLOWED)) + "}";
   string response;
   bool ok = NexusSendSignedEnvelope("Account Snapshot", payload, response);
   if(ok)
      g_nexusState.lastSnapshotAt = TimeCurrent();
   return ok;
}

bool NexusSendPositionUpdate()
{
   string payload = "{\"schemaVersion\":\"" + CACSMS_PAYLOAD_SCHEMA +
      "\",\"accountLogin\":\"" + NexusAccountLogin() + "\",\"positions\":[";
   bool first = true;
   int total = PositionsTotal();

   for(int index = total - 1; index >= 0; index--)
   {
      ulong ticket = PositionGetTicket(index);
      if(ticket == 0)
         continue;
      if(!PositionSelectByTicket(ticket))
         continue;

      string symbol = PositionGetString(POSITION_SYMBOL);
      if(!NexusSymbolInScope(symbol))
         continue;

      if(!first)
         payload += ",";
      first = false;

      datetime openTime = (datetime)PositionGetInteger(POSITION_TIME);
      payload += "{\"positionTicket\":\"" + IntegerToString((long)ticket) +
         "\",\"symbol\":\"" + NexusJsonEscape(symbol) +
         "\",\"direction\":\"" + NexusPositionDirection(PositionGetInteger(POSITION_TYPE)) +
         "\",\"volume\":" + NexusNumberJson(PositionGetDouble(POSITION_VOLUME), 2) +
         ",\"entryPrice\":" + NexusNumberJson(PositionGetDouble(POSITION_PRICE_OPEN), (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS)) +
         ",\"currentPrice\":" + NexusNumberJson(PositionGetDouble(POSITION_PRICE_CURRENT), (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS)) +
         ",\"stopLoss\":" + NexusNumberJson(PositionGetDouble(POSITION_SL), (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS)) +
         ",\"takeProfit\":" + NexusNumberJson(PositionGetDouble(POSITION_TP), (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS)) +
         ",\"profitLoss\":" + NexusNumberJson(PositionGetDouble(POSITION_PROFIT), 2) +
         ",\"swap\":" + NexusNumberJson(PositionGetDouble(POSITION_SWAP), 2) +
         ",\"commission\":" + NexusNumberJson(NexusPositionCommission(ticket), 2) +
         ",\"openTime\":\"" + NexusIsoUtcFromDatetime(openTime) + "\"}";
   }

   payload += "]}";
   string response;
   bool ok = NexusSendSignedEnvelope("Position Update", payload, response);
   if(ok)
      g_nexusState.lastPositionAt = TimeCurrent();
   return ok;
}

bool NexusSendPendingOrderUpdate()
{
   string payload = "{\"schemaVersion\":\"" + CACSMS_PAYLOAD_SCHEMA +
      "\",\"accountLogin\":\"" + NexusAccountLogin() + "\",\"orders\":[";
   bool first = true;
   int total = OrdersTotal();

   for(int index = total - 1; index >= 0; index--)
   {
      ulong ticket = OrderGetTicket(index);
      if(ticket == 0)
         continue;
      if(!OrderSelect(ticket))
         continue;

      string symbol = OrderGetString(ORDER_SYMBOL);
      if(!NexusSymbolInScope(symbol))
         continue;

      if(!first)
         payload += ",";
      first = false;

      ENUM_ORDER_TYPE orderType = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
      datetime createdTime = (datetime)OrderGetInteger(ORDER_TIME_SETUP);
      datetime expiryTime = (datetime)OrderGetInteger(ORDER_TIME_EXPIRATION);
      payload += "{\"orderTicket\":\"" + IntegerToString((long)ticket) +
         "\",\"symbol\":\"" + NexusJsonEscape(symbol) +
         "\",\"orderType\":\"" + NexusJsonEscape(NexusOrderTypeLabel(orderType)) +
         "\",\"direction\":\"" + NexusOrderDirectionFromType(orderType) +
         "\",\"volume\":" + NexusNumberJson(OrderGetDouble(ORDER_VOLUME_CURRENT), 2) +
         ",\"price\":" + NexusNumberJson(OrderGetDouble(ORDER_PRICE_OPEN), (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS)) +
         ",\"stopLoss\":" + NexusNumberJson(OrderGetDouble(ORDER_SL), (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS)) +
         ",\"takeProfit\":" + NexusNumberJson(OrderGetDouble(ORDER_TP), (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS)) +
         ",\"createdTime\":\"" + NexusIsoUtcFromDatetime(createdTime) + "\"";
      if(expiryTime > 0)
         payload += ",\"expiryTime\":\"" + NexusIsoUtcFromDatetime(expiryTime) + "\"";
      payload += "}";
   }

   payload += "]}";
   string response;
   bool ok = NexusSendSignedEnvelope("Pending Order Update", payload, response);
   if(ok)
      g_nexusState.lastOrderAt = TimeCurrent();
   return ok;
}

void NexusPushFullTelemetry()
{
   NexusSendAccountSnapshot();
   NexusSendPositionUpdate();
   NexusSendPendingOrderUpdate();
}

#endif
