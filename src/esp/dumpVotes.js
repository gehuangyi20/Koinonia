const pg = require('pg');
const dbConfig = require('./dbConfig');
const schema = dbConfig.schema;

async function dumpVotes(id, res) {
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
WHERE id = $1;`, [id]);
        if(
            result.rowCount != 1 ||
            result.rows[0].election_data === null ||
            result.rows[0].election_data.state !== 3
        ) {
            return {
                code: -1,
                msg: `Election ${id} does not exit, or has invalid state.`
            }
        }

        let canQuery = true;
        let lastVid = null;
        let limit = 1000;

        while(canQuery) {
            let sql, param;
            if (typeof lastVid === 'string') {
                sql =
`SELECT *, extract(epoch from reg_time::timestamptz) AS reg_time, \
extract(epoch from link_time::timestamptz) AS link_time, \
extract(epoch from vote_time::timestamptz) AS vote_time \
FROM ${schema}.votes WHERE eid = $1 AND rid > $2 ORDER BY rid ASC LIMIT $3;`;
                param = [id, lastVid, limit];
            } else {
                sql =
`SELECT *, extract(epoch from reg_time::timestamptz) AS reg_time, \
extract(epoch from link_time::timestamptz) AS link_time, \
extract(epoch from vote_time::timestamptz) AS vote_time \
FROM ${schema}.votes WHERE eid = $1  ORDER BY rid ASC LIMIT $2;`;
                param = [id, limit];
            }

            result = await client.query(sql, param);
            let i, il, rows = result.rows;
            for(i=0, il=rows.length; i<il; i++) {
                let row = rows[i];
                res.write(JSON.stringify({
                    rid: row.rid,
                    email: row.email,
                    reg_time: row.reg_time,
                    link_time: row.link_time,
                    link_sign: row.link_sign,
                    zs: row.data.zs,
                    proofs: row.data.proofs,
                    vote_time: row.vote_time
                }) + "\n");
            }

            if(il > 0) {
                lastVid = rows[il-1].rid;
            }
            if(il < limit) {
                canQuery = false;
            }
        }

        await client.query('COMMIT');
        console.log("commit");
        abort = false;

        return {
            code: 0,
            msg: "Dump Votes success."
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
        res.end();
    }
}

module.exports = dumpVotes;
