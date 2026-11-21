const path=require('node:path'),fs=require('node:fs');
require('./scripts/structured-data.cjs').generate();
require('./verify.cjs');
const output=path.resolve(process.cwd(),'panludiq-public');
fs.cpSync(path.join(__dirname,'dist'),output,{recursive:true});
// Keep mutually dependent storage changes on immutable paths during CDN rollout.
const crypto=require('node:crypto'),versioned={};
for(const name of ['record-ledger.js','app.js','home-progress.js','solo-store.js','solo-ui.js','arcade-store.js','arcade-ui.js','arcade-home.js']){
 const code=fs.readFileSync(path.join(output,name),'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n'),hash=crypto.createHash('sha256').update(code).digest('hex').slice(0,12),target=name.replace(/\.js$/,'.'+hash+'.js');
 fs.writeFileSync(path.join(output,target),code);versioned[name]=target;
}
for(const name of fs.readdirSync(output).filter(n=>n.endsWith('.html'))){
 const file=path.join(output,name),html=fs.readFileSync(file,'utf8').replace(/src="([^"?]+\.js)(?:\?[^" ]*)?"/g,(all,src)=>versioned[src]?'src="'+versioned[src]+'"':all);fs.writeFileSync(file,html);
}
fs.writeFileSync(path.join(output,'storage-assets.json'),JSON.stringify(versioned,null,2));
console.log('Render publish assets prepared: panludiq-public');
