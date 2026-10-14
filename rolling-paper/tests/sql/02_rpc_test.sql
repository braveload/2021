\set ON_ERROR_STOP 1
\set QUIET 1
\pset format unaligned
\pset tuples_only on

create function t_expect(q text, expected text) returns void language plpgsql as $$
declare ok boolean := false;
begin
  begin
    execute q;
  exception when others then
    if sqlerrm like '%' || expected || '%' then ok := true;
    else raise exception 'FAIL: wanted [%] got [%] for %', expected, sqlerrm, q; end if;
  end;
  if not ok then raise exception 'FAIL: no error, wanted [%] for %', expected, q; end if;
  raise notice 'ok  error[%]  %', expected, left(q, 60);
end $$;

create function t_assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok  %', msg;
end $$;
grant execute on function t_expect(text, text), t_assert(boolean, text) to anon;

set role anon;

-- ---------- 보드 생성 / 권한 ----------
select rp_create_board('abc123', '테스트 보드', 'birthday', null, false, repeat('a', 32)) as b1 \gset
select t_assert(:'b1' <> '', '보드 생성');
select t_expect($$select * from rp_board_secrets$$, 'permission denied');
select t_expect($$insert into rp_notes (board_id, message, client_hash) values (gen_random_uuid(), 'x', 'y')$$, 'permission denied');
select t_expect($$update rp_boards set title = 'hack'$$, 'permission denied');
select t_expect($$delete from rp_boards$$, 'permission denied');
select t_expect($$select rp_admin_board('abc123', 'x')$$, 'permission denied');
select t_expect($$select rp_create_board('abc123', 'dup', 'birthday', null, false, repeat('b', 32))$$, 'duplicate key');
select t_expect($$select rp_create_board('zzz999', 'x', 'birthday', null, false, 'short')$$, 'BAD_TOKEN');
select t_expect($$select rp_create_board('Bad Code', 'x', 'birthday', null, false, repeat('c', 32))$$, 'violates check');
select t_assert((select count(*) from rp_boards) = 1, '보드 공개 읽기 가능');

-- ---------- 글쓰기 ----------
select id as n1 from rp_post_note(:'b1'::uuid, '민지', '생일 축하해요', 'pink', '🎉', null, 'client-aaaaaaaa') \gset
select t_assert(:n1 > 0, '글 붙이기');
select t_expect($$select * from rp_post_note('$$ || :'b1' || $$'::uuid, 'x', '도배', 'pink', null, null, 'client-aaaaaaaa')$$, 'COOLDOWN');
select pg_sleep(3.1);
select t_expect($$select * from rp_post_note('$$ || :'b1' || $$'::uuid, 'x', '$$ || repeat('가', 101) || $$', 'pink', null, null, 'client-aaaaaaaa')$$, 'violates check');
select t_expect($$select * from rp_post_note('$$ || :'b1' || $$'::uuid, 'x', 'ok', 'red', null, null, 'client-aaaaaaaa')$$, 'violates check');
select t_expect($$select * from rp_post_note('$$ || :'b1' || $$'::uuid, 'x', 'ok', 'pink', null, 'otherboard/a.jpg', 'client-aaaaaaaa')$$, 'BAD_PHOTO');
select t_expect($$select * from rp_post_note('$$ || :'b1' || $$'::uuid, 'x', 'ok', 'pink', null, null, 'short')$$, 'BAD_CLIENT');
select id as n2 from rp_post_note(:'b1'::uuid, '   ', '  공백 닉네임  ', 'mint', null, 'abc123/p1.jpg', 'client-aaaaaaaa') \gset
select t_assert((select author from rp_notes where id = :n2) = '익명', '빈 닉네임은 익명');
select t_assert((select message from rp_notes where id = :n2) = '공백 닉네임', '메시지 trim');
select t_assert((select photo_path from rp_notes where id = :n2) = 'abc123/p1.jpg', '사진 경로 저장');
select t_assert((select count(*) from rp_notes) = 2, '두 글 조회');
select t_assert((select count(*) from information_schema.columns where table_name = 'rp_notes' and column_name = 'client_id') = 0, 'client_id 원문은 저장 안 함');

