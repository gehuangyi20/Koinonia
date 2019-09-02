const readlineSync = require('../common/readlineSync');
const { Elliptic, BN, curve } = require('../common/nativeEcc');
const parameter = require('../common/parameter');
const util = require('../common/util');
const url = require('url');
const http = require('http');
const https = require('https');

const eid = parseInt(process.argv[2]);
const espUrlStr = process.argv[3];
const filename = process.argv[4];
const startTime = Date.now();

/* elliptic curve setup */
let ec;
try {
    ec = new Elliptic(curve[parameter.name], parameter.h);
} catch (e) {
    console.log(
        `cannot initialize with parameters, maybe caused by \
unsupported curve name or point h is not on the curve`);
    return;
}

const modulus = ec.getOrder();
let lineCount = 0;
let voteCount = 0;

let report = setInterval(function () {
    console.log(`${lineCount} processed, ${voteCount} voted, time ${(Date.now()-startTime)/1000}s.`);
}, 10000);

let espUrl;
try {
    espUrl = url.parse(espUrlStr);
    if (!util.validHttpProtocol(espUrl.protocol)) {
        throw "";
    }
} catch (e) {
    console.log('The url of Auth/ESP Server is not valid.');
    process.exit(1);
}

(async function () {
    let espElection = await getElectionData(eid, espUrl);
    let authUrl = {
        hostname: espElection.authHostname,
        protocol: espElection.authProtocol,
        port: espElection.authPort,
    };
    let authElection = await getElectionData(eid, authUrl);
    let posDataArray = initPosDataArray(authElection);
    let posData = JSON.stringify(posDataArray);
    console.log(posDataArray);

    let voterList;
    try {
        voterList = new readlineSync(filename);
    } catch (e) {
        throw `cannot open file ${filename}`;
    }

    let line;
    while((line = voterList.getline()) !== null) {
        let lineArr = line.split('\t');
        let query = {
            email: lineArr[0],
            rid: lineArr[1],
            reg_time: parseFloat(lineArr[2]),
            link_time: parseFloat(lineArr[3]),
            link_sign: lineArr[4],
        };
        lineCount ++;

        try {
            let result = await vote(query, authElection, JSON.parse(posData));
            voteCount ++;
            /*if(voteCount%10 == 0) {
                console.log(`${lineCount} processed, ${voteCount} voted.`);
            }*/
            if(!result) {
                console.log(`Cannot send receipt for line ${lineCount}`);
            }
        } catch(e) {
            console.log(e);
            console.log(`Cannot vote for line ${lineCount}`);
        }
    }

    clearInterval(report);
    console.log(`${lineCount} processed, ${voteCount} voted.`);
})()
    .catch(function(e) {
       console.log(e);
        clearInterval(report);
    });

function getElectionData(eid, serverUrl) {
    return new Promise(function (resolve, reject) {

        const options = {
            hostname: serverUrl.hostname,
            protocol: serverUrl.protocol,
            port: serverUrl.port,
            path: '/electionapi/' + eid + "/",
            method: 'GET'
        };

        let protocol = serverUrl.protocol === 'http:' ? http : https;
        let req = protocol.request(options, function (res) {
            let rawData = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => rawData += chunk);
            res.on('end', function () {
                const electionData = JSON.parse(rawData);
                return resolve(electionData);
            });
        });

        req.on('error', (e) => {
            console.log(`problem with request: ${e.message}`);
            return reject('ESP ' + options.protocol + '//' +
                options.hostname + ":" + options.port + " is temporarily unavailable.");
        });
        req.setTimeout(5000, function () {
            console.log("timeout");
            req.abort();
        });
        req.write("");
        req.end()
    });
}

function initPosDataArray(election) {
    let rawPos = election.pos;
    let curPos;
    let posDataObj = {};
    let posDataArray = [];
    let i, il;

    for(i = 0, il = rawPos.length; i < il; i++) {
        curPos = rawPos[i];
        posDataObj[curPos.pid] = {
            pid: curPos.pid,
            cid: -1,
            cand: []
        };
    }

    let rawMap = election.posCandMapping;
    for(i = 0, il = rawMap.length; i < il; i++) {
        let curMap = rawMap[i];
        posDataObj[curMap.pid].cand.push(curMap.cid);
    }

    for(let key in posDataObj) {
        let obj = posDataObj[key];
        obj.cand.sort(function(a, b) { return a - b; });
        posDataArray.push(obj);
    }

    posDataArray.sort(function(a, b) {return a.pid - b.pid});

    return posDataArray;
}

