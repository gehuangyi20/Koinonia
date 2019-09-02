const fs = require("fs");

class readlineSync {

    constructor(filename) {
        this.position = 0;
        this.fd = fs.openSync(filename, "r");
        let stat = fs.fstatSync(this.fd);
        this.size = stat.size;
        this.buffer = Buffer.allocUnsafe(65536);
        this.cacheStr = [];
        this.partialStr = "";
    }

    getline() {
        if(this.cacheStr.length > 0) {
            let ret = this.cacheStr.splice(0, 1);
            return ret[0];
        }

        if(this.position === this.size) {
            return null;
        }

        while(true) {
            let bytesRead = fs.readSync(
                this.fd, this.buffer, 0, this.buffer.length);

            if(bytesRead > 0) {
                this.position += bytesRead;
                let str = this.buffer.slice(0, bytesRead).toString();
                let strArray = str.split(/\r\n?|\n/);


                if(strArray.length > 1) {

                    strArray[0] = this.partialStr + strArray[0];
                    let i, il;
                    for(i=0, il=strArray.length-1; i<il; i++) {
                        this.cacheStr.push(strArray[i]);
                    }

                    this.partialStr = strArray[il];
                } else {
                    this.partialStr += strArray[0];
                }

                if(this.position === this.size) {
                    if(this.partialStr.length > 0) {
                        this.cacheStr.push(this.partialStr);
                        this.partialStr = "";
                    }
                    break;
                }

                if(this.cacheStr.length > 0) {
                    break;
                }
            }
        }

        let ret = this.cacheStr.splice(0, 1);
        return ret[0];
    }

    close() {
        fs.closeSync(this.fd);
    }
}

module.exports = readlineSync;