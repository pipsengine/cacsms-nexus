#ifndef CACSMS_NEXUS_ENVELOPE_MQH
#define CACSMS_NEXUS_ENVELOPE_MQH

#include "NexusConfig.mqh"
#include "NexusJson.mqh"
#include "NexusCrypto.mqh"
#include "NexusTime.mqh"
#include "NexusHttp.mqh"

string NexusEndpointFor(const string message_type)
{
   if(message_type == "Heartbeat")
      return "/api/mt5/ea-bridge/ingest/heartbeat";
   if(message_type == "Account Snapshot")
      return "/api/mt5/ea-bridge/ingest/account-snapshot";
   if(message_type == "Position Update")
      return "/api/mt5/ea-bridge/ingest/positions";
   if(message_type == "Pending Order Update")
      return "/api/mt5/ea-bridge/ingest/orders";
   if(message_type == "Trade Execution Result")
      return "/api/mt5/ea-bridge/instances/" + g_nexusConfig.instanceId + "/command-ack";
   if(message_type == "Command Poll")
      return "/api/mt5/ea-bridge/instances/" + g_nexusConfig.instanceId + "/pending-commands";
   return "";
}

bool NexusSendSignedEnvelope(const string message_type, const string payload_json, string &response_body)
{
   string endpoint = NexusEndpointFor(message_type);
   if(endpoint == "")
   {
      Print("Nexus Bridge unsupported message type: ", message_type);
      return false;
   }

   string timestamp = NexusIsoUtc();
   string nonce = NexusMakeNonce();
   string canonical = g_nexusConfig.instanceId + "\n" + message_type + "\n" + timestamp + "\n" + nonce + "\n" + payload_json;
   string signature = NexusHmacSha256(g_nexusConfig.signingSecret, canonical);
   if(signature == "")
   {
      Print("Nexus Bridge could not calculate message signature.");
      return false;
   }

   string body = "{\"instanceId\":\"" + NexusJsonEscape(g_nexusConfig.instanceId) +
      "\",\"messageType\":\"" + NexusJsonEscape(message_type) +
      "\",\"timestamp\":\"" + timestamp +
      "\",\"nonce\":\"" + NexusJsonEscape(nonce) +
      "\",\"payloadJson\":\"" + NexusJsonEscape(payload_json) +
      "\",\"signature\":\"" + signature + "\"}";
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + g_nexusConfig.ingestionToken + "\r\n";
   int http_status = 0;
   return NexusHttpPost(NexusJoinUrl(g_nexusConfig.baseUrl, endpoint), headers, body, response_body, http_status);
}

bool NexusTestPairing(string &response_body)
{
   string endpoint = "/api/mt5/ea-bridge/instances/" + g_nexusConfig.instanceId + "/test-pairing";
   string body = "{\"confirmed\":true,\"ingestionToken\":\"" + NexusJsonEscape(g_nexusConfig.ingestionToken) +
      "\",\"signingSecret\":\"" + NexusJsonEscape(g_nexusConfig.signingSecret) + "\"}";
   string headers = "Content-Type: application/json\r\n";
   int http_status = 0;
   bool ok = NexusHttpPost(NexusJoinUrl(g_nexusConfig.baseUrl, endpoint), headers, body, response_body, http_status);
   if(ok && StringFind(response_body, "\"accepted\":true") >= 0)
      return true;
   return false;
}

#endif
