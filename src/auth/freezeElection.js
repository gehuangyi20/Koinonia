const pg = require('pg');
const dbConfig = require('./dbConfig');
const schema = dbConfig.schema;
const getElection = require('./getElectionV2');
const util = require('../common/util');

async function freezeElection(id, pki) {
    const client = new pg.Client(dbConfig);

    try {
        await client.connect();
        console.log("connected");
        await client.query('BEGIN');
        console.log("begin");
        let data = await getElection(id, client);
        if( (!data.id) || (data.state != 0) ) {
            throw `Election ${id} does not exit or has invalid state.`;
        }

        let time = Date.now() / 1000;
        data.freeze_time = time;
        let electionInfoStr = util.getElectionInfoStr(data, 1);
        let electionInfoSign = pki.sign(electionInfoStr);

        let result = await client.query(
`UPDATE ${schema}.election SET state=1, \
update_time=to_timestamp($3), freeze_time=to_timestamp($4), freeze_sign=$2 \
WHERE id = $1 AND state = 0;`,
            [id, electionInfoSign, time, time]);

        /* update success */
        if(result.rowCount == 1) {
            await client.query('COMMIT');
            console.log("commit");
            return {
                code: 0,
                sign: electionInfoSign,
                msg: `election ${id} is frozen.`
            }
        } else {
            throw `Cannot freeze election ${id}.`;
        }

    } catch (e) {
        console.log(e);
        console.log("abort");

        return {
            code: -1,
            msg:
`election ${id} is frozen fail (due to server issues, \
election not exist, or invalid election state).`
        };
    } finally {
        await client.end();
    }
}

module.exports = freezeElection;