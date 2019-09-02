#include "Elliptic.h"
#include "base64.h"
#include "util.h"
#include <openssl/evp.h>
#include <openssl/err.h>

NAN_MODULE_INIT(Elliptic::Init) {
    v8::Local<v8::FunctionTemplate> tpl = Nan::New < v8::FunctionTemplate > (New);
    tpl->SetClassName(Nan::New("Elliptic").ToLocalChecked());
    tpl->InstanceTemplate()->SetInternalFieldCount(1);

    Nan::SetPrototypeMethod(tpl, "gen_z", gen_z);
    Nan::SetPrototypeMethod(tpl, "verify_xyz", verify_xyz);
    Nan::SetPrototypeMethod(tpl, "proof_01", proof_01);
    Nan::SetPrototypeMethod(tpl, "verify_xyz_native", verify_xyz_native);
    Nan::SetPrototypeMethod(tpl, "verify_proof_01", verify_proof_01);
    Nan::SetPrototypeMethod(tpl, "createPoint", createPoint);
    Nan::SetPrototypeMethod(tpl, "getOrder", getOrder);

    constructor().Reset(Nan::GetFunction(tpl).ToLocalChecked());

    Nan::Set(target, Nan::New("Elliptic").ToLocalChecked(),
             Nan::GetFunction(tpl).ToLocalChecked());
}

Elliptic::Elliptic(const int nid) {
    this->G = EC_GROUP_new_by_curve_name(nid);
    if(this->G == NULL) {
        return;
    }

    /* store ctx */
    BN_CTX *ctx = BN_CTX_new();
    this->ctx = ctx;
    BN_CTX_start(ctx);

    /* get group order */
    BIGNUM* order = BN_new();
    EC_GROUP_get_order(this->G, order, ctx);
    this->order = order;

    /* compute h */
    EC_POINT *POINT = EC_POINT_new(this->G);
    this->h = POINT;

    /* compute g_inv */
    const EC_POINT* g = EC_GROUP_get0_generator(G);
    EC_POINT *g_inv = EC_POINT_new(this->G);
    EC_POINT_copy(g_inv, g);
    EC_POINT_invert(this->G, g_inv, ctx);
    this->g_inv = g_inv;

    /* pre-compute to speed up point multiplication */
    EC_GROUP_precompute_mult(this->G, ctx);

    BN_CTX_end(ctx);

}

Elliptic::Elliptic(const int nid, const char *h_base64) : Elliptic(nid) {
    if(G == NULL) {
        return;
    }

    /* decode base64 string to binary */
    unsigned char *h_bin;
    size_t h_len;
    Base64Decode(h_base64, &h_bin, &h_len);

    BN_CTX_start(ctx);

    /* convert binary string to big number and ec point */
    EC_POINT_oct2point(G, h, h_bin, h_len, ctx);
    BN_CTX_end(ctx);

    /* free memory */
    free(h_bin);
}

Elliptic::~Elliptic() {
    if(this->G) {
        EC_GROUP_free(this->G);
        EC_POINT_free(this->h);
        EC_POINT_free(this->g_inv);
        BN_free(this->order);
        BN_CTX_free(this->ctx);
    }
}

void Elliptic::gen_z(const BIGNUM *x, const BIGNUM *y, EC_POINT *z) const {
    BN_CTX_start(this->ctx);
    EC_POINT_mul(this->G, z, x, this->h, y, this->ctx);
    BN_CTX_end(this->ctx);
}

int Elliptic::verify_xyz(const BIGNUM *x, const BIGNUM *y,
                         const EC_POINT *z) const {
    BN_CTX_start(this->ctx);
    EC_POINT *tmp = EC_POINT_new(this->G);
    EC_POINT_mul(this->G, tmp, x, this->h, y, this->ctx);
    int ret = EC_POINT_cmp(this->G, tmp, z, this->ctx);
    EC_POINT_free(tmp);
    BN_CTX_end(this->ctx);
    return ret;
}

int Elliptic::verify_xyz(const BN *x, const BN *y,
               const POINT *z) const {
    return this->verify_xyz(x->getNum(), y->getNum(), z->getPoint());
}

