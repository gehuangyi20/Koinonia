const pg = require('pg');
const readlineSync = require('../common/readlineSync');
const crypto = require('crypto');
const base64url = require('base64url');
const PKI = require("../common/PKI");
const dbConfig = require('./dbConfig');
const schema = dbConfig.schema;

const eid = parseInt(process.argv[2]);
const filename = process.argv[3];
const password = process.argv[4];
const keyFileName = process.argv[5];

const client = new pg.Client(dbConfig);
let lineCount = 0, successCount = 0;

let pki;
try {
    pki = new PKI(keyFileName, password);
    console.log("public/private key loaded");
} catch (e) {
    console.log("Fail to load public/private key");
    return;
}

(async function () {
    const regTime = Date.now() / 1000;
    const signTime = regTime + 1;

    await client.connect();
    console.log("connected");
    await client.query('BEGIN');
    console.log("begin");
    let row = await client.query(
        `SELECT FROM ${schema}.election WHERE id = $1 AND state = 1 AND is_voter_sign = false;`, [eid]);
    if(row.rowCount != 1) {
        throw `Election ${eid} is not existed or has invalid state.`;
    }

    let voterList;
    try {
        voterList = new readlineSync(filename);
    } catch (e) {
        throw `cannot open file ${filename}`;
    }

    let line;
    while((line = voterList.getline()) !== null) {
        let rid = base64url(crypto.randomBytes(32));
        let link_sign = pki.sign(`${eid}${line}${rid}${regTime}${signTime}`);
        let result = await client.query(
`INSERT INTO ${schema}.voter \
(eid , identifier, rid, reg_time, link_time, link_sign) \
VALUES ($1, $2, $3, to_timestamp($4), to_timestamp($5), $6) 
ON CONFLICT DO NOTHING;;`,
                [eid, line, rid, regTime, signTime, link_sign]);
        lineCount ++;
        if(result.rowCount == 1) {
            successCount ++;
        } else {
            console.log(`insert email ${line} fail at line ${lineCount}.`);
        }
    }

    row = await client.query(
`UPDATE ${schema}.election SET voter_count = voter_count + $1 \
WHERE id = $2 AND state = 1;`, [successCount, eid]);
    if(row.rowCount != 1) {
        await client.query('ROLLBACK');
        lineCount = 0;
        throw `Election ${eid} is not existed or has invalid state.`;
    } else {
        await client.query('COMMIT');
        console.log("commit");
    }
    await client.end();
    console.log(`Insert ${successCount} voters`);
})()
    .catch(function (e) {
        console.log(e);
        client.end();
    });