#ifndef CACSMS_NEXUS_CRYPTO_MQH
#define CACSMS_NEXUS_CRYPTO_MQH

void NexusStringBytes(const string value, uchar &output[])
{
   int copied = StringToCharArray(value, output, 0, WHOLE_ARRAY, CP_UTF8);
   if(copied > 0)
      ArrayResize(output, copied - 1);
}

string NexusHexEncode(const uchar &value[])
{
   string encoded = "";
   for(int index = 0; index < ArraySize(value); index++)
      encoded += StringFormat("%02x", value[index]);
   return encoded;
}

string NexusHmacSha256(const string secret, const string value)
{
   uchar key[], data[], empty[], key_hash[];
   NexusStringBytes(secret, key);
   NexusStringBytes(value, data);
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
   return NexusHexEncode(digest);
}

#endif
