import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
const url = process.env.TEST_DATABASE_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
  throw new Error(
    "TEST_DATABASE_URL must point to a disposable local PostgreSQL instance.",
  );
const db = new pg.Client({ connectionString: url });
await db.connect();
try {
  await db.query(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';grant usage on schema auth to authenticated,anon;`,
  );
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.query(await readFile("supabase/migrations/" + f, "utf8"));
  const r = await db.query(await readFile("supabase/tests/ledger.sql", "utf8"));
  for (const result of r)
    for (const row of result.rows || [])
      if (row.result) console.log(row.result);
  console.log(
    "Disposable PostgreSQL migration and RLS regression tests passed.",
  );
} finally {
  await db.end();
}
