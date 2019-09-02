const pg = require('pg');
const dbConfig = require('./dbConfig');
const util = require('../common/util');
const schema = dbConfig.schema;

async function createElection(data) {
    const invalidData = {
        code: -2,
        msg: "Invalid data."
    };

    const dbIssue = {
        code: -3,
        msg: `Database issue.`
    };

    if(!(
        data !== null &&
        typeof data === "object" &&
        Number.isInteger(data.eid) &&
        util.validPort(data.tunnelPort) &&
        Array.isArray(data.pos) &&
        Array.isArray(data.cand) &&
        Array.isArray(data.posCandMapping)
    )) {
        return invalidData;
    }

    /* valid position */
    let pos = data.pos;
    let posIds = {};
    let posNames = {};
    for(let i=0, il=pos.length ; i<il; i++) {
        let curPos = pos[i];
        if (!(
                typeof curPos === 'object' &&
                curPos !== null &&
                Number.isInteger(curPos.id) &&
                typeof curPos.name === 'string' &&
                /* pos name cannot be empty */
                curPos.name !== '' &&
                /* unique position name */
                posIds[curPos.id] === undefined &&
                /* unique position name */
                posNames[curPos.name] === undefined
            )) {
            return invalidData;
        }
        posIds[curPos.id] = {
            id: {},
            name: {},
            count: 0
        };
        posNames[curPos.name] = 0;
    }

    /* valid candidates */
    let cand = data.cand;
    let candIds = {};
    for(let i=0, il=cand.length ; i<il; i++) {
        let curCand = cand[i];
        if (!(
                typeof curCand === 'object' &&
                curCand !== null &&
                Number.isInteger(curCand.id) &&
                typeof curCand.name === 'string' &&
                /* cand name cannot be empty */
                curCand.name !== '' &&
                /* unique cand id */
                candIds[curCand.id] === undefined
            )) {
            return invalidData;
        }
        candIds[curCand.id] = curCand.name;
    }

    /* validate pos candidate mapping */
    let map = data.posCandMapping;
    for(let i=0, il=map.length ; i<il; i++) {
        let curMap = map[i];
        let curCandName;
        if (!(
                typeof curMap === 'object' &&
                curMap !== null &&
                Number.isInteger(curMap.pid) &&
                Number.isInteger(curMap.cid) &&
                /* check whether we have this position id */
                typeof posIds[curMap.pid] === 'object' &&
                /* check whether we have this candidate id */
                typeof candIds[curMap.cid] === 'string' &&
                /* assign cand name */
                (curCandName = candIds[curMap.cid]) &&
                /* unique cid for current position */
                posIds[curMap.pid]['id'][curMap.cid] === undefined &&
                /* unique cand name for current position */
                posIds[curMap.pid]['name'][curCandName] === undefined
            )) {
            return invalidData;
        }
        posIds[curMap.pid]['id'][curMap.cid] = curMap.cid;
        posIds[curMap.pid]['name'][curCandName] = curMap.cid;
        posIds[curMap.pid].count ++;
    }

    /* make sure each position has at least two candidates */
    for(let id in posIds) {
        if(posIds[id].count < 2) {
            return invalidData;
        }
    }

    const client = new pg.Client(dbConfig);
    let abort = true;

    try {
        await client.connect();
        console.log("connected");
        await client.query('BEGIN');
        console.log("begin");

        /* insert election information */
        let eid = data.eid;
        let result = await client.query(
`INSERT INTO ${schema}.election (id, name, state, tunnel_port) 
VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING;`,
            [eid, data.name, 0, data.tunnelPort]);

        if(result.rowCount != 1) {
            return dbIssue;
        }
        console.log("INSERT election");

        /* insert election position */
        let queryData = {
            text: `INSERT INTO ${schema}.elec_position (eid, pid, name) VALUES ($1, $2, $3);`,
            name: 'insertPos'
        };
        for(let i=0, il=pos.length ; i<il; i++) {
            let curPos = pos[i];
            queryData.values = [eid, curPos.id, curPos.name];
            if(i > 0) {
                delete queryData.text;
            }
            result = await client.query(queryData);
            if(result.rowCount != 1) {
                return dbIssue;
            }
        }
        console.log(`INSERT ${pos.length} Position`);

        /* insert election candidates */
        queryData = {
            text: `INSERT INTO ${schema}.candidate (eid, cid, name) VALUES ($1, $2, $3);`,
            name: 'insertCand'
        };

        for(let i=0, il=cand.length ; i<il; i++) {
            let curCand = cand[i];
            queryData.values = [eid, curCand.id, curCand.name];
            if(i > 0) {
                delete queryData.text;
            }
            result = await client.query(queryData);
            if(result.rowCount != 1) {
                return dbIssue;
            }
        }
        console.log(`INSERT ${cand.length} Candidate`);

        /* insert pos and candidates mapping */
        queryData = {
            text: `INSERT INTO ${schema}.position_candidate_map (eid, pid, cid) VALUES ($1, $2, $3);`,
            name: 'insertMap'
        };
        for(let i=0, il=map.length ; i<il; i++) {
            let curMap = map[i];
            queryData.values = [eid, curMap.pid, curMap.cid];
            if(i > 0) {
                delete queryData.text;
            }
            result = await client.query(queryData);
            if(result.rowCount != 1) {
                return dbIssue;
            }
        }
        console.log(`INSERT ${map.length} PosCandMapping`);

        /* commit election insertion */
        await client.query('COMMIT');
        console.log("commit");
        abort = false;
        return {
            code: 0,
            msg: "election creation success",
        }
    } catch (e) {
        console.log(e);
        return {
            code: -1,
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

module.exports = createElection;