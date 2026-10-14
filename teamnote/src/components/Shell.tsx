import Link from "next/link";
import type { SessionUser } from "@/lib/db";

export default function Shell({ user, unread, children }: { user: SessionUser | null; unread: number; children: React.ReactNode }) {
  const items = user
    ? [
        { href: "/dashboard", icon: "🏠", label: "홈" },
        { href: "/teams/new", icon: "➕", label: "팀 만들기" },
        { href: "/notifications", icon: "🔔", label: unread ? `알림 ${unread}` : "알림" },
        { href: "/me", icon: "🏅", label: "내 기록" },
      ]
    : [
        { href: "/login", icon: "🔑", label: "로그인" },
        { href: "/signup", icon: "✨", label: "가입" },
      ];
  return (
    <div className="shell">
      <nav className="side" aria-label="주 메뉴">
        <Link href="/" className="logo">🗓️ 팀노트</Link>
        {items.map((i) => (
          <Link key={i.href} href={i.href}><span aria-hidden>{i.icon}</span>{i.label}</Link>
        ))}
        <div style={{ flex: 1 }} />
        {user && (
          <form action="/api/act/logout" method="post">
            <div className="mute" style={{ padding: "0 12px 8px" }}>{user.name}</div>
            <button className="btn sm" style={{ width: "100%" }}>로그아웃</button>
          </form>
        )}
      </nav>
      <main className="main">{children}</main>
      <nav className="tabbar" aria-label="하단 메뉴">
        {items.map((i) => (
          <Link key={i.href} href={i.href}><span aria-hidden style={{ fontSize: "1.3rem" }}>{i.icon}</span>{i.label}</Link>
        ))}
      </nav>
    </div>
  );
}
