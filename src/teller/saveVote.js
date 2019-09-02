const pg = require('pg');
const dbConfig = require('./dbConfig');
const util = require('../common/util');
const fs = require('fs');
const now = require('performance-now');
const statFileName = process.argv[7];
/*
let statFile;
try {
    statFile = fs.openSync(statFileName, 'w');
} catch (e) {
    console.log(`Stat file ${statFileName} open fail.`);
    process.exit(1);
    return;
}

console.log(`Stat file ${statFileName} open success.`);
*/

function verifyAndSignVote(election, vote, ec, pki, cipher) {
    let startVerifyTime = now();
    let paramStr = util.verifyVoteLink(vote, pki, election.auth_pub_key);
    if(!paramStr) return false;

    let electionData = election.election_data;
    let commits = vote.commits;
    let pos = util.buildElectionPos(electionData);

    /* 1. verify the commits, commits should have the
     * same sorted order as stored information
     * 2. sign the concatenation of voter info (paramStr), voter link sign,
     *    cid, pid, and all z's
     * 3. encrypt x,y with aes key */
    let str = paramStr + vote.link_sign;
    let retCommits = [];

    /* detect not same number of pos */
    if(!Array.isArray(commits) || commits.length !== pos.length) {
        return false;
    }

    let startVerifyCommitTime = now();
    for(let i = 0, il = commits.length; i < il; i++) {
        let curCommit = commits[i];
        let curPos = pos[i];
        let cand = curPos.cand;

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

        let curRetCommit = {
            pid: curCommit.pid,
            values: []
        };
        let curRetCommitVals = curRetCommit.values;
        retCommits.push(curRetCommit);
        str += curCommit.pid;

        for(let j = 0, jl = commitVals.length; j < jl; j++) {
            let curCommitVal = commitVals[j];
            if(
                typeof curCommitVal !== 'object' ||
                curCommitVal === null ||
                curCommitVal.cid !== cand[j]
            ) {
                return false;
            }

            str += curCommitVal.cid;
            let x = curCommitVal.x;
            let y = curCommitVal.y;
            let z = curCommitVal.z;

            if(
                typeof x !== "string" ||
                typeof y !== "string" ||
                typeof z !== "string"
            ) {
                return false;
            }

            /* TODO check whether x, y, z are base64 string */
            if(!ec.verify_xyz(x, y, z)) {
                return false;
            }

            /* concatenate z */
            str += z;

            /* encrypt x and y */
            curRetCommitVals.push({
                cid: curCommitVal.cid,
                x: curCommitVal.x,
                y: curCommitVal.y
            });
        }
    }
    let endVerifyCommitTime = now();

    retCommits = cipher.encrypt(JSON.stringify(retCommits));
    let time = Date.now()/1000;
    str += time;
    let signature = pki.sign(str);
    let endVerifyTime = now();
    let statRes = `${endVerifyCommitTime-startVerifyCommitTime}\t${endVerifyTime-startVerifyTime}\n`;
    // fs.writeSync(statFile, statRes);
    return {
        time: time,
        commits: retCommits,
        sign: signature
    };
}

async function saveVote (vote, ec, pki, cipher) {
    let invalidVote = {
        code: -2,
        msg: "Invalid vote."
    };

    if(
        vote === null ||
        typeof vote !== "object" ||
        !Number.isFinite(vote.eid)
    ) {
        return invalidVote;
    }

    const schema = dbConfig.schema;
    const client = new pg.Client(dbConfig);
    let abort = true;

    try {
        await client.connect();
        console.log("connected");
        await client.query('BEGIN');
        console.log("begin");

        let eid = vote.eid;
        let result = await client.query(
            `SELECT * FROM ${schema}.election WHERE id = $1`, [eid]);
        if(result.rowCount != 1) {
            return {
                code: -3,
                msg: `Election ${eid} does not exit.`
            };
        }

        let electionData = result.rows[0];
        if(
            electionData.election_data === null ||
            electionData.election_data.state !== 2
        ) {
            return {
                code: -4,
                msg: `Election ${eid} is not open.`
            };
        }

        let verifyResult = verifyAndSignVote(electionData, vote, ec, pki, cipher);

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
                verifyResult.commits, verifyResult.time,
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