const sjcl = require("sjcl");
const POINT_COMPRESSED = 2;
const POINT_COMPRESSED_ODD = 3;
const POINT_UNCOMPRESSED = 4;
const base64FromBits = sjcl.codec.base64.fromBits;
const base64ToBits = sjcl.codec.base64.toBits;
const pointJac = sjcl.ecc.pointJac;
const bn = sjcl.bn;

const curve_mapping = {
    secp256r1: "c256",
    prime256v1: "c256",
    secp256k1: "k256",
    secp384r1: "c384",
    secp521r1: "c521",
};

function EllipticV2(curve_name, point) {
    // paranoia level 6 matches 512 bits of entropy.
    this.paranoia = 7;
    this.curve = sjcl.ecc.curves[curve_mapping[curve_name]];
    this.g = this.curve.G.toJac();
    this.g_inv = this.curve.G.negate().toJac();
    this.h = this.deserializePoint(point).toJac();
}

/* code is from https://github.com/bitwiseshiftleft/sjcl/issues/157 */
/**
 * Convert Affine point to x9.62 representation in bitArray
 * type 2: compressed format z||x, z:0x02 means y is even, x:0x03 means y is odd
 * type 4: z||x||y, where z = 0x04
 * @param point sjcl.ecc.point {x: sjcl.bn, y: sjcl.bn}
 * @param type int
 * @returns bitArray
 */
function pointToBits(point, type ) {
    switch (type) {
        case POINT_COMPRESSED:
            /* odd y having type 3 */
            if(point.y.limbs[0] & 1) {
                type = 3;
            }
            return sjcl.bitArray.concat(new bn(type).toBits(), point.x.toBits());
        case POINT_UNCOMPRESSED:
            return sjcl.bitArray.concat(new bn(type).toBits(), point.toBits());
        default:
            throw "Invalid type of ecc point defined in X9.62.";
    }
}

/**
 * Convert X9.62 ecc point to sjcl.ecc.point
 * @param curve sjcl.ecc.curve
 * @param bits sjcl.bitArray
 * @returns sjcl.ecc.point
 **/
function pointFromBits( curve, bits ) {
    // if the octet-length is odd, check the first octet for the type indicator
    if ( ( sjcl.bitArray.bitLength( bits ) / 8 ) & 1 ) {
        let type = sjcl.bitArray.extract( bits, 0, 8 );
        bits = sjcl.bitArray.bitSlice( bits, 8 );
        switch ( type ) {
            default: throw "Invalid ecc point type.";
            case POINT_COMPRESSED: return pointFromCompressedBits( curve, bits, 0 );
            case POINT_COMPRESSED_ODD: return pointFromCompressedBits( curve, bits, 1 );
            case POINT_UNCOMPRESSED: return curve.fromBits( bits );
        }
    } else {
        throw "Invalid length of ecc point defined in X9.62.";
    }
}

function pointFromCompressedBits(curve, x, sy ) {
    return pointFromCompressedBn(curve, curve.field.fromBits(x), sy )
}

/**
 * Convert X9.62 compressed ecc point to sjcl.ecc.point
 * @param curve sjcl.ecc.curve
 * @param x sjcl.bn
 * @param sy integer 0 mean y is even, 1 means y is odd.
 * @returns sjcl.ecc.point
 */
function pointFromCompressedBn(curve, x, sy ) {
    let X, Y, alpha, beta, modulus_div_four;
    let modulus = curve.field.modulus;
    if ( ! ( modulus.limbs[0] & 1 ) ) {
        // the math is different for F_p v. F_(2^M)
        throw "Points on Curves over F_(2^M) not implemented";
    }

    X = x;
    alpha = X.mul(curve.a.add(X.square())).addM(curve.b).mod(modulus);
    modulus_div_four = modulus.add( 1 ).normalize().halveM().halveM();

    beta = alpha.powermod( modulus_div_four, modulus );

    let sbeta = beta.limbs[0] & 1;

    if ( sbeta == sy ) {
        Y = beta;
    } else {
        Y = modulus.sub( beta ).normalize();
    }

    let p = new sjcl.ecc.point(curve, X, Y);
    if (!p.isValid()) {
        throw new sjcl.exception.corrupt("not on the curve!");
    }
    return p;
}

