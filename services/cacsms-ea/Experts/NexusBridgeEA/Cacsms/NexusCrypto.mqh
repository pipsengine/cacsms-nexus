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
   uchar key_raw[], data[], empty[], key_hash[];
   NexusStringBytes(secret, key_raw);
   NexusStringBytes(value, data);

   // HMAC requires a 64-byte block key. MQL5 ArrayResize does not zero-fill new slots.
   uchar key[64];
   ArrayInitialize(key, 0);
   if(ArraySize(key_raw) > 64)
   {
      if(CryptEncode(CRYPT_HASH_SHA256, key_raw, empty, key_hash) <= 0)
         return "";
      ArrayCopy(key, key_hash, 0, 0, MathMin(64, ArraySize(key_hash)));
   }
   else
   {
      ArrayCopy(key, key_raw, 0, 0, ArraySize(key_raw));
   }

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
