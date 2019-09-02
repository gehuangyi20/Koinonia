"use strict";
const express = require('express');
const bodyParser = require('body-parser');
const createElection = require('./createElection');
const getElectionAPI = require('./getElectionAPI');
const freezeElection = require('./freezeElection');
const freezeVoters = require('./freezeVoters');
const freezeTellers = require('./freezeTellers');
const openElection = require('./openElection');
const closeElection = require('./closeElection');
const dumpVoters = require('./dumpVoters');
const registerTeller = require('./registerTeller');
const regVoter = require('./regVoter');
const sendVoteLink = require('./sendVoteLink');
const PKI = require("../common/PKI");
const util = require("../common/util");


const app = express();
const password = process.argv[2];
const keyFileName = process.argv[3];
const port = process.argv[4];

/* read pub/priv keyfile */
let pki;
try {
    pki = new PKI(keyFileName, password);
    console.log("public/private key loaded");
} catch (e) {
    console.log("Fail to load public/private key");
    return;
}

app.set('view engine', 'jade');
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static('.'));

app.listen(port, function () {
    console.log('listening on ' + port);
});

util.initAppVerifyPubKey(app, pki);

app.options('/create', (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.send(null);
});

app.post('/create', function (req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    createElection(req.body)
        .then(function(data) {
            res.send(data);
        });
});

app.get('/electionapi/:id/', function (req, res) {
    if (!req.url.endsWith('/')) {
        res.redirect(301, req.url + '/');
        return;
    }
    getElectionAPI(req.params.id)
        .then(function (data) {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.send(data);
        });
});

app.post('/election/:id/freeze', function (req, res) {
    let id = req.params.id;
    freezeElection(id, pki)
        .then(function (data) {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.send(data);
        });
});

app.post('/election/:id/server', function (req, res) {
    registerTeller(req.params.id, req.body, pki)
        .then(function (data) {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.send(data);
        });
});

app.post('/election/:id/freezeTellers', function (req, res) {
    let id = req.params.id;

    freezeTellers(id, pki)
        .then(function (data) {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.send(data);
        });
});

app.post('/election/:id/regVoters', function (req, res) {
    let id = req.params.id;
    let voter = req.body.voter.split(/\r?\n/g);

    regVoter(id, voter)
        .then(function (data) {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.send(data);
        });
});

app.post('/election/:id/freezeVoters', function (req, res) {
    let id = req.params.id;

    freezeVoters(id, pki)
        .then(function (data) {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.send(data);
        });
});

app.get('/election/:id/dumpVoters', function (req, res) {
    let id = req.params.id;
    res.set({
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="election_${id}_voters.csv"`
    });
    dumpVoters(id, {
        handleRow: function (row) {
            return `${row.identifier}\t${row.rid}\t${row.reg_time}\n`;
        },
        flush: function (str) {
            res.write(str);
        },
        end: function () {
            res.end();
        }
    });
});

app.post('/election/:id/open', function (req, res) {
    openElection(req.params.id, req.body.espUrl, pki)
        .then(function (data) {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.send(data);
        });
});

/* generate vote link and send email to the user */
app.post('/election/:id/voteLink', function (req, res) {
    sendVoteLink(req.body.url, req.params.id, req.body.email, pki)
        .then(function (data) {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.send(data);
        });
});

app.post('/election/:id/close', function (req, res) {
    closeElection(req.params.id, req.body.espUrl, pki)
        .then(function (data) {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.send(data);
        });
});
