const pg = require('pg');
const dbConfig = require('./dbConfig');
const util = require('../common/util');

async function closeElection(data, pki) {
    let invalidInfo = {
        code: -2,
        msg: "Election closing info is not valid."
    };

    if(
        (typeof data !== 'object') ||
        (!Number.isInteger(data.id)) ||
        (typeof data.close_sign !== 'string') ||
        (typeof data.close_time !== 'number')
    ) {
        return invalidInfo;
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
                code: -3,
                msg: `Election ${id} does not exit.`
            }
        }

        let rowData = result.rows[0];
        let elecData = rowData.election_data;
        let authPubKey = rowData.auth_pub_key;

        if(elecData.state == 3) {
            return {
                code: 0,
                msg: `Election ${id} is opened.`
            };
        }

        if(elecData.state != 2) {
            return {
                code: -4,
                msg: `Election ${id} has invalid state.`
            };
        }

        if(data.close_time <= data.open_time) {
            return invalidInfo;
        }

        elecData.state = 3;
        elecData.close_time = data.close_time;
        elecData.close_sign = data.close_sign;
        let elecCloseStr = util.getElectionCloseInfoStr(elecData);
        let elecCloseSign = data.close_sign;

        if( !pki.verify(elecCloseStr, elecCloseSign, authPubKey) ) {
            return {
                code: -5,
                msg: `Election ${id} info has invalid signature.`
            };
        }

        result = await client.query(
            `UPDATE ${schema}.election SET election_data = $1 WHERE id = $2;`,
            [elecData, id]
        );

        if(result.rowCount == 1) {
            await client.query('COMMIT');
            console.log("commit");
            abort = false;
            return {
                code: 0,
                msg: `Election ${id} closes success.`
            };
        } else {
            return {
                code: -6,
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

module.exports = closeElection;