int Elliptic::verify_proof_01(const EC_POINT *d0, const EC_POINT *d1,
                              const BIGNUM *e0, const BIGNUM *e1,
                              const BIGNUM *f0, const BIGNUM *f1,
                              const EC_POINT *z, BIGNUM *e) const {

    BN_CTX *ctx = this->ctx;
    EC_GROUP *G = this->G;
    const EC_POINT *h = this->h;
    int ret;
    const EC_POINT *ps0[2], *ps1[2];
    const BIGNUM *bns0[2], *bns1[2];
    EC_POINT *d_tmp, *z_tmp;
    BN_CTX_start(ctx);

    /* compute e = e0 + e1 mod r */
    BN_sub(e, e, e0);
    BN_mod_sub(e, e, e1, this->order, ctx);
    if( !BN_is_zero(e) ) {
        ret = 1;
        goto FALSE01;
    }

    d_tmp = EC_POINT_new(G);
    ps0[0] = h; ps0[1] = z;
    bns0[0] = f0; bns0[1] = e0;

    /* compute h^f0 * m^e0 */
    EC_POINTs_mul(G, d_tmp, NULL, 2, ps0, bns0, ctx);
    ret = EC_POINT_cmp(G, d_tmp, d0, ctx);
    /* no need further proof if first proof fails */
    if(ret) {
        goto FALSE02;
    }

    z_tmp = EC_POINT_new(G);
    ps1[0] = h; ps1[1] = z_tmp;
    bns1[0] = f1; bns1[1] = e1;

    /* compute h^f1 * (g^-1*m)^e1 */
    EC_POINT_add(G, z_tmp, this->g_inv, z, ctx);
    EC_POINTs_mul(G, d_tmp, NULL, 2, ps1, bns1, ctx);
    ret = EC_POINT_cmp(G, d_tmp, d1, ctx);

    EC_POINT_free(z_tmp);
FALSE02:
    EC_POINT_free(d_tmp);
FALSE01:
    BN_CTX_end(this->ctx);
    return ret;
}

NAN_METHOD(Elliptic::New) {

    if (!info.IsConstructCall()) {
        // generic recursive call with `new`
        int il = info.Length();
        v8::Local<v8::Value> *args = new v8::Local<v8::Value>[il];
        for (int i = 0; i < il; ++i) args[i] = info[i];
        // Nan::MaybeLocal<v8::Object> inst = Nan::NewInstance(info.Callee(), il, args);
        v8::Local<v8::Function> cons = Nan::New(Elliptic::constructor());
        Nan::MaybeLocal<v8::Object> inst = Nan::NewInstance(cons, il, args);
        delete args;
        if (!inst.IsEmpty()) info.GetReturnValue().Set(inst.ToLocalChecked());
        return;
    }

    Nan::Maybe<int32_t> maybeInt = Nan::To<int32_t>(info[0]);

    int32_t nid = maybeInt.ToChecked();
    char *msg = *( Nan::Utf8String(info[1]) );

    Elliptic *obj;
    if(info.Length() == 2) {
        obj = new Elliptic(nid, msg);
    } else {
        obj = new Elliptic(nid);
    }

    if(obj->getGroup() == NULL) {
        Nan::ThrowError("Error: curve is not valid.");
    }

    unsigned long code;
    while( (code = ERR_get_error()) ) {
        Nan::ThrowError(ERR_error_string(code, NULL));
    }
    obj->Wrap(info.This());
    info.GetReturnValue().Set(info.This());
}

