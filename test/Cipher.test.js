const Cipher = require("../src/common/Cipher");

let password = "123456";
let text = "helloahfduhauisdiadolfasodfoijasoidfash";
let ciphertext;
let plaintext;

let cipher = new Cipher(password,
    {
        "iterations": 100000,
        "keylen": 256,
        "digest": "sha256",
        "salt": "Zqsksu1ohkRvrTm2TrOYfxhSGrS6Ramv9LESH3cN9Zg="
    }
);

console.time(`time`);
for (let i = 0; i < 10000; i++) {
    ciphertext = cipher.encrypt(text);
    plaintext = cipher.decrypt(ciphertext);
}
console.timeEnd(`time`);
console.log(ciphertext.toString('hex'));
console.log(plaintext);