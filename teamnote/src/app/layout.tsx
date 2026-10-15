import "./globals.css";
import type { Metadata, Viewport } from "next";
import Shell from "@/components/Shell";
import { getUser, q } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "팀노트 출석부,연차신청",
  description: "팀노트 출석부,연차신청",
  openGraph: {
    title: "팀노트 출석부,연차신청",
    description: "팀노트 출석부,연차신청",
    siteName: "팀노트 출석부,연차신청",
    type: "website",
    locale: "ko_KR",
  },
  twitter: { card: "summary", title: "팀노트 출석부,연차신청", description: "팀노트 출석부,연차신청" },
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
