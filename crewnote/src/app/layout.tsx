import "./globals.css";
import type { Metadata, Viewport } from "next";
import Shell from "@/components/Shell";
import { getUser, q } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "크루노트 — 소모임 운영 도구 (학습용 데모)",
  description: "정원·대기·출석을 자동으로. 학습용 데모이며 실제 결제는 없습니다.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let user = null, unread = 0;
  try {
    user = await getUser();
    if (user) {
      const r = await q<{ n: number }>(user.id, "select count(*)::int as n from notifications where user_id = app_uid() and read_at is null");
      unread = r[0]?.n ?? 0;
    }
  } catch {}
  return (
    <html lang="ko">
      <body>
        <Shell user={user} unread={unread}>{children}</Shell>
      </body>
    </html>
  );
}
