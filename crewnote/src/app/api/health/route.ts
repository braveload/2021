import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await q(null, "select 1");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
