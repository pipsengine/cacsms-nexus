#ifndef CACSMS_NEXUS_HTTP_MQH
#define CACSMS_NEXUS_HTTP_MQH

#include "NexusConfig.mqh"

bool NexusHttpPost(const string url, const string headers, const string body, string &response_body, int &http_status)
{
   char request_body[], response[];
   string response_headers;
   StringToCharArray(body, request_body, 0, WHOLE_ARRAY, CP_UTF8);
   if(ArraySize(request_body) > 0)
      ArrayResize(request_body, ArraySize(request_body) - 1);

   for(int attempt = 0; attempt <= g_nexusConfig.httpRetryCount; attempt++)
   {
      ResetLastError();
      http_status = WebRequest("POST", url, headers, g_nexusConfig.httpTimeoutMs, request_body, response, response_headers);
      response_body = CharArrayToString(response, 0, WHOLE_ARRAY, CP_UTF8);

      if(http_status >= 200 && http_status < 300)
      {
         g_nexusState.consecutiveHttpFailures = 0;
         return true;
      }

      if(attempt < g_nexusConfig.httpRetryCount)
         Sleep(g_nexusConfig.httpRetryDelayMs * (attempt + 1));
   }

   g_nexusState.consecutiveHttpFailures++;
   PrintFormat("Nexus Bridge POST %s failed after %d attempt(s). HTTP=%d err=%d body=%s",
      url, g_nexusConfig.httpRetryCount + 1, http_status, GetLastError(), response_body);
   return false;
}

#endif
