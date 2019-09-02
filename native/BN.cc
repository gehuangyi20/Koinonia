#include "BN.h"
#include "base64.h"
#include "util.h"

NAN_MODULE_INIT(BN::Init) {
    v8::Local<v8::FunctionTemplate> tpl = Nan::New < v8::FunctionTemplate > (New);
    tpl->SetClassName(Nan::New("POINT").ToLocalChecked());
    tpl->InstanceTemplate()->SetInternalFieldCount(1);

    Nan::SetPrototypeMethod(tpl, "addM", addM);
    Nan::SetPrototypeMethod(tpl, "addMBase64", addMBase64);
    Nan::SetPrototypeMethod(tpl, "addMInt", addMInt);
    Nan::SetPrototypeMethod(tpl, "subM", subM);
    Nan::SetPrototypeMethod(tpl, "subMBase64", subMBase64);
    Nan::SetPrototypeMethod(tpl, "subMInt", subMInt);
    Nan::SetPrototypeMethod(tpl, "mod", mod);
    Nan::SetPrototypeMethod(tpl, "modSub", modSub);
    Nan::SetPrototypeMethod(tpl, "modM", modM);
    Nan::SetPrototypeMethod(tpl, "modSubM", modSubM);
    Nan::SetPrototypeMethod(tpl, "toBase64", toBase64);
    Nan::SetMethod(tpl, "rand", RAND_BIGNUM);

    constructor().Reset(Nan::GetFunction(tpl).ToLocalChecked());

    Nan::Set(target, Nan::New("BN").ToLocalChecked(),
             Nan::GetFunction(tpl).ToLocalChecked());
}

BN::BN() {
    this->num = BN_new();
}

BN::BN(const char *data) : BN{} {
    unsigned char *data_bin;
    size_t data_len;
    /* decode base64 point to char* */
    Base64Decode(data, &data_bin, &data_len);
    BN_bin2bn(data_bin, (int) data_len, this->num);
    /* free memory */
    free(data_bin);
}

BN::~BN() {
    BN_clear_free(this->num);
}

void BN::addM(const BN *b) const {
    this->addMBIGNUM(b->getNum());
}

void BN::addMBIGNUM(const BIGNUM *b) const {
    BN_add(this->num, this->num, b);
}

void BN::addMInt(const unsigned long b) const {
    BN_add_word(this->num, b);
}

void BN::subM(const BN *b) const {
    this->subMBIGNUM(b->getNum());
}

void BN::subMBIGNUM(const BIGNUM *b) const {
    BN_sub(this->num, this->num, b);
}

void BN::subMInt(const unsigned long b) const {
    BN_sub_word(this->num, b);
}

void BN::mod(BN *rem, const BN *m) const {
    BN_CTX *ctx = BN_CTX_new();
    BN_CTX_start(ctx);
    BN_mod(rem->getNum(), num, m->getNum(), ctx);
    BN_CTX_end(ctx);
    BN_CTX_free(ctx);
}

void BN::modSub(BN *rem, const BN *b, const BN *m) const {
    BN_CTX *ctx = BN_CTX_new();
    BN_CTX_start(ctx);
    BN_mod_sub(rem->getNum(), num, b->getNum(), m->getNum(), ctx);
    BN_CTX_end(ctx);
    BN_CTX_free(ctx);
}

void BN::modM(const BN *m) const {
    BN_CTX *ctx = BN_CTX_new();
    BN_CTX_start(ctx);
    BN_mod(num, num, m->getNum(), ctx);
    BN_CTX_end(ctx);
    BN_CTX_free(ctx);
}

void BN::modSubM(const BN *b, const BN *m) const {
    BN_CTX *ctx = BN_CTX_new();
    BN_CTX_start(ctx);
    BN_mod_sub(num, num, b->getNum(), m->getNum(), ctx);
    BN_CTX_end(ctx);
    BN_CTX_free(ctx);
}

int BN::toBin(unsigned char **pbuf) const {
    return BN_bn2bytes(num, pbuf);
}

