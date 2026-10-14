# 팀노트 (TeamNote) — 팀 출석부 + 연차(반차) 신청 노트 (학습용 데모)

- 오늘 상태 체크(출근/재택/외근), 연차·반차 신청 → 팀장/승인자 승인·반려, 팀 캘린더, 알림함, 월별 CSV
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
4. 서비스 종료 시각: `update teamnote.service_state set closes_at = '<시각>';` (이후 모든 쓰기를 DB가 차단)

비밀값은 저장소에 두지 않습니다(.env, .app-db-password 는 gitignore).
