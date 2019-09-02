const pg = require('pg');
const crypto = require('crypto');
const validator = require('validator');
const base64url = require('base64url');
const dbConfig = require('./dbConfig');
const schema = dbConfig.schema;

async function regVoter(id, voters) {
    let data = {};
    const client = new pg.Client(dbConfig);
    const regTime = Date.now() / 1000;

    try {
        await client.connect();
        console.log("connected");
        await client.query('BEGIN');
        console.log("begin");
        let row = await client.query(
`SELECT FROM ${schema}.election \
WHERE id = $1 AND state = 1 AND is_voter_sign = false;`, [id]);
        if(row.rowCount != 1) {
            throw {
                code: -1,
                msg: `Cannot register voters, Election ${id} is not existed or has invalid state.`
            };
        }

        let regResult = voters.map(async function (voter) {
            /* remove empty space and validate email address format */
            voter = voter.trim();
            if(voter === "" || !validator.isEmail(voter)) {
                return {
                    voter: voter,
                    valid: false,
                    count: 0
                };
            }

            /* generate 256bits random id */
            let rid = base64url(crypto.randomBytes(32));
            let result = await client
                .query({
                    text:
`INSERT INTO ${schema}.voter \
(eid , identifier, rid, reg_time) \
VALUES ($1, $2, $3, to_timestamp($4)) ON CONFLICT DO NOTHING;`,
                    name: "insert vote",
                    values: [id, voter, rid, regTime]
                });

            return {
                voter: voter,
                valid: true,
                count: result.rowCount
            };
        });

        let count = 0;
        let failEmail = [];
        let invalidEmail = [];
        for(const index of regResult){
            let result = await index;
            if(result.count) {
                count += result.count;
            } else {
                let email = result.voter;
                if(result.valid) {
                    failEmail.push(email);
                } else {
                    if(email !== "") {
                        invalidEmail.push(result.voter);

                    }
                }
            }
        }

        row = await client.query(
`UPDATE ${schema}.election SET voter_count = voter_count + $1 \
WHERE id = $2 AND state = 1 AND is_voter_sign = false;`, [count, id]);
        if(row.rowCount == 1) {
            await client.query('COMMIT');
            console.log("commit");
            data.code = 0;
            data.count = count;
            data.dupVoter = failEmail;
            data.invalidVoter = invalidEmail;
        } else {
            await client.query('ROLLBACK');
            console.log("rollback");
            data = {
                code: -1,
                msg: `Cannot register voters, Election ${id} is not existed or has invalid state.`
            };
        }
    } catch (e) {
        console.log(e);
        await client.query('ROLLBACK');
        console.log("rollback");
        data = {
            code: -2,
            msg: "Server is temporary unavailable."
        };
    } finally {
        await client.end();
    }

    return data;
}

module.exports = regVoter;