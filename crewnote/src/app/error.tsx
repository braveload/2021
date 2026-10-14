"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card empty" role="alert">
      <h2>문제가 생겼어요</h2>
      <p>잠시 후 다시 시도해주세요.</p>
      <button className="btn p" onClick={reset}>다시 시도</button>
    </div>
  );
}
