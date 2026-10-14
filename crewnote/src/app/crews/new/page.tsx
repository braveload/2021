import { redirect } from "next/navigation";
import { getUser } from "@/lib/db";
import Flash, { SP } from "@/components/Flash";

export default async function NewCrew({ searchParams }: SP) {
  if (!(await getUser())) redirect("/login");
  return (
    <div style={{ maxWidth: 520 }}>
      <h1>새 크루 만들기</h1>
      <Flash sp={searchParams} />
      <form action="/api/act/crew_create" method="post" className="card">
        <input type="hidden" name="next" value="/crews/new" />
        <label htmlFor="name">크루 이름</label>
        <input id="name" name="name" minLength={2} maxLength={40} required />
        <label htmlFor="theme">테마</label>
        <select id="theme" name="theme"><option value="running">🏃 러닝</option><option value="reading">📚 독서</option><option value="study">✏️ 스터디</option></select>
        <label htmlFor="intro">소개 (500자 이내)</label>
        <textarea id="intro" name="intro" maxLength={500} />
        <div style={{ marginTop: 16 }}><button className="btn p full-m">크루 만들기</button></div>
      </form>
    </div>
  );
}