NAN_METHOD(BN::New) {
    if (!info.IsConstructCall()) {
        // generic recursive call with `new`
        int il = info.Length();
        v8::Local<v8::Value> *args = new v8::Local<v8::Value>[il];
        for (int i = 0; i < il; ++i) args[i] = info[i];
        //Nan::MaybeLocal<v8::Object> inst = Nan::NewInstance(info.Callee(), il, args);
        v8::Local<v8::Function> cons = Nan::New(BN::constructor());
        Nan::MaybeLocal<v8::Object> inst = Nan::NewInstance(cons, il, args);
        delete args;
        if (!inst.IsEmpty()) info.GetReturnValue().Set(inst.ToLocalChecked());
        return;
    }

    BN *obj;

    if(info.Length() == 1) {
        obj = new BN( *( Nan::Utf8String(info[0]) ));
    } else {
        obj = new BN();
    }

    obj->Wrap(info.This());
    info.GetReturnValue().Set(info.This());
}

NAN_METHOD(BN::addM) {
    Nan::MaybeLocal<v8::Object> maybeB = Nan::To<v8::Object>(info[0]);
    BN *a = Nan::ObjectWrap::Unwrap<BN>(info.This());
    BN *b = Nan::ObjectWrap::Unwrap<BN>(maybeB.ToLocalChecked());
    a->addM(b);
    info.GetReturnValue().Set(info.This());
}

NAN_METHOD(BN::addMBase64) {
    BN *a = Nan::ObjectWrap::Unwrap<BN>(info.This());
    char *b_cstr = *( Nan::Utf8String(info[0]) );
    unsigned char *b_bin;
    size_t b_len;

    Base64Decode(b_cstr, &b_bin, &b_len);

    BIGNUM *b = BN_new();
    BN_bin2bn(b_bin, (int) b_len, b);
    a->addMBIGNUM(b);

    free(b_bin);
    BN_clear_free(b);
    info.GetReturnValue().Set(info.This());
}

NAN_METHOD(BN::addMInt) {
    BN *a = Nan::ObjectWrap::Unwrap<BN>(info.This());
    Nan::Maybe<uint32_t> maybeInt = Nan::To<uint32_t>(info[0]);
    uint32_t num = maybeInt.ToChecked();
    a->addMInt(num);
    info.GetReturnValue().Set(info.This());
}

NAN_METHOD(BN::subM) {
    Nan::MaybeLocal<v8::Object> maybeB = Nan::To<v8::Object>(info[0]);
    BN *a = Nan::ObjectWrap::Unwrap<BN>(info.This());
    BN *b = Nan::ObjectWrap::Unwrap<BN>(maybeB.ToLocalChecked());
    a->subM(b);
    info.GetReturnValue().Set(info.This());
}

NAN_METHOD(BN::subMBase64) {
    BN *a = Nan::ObjectWrap::Unwrap<BN>(info.This());
    char *b_cstr = *( Nan::Utf8String(info[0]) );
    unsigned char *b_bin;
    size_t b_len;

    Base64Decode(b_cstr, &b_bin, &b_len);

    BIGNUM *b = BN_new();
    BN_bin2bn(b_bin, (int) b_len, b);
    a->subMBIGNUM(b);

    free(b_bin);
    BN_clear_free(b);
    info.GetReturnValue().Set(info.This());
}

NAN_METHOD(BN::subMInt) {
    BN *a = Nan::ObjectWrap::Unwrap<BN>(info.This());
    Nan::Maybe<uint32_t> maybeInt = Nan::To<uint32_t>(info[0]);
    uint32_t num = maybeInt.ToChecked();
    a->subMInt(num);
    info.GetReturnValue().Set(info.This());
}

