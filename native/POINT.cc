#include <openssl/err.h>
#include "POINT.h"
#include "base64.h"
#include "util.h"

NAN_MODULE_INIT(POINT::Init) {
    v8::Local<v8::FunctionTemplate> tpl = Nan::New < v8::FunctionTemplate > (New);
    tpl->SetClassName(Nan::New("POINT").ToLocalChecked());
    tpl->InstanceTemplate()->SetInternalFieldCount(1);

    Nan::SetPrototypeMethod(tpl, "addMPoint", addMPoint);
    Nan::SetPrototypeMethod(tpl, "addMPointBase64", addMPointBase64);
    Nan::SetPrototypeMethod(tpl, "toBase64", toBase64);
    Nan::SetPrototypeMethod(tpl, "setCompressedCoordinates", setCompressedCoordinates);

    constructor().Reset(Nan::GetFunction(tpl).ToLocalChecked());
}

POINT::POINT(const EC_GROUP *group, BN_CTX *ctx) : group(group), ctx(ctx) {
    EC_POINT *point = EC_POINT_new(this->group);
    this->point = point;
}

POINT::POINT(const EC_GROUP *group, BN_CTX *ctx, const char* data): POINT(group, ctx) {
    unsigned char *data_bin;
    size_t data_len;

    /* decode base64 point to char* */
    Base64Decode(data, &data_bin, &data_len);

    BN_CTX_start(ctx);
    /* setup point */
    EC_POINT_oct2point(this->group, this->point, data_bin, data_len, ctx);
    BN_CTX_end(ctx);

    /* free memory */
    free(data_bin);
}

POINT::~POINT() {
    EC_POINT_free(this->point);
}

void POINT::addMEC_POINT(const EC_POINT *b) const {
    BN_CTX *ctx = this->ctx;
    BN_CTX_start(ctx);
    EC_POINT_add(this->group, this->point, this->point, b, ctx);
    BN_CTX_end(ctx);
}

void POINT::addMPOINT(const POINT *b) const {
    this->addMEC_POINT(b->getPoint());
}

size_t POINT::toOct(unsigned char **pbuf) const {
    return EC_POINT_point2bytes(group, point, POINT_CONVERSION_UNCOMPRESSED, pbuf, ctx);
}

NAN_METHOD(POINT::New) {

    if (!info.IsConstructCall()) {
        // generic recursive call with `new`
        int il = info.Length();
        v8::Local<v8::Value> *args = new v8::Local<v8::Value>[il];
        for (int i = 0; i < il; ++i) args[i] = info[i];
        // Nan::MaybeLocal<v8::Object> inst = Nan::NewInstance(info.Callee(), il, args);
        v8::Local<v8::Function> cons = Nan::New(POINT::constructor());
        Nan::MaybeLocal<v8::Object> inst = Nan::NewInstance(cons, il, args);
        delete args;
        if (!inst.IsEmpty()) info.GetReturnValue().Set(inst.ToLocalChecked());
        return;
    }

    Nan::MaybeLocal<v8::Object> maybeElliptic = Nan::To<v8::Object>(info[0]);
    Elliptic *elliptic = Nan::ObjectWrap::Unwrap<Elliptic>(maybeElliptic.ToLocalChecked());
    POINT *obj;

    if(info.Length() == 2) {
        obj = new POINT(elliptic->getGroup(), elliptic->getCtx(), *( Nan::Utf8String(info[1]) ));
    } else {
        obj = new POINT(elliptic->getGroup(), elliptic->getCtx());
    }

    obj->Wrap(info.This());
    info.GetReturnValue().Set(info.This());
}


NAN_METHOD(POINT::addMPoint) {
    Nan::MaybeLocal<v8::Object> maybeB = Nan::To<v8::Object>(info[0]);
    POINT *a = Nan::ObjectWrap::Unwrap<POINT>(info.This());
    POINT *b = Nan::ObjectWrap::Unwrap<POINT>(maybeB.ToLocalChecked());
    a->addMPOINT(b);
    info.GetReturnValue().Set(info.This());
}

NAN_METHOD(POINT::addMPointBase64) {
    POINT *a = Nan::ObjectWrap::Unwrap<POINT>(info.This());
    char *b_cstr = *( Nan::Utf8String(info[0]) );
    unsigned char *b_bin;
    size_t b_len;

    Base64Decode(b_cstr, &b_bin, &b_len);

    const EC_GROUP *group = a->getGroup();
    EC_POINT *b = EC_POINT_new(group);
    EC_POINT_oct2point(group, b, b_bin, b_len, a->getCtx());
    a->addMEC_POINT(b);

    free(b_bin);
    EC_POINT_free(b);
    info.GetReturnValue().Set(info.This());
}

NAN_METHOD(POINT::toBase64) {
    POINT *a = Nan::ObjectWrap::Unwrap<POINT>(info.This());
    unsigned char *buf;
    char *retBuf;
    size_t len = a->toOct(&buf);
    int ret;
    if(len == 0) {
        info.GetReturnValue().Set(Nan::Null());
        goto BASE64ERR;
    }

    ret = Base64Encode((const unsigned char* )buf, (int)len, &retBuf);
    if(ret == -1) {
        info.GetReturnValue().Set(Nan::Null());
        goto BASE64ERR;
    }

    info.GetReturnValue().Set(Nan::New(retBuf).ToLocalChecked());
    free(retBuf);
BASE64ERR:
    free(buf);
}

NAN_METHOD(POINT::setCompressedCoordinates) {
    POINT *p = Nan::ObjectWrap::Unwrap<POINT>(info.This());
    Nan::MaybeLocal<v8::Object> maybeX = Nan::To<v8::Object>(info[0]);
    BN *x = Nan::ObjectWrap::Unwrap<BN>(maybeX.ToLocalChecked());
    Nan::Maybe<int32_t> maybeB = Nan::To<int32_t>(info[1]);
    int32_t b = maybeB.ToChecked();
    if(b != 0 && b!= 1) {
        info.GetReturnValue().Set(Nan::False());
        return;
    }

    int ret = EC_POINT_set_compressed_coordinates_GFp(p->getGroup(), p->getPoint(), x->getNum(), b, p->getCtx());

    if(ret == 1) {
        info.GetReturnValue().Set(Nan::True());
    } else {
        /* flush all errors */
        while( ERR_get_error() );
        info.GetReturnValue().Set(Nan::False());
    }
}