const pg = require('pg');
const http = require('http');
const https = require('https');
const url = require('url');
const dbConfig = require('./dbConfig');
const schema = dbConfig.schema;
const getElection = require('./getElectionV2');
const util = require('../common/util');

function sendElectionInfoToRemote(serverUrl, data) {
    return new Promise( (resolve, reject) => {
        let options = {
            hostname : serverUrl.hostname,
            protocol : serverUrl.protocol,
            port: serverUrl.port,
            path: `/election/close`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        let protocol = serverUrl.protocol === 'http:' ? http : https;
        let req = protocol.request(options, function(res) {
            let rawData = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => rawData += chunk);
            res.on('end', function() {
                try {
                    let resData = JSON.parse(rawData);
                    if(resData.code == 0) {
                        /* close election on remote server success */
                        return resolve();
                    } else {
                        throw resData.msg;
                    }
                } catch (e) {
                    return reject({
                        code: -6,
                        msg: typeof e === 'string' ? e : 'Remote Server cannot close this election.'
                    });
                }
            });
        });

        req.on('error', (e) => {
            console.log(`problem with request: ${e.message}`);
            return reject({
                code: -5,
                msg: `Server ${options.hostname}:${options.port} is temporarily unavailable.`
            });
        });
        req.setTimeout(5000, function() {
            console.log("timeout");
            req.abort();
        });
        req.write(JSON.stringify(data));
        req.end();
    });
}

async function closeElection(id, espUrl, pki) {
    try {
        espUrl = url.parse(espUrl);
        if(!util.validHttpProtocol(espUrl.protocol)) {
            throw "";
        }
    } catch (e) {
        return {
            code: -2,
            msg: 'The url of ESP Server is not valid.'
        };
    }

    const client = new pg.Client(dbConfig);
    let abort = true;

    try {
        await client.connect();
        console.log("connected");
        await client.query('BEGIN');
        console.log("begin");
        let data = await getElection(id, client);
        if (!data.id) {
            return {
                code: -3,
                msg: `Election ${id} does not exit.`
            };
        }

        if(data.state != 2) {
            return {
                code: -4,
                msg: `Election ${id} has invalid state.`
            };
        }

        let time = Date.now() / 1000;
        let retry = false;
        let close_time = time;
        data.state = 3;

        if(data.close_sign) {
            retry = true;
            close_time = data.close_time;
        } else {
            data.close_time = close_time;
        }

        let electionInfoStr = util.getElectionCloseInfoStr(data);
        let electionInfoSign = retry ? data.close_sign : pki.sign(electionInfoStr);
        let info = {
            id: data.id,
            close_time: close_time,
            close_sign: electionInfoSign
        };
        let tellers = data.teller;

        /* try to close the election on all tellers and the ESP. Requests are in parallel. */
        let state = 3;
        try {
            let reqs  = [];
            reqs.push( sendElectionInfoToRemote(espUrl, info) );
            for(let i=0,il=tellers.length; i<il; i++) {
                reqs.push( sendElectionInfoToRemote(tellers[i], info) );
            }
            await Promise.all(reqs);
        } catch (e) {
            console.log(e);
            state = 2;
        }

        /* success state = 3, otherwise state = 2, open time is updated in the first try. */
        let result = await client.query(
`UPDATE ${schema}.election SET state=$5, \
update_time=to_timestamp($3), close_time=to_timestamp($4), close_sign=$2 \
WHERE id = $1;`, [id, electionInfoSign, time, close_time, state]);

        if(result.rowCount == 1) {
            await client.query('COMMIT');
            console.log("commit");
            abort = false;
            if(state == 3) {
                return {
                    code: 0,
                    msg: "Close election success."
                };
            } else {
                return {
                    code: -9,
                    msg: "Having issue for closing election on remote server, please try it again."
                };
            }
        } else {
            return {
                code: -8,
                msg: "Database issue."
            };
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

module.exports = closeElection;