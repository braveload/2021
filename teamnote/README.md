# 팀노트 (TeamNote) — 팀 출석부 + 연차(반차) 신청 노트 (학습용 데모)

- 오늘 상태 체크(출근/재택/외근), 연차·반차 신청 → 관리자(owner)만 승인·반려, 팀 캘린더, 알림함, 월별 CSV
- 팀장이 **팀 기본 지급일수**와 **팀원별 지급일수**를 직접 입력
- 연차 산정은 단순 규칙(월~금, 공휴일 미반영). 실제 근로기준법 산정과 다를 수 있습니다.

## 로컬 Docker (이 폴더에서)
```
copy .env.example .env          # 값은 임의의 긴 문자열로 교체
docker compose up -d --build    # http://127.0.0.1:3200
docker compose stop / start     # 중지 / 재실행 (데이터 볼륨 유지)
docker compose exec web node tests/run.mjs   # DB·권한·동시성·HTTP 테스트
```

## 클라우드 (Vercel + Supabase)
1. Supabase SQL Editor에 `supabase-setup.sql` 실행 — 전용 스키마 `teamnote`와 전용 역할 `teamnote_app`만 생성
2. `alter role teamnote_app with password '<임의 값>';`
3. Vercel: Root Directory = `teamnote`, 환경변수 `DATABASE_URL` = Transaction pooler 문자열(사용자 `teamnote_app.<project-ref>`)
4. 상시 운영: `update teamnote.service_state set closes_at = 'infinity'::timestamptz where id = true;` (종료 제한 없음)

비밀값은 저장소에 두지 않습니다(.env, .app-db-password 는 gitignore).

## 운영 변경 (2026-10-15)
- 실제 주소: https://teamnote-demo-iota.vercel.app
- 사용자의 요청에 따라 종료 시각을 infinity로 설정했습니다.
- 관리자(owner)만 연차 승인·반려가 가능합니다. 운영자(staff)는 근태 관리 권한을 유지하지만 승인·반려는 불가합니다.
- DB 권한 변경: `scripts/admin-leave-decisions-cloud.sql`. 로컬 신규 변경은 `002_admin_leave_decisions.sql`로 적용합니다.
- 실제 사용자 시작·전용팀 생성·연차 신청·관리자 승인을 검증했습니다. 일반 팀원/운영자의 승인·반려 차단 4건과 관리자 반려도 트랜잭션 롤백 방식으로 검증했습니다.
