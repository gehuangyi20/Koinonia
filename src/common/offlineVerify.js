const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const fs = require('fs');
const readlineSync = require('./readlineSync');
const { Elliptic, BN, curve } = require('../common/nativeEcc');
const parameter = require('../common/parameter');
const PKI = require("../common/PKI");
const util = require('./util');

const filenameVotes = process.argv[2];
const filenameElection = process.argv[3];
const reportInterval = parseInt(process.argv[4]);

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

let pki = new PKI();

/* read election ballotList */
let electionData;
try {
    let data = fs.readFileSync(filenameElection, 'utf8');
    electionData = JSON.parse(data);
} catch (e) {
    console.log(`cannot read Election Summation ${filenameElection}`);
    return;
}

/* Todo add election Data format checking */
let summation = initSummation(electionData.summation);
const eid = electionData.id;
const pos = util.buildElectionPos(electionData);
const authPubKey = electionData.auth.pubKey;
const teller = electionData.teller;
let ballotCount = 0;
let processedCount = 0;

if(cluster.isMaster){
    let ballotList;
    try {
        ballotList = new readlineSync(filenameVotes);
    } catch (e) {
        console.log(`cannot open file ${filenameVotes}`);
        return;
    }

    let intervalId = setInterval(function () {
        console.log(`Read ${ballotCount} ballots, ${processedCount} verified.`);
    }, reportInterval > 0 ? reportInterval : 10000);

    let onlineWorker = 0;
    let finishedWorkers = 0;
    let disconnectedWorkers = 0;
    let success = false;
    for(let i = 0; i < numCPUs; i++) {
        let worker = cluster.fork();
        worker.on("message", function workerHandler(msg) {
            if(msg == "finished") {
                finishedWorkers ++;
                if(finishedWorkers == numCPUs) {
                    /* end of aggregation */
                    success = verifySummation(summation);
                    endWorkers();
                }
                return;
            }

            if(!msg.verify) {
                console.log("verification fail ^");
                endWorkers();
            } else {
                let zs = msg.zs;
                processedCount ++;

                for(let i = 0, il = teller.length; i < il; i++) {
                    multResult(summation, zs[i].val);
                }

                processBallot(msg.id);
            }
        });

        worker.on("disconnect", () => {
            console.log(`worker #${worker.id} has disconnected`);
            disconnectedWorkers ++;
            if(disconnectedWorkers == numCPUs) {
                console.log(`Final: Read ${ballotCount} ballots, ${processedCount} verified.`);
                console.log(`Result: verification ${success ? 'success' : 'fail'}`);
            }
        });

        worker.on("online", () => {
            console.log(`worker #${worker.id} online`);
            onlineWorker ++;
            if(onlineWorker == numCPUs) {
                for(const id in cluster.workers) {
                    if(!processBallot(id)) break;
                }
            }
        });
    }

    function endWorkers() {
        clearInterval(intervalId);
        for(const id in cluster.workers) {
            cluster.workers[id].disconnect();
        }
    }

    function processBallot(workerId) {
        let line = ballotList.getline();
        if(line === null) {
            cluster.workers[workerId].send("shutdown");
        } else {
            ballotCount ++;
            try{
                let data = JSON.parse(line);
                data.eid = eid;
                cluster.workers[workerId].send({
                    id: workerId,
                    ballot: data
                });
            } catch (e) {
                console.log(e);
                console.log(`Cannot parse ballot ${ballotCount}`);
                endWorkers();
                return false;
            }
        }
        return true;
    }
} else {
    process.on('message', (msg) => {
        if(msg == "shutdown") {
            process.send("finished");
            return;
        }

        let ballot = msg.ballot;
        let verify = verifyBallot(msg.ballot);
        if(!verify) {
            console.log("verification fail &");
        }
        process.send({
            id: msg.id,
            verify: verify,
            zs: ballot.zs
        });
    });
}

function initSummation(data) {
    for(let i = 0, il = data.length; i < il; i++) {
        let tmp1 = data[i].values;
        for(let j = 0, jl = tmp1.length; j < jl; j++) {
            let tmp2 = tmp1[j];
            tmp2.z = ec.createPoint();
        }
    }

    return data;
}

function verifySummation(data) {
    for(let i = 0, il = data.length; i < il; i++) {
        let tmp1 = data[i].values;
        for(let j = 0, jl = tmp1.length; j < jl; j++) {
            let tmp2 = tmp1[j];
            tmp2.x = new BN(tmp2.x);
            tmp2.y = new BN(tmp2.y);
            let result = ec.verify_xyz_native(tmp2.x, tmp2.y, tmp2.z);
            if( !result ) {
                return false;
            }
        }
    }

    return true;
}

