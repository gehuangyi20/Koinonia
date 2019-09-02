#include "util.h"

size_t EC_POINT_point2bytes(const EC_GROUP *group, const EC_POINT *point,
                            point_conversion_form_t form,
                            unsigned char **pbuf, BN_CTX *ctx) {
    size_t len;
    unsigned char *buf;
    len = EC_POINT_point2oct(group, point, form, NULL, 0, NULL);
    if(len == 0) {
        return 0;
    }
    buf = (unsigned char*) malloc(len);
    if(buf == NULL) {
        return 0;
    }
    len = EC_POINT_point2oct(group, point, form, buf, len, ctx);

    if(len == 0) {
        free(buf);
        return 0;
    }
    *pbuf = buf;
    return len;
}

int BN_bn2bytes(const BIGNUM* num, unsigned char **pbuf) {
    int len;
    unsigned char *buf;
    buf = (unsigned char*) malloc( BN_num_bytes(num) * sizeof(unsigned char) );
    if(buf == NULL) {
        return -1;
    }
    len = BN_bn2bin(num, buf);
    *pbuf = buf;
    return len;
}