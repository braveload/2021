export default function Loading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중" style={{ display: "grid", gap: 14 }}>
      <div className="skel" /><div className="skel" /><div className="skel" />
    </div>
  );
}