NAN_METHOD(Elliptic::gen_z) {
    Nan::MaybeLocal<v8::Object> maybeX = Nan::To<v8::Object>(info[0]);
    Nan::MaybeLocal<v8::Object> maybeY = Nan::To<v8::Object>(info[1]);
    BN *x = Nan::ObjectWrap::Unwrap<BN>(maybeX.ToLocalChecked());
    BN *y = Nan::ObjectWrap::Unwrap<BN>(maybeY.ToLocalChecked());
    Elliptic *obj = Nan::ObjectWrap::Unwrap<Elliptic>(info.This());
    v8::Local<v8::Function> cons = Nan::New(POINT::constructor());
    v8::Local<v8::Value> argv[1] = { info.This() };
    v8::Local<v8::Object> zObj = Nan::NewInstance(cons, 1, argv).ToLocalChecked();
    POINT *z = Nan::ObjectWrap::Unwrap<POINT>(zObj);

    obj->gen_z(x->getNum(), y->getNum(), z->getPoint());
    info.GetReturnValue().Set(zObj);
}

NAN_METHOD(Elliptic::verify_xyz) {
    Elliptic *obj = Nan::ObjectWrap::Unwrap<Elliptic>(info.This());
    char *x = *( Nan::Utf8String(info[0]) );
    char *y = *( Nan::Utf8String(info[1]) );
    char *z = *( Nan::Utf8String(info[2]) );

    /* decode base64 string to binary */
    unsigned char *x_bin, *y_bin, *z_bin;
    size_t x_len, y_len, z_len;
    Base64Decode(x, &x_bin, &x_len);
    Base64Decode(y, &y_bin, &y_len);
    Base64Decode(z, &z_bin, &z_len);

    BN_CTX *ctx = obj->getCtx();
    BN_CTX_start(ctx);
    BIGNUM *x_bn = BN_CTX_get(ctx);
    BIGNUM *y_bn = BN_CTX_get(ctx);

    /* convert binary string to big number and ec point */
    BN_bin2bn(x_bin, (int) x_len, x_bn);
    BN_bin2bn(y_bin, (int) y_len, y_bn);
    EC_POINT *POINT = EC_POINT_new(obj->getGroup());
    EC_POINT_oct2point(obj->getGroup(), POINT, z_bin, z_len, ctx);

    /* verify result */
    int ret = obj->verify_xyz(x_bn, y_bn, POINT);

    BN_CTX_end(ctx);

    /* free memory */
    free(x_bin);
    free(y_bin);
    free(z_bin);
    EC_POINT_free(POINT);

    info.GetReturnValue().Set(ret == 0 ? Nan::True() : Nan::False());
}

NAN_METHOD(Elliptic::verify_xyz_native) {
    Elliptic *elliptic = Nan::ObjectWrap::Unwrap<Elliptic>(info.This());
    v8::Local<v8::Object> xObj = Nan::To<v8::Object>(info[0]).ToLocalChecked();
    BN *x = Nan::ObjectWrap::Unwrap<BN>(xObj);
    v8::Local<v8::Object> yObj = Nan::To<v8::Object>(info[1]).ToLocalChecked();
    BN *y = Nan::ObjectWrap::Unwrap<BN>(yObj);
    v8::Local<v8::Object> zObj = Nan::To<v8::Object>(info[2]).ToLocalChecked();
    POINT *z = Nan::ObjectWrap::Unwrap<POINT>(zObj);

    /* verify result */
    int ret = elliptic->verify_xyz(x, y, z);

    info.GetReturnValue().Set(ret == 0 ? Nan::True() : Nan::False());
}

