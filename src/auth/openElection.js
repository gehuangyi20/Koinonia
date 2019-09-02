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
            path: `/election/open`,
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
                        /* open election on remote server success */
                        return resolve();
                    } else {
                        throw resData.msg;
                    }
                } catch (e) {
                    return reject({
                        code: -8,
                        msg: typeof e === 'string' ? e : 'Remote Server cannot open this election.'
                    });
                }
            });
        });

        req.on('error', (e) => {
            console.log(`problem with request: ${e.message}`);
            return reject({
                code: -7,
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

async function openElection(id, espUrl, pki) {
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

        if(data.state != 1) {
            return {
                code: -4,
                msg: `Election ${id} has invalid state.`
            };
        }

        if(!data.is_voter_sign) {
            return {
                code: -5,
                msg: `Election ${id} does not sign voters.`
            };
        }

        if(!data.is_teller_sign) {
            return {
                code: -6,
                msg: `Election ${id} does not sign tellers.`
            };
        }

        let time = Date.now() / 1000;
        let retry = false;
        data.state = 2;

        if(data.open_sign) {
            retry = true;
        } else {
            data.open_time = time;
        }

        let electionInfo = util.getElectionOpenInfo(data);
        let electionInfoStr = util.getElectionOpenInfoStr(data);
        let electionInfoSign = retry ? data.open_sign : pki.sign(electionInfoStr);
        let tellers = util.getTellerInfo(data.teller);
        electionInfo.teller = tellers;
        electionInfo.open_sign = electionInfoSign;

        /* try to open the election on all tellers and the ESP. Requests are in parallel. */
        let state = 2;
        try {
            let reqs  = [];
            reqs.push( sendElectionInfoToRemote(espUrl, electionInfo) );
            for(let i=0,il=tellers.length; i<il; i++) {
                reqs.push( sendElectionInfoToRemote(tellers[i], electionInfo) );
            }
            await Promise.all(reqs);
        } catch (e) {
            console.log(e);
            state = 1;
        }

        /* success state = 2, otherwise state = 1, open time is updated in the first try. */
        let result = await client.query(
`UPDATE ${schema}.election SET state=$5, \
update_time=to_timestamp($3), open_time=to_timestamp($4), open_sign=$2 \
WHERE id = $1;`, [id, electionInfoSign, time, data.open_time, state]);

        if(result.rowCount == 1) {
            await client.query('COMMIT');
            console.log("commit");
            abort = false;
            if(state == 2) {
                return {
                    code: 0,
                    msg: "Open election success."
                };
            } else {
                return {
                    code: -10,
                    msg: "Having issue for opening election on remote server, please try it again."
                };
            }
        } else {
            return {
                code: -9,
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

module.exports = openElection;