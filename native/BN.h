#ifndef NATIVEECC_BN_H
#define NATIVEECC_BN_H


#include <nan.h>
#include <openssl/bn.h>

class BN : public Nan::ObjectWrap {
public:
    static NAN_MODULE_INIT(Init);
    static inline Nan::Persistent<v8::Function> &constructor() {
        static Nan::Persistent<v8::Function> my_constructor;
        return my_constructor;
    }
    explicit BN();
    explicit BN(const char *data);
    inline BIGNUM *getNum() const { return num; }
    /* a+=b */
    void addM(const BN *b) const;
    void addMBIGNUM(const BIGNUM *b) const;
    void addMInt(const unsigned long b) const;
    /* a-=b */
    void subM(const BN *b) const;
    void subMBIGNUM(const BIGNUM *b) const;
    void subMInt(const unsigned long b) const;
    /* rem = a%/m */
    void mod(BN *rem, const BN *m) const;
    /* rem = (a-b)%/m */
    void modSub(BN *rem, const BN *b, const BN *m) const;
    /* a %= m*/
    void modM(const BN *m) const;
    /* a = (a-b)%m */
    void modSubM(const BN *b, const BN *m) const;
    int toBin(unsigned char **pbuf) const;

private:
    ~BN();
    static NAN_METHOD(New);
    static NAN_METHOD(addM);
    static NAN_METHOD(addMBase64);
    static NAN_METHOD(addMInt);
    static NAN_METHOD(subM);
    static NAN_METHOD(subMBase64);
    static NAN_METHOD(subMInt);
    static NAN_METHOD(mod);
    static NAN_METHOD(modSub);
    static NAN_METHOD(modM);
    static NAN_METHOD(modSubM);
    static NAN_METHOD(toBase64);
    static NAN_METHOD(RAND_BIGNUM);
    BIGNUM *num;
};


#endif //NATIVEECC_BN_H
