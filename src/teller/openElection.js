const pg = require('pg');
const dbConfig = require('./dbConfig');
const util = require('../common/util');

async function openElection(data, pki) {
    if(!util.validateElectionOpenInfoFormat(data)) {
        return {
            code: -2,
            msg: "Election info is not valid."
        };
    }

    if(!util.validateTellerInfoFormat(data.teller)) {
        return {
            code: -3,
            msg: "Election tellers are not valid."
        };
    }

    const schema = dbConfig.schema;
    const client = new pg.Client(dbConfig);
    let abort = true;

    try {
        await client.connect();
        console.log("connected");
        await client.query('BEGIN');
        console.log("begin");

        let id = data.id;
        let result = await client.query(
            `SELECT * FROM ${schema}.election WHERE id = $1;`,
            [data.id]);

        if(result.rowCount != 1) {
            return {
                code: -4,
                msg: `Election ${id} does not exit.`
            };
        }

        let rowData = result.rows[0];
        let elecData = rowData.election_data;
        let authPubKey = rowData.auth_pub_key;

        if(elecData.state == 2) {
            return {
                code: 0,
                msg: `Election ${id} is opened.`
            };
        }

        if(elecData.state != 1) {
            return {
                code: -5,
                msg: `Election ${id} has invalid state.`
            };
        }

        /* validate election signature */
        let tellerStr = util.getTellerInfoStr(data.teller);
        let tellerSign = data.teller_sign;
        let elecFreezeStr = util.getElectionInfoStr(data, 1);
        let storedElecFreezeStr = util.getElectionInfoStr(elecData);
        let elecFreezeSign = data.freeze_sign;
        let elecOpenStr = util.getElectionOpenInfoStr(data);
        let elecOpenSign = data.open_sign;

        if( !(elecData.freeze_sign === elecFreezeSign &&
            storedElecFreezeStr === elecFreezeStr &&
            pki.verify(tellerStr, tellerSign, authPubKey) &&
            pki.verify(elecOpenStr, elecOpenSign, authPubKey))) {

            return {
                code: -6,
                msg: `Election ${id} info has invalid signature.`
            };
        }

        result = await client.query(
            `UPDATE ${schema}.election SET election_data = $1 WHERE id = $2;`,
            [util.getElectionOpenInfo(data), id]
        );

        if(result.rowCount == 1) {
            await client.query('COMMIT');
            console.log("commit");
            abort = false;
            return {
                code: 0,
                msg: `Election ${id} opens success.`
            };
        } else {
            return {
                code: -7,
                msg: "Database issue."
            };
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

module.exports = openElection;