NAN_METHOD(Elliptic::proof_01) {
    Elliptic *elliptic = Nan::ObjectWrap::Unwrap<Elliptic>(info.This());
    v8::Local<v8::Object> zObj = Nan::To<v8::Object>(info[0]).ToLocalChecked();
    POINT *zPoint = Nan::ObjectWrap::Unwrap<POINT>(zObj);
    const EC_POINT *z = zPoint->getPoint();
    v8::Local<v8::Object> yObj = Nan::To<v8::Object>(info[1]).ToLocalChecked();
    BN *yBN = Nan::ObjectWrap::Unwrap<BN>(yObj);
    const BIGNUM* y = yBN->getNum();
    Nan::Maybe<uint32_t> maybeB = Nan::To<uint32_t>(info[2]);
    uint32_t b = maybeB.ToChecked();

    /* allocate memory */
    BN_CTX *ctx = elliptic->getCtx();
    BN_CTX_start(ctx);

    const EC_GROUP *G = elliptic->getGroup();

    EC_POINT *d0_point = EC_POINT_new(G);
    EC_POINT *d1_point = EC_POINT_new(G);

    BIGNUM *r = BN_CTX_get(ctx);
    BIGNUM *e_bar = BN_CTX_get(ctx);
    BIGNUM *f_bar = BN_CTX_get(ctx);

    const BIGNUM* order = elliptic->getOrder();

    BN_rand_range(r, order);
    BN_rand_range(f_bar, order);
    BN_rand_range(e_bar, order);

    const EC_POINT *h = elliptic->getH();
    const EC_POINT *g_inv = elliptic->getGInv();
    const BIGNUM *bns[2] = {f_bar, e_bar};
    const EC_POINT *ps[2] = {h, z};

    /* compute d0, d1 */
    if( b==1 ) {
        EC_POINTs_mul(G, d0_point, NULL, 2, ps, bns, ctx);
        EC_POINT_mul(G, d1_point, NULL, h, r, ctx);
    } else {
        EC_POINT_mul(G, d0_point, NULL, h, r, ctx);
        EC_POINT *z_tmp = EC_POINT_new(G);
        ps[1] = z_tmp;
        /* compute h^f1 * (g^-1*m)^e1 */
        EC_POINT_add(G, z_tmp, g_inv, z, ctx);
        EC_POINTs_mul(G, d1_point, NULL, 2, ps, bns, ctx);
        EC_POINT_free(z_tmp);
    }

    unsigned char *d0_bin, *d1_bin, *e0_bin, *e1_bin, *f0_bin, *f1_bin, *z_bin;
    size_t d0_len, d1_len, z_len;
    int e0_len, e1_len, f0_len, f1_len;

    /* convert d0, d1, and z to bytes */
    d0_len = EC_POINT_point2bytes(G, d0_point, POINT_CONVERSION_UNCOMPRESSED, &d0_bin, ctx);
    d1_len = EC_POINT_point2bytes(G, d1_point, POINT_CONVERSION_UNCOMPRESSED, &d1_bin, ctx);
    z_len = EC_POINT_point2bytes(G, z, POINT_CONVERSION_UNCOMPRESSED, &z_bin, ctx);

    /* compute e which hash(z, d0, d1) */
    EVP_MD_CTX *mdctx = EVP_MD_CTX_create();
    EVP_DigestInit_ex(mdctx, EVP_sha256(), NULL);
    EVP_DigestUpdate(mdctx, z_bin, z_len);
    EVP_DigestUpdate(mdctx, d0_bin, d0_len);
    EVP_DigestUpdate(mdctx, d1_bin, d1_len);
    unsigned char *e_bin = (unsigned char *) OPENSSL_malloc( (size_t) EVP_MD_size(EVP_sha256()) );
    unsigned int e_len;
    EVP_DigestFinal_ex(mdctx, e_bin, &e_len);
    EVP_MD_CTX_destroy(mdctx);

    /* get bignum e */
    BIGNUM *e_bn = BN_CTX_get(ctx);
    BN_bin2bn(e_bin, (int) e_len, e_bn);

    /* compute d_b, f_b */
    BIGNUM *e_b = BN_CTX_get(ctx);
    BIGNUM *f_b = BN_CTX_get(ctx);

    BN_mod_sub(e_b, e_bn, e_bar, order, ctx);
    BN_mod_mul(f_b, e_b, y, order, ctx);
    BN_mod_sub(f_b, r, f_b, order, ctx);

    BIGNUM *e0_bn, *e1_bn, *f0_bn, *f1_bn;

    if (b == 1) {
        e0_bn = e_bar;
        e1_bn = e_b;
        f0_bn = f_bar;
        f1_bn = f_b;
    } else {
        e0_bn = e_b;
        e1_bn = e_bar;
        f0_bn = f_b;
        f1_bn = f_bar;
    }

    /* convert bignum to bytes */
    e0_len = BN_bn2bytes(e0_bn, &e0_bin);
    e1_len = BN_bn2bytes(e1_bn, &e1_bin);
    f0_len = BN_bn2bytes(f0_bn, &f0_bin);
    f1_len = BN_bn2bytes(f1_bn, &f1_bin);

    /* convert bytes to base64 */
    char *d0, *d1, *e0, *e1, *f0, *f1;
    Base64Encode(d0_bin, (int)d0_len, &d0);
    Base64Encode(d1_bin, (int)d1_len, &d1);
    Base64Encode(e0_bin, e0_len, &e0);
    Base64Encode(e1_bin, e1_len, &e1);
    Base64Encode(f0_bin, f0_len, &f0);
    Base64Encode(f1_bin, f1_len, &f1);

    /* setup return value */
    v8::Local<v8::Object> ret = Nan::New<v8::Object>();
    ret->Set(Nan::New("d0").ToLocalChecked(), Nan::New(d0).ToLocalChecked());
    ret->Set(Nan::New("d1").ToLocalChecked(), Nan::New(d1).ToLocalChecked());
    ret->Set(Nan::New("e0").ToLocalChecked(), Nan::New(e0).ToLocalChecked());
    ret->Set(Nan::New("e1").ToLocalChecked(), Nan::New(e1).ToLocalChecked());
    ret->Set(Nan::New("f0").ToLocalChecked(), Nan::New(f0).ToLocalChecked());
    ret->Set(Nan::New("f1").ToLocalChecked(), Nan::New(f1).ToLocalChecked());

    info.GetReturnValue().Set(ret);

    /* free memory */
    BN_CTX_end(ctx);

    EC_POINT_free(d0_point);
    EC_POINT_free(d1_point);

    free(d0_bin);
    free(d1_bin);
    free(e0_bin);
    free(e1_bin);
    free(f0_bin);
    free(f1_bin);
    free(e_bin);
    free(z_bin);

    free(d0);
    free(d1);
    free(e0);
    free(e1);
    free(f0);
    free(f1);
}