NAN_METHOD(BN::mod) {
    Nan::MaybeLocal<v8::Object> maybeM = Nan::To<v8::Object>(info[0]);
    BN *a = Nan::ObjectWrap::Unwrap<BN>(info.This());
    BN *m = Nan::ObjectWrap::Unwrap<BN>(maybeM.ToLocalChecked());
    v8::Local<v8::Function> cons = Nan::New(BN::constructor());
    v8::Local<v8::Object> remV8 = Nan::NewInstance(cons, 0, NULL).ToLocalChecked();
    BN *rem = Nan::ObjectWrap::Unwrap<BN>(remV8);
    a->mod(rem, m);
    info.GetReturnValue().Set(remV8);
}

NAN_METHOD(BN::modSub) {
    Nan::MaybeLocal<v8::Object> maybeB = Nan::To<v8::Object>(info[0]);
    Nan::MaybeLocal<v8::Object> maybeM = Nan::To<v8::Object>(info[1]);
    BN *a = Nan::ObjectWrap::Unwrap<BN>(info.This());
    BN *b = Nan::ObjectWrap::Unwrap<BN>(maybeB.ToLocalChecked());
    BN *m = Nan::ObjectWrap::Unwrap<BN>(maybeM.ToLocalChecked());
    v8::Local<v8::Function> cons = Nan::New(BN::constructor());
    v8::Local<v8::Object> remV8 = Nan::NewInstance(cons, 0, NULL).ToLocalChecked();
    BN *rem = Nan::ObjectWrap::Unwrap<BN>(remV8);
    a->modSub(rem, b, m);
    info.GetReturnValue().Set(remV8);
}

NAN_METHOD(BN::modM) {
    Nan::MaybeLocal<v8::Object> maybeM = Nan::To<v8::Object>(info[0]);
    BN *a = Nan::ObjectWrap::Unwrap<BN>(info.This());
    BN *m = Nan::ObjectWrap::Unwrap<BN>(maybeM.ToLocalChecked());
    a->modM(m);
    info.GetReturnValue().Set(info.This());
}

NAN_METHOD(BN::modSubM) {
    Nan::MaybeLocal<v8::Object> maybeB = Nan::To<v8::Object>(info[0]);
    Nan::MaybeLocal<v8::Object> maybeM = Nan::To<v8::Object>(info[1]);
    BN *a = Nan::ObjectWrap::Unwrap<BN>(info.This());
    BN *b = Nan::ObjectWrap::Unwrap<BN>(maybeB.ToLocalChecked());
    BN *m = Nan::ObjectWrap::Unwrap<BN>(maybeM.ToLocalChecked());
    a->modSubM(b, m);
    info.GetReturnValue().Set(info.This());
}

NAN_METHOD(BN::toBase64) {
    BN *a = Nan::ObjectWrap::Unwrap<BN>(info.This());
    unsigned char *buf;
    char *retBuf;
    int len = a->toBin(&buf);
    int ret;
    if(len == -1) {
        info.GetReturnValue().Set(Nan::Null());
        goto BASE64ERR;
    }

    ret = Base64Encode((const unsigned char* )buf, len, &retBuf);
    if(ret == -1) {
        info.GetReturnValue().Set(Nan::Null());
        goto BASE64ERR;
    }

    info.GetReturnValue().Set(Nan::New(retBuf).ToLocalChecked());
    free(retBuf);
BASE64ERR:
    free(buf);

}

NAN_METHOD(BN::RAND_BIGNUM) {
    Nan::MaybeLocal<v8::Object> maybeRange = Nan::To<v8::Object>(info[0]);
    BN *range = Nan::ObjectWrap::Unwrap<BN>(maybeRange.ToLocalChecked());
    v8::Local<v8::Function> cons = Nan::New(BN::constructor());
    v8::Local<v8::Object> rndV8 = Nan::NewInstance(cons, 0, NULL).ToLocalChecked();
    BN *rnd = Nan::ObjectWrap::Unwrap<BN>(rndV8);
    int ret = BN_rand_range(rnd->getNum(), range->getNum());
    if(ret) {
        info.GetReturnValue().Set(rndV8);
    } else {
        info.GetReturnValue().Set(Nan::Null());
    }
}
