"use client";
import {
  useEffect,
  useState,
  useId,
  Children,
  isValidElement,
  cloneElement,
  ReactElement,
  FormEvent,
} from "react";
import Papa from "papaparse";
type Row = Record<string, any>;
type State = {
  user: Row;
  today: string;
  clients: Row[];
  entries: Row[];
  documents: Row[];
};
const won = (n: number) => new Intl.NumberFormat("ko-KR").format(n) + "원";
const labels: Record<string, string> = {
  dashboard: "대시보드",
  ledger: "수입 · 경비",
  documents: "견적서 · 청구서",
  clients: "거래처",
  summary: "연간 요약",
  csv: "CSV 가져오기",
  settings: "설정",
};
const statuses: Record<string, string> = {
  draft: "초안",
  sent: "입금 대기",
  paid: "입금 완료",
  void: "취소",
};
async function api(url: string, method = "GET", body?: unknown) {
  const r = await fetch("/api/" + url, {
    method,
    headers:
      body instanceof FormData
        ? {}
        : body
          ? { "Content-Type": "application/json" }
          : undefined,
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "요청에 실패했습니다.");
  return j;
}
function values(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget));
}
function sum(rows: Row[], kind: string) {
  return rows.filter((e) => e.kind === kind).reduce((s, e) => s + e.amount, 0);
}
function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-mark">↗</span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {Children.map(children, (child) =>
        isValidElement(child) &&
        ["input", "select", "textarea"].includes(child.type as string)
          ? cloneElement(child as ReactElement<{ id: string }>, { id })
          : child,
      )}
    </div>
  );
}
export default function LedgerApp() {
  const [state, setState] = useState<State | null>(null),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState("dashboard"),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [register, setRegister] = useState(true),
    [modal, setModal] = useState<string | null>(null),
    [editing, setEditing] = useState<Row | null>(null),
    [detail, setDetail] = useState<Row | null>(null);
  const [month, setMonth] = useState(""),
    [category, setCategory] = useState(""),
    [year, setYear] = useState("2026"),
    [docKind, setDocKind] = useState("invoice"),
    [items, setItems] = useState<Row[]>([
      { description: "", qty: "1", unit_price: "" },
    ]);
  const [csv, setCsv] = useState<{ headers: string[]; rows: Row[] } | null>(
      null,
    ),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [importRows, setImportRows] = useState<Row[] | null>(null);
  const [receipt, setReceipt] = useState<{ url: string; id: string } | null>(
    null,
  );
  async function refresh() {
    const s = await api("state");
    setState(s);
    setMonth((m) => m || s.today.slice(0, 7));
    setYear((y) => (y === "2026" ? s.today.slice(0, 4) : y));
  }
  useEffect(() => {
    refresh()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    setError("");
    setMessage("");
  }, [page]);
  useEffect(() => {
    if (!modal && !detail && !receipt) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>("[role=dialog]");
    if (!dialog) return;
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]',
        ),
      );
    focusable()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        setModal(null);
        setDetail(null);
        setReceipt(null);
      }
      if (e.key === "Tab") {
        const list = focusable(),
          first = list[0],
          last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [modal, detail, receipt, busy]);

  async function run(f: () => Promise<unknown>, success = "저장했습니다.") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await f();
      await refresh();
      setMessage(success);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  function open(kind: string, row: Row | null = null) {
    setEditing(row);
    setModal(kind);
    setError("");
    if (kind === "document") {
      setDocKind("invoice");
      setItems([{ description: "", qty: "1", unit_price: "" }]);
    }
  }
  async function upload(file: File, entryId: string) {
    if (!["image/jpeg", "image/png"].includes(file.type))
      throw new Error("JPG 또는 PNG 사진을 선택해 주세요.");
    if (file.size > 20 * 1024 * 1024)
      throw new Error("원본 사진은 20MB 이하여야 합니다.");
    const bitmap = await createImageBitmap(file),
      ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("사진 변환 실패"))),
        "image/jpeg",
        0.84,
      ),
    );
    const form = new FormData();
    form.set("entry_id", entryId);
    form.set("file", blob, "receipt.jpg");
    await api("receipts", "POST", form);
  }
  if (loading)
    return <div className="loading">사이드장부를 준비하고 있습니다…</div>;
  if (!state)
    return (
      <main className="auth">
        <section className="auth-story">
          <a className="brand" href="/">
            ▥{" "}
            <span>
              사이드장부<small>SIDELEDGER</small>
            </span>
          </a>
          <div>
            <span className="eyebrow">퇴근 후의 일에도, 단단한 기록.</span>
            <h1>
              부업은 즐겁게.
              <br />돈 관리는
              <br />
              <em>가볍게.</em>
            </h1>
            <p>
              흩어진 수입과 영수증, 기다리는 입금까지.
              <br />
              당신의 작은 사업을 한 장에 담으세요.
            </p>
          </div>
          <p className="auth-note">
            CLOUD EDITION · 안전하게 보관하는 나의 장부.
          </p>
        </section>
        <section className="auth-form">
          <div className="auth-box">
            <span className="eyebrow">나만의 부업 작업실</span>
            <h2>
              {register ? "첫 장부를 열어볼까요?" : "다시 만나 반가워요."}
            </h2>
            <p>
              {register
                ? "이메일과 비밀번호로 이메일 계정을 만드세요."
                : "기록해 둔 돈 흐름을 이어서 살펴보세요."}
            </p>
            <form
              onSubmit={async (e) => {
                const v = values(e);
                await run(async () => {
                  const result = await api(
                    "auth/" + (register ? "register" : "login"),
                    "POST",
                    v,
                  );
                  if (result.verificationRequired) {
                    setRegister(false);
                    throw new Error(result.message);
                  }
                }, "");
              }}
            >
              {register && (
                <Field label="이름">
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={80}
                  />
                </Field>
              )}
              <Field label="이메일">
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </Field>
              <Field label="비밀번호">
                <input
                  type="password"
                  name="password"
                  autoComplete={register ? "new-password" : "current-password"}
                  minLength={10}
                  maxLength={128}
                  required
                  placeholder="10자 이상"
                />
              </Field>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <button className="primary full" disabled={busy}>
                {busy
                  ? "처리 중…"
                  : register
                    ? "내 장부 시작하기 →"
                    : "로그인 →"}
              </button>
            </form>
            <button
              className="link full"
              onClick={() => {
                setRegister(!register);
                setError("");
              }}
            >
              {register
                ? "이미 계정이 있어요 · 로그인"
                : "처음이에요 · 계정 만들기"}
            </button>
            <p className="fine">
              현재 체험 환경에서는 운영자에게 승인된 이메일만 가입할 수
              있습니다. 가입 확인 메일로 인증을 완료한 뒤 로그인해 주세요.
              클라우드 체험판은 모든 장부 기능을 사용할 수 있으며 결제는
              진행되지 않습니다.
            </p>
          </div>
        </section>
      </main>
    );
  const { user, entries, documents, clients, today } = state,
    monthly = entries.filter((e) => e.occurred_on.startsWith(month)),
    filtered = monthly.filter((e) => !category || e.category === category),
    income = sum(monthly, "income"),
    expense = sum(monthly, "expense"),
    pending = documents.filter(
      (d) => d.kind === "invoice" && d.status === "sent",
    ),
    overdue = pending.filter((d) => d.due_on < today);
  const annual = entries.filter((e) => e.occurred_on.startsWith(year)),
    years = [
      ...new Set([
        today.slice(0, 4),
        ...entries.map((e) => e.occurred_on.slice(0, 4)),
      ]),
    ]
      .sort()
      .reverse();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(month + "-01T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() - (5 - i));
    const key = d.toISOString().slice(0, 7),
      rows = entries.filter((e) => e.occurred_on.startsWith(key));
    return { key, income: sum(rows, "income"), expense: sum(rows, "expense") };
  });
  const maxChart = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  const badge = (d: Row) => (
    <span
      className={
        "badge " + (d.status === "sent" && d.due_on < today ? "late" : d.status)
      }
    >
      {d.kind === "quote" && d.status === "sent"
        ? "전달 완료"
        : d.status === "sent" && d.due_on < today
          ? "기한 경과"
          : statuses[d.status]}
    </span>
  );
  const clientOptions = (
    <>
      <option value="">거래처 선택</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </>
  );
  const docTable = (rows: Row[]) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>문서 / 거래처</th>
            <th>기한</th>
            <th className="right">합계</th>
            <th>상태</th>
            <th>열기</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id}>
              <td>
                <strong>{d.client_name}</strong>
                <small>
                  {d.number} · {d.kind === "quote" ? "견적서" : "청구서"}
                </small>
              </td>
              <td>{d.due_on}</td>
              <td className="right num">{won(d.total)}</td>
              <td>{badge(d)}</td>
              <td>
                <button
                  className="subtle"
                  onClick={() =>
                    run(
                      async () => setDetail(await api("documents/" + d.id)),
                      "",
                    )
                  }
                >
                  상세 →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href="/">
          ▥{" "}
          <span>
            사이드장부<small>SIDELEDGER</small>
          </span>
        </a>
        <div className="workspace-tag">
          나의 부업 작업실 <span>CLOUD</span>
        </div>
        <nav aria-label="메인 메뉴">
          {Object.entries(labels).map(([k, v], i) => (
            <button
              key={k}
              className={page === k ? "active" : ""}
              onClick={() => setPage(k)}
            >
              <span className="nav-icon" aria-hidden="true">
                {["◫", "≡", "▤", "◉", "↗", "↓", "⚙"][i]}
              </span>
              {v}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <span className="dot" /> 클라우드 체험판
            <p>
              기록은 클라우드에 보관됩니다.
              <br />
              실제 결제는 연결 전입니다.
            </p>
          </div>
          <button className="profile" onClick={() => setPage("settings")}>
            <span className="avatar">{user.name.slice(0, 1)}</span>
            <span>
              {user.name}
              <small>내 계정 설정 →</small>
            </span>
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <span>
            MY WORKSPACE <b>/</b> {labels[page]}
          </span>
          <span className="version">
            v1.1.0 <span className="dot" /> 클라우드 저장
          </span>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {page === "dashboard"
                  ? "작은 사업의, 선명한 흐름"
                  : "SIDELEDGER · MY RECORDS"}
              </span>
              <h1>
                {page === "dashboard" ? "오늘도, 차곡차곡." : labels[page]}
              </h1>
              <p>
                {page === "dashboard"
                  ? `${user.name}님의 부업 기록을 한눈에 살펴보세요.`
                  : page === "ledger"
                    ? "작은 지출도, 소중한 수입도 빠짐없이."
                    : page === "documents"
                      ? "정확한 견적부터 입금 확인까지 한 곳에서."
                      : page === "clients"
                        ? "함께 일하는 사람들을 기록하세요."
                        : page === "summary"
                          ? "신고 참고용 합계입니다. 세금 계산·신고 기능은 제공하지 않습니다."
                          : page === "csv"
                            ? "은행 내역의 열을 맞추고, 확인한 뒤 한 번에 저장하세요."
                            : "나의 정보와 서비스 연결 상태를 관리하세요."}
              </p>
            </div>
            <div className="heading-actions">
              {["dashboard", "ledger"].includes(page) && (
                <button className="primary" onClick={() => open("entry")}>
                  ＋ 수입 · 경비 기록
                </button>
              )}
              {page === "documents" && (
                <button className="primary" onClick={() => open("document")}>
                  ＋ 새 문서 작성
                </button>
              )}
              {page === "clients" && (
                <button className="primary" onClick={() => open("client")}>
                  ＋ 거래처 등록
                </button>
              )}
            </div>
          </div>
          {error && (
            <div role="alert" className="error notice">
              <span>{error}</span>
              <button aria-label="오류 닫기" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {message && (
            <div role="status" className="success notice">
              <span>{message}</span>
              <button aria-label="알림 닫기" onClick={() => setMessage("")}>
                ×
              </button>
            </div>
          )}
          {["dashboard", "ledger"].includes(page) && (
            <div className="filterbar">
              <label>
                조회 월{" "}
                <input
                  type="month"
                  value={month}
                  onChange={(e) =>
                    setMonth(e.target.value || today.slice(0, 7))
                  }
                />
              </label>
              {page === "ledger" && (
                <label>
                  분류{" "}
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">전체 분류</option>
                    {[...new Set(monthly.map((e) => e.category))]
                      .sort()
                      .map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                  </select>
                </label>
              )}
              <span>{month.replace("-", "년 ")}월 기록</span>
            </div>
          )}
          {page === "dashboard" && (
            <>
              <section className="metrics">
                <article className="metric featured">
                  <span>이번 달 수입</span>
                  <h2>{won(income)}</h2>
                  <p>
                    기록된 입금 기준 <span>↗</span>
                  </p>
                </article>
                <article className="metric">
                  <span>이번 달 경비</span>
                  <h2>{won(expense)}</h2>
                  <p>꼼꼼히 모은 지출 기록</p>
                </article>
                <article className="metric">
                  <span>전체 미수금</span>
                  <h2>{won(pending.reduce((s, d) => s + d.total, 0))}</h2>
                  <p className={overdue.length ? "red" : ""}>
                    {pending.length}건 입금 대기 · 기한 경과 {overdue.length}건
                  </p>
                </article>
              </section>
              <div className="dashboard-grid">
                <section className="panel chart-panel">
                  <div className="panel-head">
                    <h2>돈의 흐름</h2>
                    <div className="legend">
                      <span>
                        <i className="green" />
                        수입
                      </span>
                      <span>
                        <i className="sand" />
                        경비
                      </span>
                    </div>
                  </div>
                  <p className="muted">선택한 월까지 최근 6개월 · 원</p>
                  <div
                    className="chart"
                    role="img"
                    aria-label={months
                      .map(
                        (m) =>
                          `${m.key}: 수입 ${won(m.income)}, 경비 ${won(m.expense)}`,
                      )
                      .join("; ")}
                  >
                    {months.map((m) => (
                      <div className="chart-column" key={m.key}>
                        <div className="bar-pair">
                          <div
                            className="bar green"
                            style={{
                              height: `${(m.income / maxChart) * 100}%`,
                            }}
                            title={won(m.income)}
                          />
                          <div
                            className="bar sand"
                            style={{
                              height: `${(m.expense / maxChart) * 100}%`,
                            }}
                            title={won(m.expense)}
                          />
                        </div>
                        <span>{Number(m.key.slice(5))}월</span>
                      </div>
                    ))}
                  </div>
                  {entries.length === 0 && (
                    <p className="chart-note">
                      첫 기록을 남기면 나만의 그래프가 시작됩니다.
                    </p>
                  )}
                </section>
                <section className="panel quick-panel">
                  <span className="eyebrow">NEXT SMALL STEP</span>
                  <h2>
                    기록이 쌓이면,
                    <br />
                    정산이 가벼워져요.
                  </h2>
                  <p>
                    청구서를 만들고 입금을 확인하세요.
                    <br />
                    입금 완료 시 수입에 한 번만 반영됩니다.
                  </p>
                  <button
                    onClick={() => {
                      setPage("documents");
                      open("document");
                    }}
                  >
                    견적서 · 청구서 만들기 <span>→</span>
                  </button>
                  <button onClick={() => setPage("summary")}>
                    올해 기록 살펴보기 <span>→</span>
                  </button>
                </section>
              </div>
              <section className="panel">
                <div className="panel-head">
                  <h2>
                    기다리는 입금{" "}
                    <span className="count">{pending.length}</span>
                  </h2>
                  <button className="link" onClick={() => setPage("documents")}>
                    문서 전체 보기 →
                  </button>
                </div>
                {pending.length ? (
                  docTable(pending)
                ) : (
                  <Empty
                    title="기다리는 입금이 없어요"
                    body="청구서를 작성하고 ‘보냄 표시’를 하면 이곳에서 확인할 수 있어요."
                  />
                )}
              </section>
            </>
          )}
          {page === "ledger" && (
            <section className="panel">
              <div className="panel-head">
                <h2>
                  거래 내역 <span className="count">{filtered.length}</span>
                </h2>
                <a
                  className="link"
                  href={"/api/export?year=" + month.slice(0, 4)}
                >
                  올해 CSV 내보내기 ↓
                </a>
              </div>
              {filtered.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>날짜</th>
                        <th>구분 / 분류</th>
                        <th>내용</th>
                        <th className="right">금액</th>
                        <th>영수증</th>
                        <th>관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((e) => (
                        <tr key={e.id}>
                          <td className="num">{e.occurred_on}</td>
                          <td>
                            <span className={"badge " + e.kind}>
                              {e.kind === "income" ? "수입" : "경비"}
                            </span>
                            <small>{e.category}</small>
                          </td>
                          <td>
                            <strong>{e.memo || e.category}</strong>
                            <small>
                              {e.client_name || "거래처 미지정"}
                              {e.document_id ? " · 청구서 자동 반영" : ""}
                            </small>
                          </td>
                          <td
                            className={
                              "right num " +
                              (e.kind === "income" ? "green-text" : "")
                            }
                          >
                            {e.kind === "income" ? "+" : "−"}
                            {won(e.amount)}
                          </td>
                          <td>
                            {e.receipt_id ? (
                              <button
                                className="link"
                                onClick={() =>
                                  run(
                                    async () =>
                                      setReceipt({
                                        ...(await api(
                                          "receipts/" + e.receipt_id,
                                        )),
                                        id: e.receipt_id,
                                      }),
                                    "",
                                  )
                                }
                              >
                                사진 보기
                              </button>
                            ) : (
                              <label className="upload-link">
                                첨부
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png"
                                  hidden
                                  disabled={busy}
                                  onChange={(ev) => {
                                    const f = ev.target.files?.[0];
                                    if (f)
                                      run(
                                        () => upload(f, e.id),
                                        "영수증을 보관했습니다.",
                                      );
                                    ev.target.value = "";
                                  }}
                                />
                              </label>
                            )}
                          </td>
                          <td>
                            <div className="row-actions">
                              {!e.document_id && (
                                <>
                                  <button
                                    className="subtle"
                                    onClick={() => open("entry", e)}
                                  >
                                    수정
                                  </button>
                                  <button
                                    className="subtle danger"
                                    onClick={() => open("delete-entry", e)}
                                  >
                                    삭제
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="아직 기록이 없어요"
                  body="이번 달의 첫 수입 또는 경비를 남겨보세요."
                  action={
                    <button className="primary" onClick={() => open("entry")}>
                      첫 내역 기록하기
                    </button>
                  }
                />
              )}
            </section>
          )}
          {page === "documents" && (
            <>
              <div className="info-strip">
                청구서는 거래 내역서이며 세금계산서가 아닙니다. ‘보냄 표시’는
                실제 이메일 발송 기능이 아닙니다.
              </div>
              <section className="panel">
                {documents.length ? (
                  docTable(documents)
                ) : (
                  <Empty
                    title="첫 문서를 만들어보세요"
                    body="거래처와 항목을 입력하면 번호와 합계를 자동으로 만들어요."
                    action={
                      <button
                        className="primary"
                        onClick={() => open("document")}
                      >
                        새 문서 작성
                      </button>
                    }
                  />
                )}
              </section>
            </>
          )}
          {page === "clients" && (
            <section className="panel">
              <div className="panel-head">
                <h2>
                  함께 일하는 곳 <span className="count">{clients.length}</span>
                </h2>
              </div>
              {clients.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>거래처</th>
                        <th>이메일</th>
                        <th>문서 수</th>
                        <th>관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <strong>{c.name}</strong>
                          </td>
                          <td>{c.email || "미등록"}</td>
                          <td>
                            {
                              documents.filter((d) => d.client_id === c.id)
                                .length
                            }
                            건
                          </td>
                          <td>
                            <div className="row-actions">
                              <button
                                className="subtle"
                                onClick={() => open("client", c)}
                              >
                                수정
                              </button>
                              <button
                                className="subtle danger"
                                onClick={() => open("delete-client", c)}
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="함께하는 거래처를 등록하세요"
                  body="문서에 연결된 거래처는 안전하게 보존됩니다."
                  action={
                    <button className="primary" onClick={() => open("client")}>
                      거래처 등록
                    </button>
                  }
                />
              )}
            </section>
          )}
          {page === "summary" && (
            <>
              <div className="filterbar">
                <label>
                  조회 연도{" "}
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  >
                    {years.map((y) => (
                      <option key={y}>{y}</option>
                    ))}
                  </select>
                </label>
                <a className="secondary" href={"/api/export?year=" + year}>
                  연간 CSV 내보내기 ↓
                </a>
              </div>
              <section className="metrics">
                <article className="metric featured">
                  <span>연간 수입</span>
                  <h2>{won(sum(annual, "income"))}</h2>
                  <p>{year}년 입금 기록</p>
                </article>
                <article className="metric">
                  <span>연간 경비</span>
                  <h2>{won(sum(annual, "expense"))}</h2>
                  <p>
                    {annual.filter((e) => e.kind === "expense").length}건의 지출
                  </p>
                </article>
                <article className="metric">
                  <span>수입 − 경비</span>
                  <h2>{won(sum(annual, "income") - sum(annual, "expense"))}</h2>
                  <p>세액이 아닌 기록상 차액</p>
                </article>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <h2>월별 기록</h2>
                  <span className="muted">신고 참고용 합계</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>월</th>
                        <th className="right">수입</th>
                        <th className="right">경비</th>
                        <th className="right">차액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 12 }, (_, i) => {
                        const rows = annual.filter(
                            (e) => Number(e.occurred_on.slice(5, 7)) === i + 1,
                          ),
                          a = sum(rows, "income"),
                          b = sum(rows, "expense");
                        return (
                          <tr key={i}>
                            <td>{i + 1}월</td>
                            <td className="right num">{won(a)}</td>
                            <td className="right num">{won(b)}</td>
                            <td className="right num">{won(a - b)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          {page === "csv" && (
            <section className="panel csv-panel">
              <span className="step">01 · 파일 선택</span>
              <h2>흩어진 내역을 한 번에.</h2>
              <p className="muted">
                UTF-8 CSV · 2,000행 이하 · 금액은 양수, 구분은 수입/경비
              </p>
              <label className="dropzone">
                CSV 파일 선택
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setError("");
                    setImportRows(null);
                    if (f.size > 2 * 1024 * 1024) {
                      setError("CSV 파일은 2MB 이하여야 합니다.");
                      return;
                    }
                    Papa.parse<Row>(await f.text(), {
                      header: true,
                      skipEmptyLines: true,
                      complete: (r) => {
                        if (r.errors.length || !r.meta.fields?.length) {
                          setError("CSV 형식을 확인해 주세요.");
                          return;
                        }
                        if (r.data.length > 2000) {
                          setError("2,000행까지만 가져올 수 있습니다.");
                          return;
                        }
                        const headers = r.meta.fields;
                        setCsv({ headers, rows: r.data });
                        const aliases: Record<string, string[]> = {
                          occurred_on: [
                            "날짜",
                            "거래일",
                            "date",
                            "occurred_on",
                          ],
                          kind: ["구분", "kind"],
                          amount: ["금액", "amount"],
                          memo: ["적요", "내용", "memo"],
                          category: ["분류", "category"],
                        };
                        setMapping(
                          Object.fromEntries(
                            Object.entries(aliases).map(([k, names]) => [
                              k,
                              headers.find((h) => names.includes(h)) || "",
                            ]),
                          ),
                        );
                      },
                    });
                  }}
                />
              </label>
              <a
                className="link"
                download="sideledger-sample.csv"
                href={
                  "data:text/csv;charset=utf-8," +
                  encodeURIComponent(
                    "\uFEFF날짜,구분,금액,분류,적요\n" +
                      today +
                      ",수입,500000,외주 수입,디자인 작업\n" +
                      today +
                      ",경비,22000,소프트웨어,작업 도구",
                  )
                }
              >
                CSV 예시 내려받기 ↓
              </a>
              {csv && (
                <>
                  <hr />
                  <span className="step">02 · 열 맞추기</span>
                  <div className="form-grid">
                    {Object.entries({
                      occurred_on: "날짜 *",
                      kind: "수입/경비 *",
                      amount: "금액 *",
                      category: "분류",
                      memo: "적요",
                    }).map(([k, v]) => (
                      <Field key={k} label={v}>
                        <select
                          value={mapping[k]}
                          onChange={(e) => {
                            setMapping({ ...mapping, [k]: e.target.value });
                            setImportRows(null);
                          }}
                        >
                          <option value="">선택 안 함</option>
                          {csv.headers.map((h) => (
                            <option key={h}>{h}</option>
                          ))}
                        </select>
                      </Field>
                    ))}
                  </div>
                  <button
                    className="secondary"
                    onClick={() => {
                      try {
                        if (
                          !mapping.occurred_on ||
                          !mapping.kind ||
                          !mapping.amount
                        )
                          throw new Error(
                            "날짜, 구분, 금액 열을 선택해 주세요.",
                          );
                        const parsed = csv.rows.map((r, i) => {
                          const raw = String(r[mapping.amount] ?? "")
                              .replaceAll(",", "")
                              .trim(),
                            amount = Number(raw),
                            k = String(r[mapping.kind] ?? "").trim(),
                            kind = ["수입", "income"].includes(k)
                              ? "income"
                              : ["경비", "지출", "expense"].includes(k)
                                ? "expense"
                                : "";
                          if (
                            !/^\d+$/.test(raw) ||
                            !Number.isSafeInteger(amount) ||
                            amount <= 0 ||
                            !kind
                          )
                            throw new Error(
                              `${i + 1}번째 행의 구분 또는 금액이 올바르지 않습니다.`,
                            );
                          return {
                            occurred_on: String(
                              r[mapping.occurred_on] ?? "",
                            ).trim(),
                            kind,
                            amount,
                            category: String(r[mapping.category] || "기타"),
                            memo: String(r[mapping.memo] || ""),
                          };
                        });
                        setImportRows(parsed);
                        setError("");
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    미리보기 만들기
                  </button>
                </>
              )}
              {importRows && (
                <>
                  <hr />
                  <span className="step">03 · 확인 후 저장</span>
                  <p>
                    {importRows.length}행 · 아래 최대 10행 미리보기. 같은
                    날짜·구분·금액·적요는 중복 제외합니다.
                  </p>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>날짜</th>
                          <th>구분</th>
                          <th>금액</th>
                          <th>적요</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 10).map((r, i) => (
                          <tr key={i}>
                            <td>{r.occurred_on}</td>
                            <td>{r.kind === "income" ? "수입" : "경비"}</td>
                            <td>{won(r.amount)}</td>
                            <td>{r.memo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const r = await api("csv", "POST", {
                          rows: importRows,
                        });
                        setImportRows(null);
                        setCsv(null);
                        setTimeout(
                          () =>
                            setMessage(
                              `${r.added}건 저장 · ${r.skipped}건 중복 제외`,
                            ),
                          0,
                        );
                      }, "가져오기를 완료했습니다.")
                    }
                  >
                    확인한 내역 저장
                  </button>
                </>
              )}
            </section>
          )}
          {page === "settings" && (
            <div className="settings-grid">
              <section className="panel">
                <h2>내 정보</h2>
                <form
                  onSubmit={(e) => {
                    const v = values(e);
                    run(() => api("profile", "PUT", v));
                  }}
                >
                  <Field label="이름">
                    <input
                      name="name"
                      defaultValue={user.name}
                      required
                      maxLength={80}
                    />
                  </Field>
                  <Field label="이메일">
                    <input value={user.email} readOnly />
                  </Field>
                  <Field label="문서에 표시할 입금 계좌">
                    <input
                      name="account"
                      defaultValue={user.account}
                      maxLength={200}
                      placeholder="은행 · 계좌번호 · 예금주"
                    />
                  </Field>
                  <button className="primary" disabled={busy}>
                    정보 저장
                  </button>
                </form>
              </section>
              <section className="panel">
                <h2>이용 및 연결 상태</h2>
                <div className="connection">
                  <strong>클라우드 체험판</strong>
                  <span className="badge income">사용 중</span>
                </div>
                <p className="muted">
                  장부·문서·영수증·CSV 기능을 제한 없이 사용합니다. 운영 요금제
                  결제는 연결되지 않았습니다.
                </p>
                <div className="connection">
                  <span>실제 Pro 결제</span>
                  <span className="badge void">미연결</span>
                </div>
                <div className="connection">
                  <span>메일 · 입금 리마인더</span>
                  <span className="badge void">미연결</span>
                </div>
                <div className="connection">
                  <span>Supabase 연결</span>
                  <span className="badge income">연결됨</span>
                </div>
                <p className="fine">
                  장부와 영수증은 Supabase에 저장됩니다. 로그인한 사용자는
                  자신의 기록에만 접근할 수 있습니다.
                </p>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await api("auth/logout", "POST", {});
                      setState(null);
                      setPage("dashboard");
                      setRegister(false);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  로그아웃
                </button>
              </section>
            </div>
          )}
          <footer>
            사이드장부 <span>부업 하나에 딱 맞는 장부.</span>
            <div>
              <a href="/terms">이용약관 초안</a>
              <a href="/privacy">개인정보 안내 초안</a>
              <a href="/refund">환불정책 초안</a>
            </div>
          </footer>
        </div>
      </main>
      {modal && !["void-document", "delete-receipt"].includes(modal) && (
        <div
          className="overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setModal(null);
          }}
        >
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="panel-head">
              <h2 id="modal-title">
                {modal === "entry"
                  ? editing
                    ? "내역 수정"
                    : "수입 · 경비 기록"
                  : modal === "client"
                    ? editing
                      ? "거래처 수정"
                      : "거래처 등록"
                    : modal === "document"
                      ? "새 문서 작성"
                      : "삭제 확인"}
              </h2>
              <button
                className="close"
                aria-label="창 닫기"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                ×
              </button>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {modal === "entry" && (
              <form
                onSubmit={async (e) => {
                  const v = values(e),
                    ok = await run(() =>
                      api(
                        "entries" + (editing ? "/" + editing.id : ""),
                        editing ? "PUT" : "POST",
                        {
                          ...v,
                          amount: Number(String(v.amount).replaceAll(",", "")),
                        },
                      ),
                    );
                  if (ok) setModal(null);
                }}
              >
                <div className="form-grid">
                  <Field label="구분">
                    <select
                      name="kind"
                      defaultValue={editing?.kind || "income"}
                    >
                      <option value="income">수입</option>
                      <option value="expense">경비</option>
                    </select>
                  </Field>
                  <Field label="날짜">
                    <input
                      type="date"
                      name="occurred_on"
                      defaultValue={editing?.occurred_on || today}
                      required
                    />
                  </Field>
                </div>
                <Field label="금액 (원)">
                  <input
                    name="amount"
                    inputMode="numeric"
                    defaultValue={
                      editing?.amount?.toLocaleString("ko-KR") || ""
                    }
                    required
                    placeholder="예: 500,000"
                    onChange={(e) => {
                      e.target.value = e.target.value
                        .replace(/[^0-9]/g, "")
                        .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                    }}
                  />
                </Field>
                <div className="form-grid">
                  <Field label="분류">
                    <input
                      name="category"
                      defaultValue={editing?.category || "외주 수입"}
                      list="categories"
                      maxLength={50}
                      required
                    />
                    <datalist id="categories">
                      {[
                        "외주 수입",
                        "소프트웨어",
                        "교통비",
                        "식비",
                        "재료비",
                        "기타",
                      ].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </datalist>
                  </Field>
                  <Field label="거래처 (선택)">
                    <select
                      name="client_id"
                      defaultValue={editing?.client_id || ""}
                    >
                      {clientOptions}
                    </select>
                  </Field>
                </div>
                <Field label="적요">
                  <input
                    name="memo"
                    defaultValue={editing?.memo || ""}
                    maxLength={500}
                  />
                </Field>
                <div className="dialog-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setModal(null)}
                  >
                    닫기
                  </button>
                  <button className="primary" disabled={busy}>
                    {busy ? "저장 중…" : "기록 저장"}
                  </button>
                </div>
              </form>
            )}
            {modal === "client" && (
              <form
                onSubmit={async (e) => {
                  const v = values(e),
                    ok = await run(() =>
                      api(
                        "clients" + (editing ? "/" + editing.id : ""),
                        editing ? "PUT" : "POST",
                        v,
                      ),
                    );
                  if (ok) setModal(null);
                }}
              >
                <Field label="거래처 이름">
                  <input
                    name="name"
                    defaultValue={editing?.name || ""}
                    required
                    maxLength={100}
                  />
                </Field>
                <Field label="이메일 (선택)">
                  <input
                    type="email"
                    name="email"
                    defaultValue={editing?.email || ""}
                    maxLength={254}
                  />
                </Field>
                <div className="dialog-actions">
                  <button className="primary" disabled={busy}>
                    거래처 저장
                  </button>
                </div>
              </form>
            )}
            {modal === "document" &&
              (clients.length ? (
                <form
                  onSubmit={async (e) => {
                    const v = values(e),
                      ok = await run(() =>
                        api("documents", "POST", {
                          ...v,
                          kind: docKind,
                          items: items.map((i) => ({
                            ...i,
                            unit_price: Number(
                              String(i.unit_price).replaceAll(",", ""),
                            ),
                          })),
                        }),
                      );
                    if (ok) setModal(null);
                  }}
                >
                  <div className="form-grid">
                    <Field label="종류">
                      <select
                        value={docKind}
                        onChange={(e) => setDocKind(e.target.value)}
                      >
                        <option value="invoice">청구서</option>
                        <option value="quote">견적서</option>
                      </select>
                    </Field>
                    <Field label="거래처">
                      <select name="client_id" required>
                        {clientOptions}
                      </select>
                    </Field>
                    <Field label="발행일">
                      <input
                        type="date"
                        name="issued_on"
                        defaultValue={today}
                        required
                      />
                    </Field>
                    <Field
                      label={
                        docKind === "invoice" ? "입금 기한" : "견적 유효 기한"
                      }
                    >
                      <input
                        type="date"
                        name="due_on"
                        defaultValue={today}
                        required
                      />
                    </Field>
                  </div>
                  <div className="item-labels">
                    <span>항목</span>
                    <span>수량</span>
                    <span>단가 (원)</span>
                    <span />
                  </div>
                  {items.map((i, n) => (
                    <div className="item-row" key={n}>
                      <input
                        aria-label={`항목 ${n + 1}`}
                        required
                        maxLength={200}
                        value={i.description}
                        onChange={(e) =>
                          setItems(
                            items.map((x, j) =>
                              j === n
                                ? { ...x, description: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                      <input
                        aria-label={`수량 ${n + 1}`}
                        type="number"
                        step="0.01"
                        min="0.01"
                        max="999999.99"
                        required
                        value={i.qty}
                        onChange={(e) =>
                          setItems(
                            items.map((x, j) =>
                              j === n ? { ...x, qty: e.target.value } : x,
                            ),
                          )
                        }
                      />
                      <input
                        aria-label={`단가 ${n + 1}`}
                        inputMode="numeric"
                        required
                        value={i.unit_price}
                        onChange={(e) =>
                          setItems(
                            items.map((x, j) =>
                              j === n
                                ? {
                                    ...x,
                                    unit_price: e.target.value
                                      .replace(/[^0-9]/g, "")
                                      .replace(/\B(?=(\d{3})+(?!\d))/g, ","),
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        aria-label={`항목 ${n + 1} 삭제`}
                        disabled={items.length === 1}
                        onClick={() =>
                          setItems(items.filter((_, j) => j !== n))
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="link"
                    disabled={items.length >= 30}
                    onClick={() =>
                      setItems([
                        ...items,
                        { description: "", qty: "1", unit_price: "" },
                      ])
                    }
                  >
                    ＋ 항목 추가
                  </button>
                  <p className="fine">
                    합계는 서버에서 정확히 계산합니다. 소수 수량은 둘째 자리까지
                    지원합니다.
                  </p>
                  <Field label="메모">
                    <textarea name="notes" maxLength={1000} rows={2} />
                  </Field>
                  <div className="dialog-actions">
                    <button className="primary" disabled={busy}>
                      초안 만들기
                    </button>
                  </div>
                </form>
              ) : (
                <Empty
                  title="먼저 거래처를 등록하세요"
                  body="문서에는 받는 거래처가 필요합니다."
                  action={
                    <button
                      className="primary"
                      onClick={() => {
                        setPage("clients");
                        open("client");
                      }}
                    >
                      거래처 등록
                    </button>
                  }
                />
              ))}
            {modal.startsWith("delete-") && (
              <>
                <p>
                  ‘{editing?.name || editing?.memo || editing?.category}’ 내역을
                  삭제합니다. 연결된 영수증도 삭제됩니다.
                </p>
                <div className="dialog-actions">
                  <button className="secondary" onClick={() => setModal(null)}>
                    닫기
                  </button>
                  <button
                    className="danger-button"
                    disabled={busy}
                    onClick={async () => {
                      const ok = await run(
                        () =>
                          api(
                            (modal === "delete-client"
                              ? "clients/"
                              : "entries/") + editing?.id,
                            "DELETE",
                          ),
                        "삭제했습니다.",
                      );
                      if (ok) setModal(null);
                    }}
                  >
                    삭제하기
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
      {detail && (
        <div className="overlay">
          <section
            className="dialog document-detail"
            role="dialog"
            aria-modal="true"
            aria-label="문서 상세"
          >
            <div className="panel-head">
              <h2>{detail.kind === "invoice" ? "청구서" : "견적서"}</h2>
              <button
                className="close"
                aria-label="문서 닫기"
                onClick={() => setDetail(null)}
              >
                ×
              </button>
            </div>
            <p className="muted">{detail.number}</p>
            <h3>{detail.client_name} 귀중</h3>
            <p>
              발행 {detail.issued_on} · 기한 {detail.due_on}
            </p>
            {badge(detail)}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>항목</th>
                    <th>수량</th>
                    <th className="right">단가</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((i: Row, n: number) => (
                    <tr key={n}>
                      <td>{i.description}</td>
                      <td>{i.qty100 / 100}</td>
                      <td className="right">{won(i.unit_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="doc-total">합계 {won(detail.total)}</p>
            {detail.notes && <p>{detail.notes}</p>}
            <p className="fine">
              본 문서는 거래 내역서이며 세금계산서가 아닙니다.
            </p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="dialog-actions wrap">
              <a
                className="secondary"
                href={"/api/documents/" + detail.id + "/pdf"}
              >
                PDF 다운로드 ↓
              </a>
              {detail.status === "draft" && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api("documents/" + detail.id, "PATCH", {
                        status: "sent",
                      });
                      setDetail(await api("documents/" + detail.id));
                    }, "보냄으로 표시했습니다. 실제 메일은 발송되지 않았습니다.")
                  }
                >
                  보냄 표시
                </button>
              )}
              {detail.status === "sent" && detail.kind === "invoice" && (
                <form
                  className="paid-form"
                  onSubmit={(e) => {
                    const v = values(e);
                    run(async () => {
                      await api("documents/" + detail.id, "PATCH", {
                        status: "paid",
                        paid_on: v.paid_on,
                      });
                      setDetail(await api("documents/" + detail.id));
                    }, "입금을 확인하고 수입에 한 번 반영했습니다.");
                  }}
                >
                  <label>
                    입금일{" "}
                    <input
                      type="date"
                      name="paid_on"
                      defaultValue={today}
                      required
                    />
                  </label>
                  <button className="primary" disabled={busy}>
                    입금 완료
                  </button>
                </form>
              )}
              {["draft", "sent"].includes(detail.status) && (
                <button
                  className="subtle danger"
                  disabled={busy}
                  onClick={() => {
                    setDetail(null);
                    open("void-document", detail);
                  }}
                >
                  문서 취소
                </button>
              )}
            </div>
          </section>
        </div>
      )}
      {modal === "void-document" && editing && (
        <div className="overlay">
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label="문서 취소 확인"
          >
            <h2>문서를 취소할까요?</h2>
            <p>{editing.number} · 취소된 문서는 복구할 수 없습니다.</p>
            <div className="dialog-actions">
              <button className="secondary" onClick={() => setModal(null)}>
                닫기
              </button>
              <button
                className="danger-button"
                disabled={busy}
                onClick={async () => {
                  const ok = await run(
                    () =>
                      api("documents/" + editing.id, "PATCH", {
                        status: "void",
                      }),
                    "문서를 취소했습니다.",
                  );
                  if (ok) setModal(null);
                }}
              >
                취소 확정
              </button>
            </div>
          </section>
        </div>
      )}
      {receipt && (
        <div className="overlay">
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label="영수증"
          >
            <div className="panel-head">
              <h2>보관한 영수증</h2>
              <button
                className="close"
                aria-label="영수증 닫기"
                onClick={() => setReceipt(null)}
              >
                ×
              </button>
            </div>
            <p className="fine">
              링크는 60초 후 만료됩니다. 다시 열면 새 링크가 발급됩니다.
            </p>
            <img
              className="receipt-image"
              src={receipt.url}
              alt="보관된 영수증 사진"
            />
            <button
              className="link danger"
              onClick={() => {
                setEditing({ id: receipt.id });
                setReceipt(null);
                setModal("delete-receipt");
              }}
            >
              영수증 삭제
            </button>
          </section>
        </div>
      )}
      {modal === "delete-receipt" && editing && (
        <div className="overlay">
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label="영수증 삭제 확인"
          >
            <h2>영수증을 삭제할까요?</h2>
            <p>장부 내역은 유지됩니다. 사진은 복구할 수 없습니다.</p>
            <div className="dialog-actions">
              <button className="secondary" onClick={() => setModal(null)}>
                닫기
              </button>
              <button
                className="danger-button"
                disabled={busy}
                onClick={async () => {
                  const ok = await run(
                    () => api("receipts/" + editing.id, "DELETE"),
                    "영수증을 삭제했습니다.",
                  );
                  if (ok) setModal(null);
                }}
              >
                삭제 확정
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
