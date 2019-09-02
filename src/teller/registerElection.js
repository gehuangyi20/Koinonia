const pg = require('pg');
const http = require('http');
const https = require('https');
const url = require('url');
const dbConfig = require('./dbConfig');
const util = require('../common/util');

async function registerElection(data, pki) {
    let elecId = parseInt(data.id);
    let elecName = data.name;
    let state = data.state;

    if (elecId == null || elecName == null || state != 1
        || !util.validateElectionInfoFormat(data)) {
        return {
            code: -1,
            msg: "invalid election"
        };
    }

    if(typeof data.token !== "string" || data.token.length > 32) {
        return {
            code: -5,
            msg: "invalid token"
        };
    }

    let espUrl, authUrl;
    try {
        espUrl = url.parse(data.espUrl);
        if (!util.validHttpProtocol(espUrl.protocol)) {
            throw "";
        }
        authUrl = url.parse(data.authUrl);
        if (!util.validHttpProtocol(authUrl.protocol)) {
            throw "";
        }
    } catch (e) {
        return {
            code: -7,
            msg: 'The url of Auth/ESP Server is not valid.'
        };
    }

    let schema = dbConfig.schema;
    let client = new pg.Client(dbConfig);
    let abort = true;

    try {
        await client.connect();
        console.log("connected");
        await client.query('BEGIN');
        console.log("begin");

        let result = await client.query(
            'SELECT * FROM ' + schema + '.election WHERE id = $1',
            [elecId]);
        if(result.rowCount == 1) {
            return {
                code: -2,
                msg: "database issue, maybe caused by duplicated election."
            }
        }

        let espPubKey, authPubKey;
        try {
            let remotePubKeys = await Promise.all([
                reqPublicKey(espUrl, 'ESP', pki),
                reqPublicKey(authUrl, 'Auth', pki)
            ]);
            espPubKey = remotePubKeys[0];
            authPubKey = remotePubKeys[1];
        } catch (e) {
            console.log(e);
            return e;
        }

        let elecStr = util.getElectionInfoStr(data, 1);
        if(!pki.verify(elecStr, data.freeze_sign, authPubKey)) {
            return {
                code: -4,
                msg: 'The election Info is not valid.'
            };
        }
        let elecInfo = util.getElectionInfo(data);
        espUrl = {
            hostname: espUrl.hostname,
            protocol: espUrl.protocol,
            port: espUrl.port
        };
        authUrl = {
            hostname: authUrl.hostname,
            protocol: authUrl.protocol,
            port: authUrl.port
        };

        /* save the election and esp public key on the teller server */
        result = await client.query(
`INSERT INTO ${schema}.election \
(id, esp_pub_key, auth_pub_key, esp_url, auth_url, election_data) \
VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING;`,
            [elecId, espPubKey, authPubKey, espUrl, authUrl, elecInfo]);

        if(result.rowCount == 1) {
            await client.query('COMMIT');
            console.log("commit");
            abort = false;

            let ret = util.pkovSignToken(pki, data.token);
            ret.code = 0;
            ret.msg = "register success";
            return ret;
        } else {
            return {
                code: -2,
                msg: "database issue, maybe caused by duplicated election."
            }
        }
    } catch (e) {
        console.log(e);
        return {
            code: -8,
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

function reqPublicKey(serverUrl, serverName, pki) {
    return new Promise(function (resolve, reject) {
        let token = util.generateToken();
        let options = {
            hostname: serverUrl.hostname,
            protocol: serverUrl.protocol,
            port: serverUrl.port,
            path: serverUrl.path + 'verifyPubKey',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        let protocol = serverUrl.protocol === 'http:' ? http : https;
        let serverReq = protocol.request(options, function (serverRes) {
            let rawData = '';
            serverRes.setEncoding('utf8');
            serverRes.on('data', (chunk) => rawData += chunk);
            serverRes.on('end', function () {
                try {
                    let resData = JSON.parse(rawData);
                    let serverPubKey = resData.pubKey;

                    if (util.pkovVerifyPubKey(pki, token, resData)) {
                        return resolve(serverPubKey);
                    } else {
                        throw `The public key of \
${serverUrl.protocol}//${serverUrl.hostname}\
${serverUrl.port ? `:${serverUrl.port}` : ''} is not valid`;
                    }
                } catch (e) {
                    console.log(e);
                    return reject({
                        code: -6,
                        msg: 'The public key of the ' + serverName + ' server is not valid'
                    });
                }
            });
        });

        serverReq.on('error', (e) => {
            console.log(`problem with request: ${e.message}`);
            return reject({
                code: -3,
                msg: serverName + ' ' + options.protocol + '//' +
                    options.hostname + ":" + options.port + " is temporarily unavailable."
            });
        });

        /* there is no need to tell the teller other tellers' information */
        serverReq.setTimeout(5000, function () {
            console.log("timeout");
            serverReq.abort();
        });
        serverReq.write(JSON.stringify({token: token}));
        serverReq.end();
    });
}

module.exports = registerElection;