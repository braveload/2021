const sha = process.env.VERCEL_GIT_COMMIT_SHA;
if (!process.env.VERCEL) {
  console.log("Non-Vercel build: CI wait not required.");
  process.exit(0);
}
if (!sha) throw new Error("Vercel commit SHA missing.");
const endpoint =
  "https://api.github.com/repos/braveload/2021/actions/workflows/sideledger-ci.yml/runs?head_sha=" +
  encodeURIComponent(sha);
for (let i = 0; i < 24; i++) {
  const r = await fetch(endpoint, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!r.ok) throw new Error("Cannot verify GitHub CI: " + r.status);
  const data = await r.json();
  const run = data.workflow_runs?.find((r) => r.head_sha === sha);
  if (run?.status === "completed") {
    if (run.conclusion !== "success")
      throw new Error("SideLedger CI failed: " + run.conclusion);
    console.log("GitHub CI passed for", sha);
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, 15000));
}
throw new Error(
  "CI verification timed out. DB migration and deployment were not started.",
);
