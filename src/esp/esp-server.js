"use strict";
const express = require('express');
const bodyParser = require('body-parser');
const createElection = require('./createElection');
const getElection = require('./getElection');
const openElection = require('./openElection');
const closeElection = require("./closeElection");
const saveVote = require("./saveVote");
const dumpVotes = require("./dumpVotes");
const submitTellerResult = require('./submitTellerResult');
const dumpSummation = require("./dumpSummation");
const { Elliptic, curve } = require('../common/nativeEcc');
const parameter = require('../common/parameter');
const PKI = require("../common/PKI");
const util = require("../common/util");

const app = express();
const port = process.argv[2];
const password = process.argv[3];
const keyFileName = process.argv[4];

/* elliptic curve setup */
let ec;
try {
    ec = new Elliptic(curve[parameter.name], parameter.h);
} catch (e) {
    console.log(
`cannot initialize with parameters, maybe caused by \
unsupported curve name or point h is not on the curve`);
    return;
}

/* read pub/priv keyfile */
let pki;
try {
    pki = new PKI(keyFileName, password);
    console.log("public/private key loaded");
} catch (e) {
    console.log("Fail to load public/private key");
    return;
}
let pubKey = pki.getPub();

app.set('view engine', 'jade');
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static('.'));

app.listen(port, function () {
    console.log('listening on ' + port);
});
app.get('/', function (req, res) {
    res.render('index');
});

util.initAppVerifyPubKey(app, pki);

app.get('/create', function (req, res) {
    res.render('create');
});

app.post('/create', function (req, res) {
    createElection(pki, req.body)
        .then(function (data) {
            res.send(data);
        });
});

app.get('/election/:id/', function (req, res) {
    if (!req.url.endsWith('/')) {
        res.redirect(301, req.url + '/');
        return;
    }
    res.render('election');
});

app.get('/electionapi/:id/', function (req, res) {
    if (!req.url.endsWith('/')) {
        res.redirect(301, req.url + '/');
        return;
    }
    getElection(req.params.id)
        .then(function (data) {
            data.pubKey = pubKey;
            res.send(data);
        });
});

app.post('/election/open', function (req, res) {
    openElection(req.body, pki)
        .then(function (data) {
            res.send(data);
        });
});

app.post('/election/close', function (req, res) {
    closeElection(req.body, pki)
        .then(function (data) {
            res.send(data);
        });
});

app.get('/election/:id/vote', function (req, res) {
    res.render('vote');
});

app.post('/election/:id/vote', function (req, res) {
    saveVote(req.params.id, req.body, ec, pki)
        .then(function (data) {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.send(data);
        });
});

app.get('/election/:id/dumpVotes', function (req, res) {
    let id = req.params.id;
    res.set({
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="election_${id}_ballots.csv"`
    });
    dumpVotes(id, res);
});

app.post('/election/:id/submitTellerResult', function (req, res) {
    submitTellerResult(req.params.id, req.body, pki)
        .then(function (data) {
            res.send(data);
        });
});

app.get('/election/:id/dumpSummation', function (req, res) {
    let id = req.params.id;
    res.set({
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="election_${id}_summation.json`
    });

    dumpSummation(id, pubKey)
        .then(function (data) {
            res.send(JSON.stringify(data));
        });
});