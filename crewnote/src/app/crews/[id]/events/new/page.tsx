import { notFound, redirect } from "next/navigation";
import { getUser, q } from "@/lib/db";
import { toKstInput } from "@/lib/format";
import Flash, { SP } from "@/components/Flash";

export default async function NewEvent({ params, searchParams }: SP & { params: { id: string } }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!/^[0-9a-f-]{36}$/.test(params.id)) notFound();
  const role = (await q<any>(user.id, "select crew_role($1) as r", [params.id]))[0].r;
  if (role !== "owner" && role !== "staff") notFound();
  const def = toKstInput(new Date(Date.now() + 3 * 86400000));
  return (
    <div style={{ maxWidth: 560 }}>
      <h1>모임 만들기</h1>
      <Flash sp={searchParams} />
      <form action="/api/act/event_create" method="post" className="card">
        <input type="hidden" name="crew" value={params.id} />
        <input type="hidden" name="next" value={`/crews/${params.id}/events/new`} />
        <label htmlFor="title">제목</label><input id="title" name="title" minLength={2} maxLength={60} required />
        <label htmlFor="loc">장소</label><input id="loc" name="location" maxLength={100} />
        <label htmlFor="at">일시 (한국 시간)</label><input id="at" name="starts_at" type="datetime-local" defaultValue={def} required />
        <label htmlFor="cap">정원</label><input id="cap" name="capacity" type="number" inputMode="numeric" min={1} max={500} defaultValue={20} required />
        <label htmlFor="d">소개</label><textarea id="d" name="description" maxLength={1000} />
        <div style={{ marginTop: 16 }}><button className="btn p full-m">모임 열기</button></div>
      </form>
    </div>
  );
}
