/* generte pbkdf2 setting file */
const crypto = require('crypto');
const argv = require('minimist')(process.argv.slice(2));

let iterations = 100000;
let keylen = 256;
let digest = 'sha256';
let salt = null;

for(let key in argv) {
    switch (key) {
        case 'i':
        case 'iterations':
            let itr = parseInt(argv[key]);
            if(!Number.isInteger(itr) || itr < 1000) {
                console.log('Insecure iteration, iteration must be at least 1000');
                return;
            }
            iterations = itr;
            break;
        case 'k':
        case 'keyLen':
            let len = parseInt(argv[key]);
            if(len !== 128 || len !== 192 || len !== 256) {
                console.log('Key length should be 128, 192, or 256');
                return;
            }
            keylen = len;
            break;
        case 'd':
        case 'digest':
            digest = argv[key];
            break;
        case 's':
        case 'salt':
            salt = argv[key];
            break;
    }
}

if(salt === null) {
    salt = crypto.randomBytes(keylen / 8).toString('base64');
}

console.log(JSON.stringify({
    iterations: iterations,
    keylen: keylen,
    digest: digest,
    salt: salt
}));