EllipticV2.prototype.genRandom = function (){
    return bn.random(this.curve.r, this.paranoia);
};

/* utility functions */
/**
 * Serializes a number as a hex string
 * @param num BN to serialize
 * @returns string
 */
EllipticV2.prototype.serializeBN = function (num){
    return base64FromBits(num.toBits());
};
/**
 * deserializes a number
 * @param serialized
 * @returns bn
 */
EllipticV2.prototype.deserializeBN = function (serialized){
    return bn.fromBits(base64ToBits(serialized));
};

/**
 * Seriaizes each component of a point
 * @param point
 * @returns string in base64 encoding (z||x||y), where z = 0x04
 */
EllipticV2.prototype.serializePoint = function (point){
    return base64FromBits(pointToBits(point, POINT_UNCOMPRESSED));
};

EllipticV2.prototype.deserializePoint = function (point){
    return pointFromBits(this.curve, base64ToBits(point));
};

/**
 * Function to verify the x, y, and z relationship.
 * @param x:string
 * @param y:string
 * @param z:string
 * @returns {boolean}, whether verification passes or fails.
 */
EllipticV2.prototype.verify_xyz = function (x, y, z) {
    let g = this.g;
    x = this.deserializeBN(x);
    y = this.deserializeBN(y);
    let z_bn = g.multJac2(x, g, y, this.h);
    let tmpZ = this.deserializePoint(z);
    return z_bn.equalsAffine(tmpZ);
};

EllipticV2.prototype.generate_vote= function (tellers, pos) {
    let curve = this.curve;
    let g = this.g;
    let h = this.h;
    let modulus = curve.r;
    let commits = [];
    let proofs = [];
    let sumX = [];
    let sumY = [];
    let sumZ = [];

    /* initial sums */
    for(let j = 0, jl = pos.length; j<jl; j++) {
        sumX[j] = new Array(pos[j].cand.length);
        sumY[j] = new Array(pos[j].cand.length);
        sumZ[j] = new Array(pos[j].cand.length);
        proofs[j] = new Array(pos[j].cand.length + 1);
    }

    console.time("gen matrix");
    for(let i = 0, il = tellers.length; i < il; i++) {
        let curCommitData = [];

        for(let j = 0, jl = pos.length; j<jl; j++) {
            let curPos = pos[j];
            let cand = curPos.cand;
            let curPosData = {};
            let values = [];
            curPosData.pid = curPos.pid;

            for(let k = 0, kl = cand.length; k < kl; k++) {
                let x_bn;
                let cid = cand[k];

                if(i == il-1) {
                    let sum = 0;
                    if (cid == curPos.cid) {
                        sum = 1;
                    }
                    /* handle only one teller case which does not split shares */
                    x_bn = sumX[j][k] === undefined ? new curve.field(sum) : new curve.field(sum).subM(sumX[j][k]);
                    x_bn = x_bn.mod(modulus);
                } else {
                    x_bn = this.genRandom();
                }

                let y_bn = this.genRandom();
                let z = g.multJac2(x_bn, g, y_bn, h);

                values.push({
                    cid: cid,
                    x: this.serializeBN(x_bn),
                    y: this.serializeBN(y_bn),
                    z: this.serializePoint(z.toAffine())
                });

                if(sumX[j][k] === undefined) {
                    sumX[j][k] = x_bn;
                } else {
                    sumX[j][k].addM(x_bn);
                }

                if(sumY[j][k] === undefined) {
                    sumY[j][k] = y_bn;
                } else {
                    sumY[j][k].addM(y_bn);
                }

                if(sumZ[j][k] === undefined) {
                    sumZ[j][k] = z;
                } else {
                    sumZ[j][k] = sumZ[j][k].addJac(z);
                }
            }
            curPosData.values = values;
            curCommitData.push(curPosData);
        }

        commits.push(curCommitData);
    }
    console.timeEnd("gen matrix");

    console.time("gen proof");
    for(let j = 0, jl = pos.length; j<jl; j++) {
        let curPos = pos[j];
        let cand = curPos.cand;
        let curSumY = new bn(0);
        let curSumZ = new pointJac(curve);
        let k, kl;
        for(k = 0, kl = cand.length; k < kl; k++) {

            let cid = cand[k];
            let y = sumY[j][k];
            let z = sumZ[j][k];

            if (cid == curPos.cid) {
                proofs[j][k] = this.proof_01(z, y, 1);
            } else {
                proofs[j][k] = this.proof_01(z, y, 0);
            }

            curSumY.addM(y);
            curSumZ = curSumZ.addJac(z);
        }

        /* normalize the sum of Y in order to propagate carries */
        curSumY.normalize();
        if(curPos.cid >= 0) {
            proofs[j][kl] = this.proof_01(curSumZ, curSumY, 1);
        } else {
            proofs[j][kl] = this.proof_01(curSumZ, curSumY, 0);
        }
    }
    console.timeEnd("gen proof");

    return {
        commits: commits,
        proofs: proofs
    };
};


