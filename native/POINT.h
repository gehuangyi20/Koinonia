#ifndef NATIVEECC_POINT_H
#define NATIVEECC_POINT_H

#include <nan.h>
#include <openssl/ec.h>
#include "Elliptic.h"

class Elliptic;

class POINT : public Nan::ObjectWrap {
public:
    static NAN_MODULE_INIT(Init);
    static inline Nan::Persistent<v8::Function> &constructor() {
        static Nan::Persistent<v8::Function> my_constructor;
        return my_constructor;
    }
    explicit POINT(const EC_GROUP *group, BN_CTX *ctx);
    explicit POINT(const EC_GROUP *group, BN_CTX *ctx, const char* data);
    inline EC_POINT *getPoint() const { return point; }
    inline const EC_GROUP *getGroup() const { return group; }
    inline BN_CTX *getCtx() const { return ctx; }
    void addMEC_POINT(const EC_POINT *b) const;
    void addMPOINT(const POINT *b) const;
    size_t toOct(unsigned char **pbuf) const;

private:
    ~POINT();
    static NAN_METHOD(New);
    static NAN_METHOD(addMPoint);
    static NAN_METHOD(addMPointBase64);
    static NAN_METHOD(toBase64);
    static NAN_METHOD(setCompressedCoordinates);

    const EC_GROUP *group;
    EC_POINT *point;
    BN_CTX *ctx;
};


#endif //NATIVEECC_POINT_H
