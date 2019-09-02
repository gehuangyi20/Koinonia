const http = require('http');
const https = require('https');
const url = require('url');
const pg = require('pg');
const dbConfig = require('./dbConfig');
const util = require('../common/util');
const schema = dbConfig.schema;

async function createElection(pki, body) {
    let data;
    try{
        data = await reqAuthPublicKey(pki, body);
    } catch(e) {
        return e;
    }

    let authUrl = data.authUrl;
    const client = new pg.Client(dbConfig);
    let abort = true;

    try {
        await client.connect();
        console.log("connected");
        let result = await client.query(
`INSERT INTO ${schema}.election \
(auth_hostname, auth_protocol, auth_port, tunnel_port, auth_pub_key) \
VALUES ($1, $2, $3, $4, $5) RETURNING id;`,
            [authUrl.hostname, authUrl.protocol, authUrl.port,
                data.tunnelPort, data.authPubKey]);

        /* insert success */
        if(result.rowCount == 1) {
            abort = false;
            return {
                code: 0,
                id: result.rows[0].id,
                msg: "register success"
            };
        } else {
            return {
                code: -2,
                msg: "database issue, maybe caused by duplicated election."
            };
        }
    } catch (e) {
        console.log(e);
        return {
            code: -6,
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

function reqAuthPublicKey(pki, body) {
    return new Promise(function (resolve, reject) {
        let tunnelPort = parseInt(body.tunnelPort, 10);
        if( !util.validPort(tunnelPort) ) {
            return reject({
                code: -1,
                msg: 'Tunnel Port must be [1-65535].'
            });
        }

        let authServer = body.authServer;
        let authServerUrl = url.parse(authServer);

        try {
            authServerUrl = url.parse(authServer);
            if(!util.validHttpProtocol(authServerUrl.protocol)) {
                throw "";
            }
        } catch(e) {
            return reject({
                code: -5,
                msg: 'The url of Auth Server is not valid.'
            });
        }

        let authUrl = authServerUrl;
        let token = util.generateToken();
        let options = {
            hostname : authUrl.hostname,
            protocol : authUrl.protocol,
            port: authUrl.port,
            path: authUrl.path + 'verifyPubKey',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        let protocol = authUrl.protocol === 'http:' ? http : https;

        let authReq = protocol.request(options, function(authRes) {
            let rawData = '';
            authRes.setEncoding('utf8');
            authRes.on('data', (chunk) => rawData += chunk);
            authRes.on('end', function() {
                try {
                    let authResData = JSON.parse(rawData);
                    if(util.pkovVerifyPubKey(pki, token, authResData)) {
                        let data = {
                            tunnelPort: tunnelPort,
                            authUrl: authServerUrl,
                            authPubKey: authResData.pubKey,
                        };
                        return resolve(data);
                    } else {
                        throw "";
                    }
                } catch (e) {
                    console.log(e.message);
                    return reject({
                        code: -4,
                        msg: 'Auth Server ' + util.urlToOrigin(authUrl) + ' cannot register this election.'
                    });
                }
            });
        });

        authReq.on('error', (e) => {
            console.log(`problem with request: ${e.message}`);
            return reject({
                code: -3,
                msg: 'Auth Server ' + options.protocol + '//' + options.hostname +
                (options.port ? ':' + options.port : '') + ' is temporarily unavailable.'
            });
        });

        authReq.setTimeout(5000, function() {
            console.log("timeout");
            authReq.abort();
        });

        authReq.write(JSON.stringify({token: token}));
        authReq.end();
    });
}

module.exports = createElection;
