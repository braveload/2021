# 사이드장부 클라우드 v1.1.0

GitHub: braveload/2021의 sideledger 전용 폴더. 기존 앱 폴더는 수정하지 않는다.
Supabase: public.sl_* 전용 테이블/함수 및 비공개 sl-receipts 버킷. 앱은 publishable 키와 사용자의 Auth 세션만 사용하며 service_role은 사용하지 않는다.

## 개발
Node 24 이상, npm ci 후 .env.example을 참고해 .env.local을 작성한다. npm run dev (3217), npm run check, npm run build.
로컬 v1.0.0의 DB·계정은 클라우드로 자동 이전하지 않는다.

## DB 변경과 자동 배포 순서
1. GitHub push 시 SideLedger CI: 타입/단위 → 일회용 Postgres 17 마이그레이션/RLS 회귀 테스트 → 빌드.
2. Vercel 신규 프로젝트 Root Directory=sideledger. Build Command=npm run vercel-build.
3. 빌드는 해당 commit SHA의 GitHub CI 성공을 먼저 확인한다. 실패/미확인 시 DB 반영과 배포를 중단한다.
4. npm run migrate: sl_migrator 전용 계정, 트랜잭션·잠금·체크섬으로 sl_ 마이그레이션만 적용. 기존 적용 파일 변조·파괴적/공통 Storage 변경은 거절한다.
5. DB의 RLS 확인 뒤 Next 빌드 및 Vercel 배포.

필수 Vercel 환경변수: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SIDELEDGER_MIGRATION_DATABASE_URL. 마지막 변수는 전용 DB 계정으로 된 서버/빌드 전용 비밀값이다. 공유 postgres 비밀번호는 사용하지 않는다. 환경파일은 Git에 올리지 않는다.

## 초기 설정과 범위
기존 프로젝트 소유자가 최초 migration과 bootstrap-storage.sql을 적용하고, sl_ 객체만 sl_migrator에 소유권을 넘긴다. sl_migration_log에는 최초 파일의 SHA-256을 기록해 자동화가 중복 적용하지 않게 한다.
공통 Auth Site URL/메일 템플릿은 임의 변경하지 않는다. 앱의 확인 메일 callback을 허용하려면 기존 redirect 목록을 보존한 채 전용 URL을 추가해야 한다.
실제 Pro 결제·청구서 메일·리마인더는 미연결. 정책 페이지는 운영자 검토용 초안이다.
마이그레이션/RLS·실제 배포·로그인 결과는 작업폴더 History/2026-10-17_v1.1.0에서 구분해 보고한다. 설정 파일 존재만으로 연결 성공으로 간주하지 않는다.
