#include <openssl/bio.h>
#include <assert.h>
#include <string.h>
#include <openssl/evp.h>
#include <openssl/buffer.h>
#include "base64.h"

size_t calcDecodeLength(const char* b64input, const size_t len) { //Calculates the length of a decoded string
    size_t padding = 0;

    if (b64input[len-1] == '=' && b64input[len-2] == '=') //last two chars are =
        padding = 2;
    else if (b64input[len-1] == '=') //last char is =
        padding = 1;

    return (len*3)/4 - padding;
}

int Base64Decode(const char* b64message, unsigned char** buffer, size_t *length) { //Decodes a base64 encoded string
    BIO *bio, *b64;

    size_t msgLen = strlen(b64message);
    size_t decodeLen = calcDecodeLength(b64message, msgLen);
    *buffer = (unsigned char*)malloc(decodeLen + 1);
    if(*buffer == NULL) {
        *length = 0;
        return -1;
    }
    (*buffer)[decodeLen] = '\0';

    bio = BIO_new_mem_buf(b64message, -1);
    b64 = BIO_new(BIO_f_base64());
    bio = BIO_push(b64, bio);

    BIO_set_flags(bio, BIO_FLAGS_BASE64_NO_NL); //Do not use newlines to flush buffer
    *length = (size_t) BIO_read(bio, *buffer, (int) msgLen);
    assert(*length == decodeLen); //length should equal decodeLen, else something went horribly wrong
    BIO_free_all(bio);

    return (0); //success
}

int Base64Encode(const unsigned char* buffer, int length, char** b64text) { //Encodes a binary safe base 64 string
    BIO *bio, *b64;
    BUF_MEM *bufPtr;
    int ret = 0;

    b64 = BIO_new(BIO_f_base64());
    bio = BIO_new(BIO_s_mem());
    bio = BIO_push(b64, bio);

    BIO_set_flags(bio, BIO_FLAGS_BASE64_NO_NL); //Ignore newlines - write everything in one line

    BIO_write(bio, buffer, length);
    BIO_flush(bio);
    BIO_get_mem_ptr(bio, &bufPtr);

    /* make sure the data end with a end of string */
    size_t bufLen = bufPtr->length;
    size_t bufMax = bufPtr->max;
    if(bufLen < bufMax) {
        bufPtr->data[bufPtr->length] = '\0';
        *b64text = bufPtr->data;
    } else {
        /* allocate new */
        char* newBuf = (char*) realloc( bufPtr->data, (bufLen+1) * sizeof(char) );
        if(newBuf == NULL) {
            /* reallocate fails */
            free(bufPtr->data);
            ret = -1;
        } else {
            newBuf[bufLen] = '\0';
            *b64text = newBuf;
        }
    }

    BIO_set_close(bio, BIO_NOCLOSE);
    BIO_free_all(bio);

    return ret; //success
}