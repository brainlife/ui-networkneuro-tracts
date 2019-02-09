const fs = require('fs');
const index = JSON.parse(fs.readFileSync("networkneuro-apart/index.json", "ascii"));

const batches = {}; //organized by roi1

index.roi_pairs.forEach(pair=>{
    if(pair.filename != "") {
        console.log("loading");
        console.dir(pair);
        if(batches[pair.roi1] === undefined) batches[pair.roi1] = [];
        pair.idx = batches[pair.roi1].length;
        batches[pair.roi1].push(JSON.parse(fs.readFileSync("networkneuro-apart/"+pair.filename, "ascii")));
        pair.filename = pair.roi1+".json";
    }
});

fs.writeFileSync("networkneuro/index.json", JSON.stringify(index));

for(let roi in batches) {
    console.log(roi);
    fs.writeFileSync("networkneuro/"+roi+".json", JSON.stringify(batches[roi]));
}

