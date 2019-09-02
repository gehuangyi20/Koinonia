const pg = require('pg');
const dbConfig = require('./dbConfig');
const schema = dbConfig.schema;
const util = require('../common/util');

async function submitTellerResult(eid, tellerResult, pki) {
    let invalidResult = {
        code: -2,
        msg: "Invalid summation result."
    };

    if(!(
        typeof tellerResult === 'object' &&
        Number.isInteger(tellerResult.idx) &&
        Number.isFinite(tellerResult.time) &&
        typeof tellerResult.sign === 'string'
    )) {
        return invalidResult;
    }

    const client = new pg.Client(dbConfig);
    let abort = true;

    try {
        await client.connect();
        console.log("connected");
        await client.query('BEGIN');
        console.log("begin");
        let result = await client.query(`SELECT * FROM ${schema}.election WHERE id = $1;`, [eid]);
        if (result.rowCount != 1) {
            return {
                code: -3,
                msg: `Election ${eid} does not exit.`
            };
        }

        let election = result.rows[0];
        let electionData = election.election_data;

        if(
            electionData === null ||
            electionData.state !== 3
        ) {
            return {
                code: -4,
                msg: `Election ${eid} is not closed.`
            };
        }

        if(election.summation !== null) {
            return {
                code: 0,
                msg: `Summation of Election ${eid} has published.`
            };
        }

        let teller = electionData.teller[tellerResult.idx];
        let tellerUrl = `${teller.protocol}//${teller.hostname}${teller.port ? `:${teller.port}` : ''}`;
        if(teller === undefined) {
            return invalidResult;
        }

        if(teller.count) {
            return {
                code: 0,
                msg: `The result of Teller ${tellerResult.idx} (${tellerUrl}) has already been accepted.`
            }
        }

        let str = `${eid}`;
        let pos = util.buildElectionPos(electionData);
        let count = tellerResult.count;
        let retCount = [];

        if( !Array.isArray(count) || count.length !== pos.length ) {
            return invalidResult;
        }
        /* verify count which should be same as a commit */
        for(let i = 0, il = count.length; i < il; i++) {
            let curPos = pos[i];
            let curCount = count[i];

            if(
                typeof curCount !== 'object' ||
                curCount === null ||
                curCount.pid !== curPos.pid
            ) {
                return invalidResult;
            }

            let curCountVals = curCount.values;
            let cand = curPos.cand;

            if(
                !Array.isArray(curCountVals) ||
                curCountVals.length !== cand.length
            ) {
                return invalidResult;
            }

            let pid = curPos.pid;
            let curRetCount = {
                pid: pid,
                values: []
            };
            retCount.push(curRetCount);
            let curRetCountVals = curRetCount.values;
            str += pid;
            for(let j = 0, jl = curCountVals.length; j < jl; j++) {
                let curCountVal = curCountVals[j];
                if(
                    typeof curCountVal !== 'object' ||
                    curCountVal === null
                ) {
                    return invalidResult;
                }

                let cid = curCountVal.cid;
                let x = curCountVal.x;
                let y = curCountVal.y;
                if(
                    cid !== cand[j] ||
                    typeof x !== "string" || typeof y !== "string"
                ) {
                    return invalidResult;
                }
                str += `${cid}${x}${y}`;
                curRetCountVals.push({cid:cid, x:x, y:y});
            }
        }

        str += tellerResult.time;
        console.time("verifySign");
        result = pki.verify(str, tellerResult.sign, teller.pub_key);
        console.timeEnd("verifySign");

        if(!result) {
            return invalidResult;
        } else{
            console.log("sign correct");
        }

        /* store teller result */
        teller.count = retCount;
        teller.count_sign = tellerResult.sign;
        teller.count_time = tellerResult.time;
        result = await client.query(
`UPDATE ${schema}.election \
SET election_data = jsonb_set(election_data, $1, $2::jsonb) WHERE id = $3;`,
            [`{teller, ${tellerResult.idx}}`, JSON.stringify(teller), eid]
        );

        if(result.rowCount == 1) {
            await client.query('COMMIT');
            console.log("commit");
            abort = false;
            return {
                code: 0,
                msg: `Accept summation result from Teller ${tellerResult.idx} \
(${tellerUrl}), further verification will be processed in the final tallying. `
            }
        } else {
            return {
                code: -5,
                msg: "database issue."
            }
        }
    }  catch (e) {
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

module.exports = submitTellerResult;