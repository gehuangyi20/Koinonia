let PKI = require('../src/common/PKI');

try {
    let pki = new PKI('./priv.pem', '123456');
    let str = `hello world`;
    let status = true;
    console.time('PKI test');
    for(let i=0; i<100; i++) {
        let sign = pki.sign(str);
        if(!pki.verify(str, sign)) {
            status = false;
            break;
        }
    }
    console.timeEnd('PKI test');
    console.log(status ? `PKI test success` : `PKI test fails`);

    let signStream = pki.createSignStream();
    let data = [
        "Lorem Ipsum is simply dummy text of the printing and typesetting ",
        "industry. Lorem Ipsum has been the industry's standard dummy text ",
        "ever since the 1500s, when an unknown printer took a galley of type ",
        "and scrambled it to make a type specimen book. It has survived not ",
        "only five centuries, but also the leap into electronic typesetting, ",
        "remaining essentially unchanged. It was popularised in the 1960s ",
        "with the release of Letraset sheets containing Lorem Ipsum ",
        "passages, and more recently with desktop publishing software like ",
        "Aldus PageMaker including versions of Lorem Ipsum."
    ];
    console.time('PKI stream sign');
    for(let i=0, il=data.length; i<il; i++) {
        signStream.update(data[i]);
    }
    let signature = signStream.final();
    console.timeEnd('PKI stream sign');
    console.log(signature);

    let verifyStream = pki.createVerifyStream();
    console.time('PKI stream verify');
    for(let i=0, il=data.length; i<il; i++) {
        verifyStream.update(data[i]);
    }
    let result = verifyStream.final(signature);
    console.timeEnd('PKI stream verify');
    console.log(result ? 'PKI stream verify success' : 'PKI stream verify fails');
} catch (e) {
    console.log(e);
}