const path=require('node:path'),fs=require('node:fs');
require('./scripts/structured-data.cjs').generate();
require('./verify.cjs');
const output=path.resolve(process.cwd(),'panludiq-public');
fs.cpSync(path.join(__dirname,'dist'),output,{recursive:true});
console.log('Render publish assets prepared: panludiq-public');
