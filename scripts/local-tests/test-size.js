const fs = require('fs');
const pm = JSON.parse(fs.readFileSync('artifacts/PredictionMarket.json')).bytecode;
console.log("PredictionMarket bytes:", pm.length / 2);
