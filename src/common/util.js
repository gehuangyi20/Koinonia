const crypto = require("crypto");
const Cipher = require("./Cipher");
const fs = require('fs');

function validPort(port) {
    let tunnelPort = parseInt(port, 10);
    return tunnelPort > 0 && tunnelPort < 65536;
}

function validHttpProtocol(protocol) {
    return protocol === 'http:' || protocol === 'https:';
}

function urlToOrigin(data) {
    return data.protocol + "//" + data.hostname +
    (data.port != null ? ':' + data.port : '')
}

function initAESCipher(password, pwConfFile) {
    try {
        let data = fs.readFileSync(pwConfFile, 'utf8');
        let pwconf = JSON.parse(data);
        return new Cipher(password, pwconf);
    } catch (e) {
        console.log(`cannot read/parse password config file: ${pwConfFile}`);
        return false;
    }
}

function generateToken() {
    return crypto.randomBytes(16).toString("base64");
}

function pkovSignToken(pki, token) {
    let str = token || "";
    if(typeof str !== "string") {
        str = "";
    }
    let salt = crypto.randomBytes(32).toString("base64");
    const hash = crypto.createHash('sha256');
    hash.update(`PKOV${str}${salt}`);
    const digest = hash.digest();
    
    return {
        token: str,
        salt: salt,
        sign: pki.sign(digest),
        pubKey: pki.getPub()
    }
}

function initAppVerifyPubKey(app, pki){
    app.post('/verifyPubKey', function(req, res) {
        res.send(pkovSignToken(pki, req.body.token));
    });

    app.get('/verifyPubKey', function(req, res) {
        res.send(pkovSignToken(pki, req.query.token));
    });
}

function pkovVerifyPubKey(pki, sentToken, resData) {
    let sign = resData.sign;
    let token = resData.token;
    let salt = resData.salt;
    let pubKey = resData.pubKey;

    if(typeof token !== "string" || sentToken !== token) return false;
    if(typeof salt !== "string") return false;
    if(typeof sign !== "string") return false;
    if(typeof pubKey !== "string") return false;

    const hash = crypto.createHash('sha256');
    hash.update(`PKOV${token}${salt}`);
    const digest = hash.digest();

    return pki.verify(digest, sign, pubKey);
}

function getElectionInfo(data) {
    let res = {};
    res.id = data.id;
    res.name = data.name;
    res.state = data.state;
    res.tunnel_port = data.tunnel_port;
    res.create_time = data.create_time;
    res.freeze_time = data.freeze_time;
    res.freeze_sign = data.freeze_sign;

    /* candidate information */
    let cands = [];
    let dataCands = data.cand;
    for(let i=0, il=dataCands.length; i<il; i++) {
        let cand  = {};
        let curCand = dataCands[i];
        cand.eid = curCand.eid;
        cand.cid = curCand.cid;
        cand.name = curCand.name;
        cand.create_time = curCand.create_time;
        cand.update_time = curCand.update_time;
        cands[i] = cand;
    }
    res.cand = cands;

    /* position information */
    let poss = [];
    let dataPoss = data.pos;
    for(let i=0, il=dataPoss.length; i<il; i++) {
        let pos  = {};
        let curPos = dataPoss[i];
        pos.eid = curPos.eid;
        pos.pid = curPos.pid;
        pos.name = curPos.name;
        pos.create_time = curPos.create_time;
        pos.update_time = curPos.update_time;
        poss[i] = pos;
    }
    res.pos = poss;

    /* position candidate mapping */
    let posCandMapping = [];
    let dataPosCandMapping = data.posCandMapping;
    for(let i=0, il=dataPosCandMapping.length; i<il; i++) {
        let mapping  = {};
        let curMapping = dataPosCandMapping[i];
        mapping.eid = curMapping.eid;
        mapping.pid = curMapping.pid;
        mapping.cid = curMapping.cid;
        posCandMapping[i] = mapping;
    }
    res.posCandMapping = posCandMapping;

    return res;
}

