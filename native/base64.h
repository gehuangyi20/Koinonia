#ifndef NATIVEEC_BASE64_H
#define NATIVEEC_BASE64_H

int Base64Decode(const char* b64message, unsigned char** buffer, size_t *length);
int Base64Encode(const unsigned char* buffer, int length, char** b64text);
#endif //NATIVEEC_BASE64_H
