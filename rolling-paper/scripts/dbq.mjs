// 프로젝트 DB 에 읽기용 SQL 을 실행해 결과를 출력한다: node scripts/dbq.mjs <ref> "<sql>"
import fs from 'node:fs';
const token = fs.readFileSync('/home/node/.supabase-token', 'utf8').trim();
const [ref, arg] = process.argv.slice(2);
const sql = arg.startsWith('@') ? fs.readFileSync(arg.slice(1), 'utf8').replace(/^﻿/, '') : arg;
const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }),
});
console.log(r.status, JSON.stringify(JSON.parse(await r.text()), null, 1).slice(0, 3000));
