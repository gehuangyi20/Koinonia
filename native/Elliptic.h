#ifndef ELLIPTICNATIVE_ELLIPTIC_H
#define ELLIPTICNATIVE_ELLIPTIC_H

#include <nan.h>
#include <openssl/ec.h>
#include <openssl/obj_mac.h>
#include "POINT.h"
#include "BN.h"

class POINT;

class Elliptic : public Nan::ObjectWrap {

public:
    static NAN_MODULE_INIT(Init);
    const EC_GROUP *getGroup() const { return G; }
    BN_CTX *getCtx() const { return ctx; }
    const EC_POINT *getH() const { return h; }
    const EC_POINT *getGInv() const { return g_inv; }
    const BIGNUM *getOrder() const { return order; }
    void gen_z(const BIGNUM *x, const BIGNUM *y, EC_POINT *z) const;
    int verify_xyz(const BIGNUM *x, const BIGNUM *y,
                   const EC_POINT *z) const;
    int verify_xyz(const BN *x, const BN *y,
                   const POINT *z) const;
    int verify_proof_01(const EC_POINT *d0, const EC_POINT *d1,
                        const BIGNUM *e0, const BIGNUM *e1,
                        const BIGNUM *f0, const BIGNUM *f1,
                        const EC_POINT *z, BIGNUM *e) const;

private:
    explicit Elliptic(const int nid);
    explicit Elliptic(const int nid, const char *h_base64);
    ~Elliptic();
    static NAN_METHOD(New);
    static NAN_METHOD(gen_z);
    static NAN_METHOD(verify_xyz);
    static NAN_METHOD(verify_xyz_native);
    static NAN_METHOD(proof_01);
    static NAN_METHOD(verify_proof_01);
    static NAN_METHOD(createPoint);
    static NAN_METHOD(getOrder);
    static inline Nan::Persistent<v8::Function> &constructor() {
        static Nan::Persistent<v8::Function> my_constructor;
        return my_constructor;
    }

    EC_GROUP *G;
    EC_POINT *h;
    EC_POINT *g_inv;
    BN_CTX *ctx;
    BIGNUM *order;
};


#endif //ELLIPTICNATIVE_ELLIPTIC_H
