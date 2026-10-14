"use client";
import { useEffect, useState } from "react";

export function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t); // 화면을 벗어나면 해제
  }, []);
  if (now === null) return <span className="count">--</span>;
  let s = Math.floor((new Date(to).getTime() - now) / 1000);
  if (s <= 0) return <span className="count">시작됨</span>;
  const d = Math.floor(s / 86400); s %= 86400;
  const h = String(Math.floor(s / 3600)).padStart(2, "0"); s %= 3600;
  const m = String(Math.floor(s / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return <span className="count">{d > 0 ? `D-${d} ` : ""}{h}:{m}:{sec}</span>;
}

export function Party() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOn(false), 2600);
    return () => clearTimeout(t);
  }, []);
  if (!on) return null;
  const e = ["🎉", "🏃", "✨", "🎊", "💪", "⭐"];
  return (
    <div className="party" aria-hidden>
      {Array.from({ length: 24 }, (_, i) => (
        <i key={i} style={{ left: `${(i * 4.3) % 100}%`, animationDelay: `${(i % 6) * 0.12}s` }}>{e[i % e.length]}</i>
      ))}
    </div>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn sm"
      onClick={async () => {
        try {
          text = text.startsWith("/") ? window.location.origin + text : text;
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
    >
      {done ? "복사됨 ✓" : label}
    </button>
  );
}
