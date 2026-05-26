#ifndef CACSMS_NEXUS_JSON_MQH
#define CACSMS_NEXUS_JSON_MQH

string NexusJsonEscape(const string value)
{
   string escaped = value;
   StringReplace(escaped, "\\", "\\\\");
   StringReplace(escaped, "\"", "\\\"");
   StringReplace(escaped, "\r", "\\r");
   StringReplace(escaped, "\n", "\\n");
   StringReplace(escaped, "\t", "\\t");
   return escaped;
}

string NexusBoolJson(const bool value)
{
   return value ? "true" : "false";
}

string NexusNumberJson(const double value, const int digits = 8)
{
   return DoubleToString(value, digits);
}

bool NexusJsonExtractString(const string json, const string field, string &output)
{
   string needle = "\"" + field + "\":\"";
   int start = StringFind(json, needle);
   if(start < 0)
      return false;
   start += StringLen(needle);
   int end = StringFind(json, "\"", start);
   if(end < 0)
      return false;
   output = StringSubstr(json, start, end - start);
   return true;
}

bool NexusJsonExtractNumber(const string json, const string field, double &output)
{
   string needle = "\"" + field + "\":";
   int start = StringFind(json, needle);
   if(start < 0)
      return false;
   start += StringLen(needle);
   int end = start;
   while(end < StringLen(json))
   {
      ushort code = StringGetCharacter(json, end);
      if((code >= '0' && code <= '9') || code == '.' || code == '-' || code == '+')
      {
         end++;
         continue;
      }
      break;
   }
   if(end <= start)
      return false;
   output = StringToDouble(StringSubstr(json, start, end - start));
   return true;
}

int NexusJsonFindObjectBlocks(const string json, const string arrayField, string &objects[])
{
   string needle = "\"" + arrayField + "\":[";
   int arrayStart = StringFind(json, needle);
   if(arrayStart < 0)
      return 0;

   arrayStart += StringLen(needle);
   int depth = 0;
   int blockStart = -1;
   int count = 0;

   for(int index = arrayStart; index < StringLen(json); index++)
   {
      ushort code = StringGetCharacter(json, index);
      if(code == '{')
      {
         if(depth == 0)
            blockStart = index;
         depth++;
      }
      else if(code == '}')
      {
         depth--;
         if(depth == 0 && blockStart >= 0)
         {
            ArrayResize(objects, count + 1);
            objects[count] = StringSubstr(json, blockStart, index - blockStart + 1);
            count++;
            blockStart = -1;
         }
      }
      else if(code == ']' && depth == 0)
      {
         break;
      }
   }

   return count;
}

#endif
