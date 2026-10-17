import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const url = process.env.SIDELEDGER_MIGRATION_DATABASE_URL;
if (!url)
  throw new Error(
    "SIDELEDGER_MIGRATION_DATABASE_URL is required. Deployment stops before the app build.",
  );
const db = new pg.Client({
  connectionString: url,
  ssl: {
    rejectUnauthorized: true,
    ca: await readFile(
      new URL("../assets/supabase-ca.crt", import.meta.url),
      "utf8",
    ),
  },
});
await db.connect();
try {
  await db.query("begin");
  await db.query(
    "select pg_advisory_xact_lock(hashtextextended('sideledger-schema-migrations',0))",
  );
  await db.query(
    "create table if not exists public.sl_migration_log(name text primary key,sha256 text not null,applied_at timestamptz not null default now())",
  );
  await db.query(
    "alter table public.sl_migration_log enable row level security;revoke all on public.sl_migration_log from anon,authenticated",
  );
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = await readFile("supabase/migrations/" + f, "utf8"),
      sha = createHash("sha256").update(sql).digest("hex"),
      old = await db.query(
        "select sha256 from public.sl_migration_log where name=$1",
        [f],
      );
    if (old.rowCount) {
      if (old.rows[0].sha256 !== sha)
        throw new Error("Applied migration changed: " + f);
      continue;
    }
    if (
      /\b(drop\s|truncate\s|alter\s+role|auth\.users\s+(set|values)|storage\.)/i.test(
        sql,
      )
    )
      throw new Error(
        "Non-additive or shared-resource migration requires manual review: " +
          f,
      );
    await db.query(sql);
    await db.query(
      "insert into public.sl_migration_log(name,sha256) values($1,$2)",
      [f, sha],
    );
    console.log("Applied SideLedger migration:", f);
  }
  const r = await db.query(
    "select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'sl_%' and c.relkind='r' and not c.relrowsecurity",
  );
  if (r.rows[0].n !== 0)
    throw new Error("RLS is missing on SideLedger tables.");
  await db.query("commit");
  console.log("SideLedger DB schema ready.");
} catch (e) {
  await db.query("rollback").catch(() => {});
  throw e;
} finally {
  await db.end();
}
