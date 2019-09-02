let pg = require('pg');
let dbConfig = require('./dbConfig');
let schema = dbConfig.schema;

async function getElection(id) {
    const client = new pg.Client(dbConfig);
    let abort = true;

    try {
        await client.connect();
        console.log("connected");

        let result = await client.query(`SELECT * FROM ${schema}.election WHERE id = $1;`, [id]);
        /* get election success */
        if(result.rowCount == 1) {
            let row = result.rows[0];
            abort = false;
            return {
                code: 0,
                id: row.id,
                authHostname: row.auth_hostname,
                authProtocol: row.auth_protocol,
                authPort: row.auth_port,
                authPubKey: row.auth_pub_key,
                tunnelPort: row.tunnel_port,
                summation: row.summation
            };
        } else {
            return  {
                code: -1,
                msg: "Election ${id} does not exist."
            };
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

module.exports = getElection;