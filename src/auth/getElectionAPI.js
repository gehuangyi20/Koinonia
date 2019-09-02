const pg = require('pg');
const dbConfig = require('./dbConfig');
const getElection = require('./getElectionV2');

async function getElectionAPI(id) {
    let data = {};
    const client = new pg.Client(dbConfig);
    try {
        await client.connect();
        console.log("connected");
        await client.query('BEGIN');
        console.log("begin");
        data = await getElection(id, client);
        await client.query('COMMIT');
        console.log("commit");
    } catch (e) {
        console.log(e);
        console.log("abort");
    } finally {
        await client.end();
    }
    return data;
}
module.exports = getElectionAPI;