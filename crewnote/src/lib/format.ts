const TZ = "Asia/Seoul";

export function fmtKST(d: Date | string, withTime = true) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: TZ,
    month: "numeric",
    day: "numeric",
    weekday: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(new Date(d));
}

/** datetime-local 입력값(KST 기준)을 UTC ISO로 변환 */
export function kstInputToISO(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00+09:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** UTC 시각 → datetime-local 입력용 KST 문자열 */
export function toKstInput(d: Date | string) {
  const p = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(d));
  return p.replace(" ", "T");
}

export const THEMES: Record<string, { label: string; emoji: string }> = {
  running: { label: "러닝", emoji: "🏃" },
  reading: { label: "독서", emoji: "📚" },
  study: { label: "스터디", emoji: "✏️" },
};

export const EMOJIS = ["🔥", "👏", "😆", "💪", "❤️"];

export const BADGES = [
  { key: "first", emoji: "👟", name: "첫 발걸음", desc: "첫 출석", need: (s: Stats) => s.attended >= 1 },
  { key: "regular", emoji: "🌟", name: "단골", desc: "5회 출석", need: (s: Stats) => s.attended >= 5 },
  { key: "streak", emoji: "🏅", name: "개근왕", desc: "10회 출석", need: (s: Stats) => s.attended >= 10 },
  { key: "explorer", emoji: "🧭", name: "탐험가", desc: "2개 이상 크루에서 출석", need: (s: Stats) => s.crews >= 2 },
  { key: "writer", emoji: "💬", name: "소감 요정", desc: "소감 3개 작성", need: (s: Stats) => s.reviews >= 3 },
];
export type Stats = { attended: number; crews: number; reviews: number };
