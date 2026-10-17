"use client";
import { useState, FormEvent } from "react";
async function call(path: string, body: unknown) {
  const r = await fetch("/api/auth/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "처리하지 못했습니다.");
  return data;
}
export function AccountRecovery() {
  const [mode, setMode] = useState<"find" | "reset" | null>(null),
    [result, setResult] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError("");
    setResult("");
    try {
      const r = await call(
        mode === "find" ? "recovery-find" : "recovery-reset",
        data,
      );
      setResult(
        mode === "find"
          ? "가입 이메일: " + r.email
          : "비밀번호를 변경했습니다. " +
              r.email +
              " 계정으로 다시 로그인하세요. 복구코드는 사용 완료되어 로그인 후 새로 발급해야 합니다.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="계정 찾기">
      <div className="dialog-actions">
        <button
          className="link"
          type="button"
          onClick={() => {
            setMode("find");
            setError("");
            setResult("");
          }}
        >
          이메일 찾기
        </button>
        <button
          className="link"
          type="button"
          onClick={() => {
            setMode("reset");
            setError("");
            setResult("");
          }}
        >
          비밀번호 찾기
        </button>
      </div>
      {mode && (
        <form onSubmit={submit}>
          <h3>
            {mode === "find"
              ? "복구코드로 이메일 찾기"
              : "복구코드로 비밀번호 재설정"}
          </h3>
          <p className="fine">
            가입 후 발급받아 보관한 복구코드가 필요합니다. 코드가 없다면 먼저
            기억하는 계정으로 로그인해야 합니다.
          </p>
          <label htmlFor="recover-code">복구코드</label>
          <textarea
            id="recover-code"
            name="code"
            required
            autoComplete="off"
            spellCheck={false}
            maxLength={100}
          />
          {mode === "reset" && (
            <>
              <label htmlFor="recover-password">새 비밀번호</label>
              <input
                id="recover-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                maxLength={128}
                required
                placeholder="6자 이상"
              />
            </>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {result && <p role="status">{result}</p>}
          <div className="dialog-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setMode(null)}
            >
              닫기
            </button>
            <button className="primary" disabled={busy}>
              {busy
                ? "처리 중…"
                : mode === "find"
                  ? "이메일 확인"
                  : "비밀번호 재설정"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
export function RecoveryCodeSettings() {
  const [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    try {
      const r = await call(
        "recovery-issue",
        Object.fromEntries(new FormData(form)),
      );
      setCode(r.code);
      form.reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>계정 복구코드</h2>
      <p>
        이메일이나 비밀번호를 잊었을 때 사용합니다. 발급한 코드는 안전한 곳에
        보관하세요. 재발급하면 이전 코드는 사용할 수 없습니다.
      </p>
      <form onSubmit={submit}>
        <label htmlFor="recovery-current">현재 비밀번호</label>
        <input
          id="recovery-current"
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={6}
          maxLength={128}
          required
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "발급 중…" : "복구코드 발급 · 재발급"}
        </button>
      </form>
      {code && (
        <>
          <label htmlFor="issued-code">발급된 복구코드</label>
          <textarea id="issued-code" value={code} readOnly spellCheck={false} />
          <p className="fine">
            코드를 가진 사람은 계정 비밀번호를 변경할 수 있습니다. 다른 사람에게
            보내지 마세요. 이 화면을 나가면 다시 표시되지 않습니다.
          </p>
          <div className="dialog-actions">
            <button
              className="secondary"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob(
                    [
                      "사이드장부 계정 복구코드\n" +
                        code +
                        "\n다른 사람에게 공유하지 마세요.",
                    ],
                    { type: "text/plain;charset=utf-8" },
                  ),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "사이드장부-복구코드.txt";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              복구코드 파일 저장
            </button>
            <button className="secondary" onClick={() => setCode("")}>
              보관 완료 · 숨기기
            </button>
          </div>
        </>
      )}
    </section>
  );
}
