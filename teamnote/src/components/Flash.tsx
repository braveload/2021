export default function Flash({ sp }: { sp: { [k: string]: string | string[] | undefined } }) {
  const m = typeof sp.msg === "string" ? sp.msg : null;
  const e = typeof sp.err === "string" ? sp.err : null;
  if (!m && !e) return null;
  return <div className={`flash ${e ? "err" : "msg"}`} role={e ? "alert" : "status"}>{e ?? m}</div>;
}
export type SP = { searchParams: { [k: string]: string | string[] | undefined } };
