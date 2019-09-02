let pg = require('pg');
let dbConfig = require('./dbConfig');
const http = require('http');
const https = require('https');
const url = require('url');
const querystring = require('querystring');
const getElection = require('./getElectionV2');
const util = require('../common/util');

async function sendElectionToTeller(body, data, pki) {
    return new Promise( (resolve, reject) => {
        let tellerUrl = body.url;
        let tellerParsedUrl;

        try {
            tellerParsedUrl = url.parse(tellerUrl);
            if(!util.validHttpProtocol(tellerParsedUrl.protocol)) {
                throw "";
            }
        } catch (e) {
            return reject({
                code: -7,
                msg: 'The url of Teller Server is not valid.'
            });
        }

        let options = {
            hostname : tellerParsedUrl.hostname,
            protocol : tellerParsedUrl.protocol,
            port: tellerParsedUrl.port,
            path: tellerParsedUrl.path+'register',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        let protocol = tellerParsedUrl.protocol === 'http:' ? http : https;

        /* check whether teller has been registered. */
        let tellers = data.teller;
        let curTeller;
        let i, il;
        for(i=0, il=tellers.length; i<il; i++) {
            curTeller = tellers[i];
            if(curTeller.hostname == options.hostname && curTeller.port == options.port) {
                return reject({
                    code: -2,
                    msg: `Teller ${options.hostname}:${options.port} has already been registered.`
                });
            }
        }

        /* teller must sign the token to show it owns the public key */
        let token;
        let tellerReq = protocol.request(options, function(tellerRes) {
            let rawData = '';
            tellerRes.setEncoding('utf8');
            tellerRes.on('data', (chunk) => rawData += chunk);
            tellerRes.on('end', function() {
                try {
                    let tellerResData = JSON.parse(rawData);
                    let tellerPubKey = tellerResData.pubKey;
                    if(tellerResData.code == 0) {
                        if(!util.pkovVerifyPubKey(pki, token, tellerResData)) {
                            return reject({
                                code: -6,
                                msg: 'The public key of the remote teller is not valid'
                            });
                        }
                        /* register teller success, store the public key */
                        return resolve({
                            hostname: options.hostname,
                            protocol : options.protocol,
                            port: options.port,
                            pub_key: tellerPubKey
                        });
                    } else {
                        throw "";
                    }
                } catch (e) {
                    return reject({
                        code: -4,
                        msg: 'Remote teller cannot register this election.'
                    });
                }

            });
        });

        tellerReq.on('error', (e) => {
            console.log(`problem with request: ${e.message}`);
            return reject({
                code: -3,
                msg: `Teller ${options.hostname}:${options.port} is temporarily unavailable.`
            });
        });

        /* there is no need to tell the teller other tellers' information.
         * Only get the necessary information about the election. */
        let postData = util.getElectionInfo(data);
        postData.token = token = util.generateToken();
        postData.espUrl = body.espUrl;
        postData.authUrl = body.authUrl;
        tellerReq.setTimeout(5000, function() {
            console.log("timeout");
            tellerReq.abort();
        });
        tellerReq.write(JSON.stringify(postData));
        tellerReq.end();
    });

}

async function registerTeller(id, body, pki) {
    let tunnelPort = parseInt(body.tunnelPort, 10);
    if( !(tunnelPort > 0 && tunnelPort < 65536) ) {
        return {
            code: -5,
            msg: 'Tunnel Port must be [1-65535].'
        };
    }

    const client = new pg.Client(dbConfig);
    let abort = true;

    try {
        await client.connect();
        console.log("connected");
        await client.query('BEGIN');
        console.log("begin");

        /* get election info and validate state */
        let data = await getElection(id, client);
        if( (!data.id) || (data.state != 1) || (data.is_teller_sign) ) {
            return {
                code: -1,
                msg: 'Election does not exist or invalid election state.'
            };
        }

        /* register election on remote teller */
        let options;
        try {
            options = await sendElectionToTeller(body, data, pki);
        } catch (e) {
            return e;
        }

        /* insert teller on auth */
        let result = await client.query(
`INSERT INTO auth.teller (eid, protocol, hostname, port, pub_key, tunnel_port) \
VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING;`,
            [id, options.protocol, options.hostname, options.port, options.pub_key, tunnelPort]);

        if(result.rowCount == 1) {
            await client.query('COMMIT');
            console.log("commit");
            abort = false;
            return {
                protocol: options.protocol,
                hostname: options.hostname,
                port: options.port,
                pub_key: options.pub_key,
                tunnel_port: tunnelPort,
                code: 0,
                msg: "register success"
            }
        } else {
            /* TODO inform teller to remove the election */
            return {
                code: -2,
                msg: `Teller ${options.hostname}:${options.port} has already been registered.`
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

module.exports = registerTeller;