-- ---------- 하트 ----------
select hearts as h1, liked as l1 from rp_toggle_heart(:n1, 'client-aaaaaaaa') \gset
select t_assert(:h1 = 1 and :'l1' = 't', '하트 +1');
select hearts as h2, liked as l2 from rp_toggle_heart(:n1, 'client-bbbbbbbb') \gset
select t_assert(:h2 = 2, '다른 사람 하트 +1 = 2');
select hearts as h3, liked as l3 from rp_toggle_heart(:n1, 'client-aaaaaaaa') \gset
select t_assert(:h3 = 1 and :'l3' = 'f', '다시 누르면 취소(1)');
select t_assert((select hearts from rp_notes where id = :n1) = 1, 'notes.hearts 동기화');
select t_assert((select count(*) from rp_my_hearts(:'b1'::uuid, 'client-bbbbbbbb')) = 1, '내 하트 목록');
select t_expect($$select * from rp_toggle_heart(99999, 'client-aaaaaaaa')$$, 'NOT_FOUND');

-- ---------- 관리자 ----------
select t_assert(rp_admin_check('abc123', repeat('a', 32)), '관리자 토큰 확인(정상)');
select t_assert(not rp_admin_check('abc123', repeat('z', 32)), '관리자 토큰 확인(오답)');
select t_expect($$select rp_admin_delete_note('abc123', 'wrongwrongwrongwrong', 1)$$, 'FORBIDDEN');
select t_expect($$select rp_admin_update_board('abc123', 'wrongwrongwrongwrong', 'hack', null, false, null)$$, 'FORBIDDEN');
select rp_admin_delete_note('abc123', repeat('a', 32), :n2);
select t_assert((select count(*) from rp_notes) = 1, '관리자 삭제');
select rp_admin_update_board('abc123', repeat('a', 32), '새 제목', now() + interval '1 hour', false, true);
select t_assert((select title from rp_boards where code = 'abc123') = '새 제목', '관리자 제목 변경');
select t_assert((select secret from rp_boards where code = 'abc123'), '관리자 서프라이즈 모드 켜기');

-- ---------- 서프라이즈 모드: 마감 전 비공개(서버가 안 내려줌) ----------
select t_assert((select count(*) from rp_notes) = 0, '비밀 모드: 마감 전 글 0건 노출');
select t_expect($$select * from rp_toggle_heart($$ || :n1 || $$, 'client-cccccccc')$$, 'NOT_FOUND');
select id as n3 from rp_post_note(:'b1'::uuid, '서연', '비밀 글', 'blue', null, null, 'client-dddddddd') \gset
select t_assert(:n3 > 0, '비밀 모드에서도 마감 전엔 글쓰기 가능');
select t_assert((select count(*) from rp_notes) = 0, '비밀 모드: 내가 쓴 글도 서버 조회 불가(로컬에서 표시)');

-- ---------- 마감: 쓰기 잠금 + 공개 ----------
reset role;
update rp_boards set deadline = now() - interval '1 second' where code = 'abc123';
set role anon;
select t_assert((select count(*) from rp_notes) = 2, '마감 후 모든 글 공개');
select t_expect($$select * from rp_post_note('$$ || :'b1' || $$'::uuid, 'x', '마감 후', 'pink', null, null, 'client-eeeeeeee')$$, 'CLOSED');
select hearts as h4 from rp_toggle_heart(:n1, 'client-cccccccc') \gset
select t_assert(:h4 = 2, '마감 후 하트는 가능');
select rp_admin_update_board('abc123', repeat('a', 32), null, null, true, false);
select t_assert((select deadline is null from rp_boards where code = 'abc123'), '마감 없애기(재오픈)');
select id from rp_post_note(:'b1'::uuid, 'x', '재오픈 후 글', 'pink', null, null, 'client-eeeeeeee');

-- ---------- 한도 ----------
reset role;
insert into rp_notes (board_id, message, client_hash) select :'b1'::uuid, 'f' || g, 'h' || g from generate_series(1, 300) g;
set role anon;
select t_expect($$select * from rp_post_note('$$ || :'b1' || $$'::uuid, 'x', '한도 초과', 'pink', null, null, 'client-ffffffff')$$, 'FULL');

reset role;
select t_assert((select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('rp_notes','rp_boards')) = 2, 'Realtime publication 등록(notes+boards)');
select t_assert((select count(*) from storage.buckets where id = 'rp-photos' and public and file_size_limit = 524288) = 1, '사진 버킷 설정');
select t_assert((select count(*) from pg_policies where tablename = 'objects' and policyname = 'rp_photos_upload') = 1, 'Storage 업로드 정책');
\echo ALL SQL TESTS PASSED
