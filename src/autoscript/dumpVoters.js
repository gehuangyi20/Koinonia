const dumpVoters = require('../auth/dumpVoters');
const fs = require('fs');
const eid = parseInt(process.argv[2]);
const filename = process.argv[3];
let fd;
try {
    fd = fs.openSync(filename, "w");
} catch (e) {
    console.log(`cannot open file ${filename}`);
    return;
}

dumpVoters(eid, {
    handleRow: function (row) {
        return `${row.identifier}\t${row.rid}\t${row.reg_time}\t${row.link_time}\t${row.link_sign}\n`;
    },
    flush: function (str) {
        fs.writeSync(fd, str);
    },
    end: function () {
        fs.closeSync(fd);
    }
});