NAN_METHOD(Elliptic::verify_proof_01) {
    const v8::Local<v8::Value> e0_key = Nan::New("e0").ToLocalChecked();
    const v8::Local<v8::Value> e1_key = Nan::New("e1").ToLocalChecked();
    const v8::Local<v8::Value> f0_key = Nan::New("f0").ToLocalChecked();
    const v8::Local<v8::Value> f1_key = Nan::New("f1").ToLocalChecked();
    const v8::Local<v8::Value> d0_key = Nan::New("d0").ToLocalChecked();
    const v8::Local<v8::Value> d1_key = Nan::New("d1").ToLocalChecked();

    Elliptic *elliptic = Nan::ObjectWrap::Unwrap<Elliptic>(info.This());
    v8::Local<v8::Object> proof = Nan::To<v8::Object>(info[0]).ToLocalChecked();
    v8::Local<v8::Object> zObj = Nan::To<v8::Object>(info[1]).ToLocalChecked();
    POINT *z = Nan::ObjectWrap::Unwrap<POINT>(zObj);

    char *e0 = *( Nan::Utf8String( Nan::Get(proof, e0_key).ToLocalChecked() ) );
    char *e1 = *( Nan::Utf8String( Nan::Get(proof, e1_key).ToLocalChecked() ) );
    char *f0 = *( Nan::Utf8String( Nan::Get(proof, f0_key).ToLocalChecked() ) );
    char *f1 = *( Nan::Utf8String( Nan::Get(proof, f1_key).ToLocalChecked() ) );
    char *d0 = *( Nan::Utf8String( Nan::Get(proof, d0_key).ToLocalChecked() ) );
    char *d1 = *( Nan::Utf8String( Nan::Get(proof, d1_key).ToLocalChecked() ) );

    /* decode base64 string to binary */
    unsigned char *e0_bin, *e1_bin, *f0_bin, *f1_bin, *d0_bin, *d1_bin, *z_bin;
    size_t e0_len, e1_len, f0_len, f1_len, d0_len, d1_len, z_len;
    Base64Decode(e0, &e0_bin, &e0_len) ;
    Base64Decode(e1, &e1_bin, &e1_len) ;
    Base64Decode(f0, &f0_bin, &f0_len) ;
    Base64Decode(f1, &f1_bin, &f1_len) ;
    Base64Decode(d0, &d0_bin, &d0_len) ;
    Base64Decode(d1, &d1_bin, &d1_len) ;
    z_len = z->toOct(&z_bin);

    /* compute e which hash(z, d0, d1) */
    EVP_MD_CTX *mdctx = EVP_MD_CTX_create();
    EVP_DigestInit_ex(mdctx, EVP_sha256(), NULL);
    EVP_DigestUpdate(mdctx, z_bin, z_len);
    EVP_DigestUpdate(mdctx, d0_bin, d0_len);
    EVP_DigestUpdate(mdctx, d1_bin, d1_len);
    unsigned char *e_bin = (unsigned char *) OPENSSL_malloc( (size_t) EVP_MD_size(EVP_sha256()) );
    unsigned int e_len;
    EVP_DigestFinal_ex(mdctx, e_bin, &e_len);
    EVP_MD_CTX_destroy(mdctx);

    BN_CTX *ctx = elliptic->getCtx();
    BN_CTX_start(ctx);
    BIGNUM *e0_bn = BN_CTX_get(ctx);
    BIGNUM *e1_bn = BN_CTX_get(ctx);
    BIGNUM *f0_bn = BN_CTX_get(ctx);
    BIGNUM *f1_bn = BN_CTX_get(ctx);

    /* convert binary string to big number and ec point */
    BN_bin2bn(e0_bin, (int) e0_len, e0_bn);
    BN_bin2bn(e1_bin, (int) e1_len, e1_bn);
    BN_bin2bn(f0_bin, (int) f0_len, f0_bn);
    BN_bin2bn(f1_bin, (int) f1_len, f1_bn);

    const EC_GROUP *G = elliptic->getGroup();

    EC_POINT *d0_point = EC_POINT_new(G);
    EC_POINT *d1_point = EC_POINT_new(G);

    EC_POINT_oct2point(G, d0_point, d0_bin, d0_len, ctx);
    EC_POINT_oct2point(G, d1_point, d1_bin, d1_len, ctx);

    BIGNUM *e_bn = BN_CTX_get(ctx);
    BN_bin2bn(e_bin, (int) e_len, e_bn);

    /* verify result */
    int ret = elliptic->verify_proof_01(
            d0_point, d1_point, e0_bn, e1_bn, f0_bn, f1_bn, z->getPoint(), e_bn);

    BN_CTX_end(ctx);

    /* free memory */
    free(e0_bin);
    free(e1_bin);
    free(f0_bin);
    free(f1_bin);
    free(d0_bin);
    free(d1_bin);
    free(e_bin);
    free(z_bin);
    EC_POINT_free(d0_point);
    EC_POINT_free(d1_point);

    info.GetReturnValue().Set(ret == 0 ? Nan::True() : Nan::False());
}

NAN_METHOD(Elliptic::createPoint) {
    v8::Local<v8::Function> cons = Nan::New(POINT::constructor());
    v8::Local<v8::Value> argv[2];
    int argc;
    if(info.Length() >= 1) {
        argv[0] = info.This();
        argv[1] = info[0];
        argc = 2 ;
    } else {
        argv[0] = info.This();
        argc = 1;
    }

    info.GetReturnValue().Set(Nan::NewInstance(cons, argc, argv).ToLocalChecked());
}

NAN_METHOD(Elliptic::getOrder) {
    Elliptic *elliptic = Nan::ObjectWrap::Unwrap<Elliptic>(info.This());
    v8::Local<v8::Function> cons = Nan::New(BN::constructor());
    v8::Local<v8::Object> BNobj = Nan::NewInstance(cons, 0, NULL).ToLocalChecked();
    BN *a = Nan::ObjectWrap::Unwrap<BN>(BNobj);
    BN_copy(a->getNum(), elliptic->getOrder());
    info.GetReturnValue().Set(BNobj);
}