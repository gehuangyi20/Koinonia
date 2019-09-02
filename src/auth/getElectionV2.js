const dbConfig = require('./dbConfig');

async function getElection(id, client) {
    const schema = dbConfig.schema;
    let data = {};

    /* election info */
    let result = await client.query(
`SELECT *, extract(epoch from create_time::timestamptz) AS create_time, \
extract(epoch from update_time::timestamptz) AS update_time, \
extract(epoch from freeze_time::timestamptz) AS freeze_time, \
extract(epoch from open_time::timestamptz) AS open_time, \
extract(epoch from close_time::timestamptz) AS close_time \
FROM ${schema}.election WHERE id = $1;`, [id]);
    if(result.rowCount != 1) {
        throw "Election " + id + " is not existed";
    }
    let row = result.rows[0];
    data.id = row.id;
    data.name = row.name;
    data.state = row.state;
    data.create_time = row.create_time;
    data.update_time = row.update_time;
    data.freeze_time = row.freeze_time;
    data.open_time = row.open_time;
    data.open_sign = row.open_sign;
    data.close_time = row.close_time;
    data.close_sign = row.close_sign;
    data.summation = row.summation;
    data.is_verified = row.is_verified;
    data.verify_result = row.verify_result;
    data.tunnel_port = row.tunnel_port;
    data.freeze_sign = row.freeze_sign;
    data.voter_count = row.voter_count;
    data.is_voter_sign = row.is_voter_sign;
    data.voter_sign = row.voter_sign;
    data.is_teller_sign = row.is_teller_sign;
    data.teller_sign = row.teller_sign;

    /* position info */
    result = await client.query(
`SELECT *, extract(epoch from create_time::timestamptz) AS create_time, \
extract(epoch from update_time::timestamptz) AS update_time \
FROM ${schema}.elec_position WHERE eid = $1 ORDER BY pid ASC;`, [id]);
    data.pos = result.rows;

    /* candidate info */
    result = await client.query(
`SELECT *, extract(epoch from create_time::timestamptz) AS create_time, \
extract(epoch from update_time::timestamptz) AS update_time \
FROM ${schema}.candidate WHERE eid = $1 ORDER BY cid ASC;`, [id]);
    data.cand = result.rows;

    /* candidate position mapping */
    result = await client.query(
`SELECT * FROM ${schema}.position_candidate_map \
WHERE eid = $1 ORDER BY pid ASC, cid ASC;`, [id]);
    data.posCandMapping = result.rows;

    /* teller info */
    result = await client.query(
`SELECT *, extract(epoch from reg_time::timestamptz) AS reg_time \
FROM ${schema}.teller WHERE eid = $1 ORDER BY hostname, port;`, [id]);
    data.teller = result.rows;

    return data;
}

module.exports = getElection;