function randomVote(posDataArray) {
    for (let i=0, il=posDataArray.length; i<il; i++) {
        let curPosData = posDataArray[i];
        if(Math.random() > 0.1) {
            let index = randomInt(0, curPosData.cand.length);
            if(index >= 0) {
                curPosData.cid = curPosData.cand[index];
            }
        }
    }
}

function randomInt (low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}

async function vote(query, election, posDataArray) {
    randomVote(posDataArray);
    let teller = election.teller;
    let vote = generate_vote(teller, posDataArray);
    let commits = vote.commits;
    let proofs = vote.proofs;

    let tellerTasks = [];
    for(let i = 0, il = commits.length; i < il; i++) {
        tellerTasks.push(sendCommit(query, teller[i], commits[i], i));
    }
    let tellerResult = await Promise.all(tellerTasks);
    let receipt = await sendBallot(query, commits, tellerResult, proofs);
    let index = randomInt(0, teller.length);
    let ret = true;
    try {
        let result = await sendReceipt(query, receipt, teller[index],
            tellerResult[index].sign);
    } catch(e) {
        console.log(e);
        ret = false;
    }

    return ret;
}

function sendCommit(query, curTeller, commits, index) {
    return new Promise( (resolve, reject) => {
        const options = {
            hostname: curTeller.hostname,
            protocol: curTeller.protocol,
            port: curTeller.port,
            path: '/vote',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        let posData = {
            eid: curTeller.eid,
            email: query.email,
            rid: query.rid,
            reg_time: query.reg_time,
            link_time: query.link_time,
            link_sign: query.link_sign,
            commits: commits
        };

        let protocol = options.protocol === 'http:' ? http : https;
        let req = protocol.request(options, function (res) {
            let rawData = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => rawData += chunk);
            res.on('end', function () {
                let data = JSON.parse(rawData);
                if(data.code == 0) {
                    let ret = {
                        index: index,
                        sign: data.sign,
                        time: data.time
                    };

                    return resolve(ret);
                } else {
                    console.log(`Send commits to Teller ${index} error`);
                    return reject(data);
                }
            });
        });

        req.on('error', (e) => {
            console.log(`problem with request: ${e.message}`);
            return reject('Teller ' + index + ' ' + options.protocol + '//' +
                options.hostname + ":" + options.port + " is temporarily unavailable.");
        });
        req.setTimeout(60000, function() {
            console.log("timeout");
            req.abort();
        });
        req.write(JSON.stringify(posData));
        req.end();
    });
}

function sendBallot(query, commits, tellerRes, proofs) {
    return new Promise( (resolve, reject) => {
        let zs = [];

        for(let i = 0, il = commits.length; i < il; i++) {
            let curTellerRes = tellerRes[i];
            let curCommit = commits[i];

            for(let j = 0, jl = curCommit.length; j < jl; j++) {
                let curPosCommit = curCommit[j].values;
                for(let k = 0, kl = curPosCommit.length; k < kl; k++) {
                    delete curPosCommit[k].x;
                    delete curPosCommit[k].y;
                }
            }

            let curZ = {
                idx: curTellerRes.index,
                val: curCommit,
                sign: curTellerRes.sign,
                time: curTellerRes.time
            };

            zs.push(curZ);
        }

        let posData = {
            email: query.email,
            rid: query.rid,
            reg_time: query.reg_time,
            link_time: query.link_time,
            link_sign: query.link_sign,
            zs: zs,
            proofs: proofs
        };

        const options = {
            hostname: espUrl.hostname,
            protocol: espUrl.protocol,
            port: espUrl.port,
            path: '/election/' + eid + '/vote',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        let protocol = options.protocol === 'http:' ? http : https;
        let req = protocol.request(options, function (res) {
            let rawData = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => rawData += chunk);
            res.on('end', function () {
                let data = JSON.parse(rawData);
                if(data.code == 0) {
                    /* vote success */
                    return resolve(data);
                } else {
                    console.log(`Send Ballot error`);
                    return reject(data);
                }
            });
        });

        req.on('error', (e) => {
            console.log(`problem with request: ${e.message}`);
            return reject('ESP ' + options.protocol + '//' +
                options.hostname + ":" + options.port + " is temporarily unavailable.");
        });
        req.setTimeout(60000, function() {
            console.log("timeout");
            req.abort();
        });
        req.write(JSON.stringify(posData));
        req.end();
    });
}

