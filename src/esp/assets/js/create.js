requirejs([
    "jquery"
], function($) {

    let posId = 0;
    let position = {};
    let posDomBox = $("#posDomBox");
    let posAddField = $("#PosAddField");

    /* delete position */
    posDomBox.on("click", "button.posRemove", function(e){
        let name = $(this).val();
        position[name].dom.remove();
        delete position[name];
    });

    /* add new position */
    function AddPosition() {
        let name = posAddField.val().trim();
        if(name && !position[name]) {

            let pos = $('<div class="panel panel-default posPanel"></div>');
            let posHeader =
                $('<div class="panel-heading">' +
                    '<label>' + name + '</label>' +
                    '<button class="btn btn-danger posRemove" value="' + name + '">Remove</button>' +
                    '</div>');
            let posBody = $('<div class="panel-body"></div>');
            let candidateInput =
                '<div class="input-group">' +
                    '<input type="text" data-name="' + name + '" placeholder="Add new candidate" class="form-control addCandidateInput"/>' +
                    '<span class="input-group-btn">' +
                        '<button type="button" data-name="' + name + '" class="btn btn-success addCandidateBtn">Add</button>' +
                    '</span>' +
                '</div>';
            let warning =
                $('<div class="alert alert-danger" style="display: none">' +
                    'Position <b>' + name + '</b> should has at least two candidates.' +
                '</div>');
            posBody.append(candidateInput, warning);

            pos.append(posHeader, posBody);
            posDomBox.append(pos);
            position[name] = {
                id: posId ++,
                name: name,
                dom: pos,
                domHeader: posHeader,
                domBody: posBody,
                domWarning: warning,
                candidate: {}
            };
            posAddField.val("");
        }
    }

    /* position text field event */
    posAddField.on("keypress", function(e){
        if(e.keyCode == 13) {
            AddPosition();
            e.preventDefault();
        }

    });

    /* position add button event */
    $("#PosAddBtn").on("click", function(e){
        AddPosition();
        e.preventDefault();
    });

    let candId = 0;

    /* position text field event */
    posDomBox.on("keypress", ".addCandidateInput", function(e){
        if(e.keyCode == 13) {
            AddCandidate($(this).data("name"));
            e.preventDefault();
        }
    });

    /* position add button event */
    posDomBox.on("click", ".addCandidateBtn", function(e){
        AddCandidate($(this).data("name"));
        e.preventDefault();
    });

    /* add new candidate */
    function AddCandidate(posName) {
        let curPos = position[posName];
        let candidate = curPos.candidate;
        let input = curPos.domBody.find(".addCandidateInput");
        let name = input.val().trim();

        if(name && !candidate[name]) {

            let cand =
                $('<div class="btn-group">' +
                    '<div class="btn btn-default">' + name + '</div>' +
                    '<button type="button" class="btn btn-default delCandidate" data-pos="' + posName + '" data-cand="' + name + '">' +
                        '<span class="glyphicon glyphicon-remove text-danger"></span>' +
                    '</button>' +
                '</div>');

            candidate[name] = {
                id: candId ++,
                name: name,
                dom: cand
            };
            curPos.domBody.append(cand);
            input.val("");
        }
    }

    /* delete candidates */
    posDomBox.on("click", "button.delCandidate", function(e){
        let posName = $(this).data("pos");
        let candName = $(this).data("cand");
        let candidate = position[posName].candidate;
        candidate[candName].dom.remove();
        delete candidate[candName];
    });

    /* form submission */
    $("#createElection").submit(function(e){
        let valid = true;
        let electionName = $(this).find("input[name='electionName']").val().trim();
        if(electionName == "") {
            valid = false;
            $("#electionNameWarning").fadeIn().delay(5000).fadeOut();
        }

        /* auth server validation */
        let authServer = $(this).find("input[name='authServer']").val().trim();
        try {
            let authUrl = new URL(authServer);
            if (authUrl.protocol != "http:" && authUrl.protocol != "https:") {
                throw "";
            }
        } catch (e) {
            valid = false;
            $("#authServerWarning").fadeIn().delay(5000).fadeOut();
        }

        /* auth s tunnel port validation */
        let authTunnelPort = parseInt($(this).find("input[name='authTunnelPort']").val().trim(), 10);
        if( !(authTunnelPort > 0 && authTunnelPort < 65536) ) {
            valid = false;
            $("#authTunnelPortWarning").fadeIn().delay(5000).fadeOut();
        }

        /* ESP s tunnel port validation */
        let espTunnelPort = parseInt($(this).find("input[name='espTunnelPort']").val().trim(), 10);
        if( !(espTunnelPort > 0 && espTunnelPort < 65536) ) {
            valid = false;
            $("#espTunnelPortWarning").fadeIn().delay(5000).fadeOut();
        }

        let curPos;
        let _positions = [];
        let _candidate = [];
        let posCandMapping = [];
        let curPosCandidate;
        let curPosCandidateCount;
        for(let posName in position) {
            curPos = position[posName];
            _positions.push({
                id: curPos.id,
                name: curPos.name
            });

            curPosCandidate = curPos.candidate;
            curPosCandidateCount = 0;

            for(let candName in curPosCandidate) {
                let curCand = curPosCandidate[candName];
                _candidate.push({
                    id: curCand.id,
                    name: curCand.name
                });
                posCandMapping.push({pid: curPos.id, cid: curCand.id});
                curPosCandidateCount ++;
            }

            if(curPosCandidateCount < 2) {
                valid = false;
                curPos.domWarning.fadeIn().delay(5000).fadeOut();
            }
        }

        if(_positions.length == 0) {
            valid = false;
            $("#PositionWarning").fadeIn().delay(5000).fadeOut();
        }

        /* the form data is valid, do the creation */
        if(valid) {
            $.ajax({
                method: "post",
                url: "",
                data: {
                    authServer: authServer,
                    tunnelPort: espTunnelPort
                },
                success: function (data) {
                    if(data.code == 0) {
                        /* create election success */
                        createElectionOnAuth(authServer, {
                            eid: data.id,
                            name: electionName,
                            tunnelPort: authTunnelPort,
                            pos: _positions,
                            cand: _candidate,
                            posCandMapping: posCandMapping
                        });
                    } else {
                        /* create election fail */
                        $("#CreateElectionFail").fadeIn();
                    }
                },
                error: function () {
                    $("#CreateElectionFail").fadeIn();
                }
            })
        }

        return false;
    });

    function createElectionOnAuth(authServer, data) {
        let authUrl = new URL(authServer);
        let eid = data.eid;
        $.ajax({
            method: "post",
            url: authUrl.protocol + "//" + authUrl.hostname +
                (authUrl.port != null ? ':' + authUrl.port : '') + "/create",
            data: JSON.stringify(data),
            contentType: "application/json; charset=utf-8",
            success: function (data) {
                if(data.code == 0) {
                    /* create election success */
                    location.replace("election/" + eid + "/");
                } else {
                    /* create election fail */
                    $("#CreateElectionFail").fadeIn();
                }
            },
            error: function () {
                $("#CreateElectionFail").fadeIn();
            }
        });
    }
});
