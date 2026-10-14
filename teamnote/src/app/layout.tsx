import "./globals.css";
import type { Metadata, Viewport } from "next";
import Shell from "@/components/Shell";
import { getUser, q } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "팀노트 — 팀 출석부·연차 신청 (학습용 데모)",
  description: "출석 상태와 연차(반차 포함) 신청·승인을 한 곳에서. 학습용 데모이며 실제 근로기준법 산정과 다를 수 있습니다.",
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