/******************** proof *********************/
/**
 * Inside function that takes g, h, z, y and output  d, f
 * @param z:sjcl.ecc.pointJac
 * @param y:bn
 * @returns {{d: {x:string,y:string}, f: string}} object
 */
EllipticV2.prototype.proof_1 = function proof_1(z, y) {
    const curve = this.curve;
    const h = this.h;
    const r = this.genRandom();
    const d = h.mult(r);
    const hash = new sjcl.hash.sha256();
    const m_bits = pointToBits(z.toAffine(), POINT_UNCOMPRESSED);
    const d_bits = pointToBits(d, POINT_UNCOMPRESSED);
    hash.update(m_bits);
    hash.update(d_bits);
    const e = bn.fromBits(hash.finalize());
    const f = r.sub(e.mul(y)).mod(curve.r);
    return {
        'd': base64FromBits(d_bits),
        'f': this.serializeBN(f)
    };
};

/**
 * Inside function that takes g, h, z, y, b and output d0, d1, e0, d1, f0, f1
 * @param z:sjcl.ecc.pointJac
 * @param y:bn
 * @param b:int, whether to prove a 0 or 1
 * @returns {{d0: {x:string,y:string}, d1: {x:string,y:string}, e0: string, e1: string, f0: string, f1: string}} proof
 */
EllipticV2.prototype.proof_01 = function (z, y, b) {
    const curve = this.curve;
    const h = this.h;
    let r, e_bar, f_bar;

    r = this.genRandom();
    e_bar = this.genRandom();
    f_bar = this.genRandom();

    const d = h.multJac(r, h);
    let d0, d1;

    if (b == 1) {
        d0 = h.multJac2(f_bar, h, e_bar, z);
        d1 = d;
    } else {
        d0 = d;
        let tmp = this.g_inv.addJac(z);
        d1 = h.multJac2(f_bar, h, e_bar, tmp);
    }

    const hash = new sjcl.hash.sha256();
    const z_bits = pointToBits(z.toAffine(), POINT_UNCOMPRESSED);
    const d0_bits = pointToBits(d0.toAffine(), POINT_UNCOMPRESSED);
    const d1_bits = pointToBits(d1.toAffine(), POINT_UNCOMPRESSED);
    hash.update(z_bits);
    hash.update(d0_bits);
    hash.update(d1_bits);
    const e = bn.fromBits(hash.finalize());

    const e_b = e.sub(e_bar).mod(curve.r);
    const f_b = r.sub(e_b.mul(y)).mod(curve.r);
    let e0, e1, f0, f1;

    if (b == 1) {
        e0 = e_bar;
        e1 = e_b;
        f0 = f_bar;
        f1 = f_b;
    } else {
        e0 = e_b;
        e1 = e_bar;
        f0 = f_b;
        f1 = f_bar;
    }

    return {
        'd0': base64FromBits(d0_bits),
        'd1': base64FromBits(d1_bits),
        'e0': this.serializeBN(e0),
        'e1': this.serializeBN(e1),
        'f0': this.serializeBN(f0),
        'f1': this.serializeBN(f1)
    };
};

