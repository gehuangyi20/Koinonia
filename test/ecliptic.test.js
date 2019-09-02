/**
 * Created by Victor on 10/29/2016.
 */
const expect = require("chai").expect;
const ecliptic = new (require("../src/common/Elliptic"))('c521', 'hello');
const JSON = require('json3');
const it = require('mocha').it;
/*
describe('result', function () {
    this.timeout(0);
    it('should have the right count', function () {
        ecliptic.generate_T0('c521', 'hello');

// two servers generate keys
        JSON.stringify(ecliptic.generate_keys());
        const server1_pub = ecliptic.getPub();
        const server1_sec = ecliptic.getPriv();
        JSON.stringify(ecliptic.generate_keys());
        const server2_pub = ecliptic.getPub();
        const server2_sec = ecliptic.getPriv();

// should parse public keys
        const server_index = [0, 8];
        const server_keys_json = JSON.stringify([server1_pub, server2_pub], null, 2);

        const candidate_size = 5;

// voter 3, the public and private key pair will be generated during the voting process
        const vote_1 = ecliptic.do_vote(3,server_index, server_keys_json, candidate_size, 2);

// voter 4
        const vote_2 = ecliptic.do_vote(4,server_index, server_keys_json, candidate_size, 3);

        const votes=[vote_1,vote_2];

// server 0 outputs the summations of the commitments he received
        ecliptic.setPub(server1_pub);
        ecliptic.setPriv(server1_sec);
        const server_1_shares = [];
        for(let i in votes){
            server_1_shares.push(votes[i].shares[server_index[0]]);
        }

        const sum_json_1 = ecliptic.output_summation(server_1_shares,server_index[0]);
// console.log(sum_json_1);

// server 1 outputs the summations
        ecliptic.setPub(server2_pub);
        ecliptic.setPriv(server2_sec);
        const server_2_shares = [];
        for(let i in votes){
            server_2_shares.push(votes[i].shares[server_index[1]]);
        }
        const sum_json_2 = ecliptic.output_summation(server_2_shares,server_index[1]);
// console.log(sum_json_2);

// should parse the summations like this
        const summation_json = JSON.stringify([sum_json_1, sum_json_2], null, 2);

// count the result
        const result_json = ecliptic.count(votes, summation_json);
// console.log(summation_json);
        console.log(result_json);
        expect(JSON.parse(result_json)).to.deep.equal(["000000", "000000", "01", "01", "000000"]);
    });
});
*/

describe("proof 01", function () {
   it('should verify a valid  when b=1',function () {
       const y = ecliptic.deserializeBN("02a9f95618c636e5485ac293d9c18eaa4c825ec08a71b8c7abbc561ceb38cf2936676edc168069dbfc520af85e6318626e7ada782829e9f6aea267b3a728a3569d05");
       const b = "1";
       const r = ecliptic.deserializeBN("012260d6cd4f709f6c3b3c9c823f7f02a0b3204e50d63382838bff4411f2cd3251f8fc1d4246017ee0ba2b7662fa69291bd7652ab0cfeb0462b60fbda4bb9c6fba9e");
       const e_bar = ecliptic.deserializeBN("28d4f3a6465fa75a0de351da0a8b8b0919b0da17257b11e6bdce41838f06a80de90f34101389797edb3c687151cd46137dbee691d844d00540fedd7085a9a2e7b6");
       const f_bar = ecliptic.deserializeBN("01ba67449142329cbfb47aed6b33db11d0bad4526bbcf2d33e0da247311d44b30d5e8ed4b60be43ba2cd0e81670a54d839328aec1c892718b465796aa4d95f632ecd");

       const proof01 = ecliptic.proof_01(y,b,{r:r,e_bar:e_bar,f_bar:f_bar});
       expect(ecliptic.verify_proof_01(proof01)).to.be.true;
   });

   it('should verify a valid proof when b=0',function () {
       const y = ecliptic.deserializeBN("0252caf3721c58ee5e6d2750f3a134d6213802bc1692d5cc0765e12bf3bc32fb28ff203a6bc750994bc4b4ae432b9fa548d00097f2a88205b454c221678f05885373");
       const b = "0";
       const r = ecliptic.deserializeBN("012260d6cd4f709f6c3b3c9c823f7f02a0b3204e50d63382838bff4411f2cd3251f8fc1d4246017ee0ba2b7662fa69291bd7652ab0cfeb0462b60fbda4bb9c6fba9e");
       const e_bar = ecliptic.deserializeBN("28d4f3a6465fa75a0de351da0a8b8b0919b0da17257b11e6bdce41838f06a80de90f34101389797edb3c687151cd46137dbee691d844d00540fedd7085a9a2e7b6");
       const f_bar = ecliptic.deserializeBN("01ba67449142329cbfb47aed6b33db11d0bad4526bbcf2d33e0da247311d44b30d5e8ed4b60be43ba2cd0e81670a54d839328aec1c892718b465796aa4d95f632ecd");

       const proof01 = ecliptic.proof_01(y,b,{r:r,e_bar:e_bar,f_bar:f_bar});
       expect(ecliptic.verify_proof_01(proof01)).to.be.true;
   });
});