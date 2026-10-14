// 이 프로젝트(.vercel/project.json)의 Deployment Protection(Vercel 로그인 요구)만 해제한다.
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const cands = [path.join(os.homedir(), '.local/share/com.vercel.cli/auth.json'), path.join(os.homedir(), '.config/com.vercel.cli/auth.json')];
const authFile = cands.find((f) => fs.existsSync(f));
const token = JSON.parse(fs.readFileSync(authFile, 'utf8')).token;
const proj = JSON.parse(fs.readFileSync('.vercel/project.json', 'utf8'));
const q = `?teamId=${proj.orgId}`;
const r = await fetch(`https://api.vercel.com/v9/projects/${proj.projectId}${q}`, {
  method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ ssoProtection: null }),
});
const j = await r.json();
console.log(r.status, 'name=', j.name, 'ssoProtection=', JSON.stringify(j.ssoProtection ?? null));
