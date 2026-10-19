// Backend HTTP regression test. Uses fresh fixture names, never real employee credentials.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const base=process.env.BASE || 'https://teamnote-demo-iota.vercel.app';
const tag=crypto.randomBytes(4).toString('hex');
const fixtureName=`시작검증_${tag}`, concurrentName=`동시검증_${tag}`;
async function start(name,cookie='') {
  return fetch(`${base}/api/act/start`,{method:'POST',redirect:'manual',
    headers:{'Content-Type':'application/x-www-form-urlencoded',...(cookie?{Cookie:cookie}:{})},
    body:new URLSearchParams({name,next:'/dashboard'})});
}
const first=await start(fixtureName);
assert.equal(first.status,303);
const cookie=first.headers.getSetCookie().find(v=>v.startsWith('cn_session='))?.split(';')[0];
assert.ok(cookie,'new account must have a session');
for(let i=0;i<5;i++) {
  const repeated=await start(fixtureName,cookie);
  assert.equal(repeated.status,303);
  assert.ok(repeated.headers.get('location').startsWith('/dashboard'));
  assert.equal(repeated.headers.get('set-cookie'),null,'repeat start must preserve session');
}
const anonymous=await start(fixtureName);
assert.equal(anonymous.status,303);
assert.ok(new URL(anonymous.headers.get('location'),base).searchParams.has('err'));
assert.equal(anonymous.headers.get('set-cookie'),null,'same name alone must not issue a session');
const mismatch=await start('다른사람_'+tag,cookie);
assert.ok(new URL(mismatch.headers.get('location'),base).searchParams.has('err'));
assert.equal(mismatch.headers.get('set-cookie'),null);
const signup=await fetch(`${base}/signup`,{redirect:'manual',headers:{Cookie:cookie}});
assert.equal(signup.status,307);
assert.ok(signup.headers.get('location').includes('/dashboard'));
const concurrent=await Promise.all(Array.from({length:6},()=>start(concurrentName)));
assert.equal(concurrent.filter(r=>r.headers.get('set-cookie')).length,1,'only one concurrent registration may succeed');
assert.equal(concurrent.filter(r=>new URL(r.headers.get('location'),base).searchParams.has('err')).length,5);
console.log(JSON.stringify({result:'PASS',fixtureName,concurrentName,repeatStarts:5,
  anonymousDuplicate:'blocked',wrongName:'blocked',signedInSignup:'reused',concurrentRequests:6,newConcurrentAccounts:1}));
