requirejs([
    "jquery",
    "common"
], function($, common) {
    let espElection;
    let authElection;
    let authOrigin;

    $(document).ready(function() {
        let match = /\/election\/([0-9]*)\//g.exec(location.pathname);
        let electionId = parseInt(match[1]);

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

    function getAuthElection(data) {
        let url =  authOrigin + '/electionapi/' + data.id + '/';
        $.ajax({
            method: "get",
            url: url,
            success: function(data) {
                authElection = data;
                init();
            }
        });
    }

    function init() {
        let display = $("#electionDisplay");
        display.find("#electionName").html(authElection.name);
        display.find("#espTunnelPort").html(espElection.tunnelPort);
        display.find("#authUrl").html(authOrigin);
        display.find("#authTunnelPort").html(authElection.tunnel_port);
        display.find("#voterCount").html(authElection.voter_count);

        /* display position */
        let i, il;
        let curPos;
        let pos = authElection.pos;
        let posDom = display.find("#electionPosition");
        let posistions = {};
        for(i=0, il= pos.length; i<il; i++) {
            curPos = pos[i];
            let posContainer = $('<div class="panel panel-default posPanel"></div>');
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

        /* display candidate */
        let curCand;
        let cand = authElection.cand;
        let candidates = {};
        for(i=0, il= cand.length; i<il; i++) {
            curCand = cand[i];
            candidates[curCand.cid] = curCand;
        }

        /* add posCandMapping */
        let curMap;
        let posCandMapping = authElection.posCandMapping;
        for(i=0, il= posCandMapping.length; i<il; i++) {
            curMap = posCandMapping[i];
            posistions[curMap.pid].dom.body.append('<div class="btn btn-default">' + candidates[curMap.cid].name + '</div>');
        }

        /* display teller */
        let curTeller;
        let teller = authElection.teller;
        let tellerDom = display.find("#electionTeller tbody");
        let tellers = [];
        for(i=0, il= teller.length; i<il; i++) {
            curTeller = teller[i];
            tellerDom.append('<tr><td>' + curTeller.protocol + "//" + curTeller.hostname + ':' + curTeller.port + '</td><td>' + curTeller.tunnel_port + '</td></tr>');
            tellers.push(curTeller);
        }

        if(il == 0) {
            tellerDom.append('<tr><td colspan="2">No teller has been registered yet.</td></tr>');
        }

        switch(authElection.state) {
            /* 0=created     edit */
            case 0:
                display.find("#electionState0").fadeIn();
                break;
            /* 1=frozen      register server */
            case 1:
                display.find("#tellerRegistration").fadeIn();
                display.find("#voterRegistration").fadeIn();
                display.find("#electionState1").fadeIn();
                break;
            /* 2=open        vote */
            case 2:
                display.find("#electionState2").fadeIn();
                break;
            /* 3=closed      count votes */
            case 3:
                display.find("#electionState3").fadeIn();
                showElectionResult();
                break;
            /* 4=counted */
            case 4:
                break;
        }

        let electionUpdating = false;

        /* freeze election */
        $("#electionFreeze").click(function(e) {
            if(electionUpdating) return;
            electionUpdating = true;
            $.ajax({
                method: "post",
                url: authOrigin + "/election/" + authElection.id + "/freeze",
                success: function(data) {
                    let msg;
                    if(data.code == 0) {
                        /* election is frozen */
                        display.find("#tellerRegistration").fadeIn();
                        display.find("#voterRegistration").fadeIn();
                        display.find("#electionState0").fadeOut();
                        display.find("#electionState1").fadeIn();
                        msg = "<div class='alert alert-info'>" + data.msg + "</div>";
                    } else {
                        /* fail to freeze the election, maybe caused by election state changing, reload the page */
                        location.reload();
                    }

                    $("#electionMsg").html(msg).fadeIn().delay(5000).fadeOut();
                    electionUpdating = false;
                },
                error: function() {
                    $("#electionMsg")
                        .html(
                            "<div class='alert alert-danger'>" +
                            "election " + espElection.id + " is frozen fail " +
                            "(due to network/server issues, election not exist, or invalid election state)." + "</div>")
                        .fadeIn().delay(5000).fadeOut();
                    electionUpdating = false;
                }
            });
        });

        /* register teller */
        $("#tellerRegistration").submit(function(e) {
            $.ajax({
                method: "post",
                url: authOrigin + "/election/" + authElection.id + "/server",
                data: $(this).serialize() + "&espUrl=" + encodeURIComponent(location.origin)
                    + "&authUrl=" + encodeURIComponent(authOrigin),
                success: function(data) {
                    let msg;
                    if(data.code == 0) {
                        tellerDom.append('<tr><td>' + data.protocol + "//" + data.hostname + ':' + data.port + '</td><td>' + data.tunnel_port + '</td></tr>');
                        tellers.push({protocol: data.protocol, hostname: data.hostname, port:data.port, pub_key: data.pub_key});
                        msg = "<div class='alert alert-info'>" + data.msg + "</div>";
                    } else {
                        msg = "<div class='alert alert-danger'>" + data.msg + "</div>";
                    }

                    $("#tellerRegistrationMsg").html(msg).fadeIn().delay(5000).fadeOut();
                },
                error: function() {
                    let msg = "<div class='alert alert-danger'>Cannot register teller due to network/server issues.</div>";
                    $("#tellerRegistrationMsg").html(msg).fadeIn().delay(5000).fadeOut();
                }
            });
            return false;
        });

        /* freeze tellers */
        $("#tellerFreeze").click(function (e) {
            if (electionUpdating) return;
            electionUpdating = true;

            $.ajax({
                method: "post",
                url: authOrigin + "/election/" + authElection.id + "/freezeTellers",
                success: function (data) {
                    let msg;
                    if(data.code == 0) {
                        authElection.is_voter_sign = true;
                        authElection.teller_sign = data.teller_sign;
                        msg = "<div class='alert alert-info'>" + data.msg + "</div>";
                    } else {
                        msg = "<div class='alert alert-danger'>" + data.msg + "</div>";
                    }
                    $("#tellerRegistrationMsg").html(msg).fadeIn().delay(5000).fadeOut();
                    electionUpdating = false;
                },
                error: function() {
                    electionUpdating = false;
                    let msg = "<div class='alert alert-danger'>Cannot freeze Tellers due to network/server issues.</div>";
                    $("#tellerRegistrationMsg").html(msg).fadeIn().delay(5000).fadeOut();
                }
            });
        });

        /* register voters */
        $("#voterRegistration").submit(function(e) {
            $.ajax({
                method: "post",
                url: authOrigin + "/election/" + authElection.id + "/regVoters",
                data: $(this).serialize(),
                success: function(data) {
                    let msg;
                    if(data.code == 0) {
                        authElection.voter_count += data.count;
                        display.find("#voterCount").html(authElection.voter_count);
                        msg = data.count + " voters are registered. " +
                            data.dupVoter.length + " duplicated voters. " +
                            data.invalidVoter.length + " invalid email address.";
                        msg = "<div class='alert alert-info'>" + msg + "</div>";
                    } else {
                        msg = "<div class='alert alert-danger'>" + data.msg + "</div>";
                    }
                    $("#voterRegistrationMsg").html(msg).fadeIn().delay(5000).fadeOut();
                },
                error: function() {
                    let msg = "<div class='alert alert-danger'>Cannot register Voters due to network/server issues.</div>";
                    $("#voterRegistrationMsg").html(msg).fadeIn().delay(5000).fadeOut();
                }
            });
            return false;
        });

        /* freeze voters */
        $("#voterFreeze").click(function (e) {
            if (electionUpdating) return;
            electionUpdating = true;

            $.ajax({
                method: "post",
                url: authOrigin + "/election/" + authElection.id + "/freezeVoters",
                success: function (data) {
                    let msg;
                    if(data.code == 0) {
                        authElection.is_voter_sign = true;
                        authElection.voter_sign = data.voter_sign;
                        msg = "<div class='alert alert-info'>" + data.msg + "</div>";
                    } else {
                        msg = "<div class='alert alert-danger'>" + data.msg + "</div>";
                    }
                    $("#voterRegistrationMsg").html(msg).fadeIn().delay(5000).fadeOut();
                    electionUpdating = false;
                },
                error: function() {
                    electionUpdating = false;
                    let msg = "<div class='alert alert-danger'>Cannot freeze Voters due to network/server issues.</div>";
                    $("#voterRegistrationMsg").html(msg).fadeIn().delay(5000).fadeOut();
                }
            });
        });

        $("#dumpVoters").click(function () {
            window.open(authOrigin + "/election/" + authElection.id + "/dumpVoters", '_blank');
        });

        /* open election */
        $("#electionOpen").click(function(e) {
            if (electionUpdating) return;
            electionUpdating = true;

            $.ajax({
                method: "post",
                url: authOrigin + "/election/" + authElection.id + "/open",
                data: "espUrl=" + encodeURIComponent(location.origin),
                success: function(data) {
                    let msg;
                    if(data.code == 0) {
                        /* election is closed */
                        display.find("#electionState1").fadeOut();
                        display.find("#electionState2").fadeIn();
                        msg = "<div class='alert alert-info'>" + data.msg + "</div>";
                    } else {
                        /* fail to freeze the election, maybe caused by election state changing, reload the page */
                        location.reload();
                    }

                    $("#electionMsg").html(msg).fadeIn().delay(5000).fadeOut();
                    electionUpdating = false;
                },
                error: function() {
                    $("#electionMsg")
                        .html(
                        "<div class='alert alert-danger'>" +
                        "election " + authElection.id + " opens fail " +
                        "(due to network/server issues, election not exist, or invalid election state)." + "</div>")
                        .fadeIn().delay(5000).fadeOut();
                    electionUpdating = false;
                }
            });
        });

        /* close election */
        $("#electionClose").click(function(e) {
            if (electionUpdating) return;
            electionUpdating = true;

            $.ajax({
                method: "post",
                url: authOrigin + "/election/" + authElection.id + "/close",
                data: "espUrl=" + encodeURIComponent(location.origin),
                success: function(data) {
                    let msg;
                    if(data.code == 0) {
                        /* election is closed */
                        display.find("#electionState2").fadeOut();
                        display.find("#electionState3").fadeIn();
                        showElectionResult();
                        msg = "<div class='alert alert-info'>" + data.msg + "</div>";
                    } else {
                        /* fail to freeze the election, maybe caused by election state changing, reload the page */
                        location.reload();
                    }

                    $("#electionMsg").html(msg).fadeIn().delay(5000).fadeOut();
                    electionUpdating = false;
                },
                error: function() {
                    $("#electionMsg")
                        .html(
                        "<div class='alert alert-danger'>" +
                        "election " + authElection.id + " closes fail " +
                        "(due to network/server issues, election not exist, or invalid election state)." + "</div>")
                        .fadeIn().delay(5000).fadeOut();
                    electionUpdating = false;
                }
            });
        });

        /* generate validate votes list
         * @TODO gen valid vote is not used right now, may it is a link to allow public to download valid vote and verify the summation. */
        $("#electionGenValidVote").click(function(e) {
            if (electionUpdating) return;
            electionUpdating = true;

            $.ajax({
                method: "post",
                url: "genVoteList",
                success: function(data) {
                    let msg;
                    if(data.code == 0) {
                        /* election is closed */
                        display.find("#electionState2").fadeOut();
                        display.find("#electionState3").fadeIn();
                        msg = "<div class='alert alert-info'>" + data.msg + "</div>";
                    } else {
                        /* fail to freeze the election, maybe caused by election state changing, reload the page */
                        location.reload();
                    }

                    $("#electionMsg").html(msg).fadeIn().delay(5000).fadeOut();
                    electionUpdating = false;
                },
                error: function() {
                    $("#electionMsg")
                        .html(
                        "<div class='alert alert-danger'>" +
                        "election " + authElection.id + " closes fail " +
                        "(due to network/server issues, election not exist, or invalid election state)." + "</div>")
                        .fadeIn().delay(5000).fadeOut();
                    electionUpdating = false;
                }
            });
        });

        function base64toInt(str) {
            let codec = common.sjcl.codec;
            let hexStr = codec.hex.fromBits(codec.base64.toBits(str));
            return parseInt(hexStr, 16) || 0;
        }

        function showElectionResult() {
            let summation = espElection.summation;
            let dom = "";
            if(authElection.is_verified){
                if(authElection.verify_result) {
                    dom += "<div class='alert alert-success'>Verification success</div>";
                } else {
                    dom += "<div class='alert alert-danger'>Verification fail</div>";
                }
            } else {
                dom += "<div class='alert alert-info'>Waiting to verify summations</div>"
            }

            let summationDom = $("<div></div>");
            if(summation) {

                let i, il;
                let j, jl;
                let curPos;
                for(i = 0, il = summation.length; i < il; i++) {
                    console.log(summation);
                    curPos = posistions[summation[i].pid];
                    console.log(curPos);
                    let posContainer = $('<div class="panel panel-default resultPanel"></div>');
                    let posHeader = $('<div class="panel-heading"><label>' + curPos.name + '</label></div>');
                    let candTable = "<table class='table'><thead><tr><th>Candidates</th><th>Votes</th></tr></thead><tbody>";

                    let curValues = summation[i].values;
                    for(j = 0, jl = curValues.length; j < jl; j++) {
                        candTable += "<tr><td>" + candidates[ curValues[j].cid ].name + "</td><td>" + base64toInt(curValues[j].x) + "</td></tr>";
                    }

                    candTable += "</tbody></table>";
                    posContainer.append(posHeader, candTable);
                    summationDom.append(posContainer);
                }
            } else {
                dom += "<div class='alert alert-info'>Waiting to counting</div>"
            }

            $("#electionResult").html(dom).append(summationDom);
        }
    }
});
