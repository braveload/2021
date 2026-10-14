# 크루노트 (CrewNote) — 학습용 로컬 Docker 데모

실제 결제 없음 · 외부 유료 서비스 없음 · 모든 실행은 Docker 컨테이너 안에서만 이루어집니다.

## 실행 / 중지 / 재실행 (이 폴더에서)
```
copy .env.example .env      # 최초 1회, 값은 임의의 긴 문자열로 교체
docker compose up -d --build   # 실행 → http://127.0.0.1:3100
docker compose stop            # 중지 (서비스·DB 프로세스 모두 종료, 데이터 유지)
docker compose start           # 재실행
docker compose down -v         # 완전 삭제 (데이터 볼륨 포함 — 주의)
```

## 테스트 (컨테이너 안)
```
docker compose exec web node tests/run.mjs     # DB·권한·동시성·HTTP 12개
```
브라우저 검수는 `tests/browser.mjs`를 playwright 컨테이너(네트워크 crewnote_default)에서 실행합니다.

## 구조
- `db/migrations/*.sql` : 스키마·RLS·RPC (새 변경은 새 파일로 추가)
- `src/app/api/act/[name]` : 모든 쓰기 진입점 (RPC 호출)
- 데이터: 도커 볼륨 `crewnote_crewnote_pgdata`

## 클라우드 배포 (Vercel + Supabase, 무료 플랜 한도 내에서만)
1. Supabase 새 프로젝트(Free) → SQL Editor에 `supabase-setup.sql` 전체 실행
2. 같은 편집기에서 `alter role app_user with password '<새 임의 값>';` 실행
3. Connect → Transaction pooler 연결 문자열의 사용자만 `app_user.<project-ref>`로 바꿔 `DATABASE_URL`로 사용
4. Vercel → Import `braveload/2021`, **Root Directory = `crewnote`**, 환경변수 `DATABASE_URL`(Production) 등록
5. 이후 main push마다 자동 배포. DB 변경은 새 마이그레이션 파일 + SQL Editor 실행(자동 반영은 미구성)
비밀값은 저장소에 두지 않습니다(.env 는 gitignore).
