const crypto = require('webcrypto');
const { execSync } = require('child_process');

class PKI {
    constructor(filename, password) {
        if(typeof filename !== 'string') return;
        /* read private key */
        let cmdPriv = `openssl pkey -in ${filename}`;
        let cmdPub = `openssl pkey -in ${filename} -pubout`;
        if(typeof password === 'string') {
            cmdPriv += ` -passin pass:${password}`;
            cmdPub += ` -passin pass:${password}`;
        }

        this.priv = execSync(cmdPriv, {encoding: 'utf8'});
        this.pub = execSync(cmdPub, {encoding: 'utf8'});
    }

    sign(str, alg='sha256', encoding='utf8', format='base64') {
        let signInst = crypto.createSign(alg);
        signInst.update(str, encoding);
        return signInst.sign(this.priv, format);
    }

    verify(str, signature, pub=this.pub, alg='sha256', encoding='utf8', format='base64') {
        let verifyInst = crypto.createVerify(alg);
        verifyInst.update(str, encoding);
        return verifyInst.verify(pub, signature, format);
    }

    getPub() {
        return this.pub;
    }

    setPub(pub) {
        this.pub = pub;
    }

    getPriv() {
        return this.priv;
    }

    setPriv(priv) {
        this.priv = priv;
    }

    createSignStream(priv=this.priv, alg='sha256') {
        return new PKISignStream(priv, alg)
    }

    createVerifyStream(pub=this.pub, alg='sha256') {
        return new PKIVerifyStream(pub, alg)
    }
}

class PKISignStream {
    constructor(priv, alg) {
        this.priv = priv;
        this.sign = crypto.createSign(alg);
    }

    update(data, encoding='utf8') {
        this.sign.update(data, encoding);
    }

    final(format='base64') {
        return this.sign.sign(this.priv, format);
    }
}

class PKIVerifyStream {
    constructor(pub, alg) {
        this.pub = pub;
        this.verify = crypto.createVerify(alg);
    }

    update(data, encoding='utf8') {
        this.verify.update(data, encoding);
    }

    final(signature, format='base64') {
        return this.verify.verify(this.pub, signature, format);
    }
}

module.exports = PKI;