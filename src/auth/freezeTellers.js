const pg = require('pg');
const util = require('../common/util');
const dbConfig = require('./dbConfig');
const schema = dbConfig.schema;
const crypto = require('crypto');

async function freezeTellers(id, pki) {
    const client = new pg.Client(dbConfig);
    let abort = true;

    try {
        await client.connect();
        console.log("connected");
        await client.query('BEGIN');
        console.log("begin");

        /* check election state */
        let result = await client.query(
`SELECT * FROM ${schema}.election \
WHERE id = $1 AND state = 1 AND is_teller_sign = false;`, [id]);
        if(result.rowCount != 1) {
            return {
                code: -1,
                msg: `Election ${id} does not exit, has signed tellers, or has invalid state.`
            }
        }

        /* get Tellers */
        result = await client.query(
`SELECT *, extract(epoch from reg_time::timestamptz) AS reg_time \
FROM ${schema}.teller WHERE eid = $1 ORDER BY hostname, port;`, [id]);
        let tellerStr = util.getTellerInfoStr(result.rows);
        let tellerSign = pki.sign(tellerStr);

        /* update election state */
        result = await client.query(
`UPDATE ${schema}.election SET teller_sign = $2, is_teller_sign = true \
WHERE id = $1 AND state = 1 AND is_teller_sign = false;`, [id, tellerSign]);
        if(result.rowCount == 1) {
            await client.query('COMMIT');
            console.log("commit");
            abort = false;
            return {
                code: 0,
                msg: "Freeze Tellers success.",
                teller_sign: tellerSign
            }
        } else {
            return {
                code: -1,
                msg: `Election ${id} does not exit, has signed tellers, or has invalid state.`
            };
        }
    } catch (e) {
        console.log(e);
        return {
            code: -2,
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

module.exports = freezeTellers;