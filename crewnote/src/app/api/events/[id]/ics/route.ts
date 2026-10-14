import { getUser, q } from "@/lib/db";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user) return new Response("로그인이 필요해요.", { status: 401 });
  if (!/^[0-9a-f-]{36}$/.test(params.id)) return new Response("not found", { status: 404 });
  const rows = await q<any>(user.id, "select e.*, c.name as crew_name from events e join crews c on c.id = e.crew_id where e.id = $1", [params.id]);
  const e = rows[0];
  if (!e) return new Response("not found", { status: 404 });
  const start = new Date(e.starts_at);
  const end = new Date(start.getTime() + 2 * 3600 * 1000);
  const body = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CrewNote//KO", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${e.id}@crewnote.local`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(start)}`,
    `DTEND:${utc(end)}`,
    `SUMMARY:${esc(`[${e.crew_name}] ${e.title}`)}`,
    `LOCATION:${esc(e.location)}`,
    `DESCRIPTION:${esc(e.description)}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  return new Response(body, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="crewnote-event.ics"' },
  });
}
