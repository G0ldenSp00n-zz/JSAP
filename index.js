let express = require('express');
let app = express();
let fs = require('fs');
let md5 = require('md5');
let path = require('path');
let DiffMatchPatch = require('diff-match-patch');
const dmp = new DiffMatchPatch();

const BLOCK_SIZE = 100000;

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/dmp', (req, res) => {
    res.sendFile(__dirname + '/dmp.js');
})

app.get('/deltaPatcher.js', (req, res) => {
    res.sendFile(__dirname + '/deltaPatcher.js');
})

app.get('/fullFile/:filePath', (req, res) => {
    res.sendFile(__dirname + '/clientDelta/' + req.params.filePath);
});

let PAKTable = {};

app.get('/pakPatch/:hash/:filePath', (req, res) => {
    console.log('RUNNING')
    console.log(req.params.hash, req.params.filePath)

    let pakPath = req.params.filePath.split('.')[0].concat('.PAK');

    fs.readFile(path.resolve(__dirname, 'clientDelta/.deltaPAK/', pakPath), 'utf-8', function (err, data) {
        let pakData = JSON.parse(data);
        console.log(pakData[pakData.data.current].hash, req.params.hash)
        if(pakData[pakData.data.current].hash === req.params.hash) {
            return res.send({hash: req.params.hash, patches: []});
        }

        console.log(pakData[0].hash, req.params.hash)
        let foundHash = (pakData[0].hash === req.params.hash);
        let patches = [];

        for(let i = 1; i <= pakData.data.current; i++){
            if(foundHash) {
                patches.push(JSON.parse(pakData[i].patch)[0]);
            } else {
                if(pakData[i].hash === req.params.hash) {
                    foundHash = true;
                }
            }
        }

        if(!foundHash) {
            fs.readFile(path.resolve(__dirname, "clientDelta", req.params.filePath), function (data) {
                return res.json({hash:req.param.hash, file: data});
            });
        } else {
            console.log(patches)
            return res.json({hash: req.params.hash, patches: patches});
        }
    })
    // function generatePAK() {
    //     fs.readFile(__dirname + "/clientDelta/" + req.params.filePath, 'utf-8', (err, data) => {
    //         if(err) return res.status(404).send("Specified File Does Not Exist");

    //         let pakData = {root: md5(data)};

    //         const PAK_SIZE = Math.ceil(data.length / BLOCK_SIZE);
    //         console.log("LOADED FILE PAK_SIZE", PAK_SIZE);
    //         for(let pakNum = 0; pakNum < PAK_SIZE; pakNum++) {
    //             pakData[pakNum] = {
    //                 hash: md5(data.substring((pakNum) * BLOCK_SIZE, (pakNum) + 1 * BLOCK_SIZE)),
    //                 start: data.substring((pakNum) * BLOCK_SIZE, ((pakNum) * BLOCK_SIZE) + 25),
    //                 blockSize: BLOCK_SIZE
    //             };
    //         }
    //         PAKTable[req.params.filePath] = pakData;
    //         return res.send(pakData)
    //     });
    // }

    // function updatePAK(oldPAK){
    //     res.send(oldPAK);
    // }

    // if(!PAKTable[req.params.filePath]) {
    //     return generatePAK();
    // } else {
    //     console.log("RETURNING CACHED")
    //     return updatePAK(PAKTable[req.params.filePath]);
    // }
});

app.get('/pakGet/:filePath', (req, res) => {
    console.log(req.params.filePath)
    fs.readFile(path.resolve(__dirname, "clientDelta", req.params.filePath), 'utf-8', (err, data) => {
        if(err) return res.status(404).send("Specified File Does Not Exist");

        res.json({hash: md5(data), file: data})
    });
});

// process.stdin.resume();
// process.on ('exit', code => {
//   let i;

//   fs.writeSync()

//   process.exit (code);
// });

// // Catch CTRL+C
// process.on ('SIGINT', () => {
//   process.exit (0);
// });

let deltaFiles = fs.readdirSync(path.resolve(__dirname, 'clientDelta'));
if(!fs.existsSync(path.resolve(__dirname, 'clientDelta/.deltaPAK'))) {
    fs.mkdirSync(path.resolve(__dirname, 'clientDelta/.deltaPAK'));
}
let deltaFilesPAK = fs.readdirSync(path.resolve(__dirname, 'clientDelta/.deltaPAK'));

deltaFiles.forEach((item) => {
    if(item !== path.resolve(__dirname, 'clientData/.deltaPAK')){
        let pakPath = item.split('.')[0].concat('.PAK');
        if(deltaFilesPAK.includes(pakPath)){
            let pak = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'clientDelta/.deltaPAK/', pakPath), 'utf-8'));
            let file = fs.readFileSync(path.resolve(__dirname, 'clientDelta', item), 'utf-8');
            let patchedFile = Buffer.from(pak['0'].data, 'base64').toString();
            for(let i = 1; i <= pak.data.current; i++) {
                patchedFile = dmp.patch_apply(JSON.parse(pak[i].patch), patchedFile)[0];
            }
            
            if(pak[pak.data.current].hash !== md5(file)) {
                pak[++pak.data.current] = {
                    hash: md5(file),
                    patch: JSON.stringify(dmp.patch_make(dmp.diff_main(patchedFile, file))),
                }
                fs.writeFileSync(path.resolve(__dirname, 'clientDelta/.deltaPAK/', pakPath), JSON.stringify(pak), 'utf-8');
            }
        } else {
            if(item.split('.').length > 1 && item.split('.')[0].length > 0){
                let file = fs.readFileSync(path.resolve(__dirname, 'clientDelta', item), 'utf-8');
                fs.writeFileSync(path.resolve(__dirname, 'clientDelta/.deltaPAK/', pakPath), JSON.stringify({data: {current: 0}, '0': {hash: md5(file), data: Buffer.from(file).toString('base64')}}), 'utf-8');
            }
        }
    }
})


app.listen(9000, () => console.log("Listening on Port 9000"));