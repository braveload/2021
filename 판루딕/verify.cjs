const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.join(__dirname,'dist');for(const name of fs.readdirSync(root)){if(name.endsWith('.js'))cp.execFileSync(process.execPath,['--check',path.join(root,name)]);if(name.endsWith('.html')){let s=fs.readFileSync(path.join(root,name),'utf8');for(const m of s.matchAll(/(?:src|href)="([^"#]+)"/g)){let ref=m[1].split('#')[0];if(!/^(https?:|data:)/.test(ref))assert(fs.existsSync(path.join(root,ref)),`${name}: missing ${ref}`)}assert(s.includes('guest.js'),`${name}: guest entry missing`)}}
for(const t of ['tests.cjs','mini-tests.cjs','online-tests.cjs'])cp.execFileSync(process.execPath,[path.join(__dirname,t)],{stdio:'inherit'});
console.log('PASS: scripts, local asset links, guest entry on both pages and game engines');

for (const f of ['server/server.cjs','server/rooms.cjs']) cp.execFileSync(process.execPath,['--check',path.join(__dirname,f)]);