function getElectionInfoStr(data, state) {
    let res = "";
    res += data.id;
    res += data.name;
    res += (state==null) ? data.state : state;
    res += data.tunnel_port;
    res += data.create_time;
    res += data.freeze_time;

    /* candidate information */
    let dataCands = data.cand;
    for(let i=0, il=dataCands.length; i<il; i++) {
        let curCand = dataCands[i];
        res += curCand.eid;
        res += curCand.cid;
        res += curCand.name;
        res += curCand.create_time;
        res += curCand.update_time;
    }

    /* position information */
    let dataPoss = data.pos;
    for(let i=0, il=dataPoss.length; i<il; i++) {
        let curPos = dataPoss[i];
        res += curPos.eid;
        res += curPos.pid;
        res += curPos.name;
        res += curPos.create_time;
        res += curPos.update_time;
    }

    /* position candidate mapping */
    let dataPosCandMapping = data.posCandMapping;
    for(let i=0, il=dataPosCandMapping.length; i<il; i++) {
        let curMapping = dataPosCandMapping[i];
        res += curMapping.eid;
        res += curMapping.pid;
        res += curMapping.cid;
    }

    return res;
}

// @TODO: enhance port format checking
function validateElectionInfoFormat(data) {
    if(data === null || typeof data !== "object") return false;
    if(!Number.isInteger(data.id)) return false;
    if(typeof data.name !== "string") return false;
    if(!Number.isInteger(data.state)) return false;
    if(typeof data.tunnel_port !== "number") return false;
    if(!Number.isFinite(data.create_time)) return false;
    if(!Number.isFinite(data.freeze_time)) return false;
    if(data.create_time >= data.freeze_time) return false;
    if(typeof data.freeze_sign !== "string") return false;

    /* candidate information */
    let dataCands = data.cand;
    if(!Array.isArray(dataCands)) return false;
    for(let i=0, il=dataCands.length; i<il; i++) {
        let curCand = dataCands[i];
        if(curCand.eid !== data.id) return false;
        if(!Number.isInteger(curCand.cid)) return false;
        if(typeof curCand.name !== "string") return false;
        if(!Number.isFinite(curCand.create_time)) return false;
        if(!Number.isFinite(curCand.update_time)) return false;
        if(curCand.create_time > curCand.update_time) return false;
        if(curCand.update_time >= data.freeze_time) return false;
    }

    /* position information */
    let dataPoss = data.pos;
    if(!Array.isArray(dataPoss)) return false;
    for(let i=0, il=dataPoss.length; i<il; i++) {
        let curPos = dataPoss[i];
        if(curPos.eid !== data.id) return false;
        if(!Number.isInteger(curPos.pid)) return false;
        if(typeof curPos.name !== "string") return false;
        if(!Number.isFinite(curPos.create_time)) return false;
        if(!Number.isFinite(curPos.update_time)) return false;
        if(curPos.create_time > curPos.update_time) return false;
        if(curPos.update_time >= data.freeze_time) return false;
    }

    /* position candidate mapping */
    let dataPosCandMapping = data.posCandMapping;
    if(!Array.isArray(dataPosCandMapping)) return false;
    for(let i=0, il=dataPosCandMapping.length; i<il; i++) {
        let curMapping = dataPosCandMapping[i];
        if(curMapping.eid !== data.id) return false;
        if(!Number.isInteger(curMapping.pid)) return false;
        if(!Number.isInteger(curMapping.cid)) return false;
    }

    return true;
}

function getElectionOpenInfo(data) {
    let res = getElectionInfo(data);
    res.voter_count = data.voter_count;
    res.voter_sign = data.voter_sign;
    res.teller_sign = data.teller_sign;
    res.open_time = data.open_time;
    res.open_sign = data.open_sign;
    return res;
}

function getElectionOpenInfoStr(data) {
    let res = getElectionInfoStr(data, 2);
    res += data.voter_count;
    res += data.voter_sign;
    res += data.teller_sign;
    res += data.open_time;
    return res;
}

function validateElectionOpenInfoFormat(data) {
    if(!validateElectionInfoFormat(data)) return false;
    if(!Number.isInteger(data.voter_count) || data.voter_count < 0) return false;
    if(typeof data.voter_sign !== "string") return false;
    if(typeof data.teller_sign !== "string") return false;
    if(!Number.isFinite(data.open_time)) return false;
    if(data.open_time <= data.freeze_time) return false;
    return typeof data.open_sign === "string";
}

function getElectionCloseInfo(data) {
    let res = getElectionOpenInfo(data);
    res.close_time = data.close_time;
    res.close_sign = data.close_sign;
    return res;
}

function getElectionCloseInfoStr(data) {
    let res = getElectionInfoStr(data, 3);
    res += data.voter_count;
    res += data.voter_sign;
    res += data.teller_sign;
    res += data.open_time;
    res += data.close_time;
    return res;
}

