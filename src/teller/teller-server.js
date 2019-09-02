"use strict";
const express = require('express');
const bodyParser = require('body-parser');
const registerElection = require("./registerElection");
const openElection = require("./openElection");
const closeElection = require("./closeElection");
const saveVote = require("./saveVote");
const saveReceipt = require("./saveReceipt");
const dbConfig = require('./dbConfig');
const { Elliptic, curve } = require('../common/nativeEcc');
const parameter = require('../common/parameter');
const Cipher = require("../common/Cipher");
const PKI = require("../common/PKI");
const util = require("../common/util");


const app = express();


app.set('view engine', 'jade');
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static('assets'));

const port = process.argv[2];
const schema = process.argv[3];
const password = process.argv[4];
const pwConfFile = process.argv[5];
const keyFileName = process.argv[6];

/* set up database schema */
dbConfig.schema = schema;

/* setup server aesKey */
const cipher = util.initAESCipher(password, pwConfFile);

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

app.listen(port,()=>{
   console.log('listening on '+port);
});

util.initAppVerifyPubKey(app, pki);

console.log('database schema: ' + schema);
console.log('password: ' + password);

app.post('/register', (req, res)=> {
    registerElection(req.body, pki)
        .then(function (data) {
            res.send(data);
        });
});

app.options('/vote', (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.send(null);
});

app.post('/vote', (req, res)=> {
    saveVote(req.body, ec, pki, cipher)
        .then(function (data) {
            res.setHeader("Access-Control-Allow-Origin", "*");
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

app.options('/saveReceipt', (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.send(null);
});

app.post('/saveReceipt', function (req, res) {
    saveReceipt(req.body, pki)
        .then(function (data) {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.send(data);
        });
});