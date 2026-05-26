#ifndef CACSMS_NEXUS_TIME_MQH
#define CACSMS_NEXUS_TIME_MQH

#include "NexusConfig.mqh"

string NexusIsoUtc()
{
   MqlDateTime parts;
   TimeToStruct(TimeGMT(), parts);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
      parts.year, parts.mon, parts.day, parts.hour, parts.min, parts.sec);
}

string NexusIsoUtcFromDatetime(const datetime value)
{
   MqlDateTime parts;
   TimeToStruct(value, parts);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
      parts.year, parts.mon, parts.day, parts.hour, parts.min, parts.sec);
}

string NexusMakeNonce()
{
   return StringFormat("%s-%I64d-%u", g_nexusConfig.instanceId, (long)TimeGMT(), GetTickCount());
}

int NexusTerminalLatencyMs()
{
   long ping = TerminalInfoInteger(TERMINAL_PING_LAST);
   if(ping < 0)
      ping = 0;
   if(ping > 60000)
      ping = 60000;
   return (int)ping;
}

bool NexusIntervalElapsed(const datetime lastAt, const int intervalSeconds)
{
   if(intervalSeconds <= 0)
      return false;
   if(lastAt <= 0)
      return true;
   return (TimeCurrent() - lastAt) >= intervalSeconds;
}

#endif
