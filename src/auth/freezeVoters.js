const pg = require('pg');
const dbConfig = require('./dbConfig');
const schema = dbConfig.schema;
const crypto = require('crypto');

async function freezeVoters(id, pki) {
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
WHERE id = $1 AND state = 1 AND is_voter_sign = false;`, [id]);
        if(result.rowCount != 1) {
            return {
                code: -1,
                msg: `Election ${id} does not exit, has signed voters, or has invalid state.`
            }
        }

        const signStream = pki.createSignStream();
        let canQuery = true;
        let lastVid = null;
        let limit = 1000;

        while(canQuery) {
            let sql, param;
            if(typeof lastVid === 'string') {
                sql =
`SELECT *, extract(epoch from reg_time::timestamptz) AS reg_time \
FROM ${schema}.voter WHERE eid = $1 AND rid > $2 ORDER BY rid ASC LIMIT $3;`;
                param = [id, lastVid, limit];
            } else {
                sql =
`SELECT *, extract(epoch from reg_time::timestamptz) AS reg_time \
FROM ${schema}.voter WHERE eid = $1  ORDER BY rid ASC LIMIT $2;`;
                param = [id, limit];
            }

            result = await client.query(sql, param);
            let i, il, rows = result.rows;
            for(i=0, il=rows.length; i<il; i++) {
                let row = rows[i];
                signStream.update(`${row.identifier}\t${row.rid}\t${row.reg_time}\n`);
            }

            if(il > 0) {
                lastVid = rows[il-1].rid;
            }
            if(il < limit) {
                canQuery = false;
            }
        }

        let voterSign = signStream.final();
        console.log(voterSign);

        /* update election state */
        result = await client.query(
`UPDATE ${schema}.election SET voter_sign = $2, is_voter_sign = true \
WHERE id = $1 AND state = 1 AND is_voter_sign = false;`, [id, voterSign]);
        if(result.rowCount == 1) {
            await client.query('COMMIT');
            console.log("commit");
            abort = false;
            return {
                code: 0,
                msg: "Freeze Voters success.",
                voter_sign: voterSign
            }
        } else {
            return {
                code: -1,
                msg: `Election ${id} does not exit, has signed voters, or has invalid state.`
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

module.exports = freezeVoters;