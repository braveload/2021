import { getUser, q } from "@/lib/db";

export const dynamic = "force-dynamic";

// CSV 수식 주입 방지
const cell = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};
const ST: Record<string, string> = { office: "출근", remote: "재택", field: "외근" };
const KD: Record<string, string> = { full: "연차", half_am: "오전반차", half_pm: "오후반차" };
const LS: Record<string, string> = { pending: "대기", approved: "승인", rejected: "반려", cancelled: "취소" };

export async function GET(req: Request, { params }: { params: { id: string; kind: string } }) {
  const user = await getUser();
  if (!user) return new Response("로그인이 필요해요.", { status: 401 });
  if (!/^[0-9a-f-]{36}$/.test(params.id)) return new Response("not found", { status: 404 });
  const role = (await q<{ team_role: string | null }>(user.id, "select team_role($1)", [params.id]))[0]?.team_role;
  if (role !== "owner" && role !== "staff") return new Response("권한이 없어요.", { status: 403 });
  const ym = new URL(req.url).searchParams.get("month");
  const month = /^\d{4}-\d{2}$/.test(ym ?? "") ? ym! : new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date()).slice(0, 7);
  const from = `${month}-01`;

  let head: string[], rows: unknown[][];
  if (params.kind === "attendance") {
    head = ["날짜", "이름", "이메일", "상태", "기록자"];
    const r = await q<any>(user.id, `select a.work_date, u.name, u.email, a.status, w.name as by
      from attendance a join users u on u.id = a.user_id left join users w on w.id = a.updated_by
      where a.team_id = $1 and a.work_date >= $2::date and a.work_date < ($2::date + interval '1 month')
      order by a.work_date, u.name limit 5000`, [params.id, from]);
    rows = r.map((x) => [x.work_date, x.name, x.email, ST[x.status], x.by]);
  } else if (params.kind === "leaves") {
    head = ["이름", "이메일", "종류", "시작", "종료", "일수", "상태", "사유", "처리 메모"];
    const r = await q<any>(user.id, `select u.name, u.email, l.kind, l.start_date, l.end_date, l.days, l.status, l.reason, l.decision_note
      from leave_requests l join users u on u.id = l.user_id
      where l.team_id = $1 and l.start_date >= $2::date and l.start_date < ($2::date + interval '1 month')
      order by l.start_date, u.name limit 5000`, [params.id, from]);
    rows = r.map((x) => [x.name, x.email, KD[x.kind], x.start_date, x.end_date, x.days, LS[x.status], x.reason, x.decision_note]);
  } else {
    return new Response("not found", { status: 404 });
  }
  const csv = "\uFEFF" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="teamnote-${params.kind}-${month}.csv"` },
  });
}
