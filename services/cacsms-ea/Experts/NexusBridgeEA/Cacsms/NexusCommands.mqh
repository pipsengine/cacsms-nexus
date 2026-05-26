#ifndef CACSMS_NEXUS_COMMANDS_MQH
#define CACSMS_NEXUS_COMMANDS_MQH

#include <Trade/Trade.mqh>
#include "NexusConfig.mqh"
#include "NexusJson.mqh"
#include "NexusEnvelope.mqh"
#include "NexusTelemetry.mqh"

struct NexusTradeCommand
{
   string commandUuid;
   string symbol;
   string commandType;
   string direction;
   double volume;
   double requestedPrice;
   double stopLoss;
   double takeProfit;
   bool hasStopLoss;
   bool hasTakeProfit;
};

bool NexusSendExecutionFeedback(const string commandUuid, const string status, const int responseTimeMs, const string rejectionReason = "")
{
   string payload = "{\"commandUuid\":\"" + NexusJsonEscape(commandUuid) +
      "\",\"status\":\"" + NexusJsonEscape(status) +
      "\",\"responseTimeMs\":" + IntegerToString(responseTimeMs);
   if(StringLen(rejectionReason) > 0)
      payload += ",\"rejectionReason\":\"" + NexusJsonEscape(rejectionReason) + "\"";
   payload += "}";

   string response;
   return NexusSendSignedEnvelope("Trade Execution Result", payload, response);
}

bool NexusParseTradeCommand(const string objectJson, NexusTradeCommand &command)
{
   ZeroMemory(command);
   if(!NexusJsonExtractString(objectJson, "commandUuid", command.commandUuid))
      return false;
   if(!NexusJsonExtractString(objectJson, "symbol", command.symbol))
      return false;
   if(!NexusJsonExtractString(objectJson, "commandType", command.commandType))
      return false;
   if(!NexusJsonExtractString(objectJson, "direction", command.direction))
      return false;
   if(!NexusJsonExtractNumber(objectJson, "volume", command.volume))
      return false;
   NexusJsonExtractNumber(objectJson, "requestedPrice", command.requestedPrice);
   command.hasStopLoss = NexusJsonExtractNumber(objectJson, "stopLoss", command.stopLoss);
   command.hasTakeProfit = NexusJsonExtractNumber(objectJson, "takeProfit", command.takeProfit);
   return true;
}

bool NexusValidateCommandGuards(const NexusTradeCommand &command, string &rejectionReason)
{
   if(!g_nexusConfig.enableCommandExecution)
   {
      rejectionReason = "Command execution is disabled on this EA instance.";
      return false;
   }
   if(!TerminalInfoInteger(TERMINAL_CONNECTED))
   {
      rejectionReason = "Terminal is not connected to the broker.";
      return false;
   }
   if(!AccountInfoInteger(ACCOUNT_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED))
   {
      rejectionReason = "Trading is not allowed for this account or expert advisor.";
      return false;
   }
   if(command.volume <= 0 || command.volume > g_nexusConfig.maxCommandVolume)
   {
      rejectionReason = StringFormat("Requested volume %.2f exceeds configured max %.2f.", command.volume, g_nexusConfig.maxCommandVolume);
      return false;
   }
   if(!NexusSymbolInScope(command.symbol))
   {
      rejectionReason = "Symbol is outside the configured EA symbol scope.";
      return false;
   }
   if(!SymbolInfoInteger(command.symbol, SYMBOL_SELECT))
   {
      if(!SymbolSelect(command.symbol, true))
      {
         rejectionReason = "Requested symbol is unavailable in Market Watch.";
         return false;
      }
   }
   return true;
}

bool NexusExecuteTradeCommand(const NexusTradeCommand &command, string &rejectionReason)
{
   if(!NexusValidateCommandGuards(command, rejectionReason))
      return false;

   CTrade trade;
   trade.SetAsyncMode(false);
   trade.SetDeviationInPoints(20);
   bool result = false;

   if(command.commandType == "Market")
   {
      if(command.direction == "Buy")
         result = trade.Buy(command.volume, command.symbol, 0.0,
            command.hasStopLoss ? command.stopLoss : 0.0,
            command.hasTakeProfit ? command.takeProfit : 0.0);
      else
         result = trade.Sell(command.volume, command.symbol, 0.0,
            command.hasStopLoss ? command.stopLoss : 0.0,
            command.hasTakeProfit ? command.takeProfit : 0.0);
   }
   else if(command.commandType == "Limit")
   {
      if(command.direction == "Buy")
         result = trade.BuyLimit(command.volume, command.requestedPrice, command.symbol,
            command.hasStopLoss ? command.stopLoss : 0.0,
            command.hasTakeProfit ? command.takeProfit : 0.0);
      else
         result = trade.SellLimit(command.volume, command.requestedPrice, command.symbol,
            command.hasStopLoss ? command.stopLoss : 0.0,
            command.hasTakeProfit ? command.takeProfit : 0.0);
   }
   else
   {
      rejectionReason = "Unsupported command type: " + command.commandType;
      return false;
   }

   if(!result)
   {
      rejectionReason = StringFormat("OrderSend failed: retcode=%d desc=%s", trade.ResultRetcode(), trade.ResultRetcodeDescription());
      return false;
   }
   return true;
}

void NexusProcessCommandObject(const string objectJson)
{
   NexusTradeCommand command;
   if(!NexusParseTradeCommand(objectJson, command))
   {
      Print("Nexus Bridge skipped malformed command payload.");
      return;
   }
   if(NexusHasProcessedCommand(command.commandUuid))
      return;

   ulong started = GetTickCount();
   string rejectionReason = "";
   bool executed = false;
   if(g_nexusConfig.enableCommandExecution)
      executed = NexusExecuteTradeCommand(command, rejectionReason);
   else
      rejectionReason = "Command received but execution remains disabled until explicitly enabled.";

   int responseTimeMs = (int)(GetTickCount() - started);
   string status = executed ? "Executed" : "Rejected";
   NexusSendExecutionFeedback(command.commandUuid, status, responseTimeMs, executed ? "" : rejectionReason);
   NexusRememberProcessedCommand(command.commandUuid);

   if(executed)
   {
      PrintFormat("Nexus Bridge executed command %s on %s.", command.commandUuid, command.symbol);
      NexusPushFullTelemetry();
   }
   else
   {
      PrintFormat("Nexus Bridge rejected command %s: %s", command.commandUuid, rejectionReason);
   }
}

void NexusPollApprovedCommands()
{
   string response;
   if(!NexusSendSignedEnvelope("Command Poll", "{}", response))
      return;

   g_nexusState.lastCommandPollAt = TimeCurrent();
   if(StringLen(response) == 0)
      return;

   string blockedReason = "";
   if(NexusJsonExtractString(response, "blockedReason", blockedReason) && StringLen(blockedReason) > 0)
   {
      Print("Nexus Bridge command poll blocked: ", blockedReason);
      return;
   }

   string objects[];
   int count = NexusJsonFindObjectBlocks(response, "commands", objects);
   for(int index = 0; index < count; index++)
      NexusProcessCommandObject(objects[index]);
}

#endif
