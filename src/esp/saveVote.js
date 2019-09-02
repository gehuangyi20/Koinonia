const pg = require('pg');
const dbConfig = require('./dbConfig');
const schema = dbConfig.schema;
const util = require('../common/util');
const fs = require('fs');
const now = require('performance-now');
/*
const statFileName = process.argv[5];
let statFile;
try {
    statFile = fs.openSync(statFileName, 'w');
} catch (e) {
    console.log(`Stat file ${statFileName} open fail.`);
    process.exit(1);
    return;
}
*/

function verifyAndSignVote(vote, ec, pki, election) {
    let startVerifyTime = now();
    let paramStr = util.verifyVoteLink(vote, pki, election.auth_pub_key);

    if(!paramStr) return false;

    let electionData = election.election_data;
    let pos = util.buildElectionPos(electionData);

    for(let i = 0, il = pos.length; i < il; i++) {
        let zs = [];
        let curPos = pos[i];
        curPos.zs = zs;
        for(let j = 0, jl = curPos.cand.length + 1; j < jl; j++) {
            zs[j] = ec.createPoint();
        }
    }

    /* ballot sign string
     * 1. sign the concatenation of voter info (paramStr), voter link sign,
     *    zs, and proof */
    let str = paramStr + vote.link_sign;

    /* start to verify zs */
    let zs = vote.zs;
    let teller = electionData.teller;
    if(!Array.isArray(zs) || zs.length !== teller.length) {
        return false;
    }

    let retZs = [];

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

        let curRetZ = {
            idx: curZ.idx,
            sign: curSign,
            time: curTime,
            val: []
        };

        let curRetVal = curRetZ.val;
        let curStr = str;
        retZs.push(curRetZ);

        for(let j = 0, jl = curVal.length; j < jl; j++) {
            let curCommit = curVal[j];
            let curPos = pos[j];
            let cand = curPos.cand;
            let zs = curPos.zs;

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

            let pid = curCommit.pid;
            let curRetCommit = {
                pid: pid,
                values: []
            };
            let curRetCommitVals = curRetCommit.values;
            curRetVal.push(curRetCommit);
            curStr += pid;

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
                let z = curCommitVal.z;
                zs[k].addMPointBase64(z);

                /* concatenate z */
                curStr += z;

                curRetCommitVals.push({
                    cid: curCommitVal.cid,
                    z: z
                });
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

    let retProofs = [];
    let startVerifyProofTime = now();

    for(let i = 0, il = proofs.length; i < il; i ++) {
        let curProof = proofs[i];
        let curPos = pos[i];
        let cand = curPos.cand;
        let candLen = cand.length;
        let curRetProof = [];
        let zs = curPos.zs;
        retProofs.push(curRetProof);

        /* For each position, we have number of candidates + 1 proofs */
        if(!Array.isArray(curProof) || curProof.length !== candLen + 1) {
            return false;
        }

        for(let j = 0, jl = curProof.length; j < jl; j++) {
            let curProofData = curProof[j];

            /* check proof format */
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

            let result = ec.verify_proof_01(curProofData, zs[j]);

            if(j < candLen) {
                zs[candLen].addMPoint(zs[j]);
            }

            if(!result) {
                return false;
            } else {
                curRetProof.push({
                    d0: d0,
                    d1: d1,
                    e0: e0,
                    e1: e1,
                    f0: f0,
                    f1: f1
                });
            }
        }
    }
    let endVerifyProofTime = now();

    let time = Date.now()/1000;
    str += time;
    let signature = pki.sign(str);
    let endVerifyTime = now();
    let statRes = `${endVerifyProofTime-startVerifyProofTime}\t${endVerifyTime-startVerifyTime}\n`;
    // fs.writeSync(statFile, statRes);

    return {
        ballot: {
            zs: retZs,
            proofs: retProofs,
        },
        time: time,
        sign: signature
    };
}

async function saveVote(eid, vote, ec, pki) {
    let invalidVote = {
        code: -2,
        msg: "Invalid vote."
    };

    if(
        vote === null ||
        typeof vote !== "object"
    ) {
        return invalidVote;
    } else {
        vote.eid = eid;
    }

    const client = new pg.Client(dbConfig);
    let abort = true;

    try {
        await client.connect();
        console.log("connected");
        await client.query('BEGIN');
        console.log("begin");

        let result = await client.query(
            `SELECT * FROM ${schema}.election WHERE id = $1;`, [eid]);
        if(result.rowCount != 1) {
            return {
                code: -3,
                msg: `Election ${eid} does not exit.`
            };
        }

        let election = result.rows[0];
        if(
            election.election_data === null ||
            election.election_data.state !== 2
        ) {
            return {
                code: -4,
                msg: `Election ${eid} is not open.`
            };
        }

        let verifyResult = verifyAndSignVote(vote, ec, pki, election);

        if(!verifyResult) {
            return invalidVote;
        }

        result = await client.query(
            `INSERT INTO ${schema}.votes \
(eid, rid, email, reg_time, link_time, link_sign, data, vote_time, vote_sign) \
VALUES ($1, $2, $3, to_timestamp($4), to_timestamp($5), $6, $7, \
to_timestamp($8), $9) ON CONFLICT DO NOTHING;`,
            [
                vote.eid, vote.rid, vote.email, vote.reg_time,
                vote.link_time, vote.link_sign,
                JSON.stringify(verifyResult.ballot), verifyResult.time,
                verifyResult.sign
            ]);

        if(result.rowCount == 1) {
            await client.query('COMMIT');
            console.log("commit");
            abort = false;
            return {
                code: 0,
                msg: "vote success",
                time: verifyResult.time,
                sign: verifyResult.sign
            }
        } else {
            return {
                code: -5,
                msg: "database issue."
            }
        }

    } catch (e) {
        console.log(e);
        return {
            code: -1,
            msg: "Server is temporary unavailable."
        };
    } finally {
        if(abort) {
            console.log("abort");
        }
        console.log("end");
        await client.end();
    }
}

module.exports = saveVote;