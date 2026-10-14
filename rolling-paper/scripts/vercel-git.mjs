// 프로젝트 Root Directory 를 rolling-paper 로 지정 (저장소 하위 폴더 배포용)
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const f = [path.join(os.homedir(), '.local/share/com.vercel.cli/auth.json'), path.join(os.homedir(), '.config/com.vercel.cli/auth.json')].find((x) => fs.existsSync(x));
const token = JSON.parse(fs.readFileSync(f, 'utf8')).token;
const proj = JSON.parse(fs.readFileSync('.vercel/project.json', 'utf8'));
const r = await fetch(`https://api.vercel.com/v9/projects/${proj.projectId}?teamId=${proj.orgId}`, {
  method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ rootDirectory: 'rolling-paper', framework: null }),
});
const j = await r.json();
console.log(r.status, 'rootDirectory=', j.rootDirectory, j.error?.message || '');
