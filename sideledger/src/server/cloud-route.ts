import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { cloud, checked } from "./cloud";
import {
  AppError,
  str,
  date,
  money,
  qty100,
  csvCell,
  today,
  Row,
} from "./ledger";
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store", Pragma: "no-cache" },
  });
function id(v: string) {
  if (!/^[a-f0-9-]{36}$/.test(v))
    throw new AppError("내역을 찾을 수 없습니다.", 404);
  return v;
}
export async function handler(req: NextRequest) {
  try {
    const url = new URL(req.url),
      [resource, key, action] = url.pathname.slice(5).split("/"),
      method = req.method;
    if (resource === "health" && method === "GET")
      return json({ ok: true, version: "1.1.0", storage: "supabase" });
    const host = req.headers.get("host") || "",
      origin = req.headers.get("origin"),
      local = /^(localhost|127\.0\.0\.1):\d+$/.test(host);
    if (!local && !/^[a-z0-9-]+\.vercel\.app$/.test(host))
      throw new AppError("허용되지 않은 호스트입니다.", 403);
    if (method !== "GET" && origin !== (local ? "http://" : "https://") + host)
      throw new AppError("요청 출처가 올바르지 않습니다.", 403);
    if (Number(req.headers.get("content-length") || 0) > 5500000)
      throw new AppError("업로드 크기를 줄여 주세요.", 413);
    const db = await cloud();
    if (
      resource === "auth" &&
      method === "POST" &&
      ["register", "login", "verify"].includes(key)
    ) {
      const b = await req.json(),
        email = str(b.email, 254).toLowerCase();
      if (key === "verify") {
        const r = await db.auth.verifyOtp({
          email,
          token: str(b.token, 10),
          type: "signup",
        });
        if (r.error)
          throw new AppError("인증번호가 올바르지 않거나 만료되었습니다.");
        return json({ ok: true });
      }
      const password = str(b.password, 128);
      if (password.length < 10)
        throw new AppError("비밀번호는 10자 이상 입력해 주세요.");
      if (key === "register") {
        const name = str(b.name, 80),
          r = await db.auth.signUp({
            email,
            password,
            options: {
              data: { name },
              emailRedirectTo:
                (local ? "http://" : "https://") + host + "/api/auth/callback",
            },
          });
        if (r.error)
          throw new AppError(
            r.error.status === 429
              ? "이메일 발송 한도에 도달했습니다. 잠시 후 다시 시도해 주세요."
              : "가입에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.",
          );
        if (!r.data.session)
          return json({
            verificationRequired: true,
            email,
            message:
              "가입 확인 메일을 보냈습니다. 메일에서 인증을 완료한 뒤 로그인해 주세요.",
          });
        checked(await db.rpc("sl_ensure_profile", { p_name: name }));
        return json({ ok: true });
      }
      const r = await db.auth.signInWithPassword({ email, password });
      if (r.error)
        throw new AppError(
          "이메일·비밀번호 또는 이메일 인증 상태를 확인해 주세요.",
          401,
        );
      return json({ ok: true });
    }
    if (resource === "auth" && key === "callback" && method === "GET") {
      const code = url.searchParams.get("code");
      if (code && !(await db.auth.exchangeCodeForSession(code)).error)
        return NextResponse.redirect(new URL("/", req.url));
      return NextResponse.redirect(new URL("/?auth=failed", req.url));
    }
    const auth = await db.auth.getUser();
    if (auth.error || !auth.data.user)
      throw new AppError("로그인이 필요합니다.", 401);
    const user = auth.data.user,
      owner = user.id;
    if (resource === "auth" && key === "logout" && method === "POST") {
      checked(await db.auth.signOut({ scope: "local" }));
      return json({ ok: true });
    }
    checked(
      await db.rpc("sl_ensure_profile", {
        p_name: String(
          user.user_metadata.name || user.email?.split("@")[0] || "사용자",
        ),
      }),
    );
    const own = async (table: string, k: string) => {
      const r = await db
        .from(table)
        .select("*")
        .eq("id", id(k))
        .eq("owner_id", owner)
        .maybeSingle();
      checked(r);
      if (!r.data) throw new AppError("내역을 찾을 수 없습니다.", 404);
      return r.data as Row;
    };
    const client = async (v: unknown, optional = false) => {
      if (optional && !v) return null;
      return (await own("sl_clients", str(v, 36))).id;
    };
    const all = async (
      table: string,
      columns = "*",
      sort = "id",
      year: string | null = null,
    ): Promise<Row[]> => {
      const result: Row[] = [];
      for (let offset = 0; offset < 100000; offset += 500) {
        let q = db
          .from(table)
          .select(columns)
          .eq("owner_id", owner)
          .order(sort)
          .order("id")
          .range(offset, offset + 499);
        if (year)
          q = q
            .gte("occurred_on", year + "-01-01")
            .lte("occurred_on", year + "-12-31");
        const r = await q;
        checked(r);
        const rows = (r.data || []) as unknown as Row[];
        result.push(...rows);
        if (rows.length < 500) return result;
      }
      throw new AppError(
        "내역이 너무 많습니다. 관리자에게 대용량 조회를 요청해 주세요.",
        503,
      );
    };
    if (resource === "state" && method === "GET") {
      const [p, cs, es, ds, rs] = await Promise.all([
        db
          .from("sl_profiles")
          .select("name,account,plan")
          .eq("owner_id", owner)
          .single(),
        all("sl_clients", "*", "name"),
        all("sl_entries", "*", "occurred_on"),
        all(
          "sl_documents",
          "id,owner_id,client_id,kind,number,issued_on,due_on,status,notes,total",
          "issued_on",
        ),
        all("sl_receipts", "id,entry_id"),
      ]);
      checked(p);
      return json({
        user: { id: owner, email: user.email, ...p.data },
        today: today(),
        clients: cs,
        entries: es
          .reverse()
          .map((x) => ({
            ...x,
            client_name: cs.find((y) => y.id === x.client_id)?.name,
            receipt_id: rs.find((y) => y.entry_id === x.id)?.id,
          })),
        documents: ds
          .reverse()
          .map((x) => ({
            ...x,
            client_name: cs.find((y) => y.id === x.client_id)?.name,
          })),
      });
    }
    if (resource === "profile" && method === "PUT") {
      const b = await req.json();
      checked(
        await db
          .from("sl_profiles")
          .update({
            name: str(b.name, 80),
            account: str(b.account || "", 200, false),
          })
          .eq("owner_id", owner),
      );
      return json({ ok: true });
    }
    if (resource === "clients") {
      if (["POST", "PUT"].includes(method)) {
        const b = await req.json(),
          v = { name: str(b.name, 100), email: str(b.email || "", 254, false) };
        if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))
          throw new AppError("이메일 형식을 확인해 주세요.");
        if (method === "PUT") await own("sl_clients", key);
        const r =
          method === "POST"
            ? await db.from("sl_clients").insert(v).select("id").single()
            : await db
                .from("sl_clients")
                .update(v)
                .eq("id", key)
                .eq("owner_id", owner)
                .select("id")
                .single();
        checked(r);
        return json(r.data, method === "POST" ? 201 : 200);
      }
      if (method === "DELETE") {
        await own("sl_clients", key);
        checked(
          await db
            .from("sl_clients")
            .delete()
            .eq("id", key)
            .eq("owner_id", owner),
        );
        return json({ ok: true });
      }
    }
    if (resource === "entries") {
      if (["POST", "PUT"].includes(method)) {
        const b = await req.json(),
          kind = str(b.kind, 10);
        if (!["income", "expense"].includes(kind))
          throw new AppError("수입/경비를 선택해 주세요.");
        const v = {
          kind,
          amount: money(b.amount),
          occurred_on: date(b.occurred_on),
          category: str(b.category, 50),
          memo: str(b.memo || "", 500, false),
          client_id: await client(b.client_id, true),
        };
        if (method === "PUT" && (await own("sl_entries", key)).document_id)
          throw new AppError("청구서 자동 수입은 수정할 수 없습니다.");
        const r =
          method === "POST"
            ? await db.from("sl_entries").insert(v).select("id").single()
            : await db
                .from("sl_entries")
                .update(v)
                .eq("id", key)
                .eq("owner_id", owner)
                .select("id")
                .single();
        checked(r);
        return json(r.data, method === "POST" ? 201 : 200);
      }
      if (method === "DELETE") {
        await own("sl_entries", key);
        const r = await db
          .from("sl_receipts")
          .select("path")
          .eq("entry_id", key)
          .eq("owner_id", owner);
        checked(r);
        checked(
          await db
            .from("sl_entries")
            .delete()
            .eq("id", key)
            .eq("owner_id", owner),
        );
        if (r.data?.length)
          checked(
            await db.storage
              .from("sl-receipts")
              .remove(r.data.map((x) => x.path)),
          );
        return json({ ok: true });
      }
    }
    if (resource === "documents") {
      if (method === "POST") {
        const b = await req.json();
        if (
          !Array.isArray(b.items) ||
          b.items.length < 1 ||
          b.items.length > 30
        )
          throw new AppError("항목은 1~30개로 입력해 주세요.");
        const r = await db.rpc("sl_create_document", {
          p_client: await client(b.client_id),
          p_kind: str(b.kind, 10),
          p_issued: date(b.issued_on),
          p_due: date(b.due_on),
          p_notes: str(b.notes || "", 1000, false),
          p_items: b.items.map((i: Row) => ({
            description: str(i.description, 200),
            qty100: qty100(i.qty),
            unit_price: money(i.unit_price, true),
          })),
        });
        checked(r);
        return json({ id: r.data }, 201);
      }
      if (method === "GET") {
        const d = await own("sl_documents", key),
          c = await own("sl_clients", d.client_id),
          doc = { ...d, client_name: c.name, client_email: c.email };
        if (action === "pdf") {
          const p = await db
            .from("sl_profiles")
            .select("name,account")
            .eq("owner_id", owner)
            .single();
          checked(p);
          const { pdf } = await import("./pdf");
          const buffer = await pdf(doc, { ...p.data, email: user.email });
          return new Response(new Uint8Array(buffer), {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${d.number}.pdf"`,
              "Cache-Control": "private, no-store",
            },
          });
        }
        return json(doc);
      }
      if (method === "PATCH") {
        const b = await req.json();
        if (!["draft", "sent", "paid", "void"].includes(b.status))
          throw new AppError("상태를 확인해 주세요.");
        await own("sl_documents", key);
        checked(
          await db.rpc("sl_document_status", {
            p_id: key,
            p_status: b.status,
            p_paid: date(b.paid_on || today()),
          }),
        );
        return json({ ok: true });
      }
    }
    if (resource === "csv" && method === "POST") {
      const b = await req.json();
      if (!Array.isArray(b.rows) || b.rows.length < 1 || b.rows.length > 2000)
        throw new AppError("1~2,000행을 가져올 수 있습니다.");
      const rows = b.rows.map((r: Row) => ({
        kind: str(r.kind, 10),
        amount: money(r.amount),
        occurred_on: date(r.occurred_on),
        category: str(r.category || "기타", 50),
        memo: str(r.memo || "", 500, false),
      }));
      const r = await db.rpc("sl_import_csv", { p_rows: rows });
      checked(r);
      return json(r.data);
    }
    if (resource === "export" && method === "GET") {
      const year = url.searchParams.get("year");
      if (year && !/^\d{4}$/.test(year))
        throw new AppError("연도를 확인해 주세요.");
      const entries = await all("sl_entries", "*", "occurred_on", year),
        clients = await all("sl_clients", "id,name");
      const rows = [
        ["날짜", "구분", "금액", "분류", "적요", "거래처"],
        ...entries.map((x) => [
          x.occurred_on,
          x.kind === "income" ? "수입" : "경비",
          x.amount,
          x.category,
          x.memo,
          clients.find((y) => y.id === x.client_id)?.name || "",
        ]),
      ];
      return new Response(
        "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n"),
        {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="ledger-${year || "all"}.csv"`,
            "Cache-Control": "private, no-store",
          },
        },
      );
    }
    if (resource === "receipts") {
      if (method === "POST") {
        const f = await req.formData(),
          file = f.get("file"),
          entry = String(f.get("entry_id"));
        await own("sl_entries", entry);
        if (
          !(file instanceof File) ||
          file.size < 1 ||
          file.size > 5 * 1024 * 1024
        )
          throw new AppError("5MB 이하 사진을 선택해 주세요.");
        const b = Buffer.from(await file.arrayBuffer()),
          jpg = b[0] === 255 && b[1] === 216 && b[2] === 255,
          png = b
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        if (!jpg && !png) throw new AppError("JPG/PNG 사진만 가능합니다.");
        const mime = jpg ? "image/jpeg" : "image/png",
          path =
            owner +
            "/" +
            today().slice(0, 7) +
            "/" +
            randomUUID() +
            (jpg ? ".jpg" : ".png");
        checked(
          await db.storage
            .from("sl-receipts")
            .upload(path, b, { contentType: mime, upsert: false }),
        );
        const r = await db
          .from("sl_receipts")
          .insert({ entry_id: entry, path, mime })
          .select("id")
          .single();
        if (r.error) {
          await db.storage.from("sl-receipts").remove([path]);
          checked(r);
        }
        return json(r.data, 201);
      }
      const r = await own("sl_receipts", key);
      if (method === "GET") {
        const link = await db.storage
          .from("sl-receipts")
          .createSignedUrl(r.path, 60);
        checked(link);
        return json({ url: link.data!.signedUrl });
      }
      if (method === "DELETE") {
        checked(await db.storage.from("sl-receipts").remove([r.path]));
        checked(
          await db
            .from("sl_receipts")
            .delete()
            .eq("id", key)
            .eq("owner_id", owner),
        );
        return json({ ok: true });
      }
    }
    if (["payments", "mail"].includes(resource))
      throw new AppError("실제 결제/메일은 아직 연결되지 않았습니다.", 503);
    throw new AppError("요청을 찾을 수 없습니다.", 404);
  } catch (e) {
    if (e instanceof AppError) return json({ error: e.message }, e.status);
    if (e instanceof SyntaxError)
      return json({ error: "요청 형식을 확인해 주세요." }, 400);
    console.error("SideLedger cloud request failed");
    return json({ error: "처리 중 오류가 발생했습니다." }, 500);
  }
}
