let vidStart = parseInt(process.argv[2]);
let vidCount = parseInt(process.argv[3]);

for(let i=0; i<vidCount; i++) {
    let vid = vidStart + i;
    console.log(`${vid}@example.com`);
}
