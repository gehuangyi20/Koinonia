const readlineSync = require('../src/common/readlineSync');
const path = require('path');

const filename = process.argv[2];
let file;
try {
    let pathname = path.isAbsolute(filename) ? filename : path.join(__dirname, filename);
    file = new readlineSync(pathname);
} catch (e) {
    console.log(`cannot open file ${filename}`);
    return;
}
let line;

while((line = file.getline()) !== null) {
    console.log(line);
}

file.close();