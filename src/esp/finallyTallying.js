const pg = require('pg');
const fs = require('fs');
const dbConfig = require('./dbConfig');
const readlineSync = require('../common/readlineSync');
const tallyingUtil = require('../common/tallyingUtil');
const { Elliptic, BN, curve } = require('../common/nativeEcc');
const parameter = require('../common/parameter');
const schema = dbConfig.schema;

const eid = process.argv[2];
const filename = process.argv[3];

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

const client = new pg.Client(dbConfig);
let abort = true;

(async function () {
    await client.connect();
    console.log("connected");
    await client.query('BEGIN');
    console.log("begin");

    let result = await client.query(
        `SELECT * FROM ${schema}.election WHERE id = $1;`, [eid]);

    if(result.rowCount != 1) {
        throw `Election ${eid} is not existed.`;
    }

    let election = result.rows[0];
    if(
        election.election_data === null || election.election_data.state !== 3
    ) {
        throw `Election ${eid} has invalid state.`;
    }

    if(election.summation !== null) {
        console.log("Final Tallying is done (No tallying needed).");
        return null;
    }

    /* check whether all tellers submit the result */
    let teller = election.election_data.teller;
    let tellerResults = [];
    for(let i=0, il=teller.length; i<il; i++) {
        let curTeller = teller[i];
        let count = curTeller.count;
        if(count === undefined) {
            throw `Have not receive tallying result from all tellers.`
        }

        /* init z value */
        for(let j=0, jl=count.length; j<jl; j++) {
            let tmp1 = count[j].values;
            for(let k = 0, kl = tmp1.length; k < kl; k++) {
                let tmp2 = tmp1[k];
                tmp2.z = ec.createPoint();
            }
        }

        tellerResults.push(count);
    }

    console.log("Start Verify Tallying result from all tellers.");

    let file;
    try {

        file = new readlineSync(filename);
    } catch (e) {
        throw `cannot open file ${filename}`;
    }

    /* multiple z in the ballot separated by teller */
    let line;
    while((line = file.getline()) !== null) {
        let ballot = JSON.parse(line);
        let zs = ballot.zs;
        for(let i=0, il=zs.length; i<il; i++) {
            multResultZ(tellerResults[i], zs[i].val);
        }
    }

    /* verify all tellers' result add do the summation */
    let success = true;
    let finalResult = tallyingUtil.initElectionPos(election.election_data);

    for(let i=0, il=tellerResults.length; i<il; i++) {
        let curTeller = teller[i];
        let tellerUrl = `${curTeller.protocol}//${curTeller.hostname}${curTeller.port ? `:${curTeller.port}` : ''}`;
        let curTellerResult = tellerResults[i];
        let result;
        try {
            result = verifyResult(curTellerResult)
        } catch(e) {
            result = false;
        }
        if(result) {
            console.log(`Tallying result ${i} (${tellerUrl}) is correct.`);
            addResultXY(finalResult, curTellerResult);
        } else {
            console.log(`Tallying result ${i} (${tellerUrl}) is not correct.`);
            success = false;

            /* delete this teller result */
            delete curTeller.count;
            delete curTeller.count_sign;
            delete curTeller.count_time;
            result = await client.query(
`UPDATE ${schema}.election \
SET election_data = jsonb_set(election_data, $1, $2::jsonb) WHERE id = $3;`,
                [`{teller, ${i}}`, JSON.stringify(curTeller), eid]
            );
            if(result.rowCount != 1) {
                throw `database issue`;
            }
        }
    }

    if(!success) {
        await client.query('COMMIT');
        throw `Some teller result is not correct`;
    }

    serializeResultXY(finalResult);

    /* store summation result */
    result = await client.query(
`UPDATE ${schema}.election SET summation = $1 WHERE id = $2;`,
        [JSON.stringify(finalResult), eid]);

    if(result.rowCount != 1) {
        throw `database issue`;
    }
    await client.query('COMMIT');
    console.log("commit");
    abort = false;
    console.log("Tallying Result is stored.");
})()
    .catch(function (e) {
        console.log(e);
    })
    .then(async function () {
        if(abort) {
            console.log("abort");
        }
        console.log("end");
        await client.end();
    });

function multResultZ(result, data) {
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

function addResultXY(result, data) {
    for(let i = 0, il = result.length; i < il; i++) {
        let val1 = result[i].values;
        let val2 = data[i].values;
        for(let j = 0, jl = val1.length; j < jl; j++) {
            let curVal1 = val1[j];
            let curVal2 = val2[j];
            curVal1.x.addM(curVal2.x);
            curVal1.y.addM(curVal2.y);
        }
    }
}

function serializeResultXY(result) {
    let order = ec.getOrder();
    for(let i = 0, il = result.length; i < il; i++) {
        let val1 = result[i].values;
        for(let j = 0, jl = val1.length; j < jl; j++) {
            let curVal1 = val1[j];
            curVal1.x = curVal1.x.modM(order).toBase64();
            curVal1.y = curVal1.y.modM(order).toBase64();
        }
    }
}

function verifyResult(data) {
    for(let i = 0, il = data.length; i < il; i++) {
        let tmp1 = data[i].values;
        for(let j = 0, jl = tmp1.length; j < jl; j++) {
            let tmp2 = tmp1[j];
            tmp2.x = new BN(tmp2.x);
            tmp2.y = new BN(tmp2.y);
            if( !ec.verify_xyz_native(tmp2.x, tmp2.y, tmp2.z) ) {
                return false;
            }
        }
    }

    return true;
}