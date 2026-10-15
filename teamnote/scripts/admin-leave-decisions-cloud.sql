create or replace function teamnote.decide_leave(p_leave uuid, p_approve boolean, p_note text) returns void
  language plpgsql security definer set search_path = teamnote, pg_temp as $$
declare v_uid uuid := require_user(); r leave_requests%rowtype;
begin
  select * into r from leave_requests where id = p_leave for update;
  if not found then raise exception 'not_found'; end if;
  if coalesce(team_role(r.team_id), '') <> 'owner' then raise exception 'forbidden'; end if;
  if r.user_id = v_uid and team_role(r.team_id) <> 'owner' then raise exception 'self_approval'; end if;
  if r.status <> 'pending' then raise exception 'already_decided'; end if;
  update leave_requests set status = case when p_approve then 'approved' else 'rejected' end,
    decided_by = v_uid, decided_at = now(), decision_note = coalesce(trim(p_note), '') where id = p_leave;
  perform notify(r.user_id, r.team_id, case when p_approve then 'leave_approved' else 'leave_rejected' end,
    case when p_approve then '연차가 승인됐어요: ' else '연차가 반려됐어요: ' end || r.start_date || ' (' || r.days || '일)',
    'decide:' || r.id);
end $$;

