import { getUser, q } from "@/lib/db";

export const dynamic = "force-dynamic";

// CSV 수식 주입 방지: 위험 문자로 시작하면 ' 접두
const cell = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET(_: Request, { params }: { params: { id: string; kind: string } }) {
  const user = await getUser();
  if (!user) return new Response("로그인이 필요해요.", { status: 401 });
  if (!/^[0-9a-f-]{36}$/.test(params.id)) return new Response("not found", { status: 404 });
  const role = (await q<{ crew_role: string | null }>(user.id, "select crew_role($1)", [params.id]))[0]?.crew_role;
  if (role !== "owner" && role !== "staff") return new Response("권한이 없어요.", { status: 403 });

  let head: string[], rows: unknown[][];
  if (params.kind === "members") {
    head = ["이름", "이메일", "역할", "가입일(UTC)"];
    const r = await q<any>(user.id, `select u.name, u.email, m.role, m.joined_at from crew_members m
      join users u on u.id = m.user_id where m.crew_id = $1 order by m.joined_at limit 1000`, [params.id]);
    rows = r.map((x) => [x.name, x.email, x.role, new Date(x.joined_at).toISOString()]);
  } else if (params.kind === "attendance") {
    head = ["모임", "일시(UTC)", "이름", "상태", "대기순번기준", "출석"];
    const r = await q<any>(user.id, `select e.title, e.starts_at, u.name, g.status, g.seq, g.checked_in
      from registrations g join events e on e.id = g.event_id join users u on u.id = g.user_id
      where e.crew_id = $1 order by e.starts_at desc, g.seq limit 5000`, [params.id]);
    rows = r.map((x) => [x.title, new Date(x.starts_at).toISOString(), x.name, x.status, x.seq, x.checked_in ? "출석" : ""]);
  } else {
    return new Response("not found", { status: 404 });
  }
  const csv = "﻿" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="crewnote-${params.kind}.csv"` },
  });
}
