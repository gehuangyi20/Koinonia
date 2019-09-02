let pg = require('pg');
let dbConfig = require('./dbConfig');
let schema = dbConfig.schema;

async function getElection(eid, pubKey) {
    const client = new pg.Client(dbConfig);
    let abort = true;

    try {
        await client.connect();
        console.log("connected");

        let result = await client.query(`SELECT * FROM ${schema}.election WHERE id = $1;`, [eid]);
        /* get election success */
        if(result.rowCount != 1) {
            return {
                code: -1,
                msg: "Election ${id} does not exist."
            };
        }
        let election = result.rows[0];
        let electionData = election.election_data;

        if(
            electionData === null ||
            electionData.state !== 3 ||
            election.summation === null
        ) {
            return {
                code: -4,
                msg: `The summation result of Election ${eid} has not been published.`
            };
        }

        electionData.summation = election.summation;
        electionData.auth = {
            hostname: election.auth_hostname,
            protocol: election.auth_protocol,
            port: election.auth_port,
            pubKey: election.auth_pub_key,
        };

        electionData.esp ={
            pubKey: pubKey,
            tunnelPort: election.tunnel_port
        };
        abort = false;
        return electionData;

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