/**
 * Function to verify a proof of value 1
 * @param proof:json object, proof part of the vote json object
 * @param z: sjcl.ecc.pointJac the sum of zs from all shares
 *           which equals to g^1 * h^y
 * @returns {boolean}, whether the proof is correct
 */
EllipticV2.prototype.verify_proof_1 = function (proof, z) {
    const h = this.h;
    const curve = this.curve;
    const z_bits = pointToBits(z.toAffine(), POINT_UNCOMPRESSED);
    const d_bits = base64ToBits(proof.d);
    const hash = new sjcl.hash.sha256();
    hash.update(z_bits);
    hash.update(d_bits);
    const e = bn.fromBits(hash.finalize());
    const f = this.deserializeBN(proof.f);
    const d = pointFromBits(curve, d_bits);

    const hJac = h.toJac();
    const tmp = z.addJac(this.g_inv);
    const d_p_jac = hJac.multJac2(f, hJac, e, tmp);
    return d_p_jac.equalsAffine(d);
};

/**
 * Function to verify a proof of value 0 or 1
 * @param proof:json object, proof part of the vote json object
 * @param z: sjcl.ecc.pointJac the sum of zs from all shares
 *           which equals to g^1 * h^y
 * @returns {boolean}, whether the proof is correct
 */
EllipticV2.prototype.verify_proof_01 = function (proof, z) {
    const curve = this.curve;
    const g = this.g;
    const h = this.h;
    const modulus = curve.r;
    const z_bits = pointToBits(z.toAffine(), POINT_UNCOMPRESSED);
    const d0_bits = base64ToBits(proof.d0);
    const d1_bits = base64ToBits(proof.d1);
    const hash = new sjcl.hash.sha256();
    hash.update(z_bits);
    hash.update(d0_bits);
    hash.update(d1_bits);
    const e = bn.fromBits(hash.finalize());
    const e0 = this.deserializeBN(proof.e0);
    const e1 = this.deserializeBN(proof.e1);

    /* check e = e0 + e1 first */
    let res = e0.add(e1).sub(e).mod(modulus).equals(new bn(0));
    if( !res ) {
        return false;
    }

    const f0 = this.deserializeBN(proof.f0);
    const f1 = this.deserializeBN(proof.f1);
    const d0 = pointFromBits(curve, d0_bits);
    const d1 = pointFromBits(curve, d1_bits);

    const hJac = h;
    const zJac = z;
    const d0_p_jac = hJac.multJac2(f0, hJac, e0, zJac);
    const tmp = zJac.add(this.g_inv);
    const d1_p_jac = hJac.multJac2(f1, hJac, e1, tmp);

    return d0_p_jac.equalsAffine(d0) && d1_p_jac.equalsAffine(d1);
};

/**
 * Add two Jac points
 *
 * U1 = X1*Z2^2
 * U2 = X2*Z1^2
 * S1 = Y1*Z2^3
 * S2 = Y2*Z1^3
 * if (U1 == U2)
 *      if (S1 != S2)
 *          return POINT_AT_INFINITY
 *      else
 *          return POINT_DOUBLE(X1, Y1, Z1)
 * H = U2 - U1
 * R = S2 - S1
 * X3 = R^2 - H^3 - 2*U1*H^2
 * Y3 = R*(U1*H^2 - X3) - S1*H^3
 * Z3 = H*Z1*Z2
 * return (X3, Y3, Z3)
 * @param {sjcl.ecc.pointJac} T
 * @returns {sjcl.ecc.pointJac}
 *
 */
