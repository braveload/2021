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
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      className="btn sm"
      onClick={async () => {
        let copied = false;
        try {
          text = text.startsWith("/") ? window.location.origin + text : text;
          await navigator.clipboard.writeText(text);
          copied = true;
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text; document.body.appendChild(ta); ta.select();
          try { copied = document.execCommand("copy"); } catch { copied = false; }
          ta.remove();
        }
        setDone(copied);
        setFailed(!copied);
        setTimeout(() => setDone(false), 1800);
      }}
    >
      {done ? "복사됨 ✓" : failed ? "복사 제한 · 문구를 직접 선택해주세요" : label}
    </button>
  );
}

export function InviteShare({ text, label }: { text: string; label: string }) {
  return <div style={{ marginTop: 12, marginBottom: 12 }}>
    <CopyButton text={text} label={label} />
    <details style={{ marginTop: 10 }}>
      <summary style={{ cursor: "pointer" }}>초대문구 직접 복사하기</summary>
      <textarea aria-label="카톡 초대문구" readOnly rows={7} value={text}
        style={{ width: "100%", marginTop: 8, resize: "vertical" }}
        onFocus={(event) => event.currentTarget.select()} />
      <p className="mute">문구를 길게 눌러 복사한 뒤 카톡 대화창에 붙여넣으세요.</p>
    </details>
  </div>;
}
