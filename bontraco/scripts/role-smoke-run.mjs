/* global process, console */
import { spawnSync } from "node:child_process";

const runId = String(process.argv[2] || "").toLowerCase();
if (!/^[a-z0-9]{6,24}$/.test(runId)) throw new Error("Provide a 6-24 character run id");

function execute(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed`);
}

let created = false;
try {
  execute("scripts/role-smoke-fixtures.mjs", ["create", runId]);
  created = true;
  execute("scripts/role-smoke-verify.mjs", [runId]);
  console.log(`Bontraco five-role smoke passed for ${runId}`);
} finally {
  if (created) execute("scripts/role-smoke-fixtures.mjs", ["cleanup", runId]);
}
