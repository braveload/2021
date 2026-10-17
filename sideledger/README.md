# 사이드장부 클라우드 v1.2.3 · 2026-10-17

공개 서비스: https://sideledger-tiger82.vercel.app
GitHub: braveload/2021/sideledger · Vercel tiger82/sideledger-tiger82 · Supabase sidejangbu (xgqpdkildlfldgqzdjqm, 서울).

## 가입과 계정 찾기
이메일·이름·비밀번호 6자 이상으로 인증 메일 없이 바로 가입한다. 4자 요청은 Supabase 서버 최소 6자 제약 확인 후 사용자 선택으로 6자 기준으로 변경했다. 기존 10자 이상 비밀번호도 그대로 사용할 수 있다.
로그인 후 설정 → 계정 복구코드에서 현재 비밀번호를 확인하고 코드를 발급한다. 안전한 곳에 저장해야 한다. 이메일·비밀번호를 잊으면 로그인 화면의 찾기 버튼에서 코드로 이메일을 확인하거나 비밀번호를 재설정한다. 비밀번호 재설정 시 코드가 소진되고 이전 세션은 차단된다. 재발급하면 이전 코드는 폐기된다. 코드가 없는 기존 사용자는 먼저 정상 로그인해서 발급해야 한다. 이름만으로 계정을 찾거나 변경하지 않는다.

## 데이터와 권한
Next 앱은 publishable 키·사용자 세션을 사용한다. Auth 관리자 비밀키는 Next/Vercel/브라우저/Git에 저장하지 않는다. 전용 Supabase Edge Function sl-account-recovery가 플랫폼에서 제공하는 서버 전용 secret/service 자격으로 Auth Admin API를 호출한다. 공개 복구 요청은 256비트 복구코드의 소유로 인증하며 코드 발급은 로그인과 현재 비밀번호를 확인한다. DB에는 SHA-256 해시만 저장한다. 복구 테이블은 익명/일반 사용자 직접 접근을 금지한다. 코드 선점과 실패 해제·일회용 소진을 DB에서 처리한다.
재설정 시 Supabase Auth가 기존 세션/갱신 토큰을 폐기한다. 추가 reset_at 검사와 RLS/RPC/Storage 정책이 이전 JWT의 앱 데이터 접근을 차단한다. 이미 발급한 영수증 서명 URL은 기존 최대 60초 만료까지 유효할 수 있다.

## 개발과 배포
Node 24.x, npm ci, npm run check, npm run build. 개발 포트 3217. 비밀 환경값은 .env.local에 보관하고 Git에서 제외한다.
GitHub push → 해당 커밋 CI 성공 확인 → sl_migrator 전용 계정의 트랜잭션 DB 마이그레이션 → Vercel 빌드·배포. CI는 일회용 Postgres 17에서 장부 및 복구 권한/원자성 회귀를 실행한다.
Edge Function 소스 변경은 Supabase에 별도 배포해야 한다. 현재 GitHub/Vercel 자동화는 Edge 배포를 수행하지 않는다. supabase/functions/sl-account-recovery/index.ts의 동작을 배포 후 검증한다. verify_jwt=false이며 함수 내부에서 사용자 JWT+현재 비밀번호 또는 복구코드로 인증하므로 JWT가 없는 계정 복구가 가능하다.
최초 Storage는 프로젝트 소유자가 bootstrap-storage.sql을 적용한다. 기존 프로젝트의 reset session 정책 추가는 bootstrap-storage-reset-guard.sql을 한 번 적용한다. 신규 환경에서는 DB 마이그레이션 적용 후 두 파일을 순서대로 적용한다. 제한된 CI 계정에 공통 Storage/Auth 관리 권한은 부여하지 않는다.

## 검증
npm run check, npm run test:db (TEST_DATABASE_URL은 일회용 localhost Postgres만 허용).
실제 UI 전체 검사는 e2e/full-user-flow.spec.ts. SIDELEDGER_TEST_URL, SL_FLOW_EMAIL, SL_FLOW_PASSWORD, SL_FLOW_NEW_PASSWORD에는 일회용 계정만 넣는다. 테스트는 장부와 문서를 작성하므로 실제 사용자의 계정을 쓰지 않는다. 코드/비밀번호/세션은 로그·Git·공유 증거에 넣지 않는다.
검증 기록은 기준 work/History/2026-10-17_v1.2.3, 오류는 Issue debug/동일 버전, 계획은 Plan/동일 버전에 저장했다.

결제·청구서 메일·리마인더는 미연결. 정책 페이지는 초안. 로컬 v1.0.0 데이터는 자동 이전하지 않는다.
