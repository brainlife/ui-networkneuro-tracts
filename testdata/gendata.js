#!/usr/bin/env node

const fs = require('fs');

/*
{
   "coords": [
       [
           [ -48.33, -49.33, -50.33 ],  
           [ 18.33, 19.33, 10.33 ],    
           [ 28.33, 29.33, 20.33 ]
       ],
       [
           [ -45.33, -4233, -50.33 ],
           [ 28.33, 29.33, 20.33 ],
           [ 8.33, 9.33, 0.33 ]
       ]
   ]
}

[
   {
       "roi1": 1001,
       "roi2": 1002,
       "weights": {
           "count": 333,
           "densitiy": 333,
           "otherthing": 333,
       },
       "filename": "1001_1002.json"
   },
]
*/

function gen_fiber() {
    let fiber = [];
    for(let i = 0;i < 3;++i) {
        let coords = [];
        let v = Math.random()*20-10;
        let dv = Math.random()-0.5;
        let ddv = (Math.random()-0.5)/10;
        for(let x = 0;x < 40;++x) {
            v += dv;
            dv += ddv;
            coords.push(v);
        }
        fiber.push(coords);
    }
    return fiber;
}

let rois = [];

let columns = [];
for(let i = 1001;i < 1036;++i) {
    if(i == 1004) continue;
    columns.push(i);
}
for(let i = 2001;i < 2036;++i) {
    if(i == 2004) continue;
    columns.push(i);
}

for(let a = 0; a < columns.length;a++) {
    for(let b = a+1; b < columns.length;b++) {
        let roi1 = columns[a].toString();
        let roi2 = columns[b].toString();
        let filename = roi1+"_"+roi2+".json";
        console.log(filename);
        rois.push({
            roi1,
            roi2,
            weights: {
                count: Math.random(),
                density: Math.random(),
            },
            filename,
        });        

        let coords = [];
        for(let i = 0;i < 100;++i) {
            coords.push(gen_fiber());
        }
        fs.writeFileSync("networkneuro/"+filename, JSON.stringify({coords}, null, 4));
    }
}

fs.writeFileSync("networkneuro/index.js", "var roi_pairs = "+JSON.stringify(rois, null, 4));
