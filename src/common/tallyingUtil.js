const { BN } = require("./../common/nativeEcc");
module.exports = {
    initElectionPos: function initElectionPos(election) {
        let rawPos = election.pos;
        let posCandMapping = election.posCandMapping;

        let posObj = {};
        let pos = [];
        for(let i = 0, il = rawPos.length; i < il; i++) {
            posObj[rawPos[i].pid] = [];
        }

        let curMap;
        for(let i = 0, il = posCandMapping.length; i < il; i++) {
            curMap = posCandMapping[i];
            posObj[curMap.pid].push({
                cid: curMap.cid,
                x: new BN(),
                y: new BN()
            });
        }

        for(let key in posObj) {
            pos.push({
                pid: parseInt(key),
                values: posObj[key]
            })
        }

        return pos;
    }
};