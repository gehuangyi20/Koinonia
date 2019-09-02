const crypto = require('crypto');

class Cipher {
    constructor(password, conf) {
        this.ivLen = 16;
        this.alg = `aes-${conf.keylen}-cbc`;
        this.key = crypto.pbkdf2Sync(password, conf.salt, conf.iterations, conf.keylen/8, conf.digest);
    }

    encrypt(plaintext) {
        let iv = crypto.randomBytes(this.ivLen);
        let encipher = crypto.createCipheriv(this.alg, this.key, iv);
        return Buffer.concat([iv, encipher.update(plaintext, 'utf8'), encipher.final()]);
    }

    decrypt(ciphertext) {
        let iv = ciphertext.slice(0, 16);
        let data = ciphertext.slice(16);
        let decipher = crypto.createDecipheriv(this.alg, this.key, iv);
        return decipher.update(data, 'binary', 'utf8') + decipher.final('utf8');
    }
}

module.exports = Cipher;