import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return reply({error:'요청을 확인해 주세요.'},405);
 if(Number(req.headers.get('content-length')||0)>4096)return reply({error:'요청을 확인해 주세요.'},413);
 try{
  const b=await req.json();const url=Deno.env.get('SUPABASE_URL')!;
  const secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const publicKey=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||Deno.env.get('SUPABASE_ANON_KEY');
  if(!secret||!publicKey)throw Error('CONFIG');
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  if(b.action==='issue'){
   const token=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');
   const u=await admin.auth.getUser(token);if(u.error||!u.data.user)return reply({error:'로그인이 필요합니다.'},401);
   const user=u.data.user;const sec=await admin.from('sl_account_security').select('reset_at').eq('owner_id',user.id).maybeSingle();if(sec.error)throw Error('DB');
   const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
   if(sec.data&&payload.iat<=Math.floor(Date.parse(sec.data.reset_at)/1000))return reply({error:'다시 로그인해 주세요.'},401);
   const check=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
   const verified=await check.auth.signInWithPassword({email:user.email!,password:String(b.password||'')});if(verified.error)return reply({error:'현재 비밀번호를 확인해 주세요.'},400);
   await check.auth.signOut({scope:'local'});
   const bytes=crypto.getRandomValues(new Uint8Array(32));const code=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code));const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
   const saved=await admin.from('sl_recovery_codes').upsert({owner_id:user.id,email:user.email,code_hash:hash,created_at:new Date().toISOString(),used_at:null,claim_id:null});if(saved.error)throw Error('DB');
   return reply({code:code.match(/.{1,8}/g)!.join('-')});
  }
  if(!['find','reset'].includes(b.action))return reply({error:'요청을 확인해 주세요.'},400);
  const code=String(b.code||'').replace(/[\s-]/g,'').toLowerCase();if(!/^[a-f0-9]{64}$/.test(code))return reply({error:'복구코드가 올바르지 않거나 이미 사용되었습니다.'},400);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code));const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  if(b.action==='find'){
   const r=await admin.from('sl_recovery_codes').select('email').eq('code_hash',hash).is('used_at',null).maybeSingle();if(r.error)throw Error('DB');
   return r.data?reply({email:r.data.email}):reply({error:'복구코드가 올바르지 않거나 이미 사용되었습니다.'},400);
  }
  const password=String(b.password||'');if(password.length<6||password.length>128)return reply({error:'비밀번호는 6~128자로 입력해 주세요.'},400);
  const claim=crypto.randomUUID();const r=await admin.rpc('sl_recovery_claim',{p_hash:hash,p_claim:claim});if(r.error)throw Error('DB');if(!r.data)return reply({error:'복구코드가 올바르지 않거나 이미 사용되었습니다.'},400);
  const changed=await admin.auth.admin.updateUserById(r.data.id,{password});
  const done=await admin.rpc('sl_recovery_finish',{p_owner:r.data.id,p_claim:claim,p_success:!changed.error});
  if(changed.error||done.error||done.data!==true)return reply({error:'비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.'},503);
  return reply({ok:true,email:r.data.email});
 }catch{return reply({error:'처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'},503);}
});
