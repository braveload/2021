# schema.sql 을 임시 Postgres 컨테이너에서 검증한다 (끝나면 컨테이너와 데이터 모두 삭제).
$root = Split-Path $PSScriptRoot -Parent
$name = 'rp-sqltest'
$ok = $false
cmd /c "docker rm -f $name >nul 2>nul"
docker run -d --name $name -e POSTGRES_PASSWORD=test --tmpfs /var/lib/postgresql/data `
  -v "${root}/supabase:/sb:ro" -v "${root}/tests/sql:/t:ro" postgres:16-alpine | Out-Null
for ($i = 0; $i -lt 40; $i++) {
  cmd /c "docker exec $name pg_isready -U postgres >nul 2>nul"
  if ($LASTEXITCODE -eq 0) { Start-Sleep 3; break }
  Start-Sleep 1
}
function Psql($file) { cmd /c "docker exec $name psql -U postgres -v ON_ERROR_STOP=1 -q -f $file 2>&1" }
Psql /t/00_stub.sql
Write-Host '--- schema.sql (1st run) ---'; Psql /sb/schema.sql
if ($LASTEXITCODE -eq 0) {
  Write-Host '--- schema.sql (2nd run: idempotent) ---'; Psql /sb/schema.sql
}
if ($LASTEXITCODE -eq 0) {
  Write-Host '--- RPC / RLS tests ---'
  cmd /c "docker exec $name psql -U postgres -v ON_ERROR_STOP=1 -f /t/02_rpc_test.sql 2>&1"
  if ($LASTEXITCODE -eq 0) { $ok = $true }
}
cmd /c "docker rm -f $name >nul 2>nul"
if (-not $ok) { Write-Host 'SQL TESTS FAILED'; exit 1 }
