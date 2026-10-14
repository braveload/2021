# 우리 팀 롤링페이퍼

링크 하나로 모두의 마음을 모으는 실시간 롤링페이퍼. 빌드 도구 없는 정적 웹(HTML/CSS/ES Modules) + Supabase(DB·Realtime·Storage) + Vercel.

## 기능
| 구분 | 내용 |
|---|---|
| 기본 | 포스트잇 4색, 닉네임(비우면 익명), 100자, 실시간 반영, 초대 링크·QR |
| 도전과제 | ❤️ 하트(실시간 카운트) · 📷 폴라로이드 사진(Storage) · ⏰ 마감 잠금 + 공개 · GitHub push 자동 배포 |
| 재미 | 🤫 서프라이즈 모드(마감 때 봉투 공개) · 👑 베스트 쪽지 · 이모지 실시간 날리기 · 👀 접속자 수 · 🎲 글감 뽑기 · 스티커 · 컨페티 · 🎞️ 슬라이드쇼 |
| 관리 | 만든 사람만 글 삭제·마감 변경(관리자 링크), CSV 내려받기 |
| 반응형 | 같은 주소로 폰 접속 시 `/m/` 모바일 UI 로 자동 이동 (`?desktop=1` 로 PC 강제), 다크모드, 모션 줄이기 |

## 비용 0원 설계
- 카드 미등록 무료 플랜만 사용 (Vercel Hobby, Supabase Free). 한도 초과 시 과금이 아닌 일시 제한.
- 보드 300개 / 보드당 글 300장 / 사진 60장 / 사진 512KB(업로드 전 자동 압축) / 3초 도배 방지를 서버에서 강제.
- 브라우저엔 anon 키만 노출. 테이블 직접 쓰기 권한 없음 → 모든 쓰기는 검증하는 RPC 함수 (`supabase/schema.sql`).

## 로컬 실행 (Docker 만 필요 — 호스트 설치 없음)
```
docker compose up -d web              # http://127.0.0.1:3015   (down 하면 종료)
docker compose --profile test run --rm e2e     # 브라우저 E2E 57개 (Playwright)
powershell scripts/test-sql.ps1                # 스키마·RLS·RPC 테스트 (임시 Postgres)
docker compose down
```
`web/js/config.js` 가 비어 있으면 **데모 모드**(브라우저 안 저장, 탭끼리 실시간).

## 배포
1. `docker compose --profile tools run --rm cli bash` 안에서 `npx vercel login` (브라우저 승인)
2. `SUPABASE_ACCESS_TOKEN=… node scripts/supabase-setup.mjs` (프로젝트 목록) → `… <ref>` (스키마 적용 + config.js 생성)
3. `npx vercel deploy --prod --yes` → 주소 발급. GitHub 연결: `npx vercel git connect`
4. 종료: `npx vercel remove <project> --yes`

보안 메모: `config.js` 의 anon 키는 공개용입니다. secret/service_role 키는 어디에도 넣지 마세요.
