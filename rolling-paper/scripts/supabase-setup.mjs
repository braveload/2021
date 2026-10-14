// Supabase 프로젝트에 schema.sql 을 적용하고 web/js/config.js 를 생성한다 (컨테이너 안에서 실행).
//   docker compose --profile tools run --rm -e SUPABASE_ACCESS_TOKEN cli node scripts/supabase-setup.mjs <project-ref>
// - SUPABASE_ACCESS_TOKEN: 대시보드 > Account > Access Tokens 에서 만든 개인 토큰 (채팅에 붙여넣지 마세요)
// - 브라우저용 키는 anon/publishable 만 사용. service_role/secret 키는 읽지도 저장하지도 않는다.
import fs from 'node:fs';

const API = 'https://api.supabase.com/v1';
const token = process.env.SUPABASE_ACCESS_TOKEN || (fs.existsSync('/home/node/.supabase-token') ? fs.readFileSync('/home/node/.supabase-token', 'utf8').trim() : '');
const ref = process.argv[2];
if (!token) { console.error('토큰이 없습니다: node scripts/save-token.mjs 를 먼저 실행하세요'); process.exit(1); }
const call = async (path, init = {}) => {
  const r = await fetch(API + path, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${path}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
};

if (!ref) {
  const list = await call('/projects');
  console.log('프로젝트 목록 (ref 를 인자로 넘기세요):');
  for (const p of list) console.log(` - ${p.id}  ${p.name}  [${p.region}]  ${p.status}`);
  process.exit(0);
}

const sql = fs.readFileSync('supabase/schema.sql', 'utf8');
await call(`/projects/${ref}/database/query`, { method: 'POST', body: JSON.stringify({ query: sql }) });
console.log('✓ schema.sql 적용 완료 (rp_ 접두사 객체만 생성/갱신)');

const keys = await call(`/projects/${ref}/api-keys`);
const anon = keys.find((k) => k.name === 'anon') || keys.find((k) => k.type === 'publishable');
if (!anon?.api_key) throw new Error('anon/publishable 키를 찾지 못했습니다');
const url = `https://${ref}.supabase.co`;
fs.writeFileSync('web/js/config.js',
  `// 공개되어도 안전한 값만 (Project URL + anon/publishable key). secret/service_role 키 금지.\nexport const CONFIG = {\n  SUPABASE_URL: '${url}',\n  SUPABASE_KEY: '${anon.api_key}',\n};\n`);
console.log(`✓ web/js/config.js 생성: ${url}`);
