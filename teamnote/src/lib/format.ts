const TZ = "Asia/Seoul";

export function todayKST(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date());
}

/** 'YYYY-MM-DD' (date 컬럼은 pg에서 문자열로 읽도록 변환) */
export function fmtDate(d: string | Date): string {
  const s = typeof d === "string" ? d.slice(0, 10) : new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(d);
  const dt = new Date(s + "T00:00:00+09:00");
  return new Intl.DateTimeFormat("ko-KR", { timeZone: TZ, month: "numeric", day: "numeric", weekday: "short" }).format(dt);
}

export function fmtDateTime(d: Date | string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: TZ, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(d));
}

export const STATUS_LABEL: Record<string, string> = { office: "🏢 출근", remote: "🏠 재택", field: "🚗 외근" };
export const KIND_LABEL: Record<string, string> = { full: "연차", half_am: "오전 반차", half_pm: "오후 반차" };
export const LEAVE_STATE: Record<string, string> = { pending: "승인 대기", approved: "승인", rejected: "반려", cancelled: "취소" };
export const ROLE_LABEL: Record<string, string> = { owner: "관리자", staff: "운영자", member: "팀원" };
