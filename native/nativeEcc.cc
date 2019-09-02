#include <nan.h>
#include "Elliptic.h"

NAN_MODULE_INIT(Init) {
    POINT::Init(target);
    Elliptic::Init(target);
    BN::Init(target);

    v8::Local<v8::Object> curve = Nan::New<v8::Object>();
    Nan::Set(curve, Nan::New("secp256r1").ToLocalChecked(),
             Nan::New(NID_X9_62_prime256v1));
    Nan::Set(curve, Nan::New("prime256v1").ToLocalChecked(),
             Nan::New(NID_X9_62_prime256v1));
    Nan::Set(curve, Nan::New("secp256k1").ToLocalChecked(),
             Nan::New(NID_secp256k1));
    Nan::Set(curve, Nan::New("secp384r1").ToLocalChecked(),
             Nan::New(NID_secp384r1));
    Nan::Set(curve, Nan::New("secp521r1").ToLocalChecked(),
             Nan::New(NID_secp521r1));

    Nan::Set(target, Nan::New("curve").ToLocalChecked(),
             curve);
}

NODE_MODULE(nativeEc, Init)