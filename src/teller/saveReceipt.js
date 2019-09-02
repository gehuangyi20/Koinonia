const pg = require('pg');
const dbConfig = require('./dbConfig');

async function saveReceipt(receipt, pki) {

    if(!(
        typeof receipt === 'object' &&
        Number.isInteger(receipt.eid) &&
        Number.isFinite(receipt.time) &&
        typeof receipt.rid === 'string' &&
        typeof receipt.sign === 'string' &&
        typeof receipt.commitSign === 'string'
    )) {
        return {
            code: -2,
            msg: "Invalid receipt."
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

        let eid = receipt.eid;
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

        result = await client.query(
`SELECT eid, rid, email, \
extract(epoch from reg_time::timestamptz) AS reg_time, \
extract(epoch from link_time::timestamptz) AS link_time, \
link_sign, \
extract(epoch from vote_time::timestamptz) AS vote_time, \
receipt_sign
FROM ${schema}.votes WHERE eid = $1 AND rid = $2 AND vote_sign = $3`,
            [eid, receipt.rid, receipt.commitSign]);

        if(result.rowCount != 1) {
            return {
                code: -5,
                msg: `Share does not exit.`
            };
        }

        let shareData = result.rows[0];
        if(shareData.receipt_sign !== null) {
            abort = false;
            return {
                code: -6,
                msg: `Receipt has already received.`
            };
        }

        let str =
`${shareData.eid}${shareData.email}${shareData.rid}${shareData.reg_time}\
${shareData.link_time}${shareData.link_sign}${receipt.time}`;

        if(
            receipt.time <= shareData.vote_time ||
            !pki.verify(str, receipt.sign, electionData.esp_pub_key)
        ) {
            return {
                code: -6,
                msg: `Receipt is not valid.`
            };
        }

        result = await client.query(
`UPDATE ${schema}.votes SET receipt_time = to_timestamp($4), receipt_sign = $5\
WHERE eid = $1 AND rid = $2 AND vote_sign = $3`,
            [eid, receipt.rid, receipt.commitSign, receipt.time, receipt.sign]);

        if(result.rowCount == 1) {
            await client.query('COMMIT');
            console.log("commit");
            abort = false;
            return {
                code: 0,
                msg: "receipt is received"
            }
        } else {
            return {
                code: -7,
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

module.exports = saveReceipt;