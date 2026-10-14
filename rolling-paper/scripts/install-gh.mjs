// 컨테이너 볼륨(/home/node/.local)에 GitHub CLI 를 설치한다 (호스트 영향 없음)
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const v = '2.63.0';
const r = await fetch(`https://github.com/cli/cli/releases/download/v${v}/gh_${v}_linux_amd64.tar.gz`);
if (!r.ok) throw new Error('download failed ' + r.status);
fs.writeFileSync('/tmp/gh.tgz', Buffer.from(await r.arrayBuffer()));
fs.mkdirSync('/home/node/.local/bin', { recursive: true });
execSync(`tar xzf /tmp/gh.tgz -C /tmp && cp /tmp/gh_${v}_linux_amd64/bin/gh /home/node/.local/bin/gh`);
console.log(execSync('/home/node/.local/bin/gh --version').toString());