function validateElectionCloseInfoFormat(data) {
    if(!validateElectionOpenInfoFormat(data)) return false;
    if(!Number.isFinite(data.close_time)) return false;
    if(data.close_time <= data.open_time) return false;
    return typeof data.close_sign === "string";
}

function getTellerInfo(data) {
    let res = [];
    for(let i=0, il=data.length; i<il; i++) {
        let teller  = {};
        let curTeller = data[i];
        teller.eid = curTeller.eid;
        teller.protocol = curTeller.protocol;
        teller.hostname = curTeller.hostname;
        teller.port = curTeller.port;
        teller.tunnel_port = curTeller.tunnel_port;
        teller.reg_time = curTeller.reg_time;
        teller.pub_key = curTeller.pub_key;
        res[i] = teller;
    }
    return res;
}

function getTellerInfoStr(data) {
    let res = "";
    for(let i=0, il=data.length; i<il; i++) {
        let curTeller = data[i];
        res += curTeller.eid;
        res += curTeller.protocol;
        res += curTeller.hostname;
        res += (curTeller.port === null) ? "" : curTeller.port;
        res += curTeller.tunnel_port;
        res += curTeller.reg_time;
        res += curTeller.pub_key;
    }
    return res;
}

function validateTellerInfoFormat(data) {
    if(!Array.isArray(data)) return false;
    for(let i=0, il=data.length; i<il; i++) {
        let curTeller = data[i];
        if(!Number.isInteger(curTeller.eid)) return false;
        if(typeof curTeller.protocol !== "string") return false;
        if(typeof curTeller.hostname !== "string") return false;
        if(typeof curTeller.port !== "number" && curTeller.port !== null) return false;
        if(typeof curTeller.tunnel_port !== "number") return false;
        if(!Number.isFinite(curTeller.reg_time)) return false;
        if(typeof curTeller.pub_key !== "string") return false;
    }
    return true;
}

function verifyVoteLink(vote, pki, pubKey) {
    /* validate vote parameter format */
    if(!(
            typeof vote.email === "string" &&
            typeof vote.rid === "string" &&
            Number.isFinite(vote.reg_time) &&
            Number.isFinite(vote.link_time) &&
            vote.reg_time < vote.link_time &&
            typeof vote.link_sign === "string"
        )) {
        return false;
    }

    /* check signature */
    let paramStr = `${vote.eid}${vote.email}${vote.rid}${vote.reg_time}${vote.link_time}`;
    if(!pki.verify(paramStr, vote.link_sign, pubKey)) {
        return false;
    }

    return paramStr;
}

function buildElectionPos(election) {
    let rawPos = election.pos;
    let posCandMapping = election.posCandMapping;

    let posObj = {};
    let pos = [];
    for(let i = 0, il = rawPos.length; i < il; i++) {
        posObj[rawPos[i].pid] = [];
    }

    for(let i = 0, il = posCandMapping.length; i < il; i++) {
        let curMap = posCandMapping[i];
        posObj[curMap.pid].push(curMap.cid);
    }

    /* stored information are sorted by pid, cid ASC.
     * At this point the pid in pos are sorted in ASC.
     * Also, each cand Array in pos is sorted in ASC. */
    for(let key in posObj) {
        pos.push({
            pid: parseInt(key, 10),
            cand: posObj[key]
        });
    }

    return pos
}

module.exports = {
    validPort: validPort,
    validHttpProtocol: validHttpProtocol,
    urlToOrigin: urlToOrigin,
    initAESCipher: initAESCipher,
    generateToken: generateToken,
    initAppVerifyPubKey: initAppVerifyPubKey,
    pkovSignToken: pkovSignToken,
    pkovVerifyPubKey: pkovVerifyPubKey,
    getElectionInfo: getElectionInfo,
    getElectionInfoStr: getElectionInfoStr,
    validateElectionInfoFormat: validateElectionInfoFormat,
    getElectionOpenInfo: getElectionOpenInfo,
    getElectionOpenInfoStr: getElectionOpenInfoStr,
    validateElectionOpenInfoFormat: validateElectionOpenInfoFormat,
    getElectionCloseInfo: getElectionCloseInfo,
    getElectionCloseInfoStr: getElectionCloseInfoStr,
    validateElectionCloseInfoFormat: validateElectionCloseInfoFormat,
    getTellerInfo: getTellerInfo,
    getTellerInfoStr: getTellerInfoStr,
    validateTellerInfoFormat: validateTellerInfoFormat,
    verifyVoteLink: verifyVoteLink,
    buildElectionPos: buildElectionPos
};