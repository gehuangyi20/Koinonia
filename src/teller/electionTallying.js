const pg = require('pg');
const http = require('http');
const https = require('https');
const dbConfig = require('./dbConfig');
const util = require("../common/util");
const readlineSync = require('../common/readlineSync');
const tallyingUtil = require('../common/tallyingUtil');
const fs = require('fs');
const { Elliptic, curve } = require('../common/nativeEcc');
const parameter = require('../common/parameter');
const PKI = require("../common/PKI");

const eid = process.argv[2];
const filename = process.argv[3];
const schema = process.argv[4];
const password = process.argv[5];
const pwConfFile = process.argv[6];
const keyFileName = process.argv[7];
const tellerIndex = parseInt(process.argv[8]);

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

/* set up database schema */
dbConfig.schema = schema;

/* setup server aesKey */
const cipher = util.initAESCipher(password, pwConfFile);
let pki;
try {
    pki = new PKI(keyFileName, password);
    console.log("public/private key loaded");
} catch (e) {
    console.log("Fail to load public/private key");
}

const client = new pg.Client(dbConfig);
let abort = true;

(async function () {

    await client.connect();
    console.log("connected");
    await client.query('BEGIN');
    console.log("begin");

    let result = await client.query(
`SELECT *, extract(epoch from count_time::timestamptz) AS count_time \
FROM ${schema}.election WHERE id = $1;`, [eid]);

    if(result.rowCount != 1) {
        throw `Election ${eid} is not existed.`;
    }

    let election = result.rows[0];
    if(
        election.election_data === null || election.election_data.state !== 3
    ) {
        throw `Election ${eid} has invalid state.`;
    }

    if(election.count !== null) {
        console.log("Tallying is done (No tallying needed).");
        return {
            espUrl: election.esp_url,
            count: election.count,
            time: election.count_time,
            sign: election.count_sign
        };
    }

    console.log("Start Tallying.");

    let output = tallyingUtil.initElectionPos(election.election_data);

    let file;
    try {

        file = new readlineSync(filename);
    } catch (e) {
        throw `cannot open file ${filename}`;
    }

    let line;
    while((line = file.getline()) !== null) {
        if(line !== '') {
            try {
                let ballot = JSON.parse(line);
                if(!(
                    typeof ballot === 'object' &&
                    ballot !== null &&
                    typeof ballot.rid === 'string' &&
                    Array.isArray(ballot.zs)
                )) {
                    throw "bad ballot format";
                }
                let zs = ballot.zs;

                for(let i=0, il=zs.length; i<il; i++) {
                    let commit = zs[i];
                    if(commit.idx === tellerIndex) {
                        if( typeof commit.sign !== 'string' ) {
                            throw "bad ballot format";
                        }
                        let result = await client.query(
`SELECT * FROM ${schema}.votes \
WHERE eid = $1 AND rid = $2 AND vote_sign = $3 AND is_sum = false`,
                            [eid, ballot.rid, commit.sign]);

                        if(result.rowCount != 1) {
                            throw `Election ${eid} has invalid ballot (duplicated or malicious).`;
                        }

                        let data = result.rows[0].data;
                        addResult(output, data);

                        result = await client.query(
`UPDATE ${schema}.votes SET is_sum = true \
WHERE eid = $1 AND rid = $2 AND vote_sign = $3 AND is_sum = false`,
                            [eid, ballot.rid, commit.sign]);
                        if(result.rowCount != 1) {
                            throw `database issue`;
                        }
                    }
                }
            } catch (e) {
                console.log(e);
                throw "bad json in ballot file.";
            }
        }
    }

    /* check if there exists a commit which receives the sign from ESP but not
     * added in the output (is_sum is false and receipt_sign is not null). It
     * implies the ESP excludes accepted ballot. */
    result = await client.query(
`SELECT count(*) AS count FROM ${schema}.votes \
WHERE eid = $1 AND receipt_sign IS NOT NULL AND is_sum = false;`,
        [eid]);
    if(result.rows[0].count > 0) {
        throw `ESP excludes accepted ballots.`
    }

    /* save output */
    let str = `${eid}`;
    let order = ec.getOrder();
    for(let i = 0, il = output.length; i < il; i++) {
        let tmp1 = output[i].values;
        str += output[i].pid;

        for(let j = 0, jl = tmp1.length; j < jl; j++) {
            let tmp2 = tmp1[j];
            tmp2.x = tmp2.x.mod(order).toBase64();
            tmp2.y = tmp2.y.mod(order).toBase64();
            str += `${tmp2.cid}${tmp2.x}${tmp2.y}`;
        }
    }

    let time = Date.now()/1000;
    str += time;
    let count_sign = pki.sign(str);

    result = await client.query(
`UPDATE ${schema}.election SET count = $1, count_sign = $2, \
count_time = to_timestamp($3) WHERE id = $4;`,
        [JSON.stringify(output), count_sign, time, eid]);

    if(result.rowCount != 1) {
        throw `database issue`;
    }
    await client.query('COMMIT');
    console.log("commit");
    abort = false;
    console.log("Tallying Result is stored.");

    return {
        espUrl: election.esp_url,
        count: output,
        time: time,
        sign: count_sign
    };
})()
    .then(function (result) {
        if(abort) {
            console.log("abort");
        }
        console.log("end");
        client.end();
        if(result) {
            console.log('Start to submit the summation result.');
            sendResultToESP(result);
        }
    })
    .catch(function(e) {
        console.log(e);
    });

function addResult(result, data) {
    let val1, val2;
    let curVal1, curVal2;
    data = JSON.parse(cipher.decrypt(data));

    for(let i = 0, il = result.length; i < il; i++) {
        val1 = result[i].values;
        val2 = data[i].values;
        for(let j = 0, jl = val1.length; j < jl; j++) {
            curVal1 = val1[j];
            curVal2 = val2[j];
            let x = curVal2.x;
            let y = curVal2.y;
            curVal1.x.addMBase64(x);
            curVal1.y.addMBase64(y);
        }
    }
}

function sendResultToESP(data) {
    return new Promise( (resolve, reject) => {
        let espUrl = data.espUrl;
        let options = {
            hostname: espUrl.hostname,
            protocol: espUrl.protocol,
            port: espUrl.port,
            path: `/election/${eid}/submitTellerResult`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        let protocol = espUrl.protocol === 'http:' ? http : https;
        let serverReq = protocol.request(options, function (serverRes) {
            let rawData = '';
            serverRes.setEncoding('utf8');
            serverRes.on('data', (chunk) => rawData += chunk);
            serverRes.on('end', function () {
                try {
                    let resData = JSON.parse(rawData);
                    if(resData.code === 0) {
                        console.log('ESP accepts the summation result.');
                        console.log(`Msg from ESP: ${resData.msg}`);
                    } else {
                        console.log("Cannot submit the result to ESP.");
                        console.log(`Error code: ${resData.code}`);
                        console.log(`Error msg: ${resData.msg}`);
                    }
                } catch (e) {
                    console.log(`Unexpected Error: ${e.message}`);
                }
            });
        });

        serverReq.on('error', (e) => {
            console.log(`problem with request: ${e.message}`);
            return reject({
                code: -3,
                msg: `${options.protocol}//${options.hostname}:${options.port} \
is temporarily unavailable.`
            });
        });

        serverReq.setTimeout(5000, function () {
            console.log("timeout");
            serverReq.abort();
        });
        serverReq.write(JSON.stringify({
            idx: tellerIndex,
            count: data.count,
            time: data.time,
            sign: data.sign
        }));
        serverReq.end();
    });
}