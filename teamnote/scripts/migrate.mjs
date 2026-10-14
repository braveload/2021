import pg from "pg";
import fs from "node:fs";
import path from "node:path";

const url = process.env.OWNER_DATABASE_URL;
if (!url) throw new Error("OWNER_DATABASE_URL missing");
const dir = path.join(process.cwd(), "db", "migrations");

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(
  "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())"
);
const done = new Set((await client.query("select name from schema_migrations")).rows.map((r) => r.name));
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  if (done.has(f)) continue;
  await client.query("begin");
  try {
    await client.query(fs.readFileSync(path.join(dir, f), "utf8"));
    await client.query("insert into schema_migrations (name) values ($1)", [f]);
    await client.query("commit");
    console.log("applied", f);
  } catch (e) {
    await client.query("rollback");
    throw e;
  }
}
// 앱 계정 비밀번호는 환경변수에서만 주입 (코드/저장소에 없음)
const lit = (await client.query("select quote_literal($1) as l", [process.env.APP_DB_PASSWORD])).rows[0].l;
await client.query(`alter role teamnote_app with login password ${lit}`);
await client.end();
console.log("migrations ok");
