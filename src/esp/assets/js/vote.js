requirejs([
    "jquery",
    "common"
], function($, common) {
    let espElection;
    let authElection;
    let authOrigin;
    let query;
    let parameter = common.parameter;
    let ec = new common.Elliptic(parameter.name, parameter.h);
    let pki = new common.PKI();

    $(document).ready(function () {
        let match = /\/election\/([0-9]*)\//g.exec(location.pathname);
        let electionId = parseInt(match[1]);
        query = searchToObject();

        $.ajax({
            method: "get",
            url: "/electionapi/" + electionId + "/",
            success: function(data) {
                espElection = data;
                authOrigin = data.authProtocol + "//" + data.authHostname +
                    (data.authPort != null ? ':' + data.authPort : '');
                getAuthElection(data);
            }
        });
    });

    function searchToObject() {
        let pairs = location.search.substring(1).split('&');
        let ret = {};
        let i = pairs.length;
        while(i--) {
            let pair = pairs[i].split('=');
            ret[ decodeURIComponent(pair[0]) ] = decodeURIComponent(pair[1]);
        }
        return ret;
    }

    function validateQuery(query, ec, pubKey) {
        if(typeof query.email !== "string") return false;
        if(typeof query.rid !== "string") return false;
        query.reg_time = parseFloat(query.reg_time);
        if(!isFinite(query.reg_time)) return false;
        query.link_time = parseFloat(query.link_time);
        if(!isFinite(query.link_time)) return false;
        if(query.link_time <= query.reg_time) return false;
        if(typeof query.link_sign !== "string") return false;

        let paramStr = `${authElection.id}${query.email}${query.rid}${query.reg_time}${query.link_time}`;
        return pki.verify(paramStr, query.link_sign, pubKey);
    }

    function getAuthElection(data) {
        let url =  authOrigin + '/electionapi/' + data.id + '/';
        $.ajax({
            method: "get",
            url: url,
            success: function(data) {
                authElection = data;
                /* we have the voting id, do not show the vote form */
                let voteEamil = $("#voteEmail");
                let voteForm = $("#voteForm");
                if(validateQuery(query, ec, espElection.authPubKey) && authElection.state == 2) {
                    voteEamil.hide();
                    voteForm.find("input").prop('disabled', false);
                } else {
                    voteForm.find("input").prop('disabled', true);
                }
                init();
            }
        });
    }

    function init() {
        let display = $("#voteDisplay");
        display.find("#electionName").html(authElection.name);

        /* display position */
        let pos = authElection.pos;
        let posDom = display.find("#electionPosition");
        let posistions = {};
        for(let i=0, il= pos.length; i<il; i++) {
            let curPos = pos[i];
            let posContainer = $('<div class="panel panel-default candidatePanel"></div>');
            let posHeader = $('<div class="panel-heading"><label>' + curPos.name + '</label></div>');
            let posBody = $('<div class="panel-body"></div>');
            curPos.dom = {
                container: posContainer,
                header: posHeader,
                body: posBody
            };
            posContainer.append(posHeader, posBody);
            posDom.append(posContainer);
            posistions[curPos.pid] = curPos;
        }

        /* candidates */
        let cand = authElection.cand;
        let candidates = {};
        for(let i=0, il= cand.length; i<il; i++) {
            let curCand = cand[i];
            candidates[curCand.cid] = curCand;
        }

        /* add posCandMapping */
        let posCandMapping = authElection.posCandMapping;
        for(let i=0, il= posCandMapping.length; i<il; i++) {
            let curMap = posCandMapping[i];
            posistions[curMap.pid].dom.body.append('<div class="btn btn-default"><label><input type="radio" name="' + curMap.pid +'" value="' + curMap.cid + '">' + candidates[curMap.cid].name + '</label></div>');
        }

        let voteMsg = $("#voteMsg");
        switch (authElection.state) {
            /* 0=created     edit */
            case 0:
                voteMsg.html("<div class='alert alert-info'>Election is created</div>");
                break;
            /* 1=frozen      register server */
            case 1:
                voteMsg.html("<div class='alert alert-info'>Election is freezed</div>");
                break;
            /* 2=open        vote */
            case 2:
                voteMsg.html("<div class='alert alert-info'>Election is open!</div>");
                break;
            /* 3=closed      count votes */
            case 3:
                voteMsg.html("<div class='alert alert-info'>Election is closed!</div>");
                break;
            /* 4=counted */
            case 4:
                voteMsg.html("<div class='alert alert-info'>Election is counted!</div>");
                break;
        }

        /* get vote link */
        $("#voteEmail").submit(function(e){
            $.ajax({
                url: authOrigin + "/election/" + authElection.id + '/voteLink',
                method: "POST",
                data: $(this).serialize()  + "&url=" + encodeURIComponent(location.origin),
                success: function(data) {
                    let msg;
                    if(data.code == 0) {
                        /* Email sent success */
                        msg = "<div class='alert alert-info'>" + data.msg + "</div>";
                    } else {
                        /* fail to send the email */
                        msg = "<div class='alert alert-danger'>" + data.msg + "</div>";
                    }

                    $("#voteEmailMsg").html(msg).fadeIn().delay(5000).fadeOut();
                },
                error: function() {
                    $("#voteEmailMsg").html("<div class='alert alert-danger'>Cannot sent email due to network/server issues.</div>").fadeIn().delay(5000).fadeOut();
                }
            });

            return false;
        });

        /* vote submission */
        let voteForm = $("#voteForm").submit(function(e) {
            let selection = $(this).serializeArray();
            vote(selection)
                .then(function (msg) {
                    updateProgress(100)
                        .then(function () {
                            $("#VoteButton").hide();
                            voteForm.find("input").prop('disabled', true);
                            $("#voteProgress").fadeOut();
                            $("#voteStatusMsg").html(`<div class='alert alert-info'>${msg}</div>`).fadeIn();
                        });
                })
                .catch(function (msg) {
                    console.log(msg);
                    handleTerminate(msg);
                });

            return false;
        });

        async function vote(selection) {
            let uiVoteProgress = $("#voteProgress");
            let paramStr = `${authElection.id}${query.email}${query.rid}${query.reg_time}${query.link_time}${query.link_sign}`;
            resetProgress(0);
            await new Promise((resolve, reject) => {
                uiVoteProgress.fadeIn('normal', function () {
                    resolve();
                });
            });

            let rawPos = authElection.pos;
            let posDataObj = {};
            let posDataArray = [];

            for(let i = 0, il = rawPos.length; i < il; i++) {
                let curPos = rawPos[i];
                posDataObj[curPos.pid] = {
                    pid: curPos.pid,
                    cid: -1,
                    cand: []
                };
            }

            let rawMap = authElection.posCandMapping;
            for(let i = 0, il = rawMap.length; i < il; i++) {
                let curMap = rawMap[i];
                posDataObj[curMap.pid].cand.push(curMap.cid);
            }

            for(let i = 0, il = selection.length; i < il; i++) {
                let curSelection = selection[i];
                posDataObj[curSelection.name].cid = parseInt(curSelection.value);
            }

            for(let key in posDataObj) {
                let obj = posDataObj[key];
                obj.cand.sort(function(a, b) { return a - b; });
                posDataArray.push(obj);
            }

            posDataArray.sort(function(a, b) {return a.pid - b.pid});

            await updateProgress(5);

            let teller = authElection.teller;
            let tellerLen = teller.length;
            let percentLen = 95 / (tellerLen + 2);
            console.time("genVote");
            let vote = ec.generate_vote(teller, posDataArray);
            console.timeEnd("genVote");
            let commits = vote.commits;
            let proofs = vote.proofs;
            /*let tellerReady = new Array(tellerLen);
            let signature = new Array(tellerLen);*/
            let tellerSuccess = 0;

            await updateProgress(5+percentLen);

            function verifyCommitSign(str, commits, sign, time, pubKey) {
                for(let i = 0, il = commits.length; i < il; i++) {
                    let curCommit = commits[i];
                    let commitVals = curCommit.values;
                    str += curCommit.pid;

                    for(let j = 0, jl = commitVals.length; j < jl; j++) {
                        let curCommitVal = commitVals[j];
                        str += curCommitVal.cid;
                        str += curCommitVal.z;
                    }
                }
                str += time;
                return pki.verify(str, sign, pubKey);
            }

            function sendCommit(str, curTeller, commits, index) {
                function tryNextTeller(ajaxObj, reject) {
                    ajaxObj.tryCount = 0;
                    let tellerIndex = (ajaxObj.tellerIndex + 1) % tellerLen;
                    let newTeller = teller[tellerIndex];

                    /* has tried all tellers but still fails. */
                    if(tellerIndex == ajaxObj.index) {
                        //handleTerminate();
                        return reject(`Cannot send share ${index} due to network/server issues.`);
                    }

                    ajaxObj.tellerIndex = tellerIndex;
                    ajaxObj.url = 'http://' + newTeller.hostname + ":" + newTeller.port + "/vote";
                    $.ajax(ajaxObj);
                }

                return new Promise( (resolve, reject) => {
                    $.ajax({
                        url: 'http://' + curTeller.hostname + ":" + curTeller.port + "/vote",
                        method: "POST",
                        data: JSON.stringify({
                            eid: curTeller.eid,
                            email: query.email,
                            rid: query.rid,
                            reg_time: query.reg_time,
                            link_time: query.link_time,
                            link_sign: query.link_sign,
                            commits: commits
                        }),
                        contentType: "application/json; charset=utf-8",
                        tryCount : 0,
                        tryLimit : 3,
                        index: index,
                        tellerIndex: index,
                        success: function(data) {
                            if(data.code == 0) {
                                let ret = {
                                    index: this.tellerIndex,
                                    sign: data.sign,
                                    time: data.time
                                };

                                console.time(`verify commit sign ${this.tellerIndex}`);
                                if(verifyCommitSign(str, commits,
                                        data.sign, data.time,
                                        teller[this.tellerIndex].pub_key)) {
                                    console.timeEnd(`verify commit sign ${this.tellerIndex}`);
                                    tellerSuccess ++;
                                    updateProgress(5 + percentLen * (tellerSuccess + 1) )
                                        .then(function () {
                                            resolve(ret);
                                        });
                                } else {
                                    tryNextTeller(this, reject);
                                }
                            } else {
                                tryNextTeller(this, reject);
                            }
                        },
                        error: function(xhr, textStatus, errorThrown ) {
                            this.tryCount++;
                            if (this.tryCount < this.tryLimit) {
                                //try again
                                $.ajax(this);
                                return;
                            }
                            /* use next teller for submission */
                            tryNextTeller(this, reject);
                        }
                    });
                });
            }

            let tellerTasks = [];
            for(let i = 0, il = commits.length; i < il; i++) {
                tellerTasks.push(sendCommit(paramStr, teller[i], commits[i], i));
            }
            let tellerResult = await Promise.all(tellerTasks);

            let tellerAvail = [];
            let count = 0;
            for(let i = 0, il = teller.length; i < il; i++) {
                tellerAvail[i] = false;
            }

            for(let i = 0, il = teller.length; i < il; i++) {
                tellerAvail[ tellerResult[i].index ] = tellerResult[i].sign;
            }

            let availTellerIdx = [];
            for(let i = 0, il = teller.length; i < il; i++) {
                if(tellerAvail[i]) {
                    count ++;
                    availTellerIdx.push({
                        idx: i,
                        sign: tellerAvail[i]
                    });
                }
            }

            if(count == 1) {
                throw `All shares are submitted to one Teller, privacy cannot guaranteed. Please try it later.`;
            }

            let receipt = await sendVote(paramStr, commits, tellerResult, proofs);

            updateProgress(95);

            let result = await sendReceipt(receipt, teller, availTellerIdx,
                Math.floor(Math.random() * availTellerIdx.length));
            return `<p>${receipt.msg}</p><p style='word-wrap: break-word;'>\
Your Ballot Receipt: ${receipt.sign}</p><p>Teller: ${result}</p>`;
        }

        function resetProgress() {
            $("#voteProgressBar")
                .css({width: 0})
                .html("0%");
        }

        function updateProgress(progress) {
            return new Promise((resolve) => {
                $("#voteProgressBar")
                    .css({width: progress + "%"})
                    .html(progress + "%")
                    .on("transitionend", function () {
                        $("#voteProgressBar").off("transitionend");
                        resolve();
                    });
            });
        }

        function handleTerminate(msg) {
            if(msg === null || msg === undefined || msg === "") {
                msg = "Cannot sent vote due to network/server issues.";
            }
            $("#voteProgress").fadeOut();
            $("#voteStatusMsg")
                .html(`<div class='alert alert-danger'>${msg}</div>`)
                .fadeIn()
        }

        function sendVote(str, commits, tellerRes, proofs) {
            let zs = [];

            for(let i = 0, il = commits.length; i < il; i++) {
                let curTellerRes = tellerRes[i];
                let curCommit = commits[i];

                for(let j = 0, jl = curCommit.length; j < jl; j++) {
                    let curPosCommit = curCommit[j].values;
                    for(let k = 0, kl = curPosCommit.length; k < kl; k++) {
                        delete curPosCommit[k].x;
                        delete curPosCommit[k].y;
                    }
                }

                let curZ = {
                    idx: curTellerRes.index,
                    val: curCommit,
                    sign: curTellerRes.sign,
                    time: curTellerRes.time
                };

                zs.push(curZ);
            }

            let data = {
                email: query.email,
                rid: query.rid,
                reg_time: query.reg_time,
                link_time: query.link_time,
                link_sign: query.link_sign,
                zs: zs,
                proofs: proofs
            };

            return new Promise( (resolve, reject) => {
                $.ajax({
                    url: "vote",
                    method: "POST",
                    data: JSON.stringify(data),
                    contentType: "application/json; charset=utf-8",
                    success: function(data) {
                        if(data.code == 0) {
                            /* Vote sent success and verify the receipt */
                            console.time(`verify ballot sign`);
                            if(pki.verify(str + data.time, data.sign, espElection.pubKey)) {
                                resolve(data);
                            } else {
                                reject("Ballot receipt is not valid.");
                            }
                            console.timeEnd(`verify ballot sign`);
                        } else {
                            /* fail to send the Vote */
                            reject(data.msg);
                        }
                    },
                    error: function(xhr, textStatus, errorThrown ) {
                        reject();
                    }
                });
            });
        }

        function sendReceipt(receipt, teller, avaliTellerIdx, idx) {
            function tryNextTeller(ajaxObj, resolve) {
                let tellerIndex = (ajaxObj.index + 1) % idxLen;
                let newTeller = teller[ avaliTellerIdx[tellerIndex].idx ];

                /* has tried all tellers but still fails. */
                if(tellerIndex == idx) {
                    return resolve(`Cannot send receipt due to network/server issues.`);
                }

                ajaxObj.index = tellerIndex;
                ajaxObj.url = 'http://' + newTeller.hostname + ":" + newTeller.port + "/saveReceipt";
                data.commitSign = avaliTellerIdx[tellerIndex].sign;
                ajaxObj.data = JSON.stringify(data);
                $.ajax(ajaxObj);
            }

            let idxLen = avaliTellerIdx.length;
            let curTeller = teller[ avaliTellerIdx[idx].idx ];
            let data = {
                eid: curTeller.eid,
                rid: query.rid,
                commitSign: avaliTellerIdx[idx].sign,
                time: receipt.time,
                sign: receipt.sign
            };
            return new Promise( (resolve, reject) => {
                $.ajax({
                    url: 'http://' + curTeller.hostname + ":" + curTeller.port + "/saveReceipt",
                    method: "POST",
                    data: JSON.stringify(data),
                    contentType: "application/json; charset=utf-8",
                    index: idx,
                    success: function(data) {
                        if(data.code == 0) {
                            resolve(data.msg);
                        } else {
                            tryNextTeller(this, resolve);
                        }
                    },
                    error: function(xhr, textStatus, errorThrown ) {
                        /* use next teller for submission */
                        tryNextTeller(this, resolve);
                    }
                });
            });
        }
    }
});