pointJac.prototype.addJac = function (T) {

    if (T.isIdentity) {
        return this;
    } else if (T.z.equals(1)) {
        return this.add(new sjcl.ecc.point(T.curve, T.x, T.y));
    } else if(this.isIdentity) {
        return T;
    }

    let x1 = this.x, y1 = this.y, z1 = this.z;
    let x2 = T.x, y2 = T.y, z2 = T.z;

    let sz1 = z1.square();
    let sz2 = z2.square();

    let U1 = x1.mul(sz2);
    let U2 = x2.mul(sz1);
    let S1 = y1.mul(sz2.mul(z2));
    let S2 = y2.mul(sz1.mul(z1));

    let H = U2.subM(U1);

    if(H.equals(0)) {
        if(S1.equals(S2)) {
            // same point
            return S.doubl();
        } else {
            // inverses
            return new pointJac(S.curve);
        }
    }

    let R = S2.subM(S1);
    let sH = H.square();
    let cH = H.mul(sH);

    let x3 = R.square().subM(cH).subM( U1.add(U1).mul(sH) );
    let y3_1 = U1.mul(sH).subM(x3).mul(R);
    let y3_2 = S1.mul(cH);
    let y3 = y3_1.subM(y3_2);
    let z3 = H.mul(z1).mul(z2);

    return new pointJac(this.curve, x3, y3, z3);
};

pointJac.prototype.multJac = function(k, jac) {
    if (typeof(k) === "number") {
        k = [k];
    } else if (k.limbs !== undefined) {
        k = k.normalize().limbs;
    }

    let i, j, out = new pointJac(this.curve), multiples = jac.multiples(), l;

    for (i=k.length-1; i>=0; i--) {
        l = k[i] | 0;
        for (j=bn.prototype.radix-4; j>=0; j-=4) {
            out = out.doubl().doubl().doubl().doubl().addJac(multiples[l>>j & 0xF]);
        }
    }

    return out;
};

pointJac.prototype.multJac2 = function(k1, jac1, k2, jac2) {
    if (typeof(k1) === "number") {
        k1 = [k1];
    } else if (k1.limbs !== undefined) {
        k1 = k1.normalize().limbs;
    }

    if (typeof(k2) === "number") {
        k2 = [k2];
    } else if (k2.limbs !== undefined) {
        k2 = k2.normalize().limbs;
    }

    let i, j, out = new pointJac(this.curve), m1 = jac1.multiples(),
        m2 = jac2.multiples(), l1, l2;

    for (i=Math.max(k1.length, k2.length)-1; i>=0; i--) {
        l1 = k1[i] | 0;
        l2 = k2[i] | 0;
        for (j=bn.prototype.radix-4; j>=0; j-=4) {
            out = out.doubl().doubl().doubl().doubl().addJac(m1[l1>>j & 0xF]).addJac(m2[l2>>j & 0xF]);
        }
    }

    return out;
};

pointJac.prototype.multiples = function() {
    let m, i, j;
    if (this._multiples === undefined) {
        j = this.doubl();
        m = this._multiples = [new pointJac(this.curve), this, j];
        for (i=3; i<16; i++) {
            j = j.addJac(this);
            m.push(j);
        }
    }
    return this._multiples;
};

pointJac.prototype.equalsAffine = function(affine) {
    if(this.isIdentity) {
        if(affine.isIdentity) {
            return true;
        } else {
            return false;
        }
    }

    let sz = this.z.square();
    return affine.x.mul(sz).equals( this.x ) &&
        affine.y.mul(sz).mul(this.z).equals( this.y );
};

module.exports = EllipticV2;
