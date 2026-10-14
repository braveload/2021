// Supabase 개인 액세스 토큰을 화면에 표시하지 않고 입력받아 컨테이너 볼륨에만 저장한다.
import fs from 'node:fs';
// 환경변수로 전달된 경우(PowerShell 숨김 입력) 바로 저장
if (process.env.SUPABASE_ACCESS_TOKEN) {
  const m = process.env.SUPABASE_ACCESS_TOKEN.match(/sbp_[A-Za-z0-9]{20,}/);
  if (!m) { console.error(`✗ sbp_ 토큰을 찾지 못했습니다 (입력 길이 ${process.env.SUPABASE_ACCESS_TOKEN.length}자)`); process.exit(1); }
  fs.writeFileSync('/home/node/.supabase-token', m[0], { mode: 0o600 });
  console.log('✓ 저장 완료 (Docker 볼륨 안에만 보관)');
  process.exit(0);
}
process.stdout.write('Supabase Access Token (입력은 보이지 않습니다) : ');
const stdin = process.stdin;
stdin.setRawMode?.(true); stdin.resume(); stdin.setEncoding('utf8');
let buf = '';
stdin.on('data', (c) => {
  for (const ch of c) {
    if (ch === '\r' || ch === '\n') {
      stdin.setRawMode?.(false); stdin.pause(); process.stdout.write('\n');
      const m = buf.replace(/\[[0-9;]*[~A-Za-z]/g, '').match(/sbp_[A-Za-z0-9]{20,}/);
      if (!m) { console.error(`✗ sbp_ 토큰을 찾지 못했습니다 (입력 길이 ${buf.length}자)`); process.exit(1); }
      const t = m[0];
      fs.writeFileSync('/home/node/.supabase-token', t, { mode: 0o600 });
      console.log('✓ 저장 완료 (Docker 볼륨 안에만 보관)'); process.exit(0);
    } else if (ch === '\u0003') process.exit(1);
    else if (ch === '\u007f') buf = buf.slice(0, -1);
    else buf += ch;
  }
});
