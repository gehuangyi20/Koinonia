#ifndef NATIVEECC_EC_H
#define NATIVEECC_EC_H

#include <openssl/ec.h>

# ifdef  __cplusplus
extern "C" {
# endif

size_t EC_POINT_point2bytes(const EC_GROUP *group, const EC_POINT *point,
                            point_conversion_form_t form,
                            unsigned char **pbuf, BN_CTX *ctx);
int BN_bn2bytes(const BIGNUM* num, unsigned char **pbuf);

#ifdef  __cplusplus
}
#endif

#endif //NATIVEECC_EC_H