function sendReceipt(query, receipt, teller, sign) {
    return new Promise( (resolve, reject) => {
        const options = {
            hostname: teller.hostname,
            protocol: teller.protocol,
            port: teller.port,
            path: '/saveReceipt',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        let posData = {
            eid: teller.eid,
            rid: query.rid,
            commitSign: sign,
            time: receipt.time,
            sign: receipt.sign
        };

        let protocol = options.protocol === 'http:' ? http : https;
        let req = protocol.request(options, function (res) {
            let rawData = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => rawData += chunk);
            res.on('end', function () {
                let data = JSON.parse(rawData);
                if(data.code == 0) {
                    return resolve(data.msg);
                } else {
                    console.log(`Send receipt error`);
                    return reject(data.msg);
                }
            });
        });

        req.on('error', (e) => {
            console.log(`problem with request: ${e.message}`);
            return reject('Teller ' + options.protocol + '//' +
                options.hostname + ":" + options.port + " is temporarily unavailable.");
        });
        req.setTimeout(60000, function() {
            console.log("timeout");
            req.abort();
        });
        req.write(JSON.stringify(posData));
        req.end();
    });
}

function generate_vote(tellers, pos) {
    let commits = [];
    let proofs = [];
    let sumX = [];
    let sumY = [];
    let sumZ = [];

    /* initial sums */
    for(let j = 0, jl = pos.length; j<jl; j++) {
        sumX[j] = new Array(pos[j].cand.length);
        sumY[j] = new Array(pos[j].cand.length);
        sumZ[j] = new Array(pos[j].cand.length);
        proofs[j] = new Array(pos[j].cand.length + 1);
    }

    for(let i = 0, il = tellers.length; i < il; i++) {
        let curCommitData = [];

        for(let j = 0, jl = pos.length; j<jl; j++) {
            let curPos = pos[j];
            let cand = curPos.cand;
            let curPosData = {};
            let values = [];
            curPosData.pid = curPos.pid;

            for(let k = 0, kl = cand.length; k < kl; k++) {
                let x_bn;
                let cid = cand[k];

                if(i == il-1) {
                    /* handle only one teller case which does not split shares */
                    x_bn = new BN();

                    if (cid == curPos.cid) {
                        x_bn.addMInt(1);
                    }

                    if(sumX[j][k]) {
                        x_bn.modSubM(sumX[j][k], modulus);
                    }

                } else {
                    x_bn = BN.rand(modulus);
                }

                let y_bn = BN.rand(modulus);
                let z = ec.gen_z(x_bn, y_bn);

                values.push({
                    cid: cid,
                    x: x_bn.toBase64(),
                    y: y_bn.toBase64(),
                    z: z.toBase64()
                });

                if(sumX[j][k] === undefined) {
                    sumX[j][k] = x_bn;
                } else {
                    sumX[j][k].addM(x_bn);
                }

                if(sumY[j][k] === undefined) {
                    sumY[j][k] = y_bn;
                } else {
                    sumY[j][k].addM(y_bn);
                }

                if(sumZ[j][k] === undefined) {
                    sumZ[j][k] = z;
                } else {
                    sumZ[j][k].addMPoint(z);
                }
            }
            curPosData.values = values;
            curCommitData.push(curPosData);
        }

        commits.push(curCommitData);
    }

    for(let j = 0, jl = pos.length; j<jl; j++) {
        let curPos = pos[j];
        let cand = curPos.cand;
        let curSumY = new BN();
        let curSumZ = ec.createPoint();
        let k, kl;
        for(k = 0, kl = cand.length; k < kl; k++) {

            let cid = cand[k];
            let y = sumY[j][k];
            let z = sumZ[j][k];

            if (cid == curPos.cid) {
                proofs[j][k] = ec.proof_01(z, y, 1);
            } else {
                proofs[j][k] = ec.proof_01(z, y, 0);
            }

            curSumY.addM(y);
            curSumZ.addMPoint(z);
        }

        if(curPos.cid >= 0) {
            proofs[j][kl] = ec.proof_01(curSumZ, curSumY, 1);
        } else {
            proofs[j][kl] = ec.proof_01(curSumZ, curSumY, 0);
        }
    }

    return {
        commits: commits,
        proofs: proofs
    };
}