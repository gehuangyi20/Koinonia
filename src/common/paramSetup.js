const crypto = require('crypto');
const { Elliptic, BN, curve } = require('./nativeEcc');
const argv = require('minimist')(process.argv.slice(2));

let common_str = 'Koinonia';
let curveName = "prime256v1";
let digestAlg = 'sha256';
let bit = 1;

let ec, hash;

for(let key in argv) {
    switch (key) {
        case 'n':
        case 'name':
            curveName = argv[key];
            break;
        case 'd':
        case 'digest':
            digestAlg = argv[key];
            break;
        case 's':
        case 'str':
            common_str = argv[key];
            break;
        case 'b':
        case 'bit':
            if(argv[key] !== '0' && argv[key] !== '1') {
                console.log('bit should be either 0 or 1');
                return;
            }
            bit = parseInt(argv[key]);
    }
}

try {
    ec = new Elliptic(curve[curveName]);
} catch (e) {
    console.log(`curve name '${curveName}' is not valid`);
    return;
}

try {
    hash = crypto.createHash(digestAlg);
} catch (e) {
    console.log(`Digest method '${digestAlg}' is not supported`);
    return;
}

if(typeof common_str !== 'string' || common_str === '') {
    console.log(`Common string cannot be empty.`);
    return;
}

hash.update(common_str);
const digest_val = hash.digest('base64');
const num = new BN(digest_val);
const point = ec.createPoint();

while( !point.setCompressedCoordinates(num, bit) ) {
    num.addMInt(1);
}

console.log(`\
/* generate by command line
 * ${process.argv[0]} ${process.argv[1]} -n ${curveName} -d ${digestAlg} -s '${common_str}' -b ${bit}
 *
 * # parameters
 * - curve: ${curveName}, 
 * - digest: ${digestAlg}, 
 * - common_str: '${common_str}' 
 * - bit: ${bit} */`);
console.log(`module.exports = ${JSON.stringify({
    name: curveName,
    digest: digestAlg,
    str: common_str,
    bit: bit,
    h: point.toBase64()
})};`);
