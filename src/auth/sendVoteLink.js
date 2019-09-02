const pg = require('pg');
const dbConfig = require('./dbConfig');
const schema = dbConfig.schema;
const url = require('url');
const sendmail = require('sendmail')();
const util = require('../common/util');

async function sendVoteLink(espUrl, eid, email, pki) {

    try {
        espUrl = url.parse(espUrl);
        if(!util.validHttpProtocol(espUrl.protocol)) {
            throw "";
        }
    } catch (e) {
        return {
            code: -1,
            msg: 'The url of Teller Server is not valid.'
        };
    }

    const client = new pg.Client(dbConfig);
    let abort = true;

    try {
        await client.connect();
        console.log("connected");
        await client.query('BEGIN');
        console.log("begin");

        /* get the voter rid, identifier, reg_time, link_time, and link_sign
         * under condition that the election is open. */
        let result = await  client.query(
`SELECT voter.rid, \
extract(epoch from voter.reg_time::timestamptz) AS reg_time, \
extract(epoch from voter.link_time::timestamptz) AS link_time, \
voter.link_sign FROM ${schema}.voter, ${schema}.election \
WHERE voter.eid = $1 AND voter.identifier = $2 AND \
voter.eid = election.id AND election.state = 2;`,
            [eid, email]);

        if(result.rowCount != 1) {
            return {
                code: -3,
                msg: `${email} did not registered or election ${eid} does not open.`,
            }
        }

        let row = result.rows[0];
        let rid = row.rid;
        let reg_time = row.reg_time;
        let link_time = row.link_time;
        let link_sign = row.link_sign;

        /* sign the email + rid + reg_time + link_time */
        if(link_sign == null) {
            link_time = Date.now() / 1000;
            link_sign = pki.sign(`${eid}${email}${rid}${reg_time}${link_time}`);
            result = await client.query(
`UPDATE ${schema}.voter SET link_time = to_timestamp($3), link_sign = $4 \
WHERE eid = $1 AND rid = $2;`,
                [eid, rid, link_time, link_sign]);
            if(result.rowCount == 1) {
                await client.query('COMMIT');
                console.log("commit");
                abort = false;
            } else {
                return {
                    code: -4,
                    msg: "Database issue."
                };
            }
        } else {
            await client.query('COMMIT');
            console.log("commit");
            abort = false;
        }

        let link =
`${espUrl.protocol}//${espUrl.hostname}${espUrl.port ? `:${espUrl.port}` : ''}\
/election/${eid}/vote\
?email=${encodeURIComponent(email)}&rid=${rid}&reg_time=${reg_time}&link_time=${link_time}&link_sign=${encodeURIComponent(link_sign)}`;
        console.log(link);

        return await new Promise( (resolve, reject) => {
            sendmail({
                from: `no-reply@${espUrl.hostname}`,
                to: email,
                subject: `Election ${eid} is open. Please Vote`,
                html: `Your vote link is <br/><a href="${link}">${link}</a>`
            }, function(err, reply) {
                if(err) {
                    console.log(err);
                    return resolve({
                        code: -5,
                        msg: `Fail to send the email to ${email}.`
                    });
                } else {
                    console.log(reply);
                    return resolve({
                        code: 0,
                        msg: 'Email is sent. Check your email and vote!'
                    });
                }
            });
        });

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

module.exports = sendVoteLink;