function verifyBallot(vote) {
    if( vote === null || typeof vote !== "object" ) {
        return false;
    }

    let paramStr = util.verifyVoteLink(vote, pki, authPubKey);
    if(!paramStr) return false;

    let str = paramStr + vote.link_sign;

    let retZs = [];
    for(let i = 0, il = pos.length; i < il; i++) {
        let zs = [];
        let curPos = pos[i];
        retZs.push({ values: zs });
        for(let j = 0, jl = curPos.cand.length + 1; j < jl; j++) {
            zs[j] = ec.createPoint();
        }
    }

    /* start to verify zs */
    let zs = vote.zs;

    if(!Array.isArray(zs) || zs.length !== teller.length) {
        return false;
    }


    for(let i = 0, il = zs.length; i < il; i ++) {
        let curZ = zs[i];

        if(typeof curZ !== 'object' || curZ === null) {
            return false;
        }

        if(!Number.isInteger(curZ.idx) || curZ.idx < 0 || curZ.idx >= il ) {
            return false;
        }

        let curPubKey = teller[curZ.idx].pub_key;
        let curVal = curZ.val;
        let curSign = curZ.sign;
        let curTime = curZ.time;

        if(typeof curSign !== "string" || !Number.isFinite(curTime)) {
            return false;
        }

        if(!Array.isArray(curVal) || curVal.length !== pos.length) {
            return false;
        }

        let curStr = str;

        for(let j = 0, jl = curVal.length; j < jl; j++) {
            let curCommit = curVal[j];
            let curPos = pos[j];
            let cand = curPos.cand;
            let curRetZs = retZs[j].values;

            if(
                typeof curCommit !== 'object' ||
                curCommit === null ||
                curCommit.pid !== curPos.pid
            ) {
                return false;
            }

            let commitVals = curCommit.values;

            if(
                !Array.isArray(commitVals) ||
                commitVals.length !== cand.length
            ) {
                return false;
            }

            curStr += curCommit.pid;

            for(let k = 0, kl = commitVals.length; k < kl; k++) {
                let curCommitVal = commitVals[k];
                if(
                    typeof curCommitVal !== 'object' ||
                    curCommitVal === null ||
                    curCommitVal.cid !== cand[k] ||
                    typeof curCommitVal.z !== "string"
                ) {
                    return false;
                }

                curStr += curCommitVal.cid;

                /* concatenate z */
                let z = curCommitVal.z;
                curStr += z;
                curRetZs[k].addMPointBase64(z);
            }
        }

        curStr += curTime;

        let result = pki.verify(curStr, curSign, curPubKey);

        if(!result) {
            return false;
        }
    }

    /* start to verify proofs */
    let proofs = vote.proofs;
    if(!Array.isArray(proofs) || proofs.length !== pos.length) {
        return false;
    }

    for(let i=0, il = proofs.length; i < il; i++) {
        let curProof = proofs[i];
        let curPos = pos[i];
        let cand = curPos.cand;
        let candLen = cand.length;
        let curRetZs = retZs[i].values;

        /* For each position, we have number of candidates + 1 proofs */
        if(!Array.isArray(curProof) || curProof.length !== candLen + 1) {
            return false;
        }

        for(let j = 0, jl = curProof.length; j < jl; j++) {
            let curProofData = curProof[j];

            /* check proof format, TODO migrate with saveVote.js */
            if(typeof curProofData != "object" || curProofData == null) {
                return false;
            }

            let d0 = curProofData.d0;
            let d1 = curProofData.d1;
            let e0 = curProofData.e0;
            let e1 = curProofData.e1;
            let f0 = curProofData.f0;
            let f1 = curProofData.f1;
            if(
                typeof d0 !== "string" ||
                typeof d1 !== "string" ||
                typeof e0 !== "string" ||
                typeof e1 !== "string" ||
                typeof f0 !== "string" ||
                typeof f1 !== "string"
            ) {
                return false;
            }

            let result = ec.verify_proof_01(curProofData, curRetZs[j]);

            if(j < candLen) {
                curRetZs[candLen].addMPoint(curRetZs[j]);
            }

            if(!result) {
                return false;
            }
        }
    }

    return true;
}

function multResult(result, data) {
    for(let i = 0, il = result.length; i < il; i++) {
        let val1 = result[i].values;
        let val2 = data[i].values;
        for(let j = 0, jl = val1.length; j < jl; j++) {
            let curVal1 = val1[j];
            let curVal2 = val2[j];
            curVal1.z.addMPointBase64(curVal2.z);
        }
    }
}
