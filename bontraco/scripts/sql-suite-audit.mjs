/* global console, process */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const sqlFilename = /^[a-z0-9_]+\.sql$/;
const transactionStart = /^\s*begin;\s*$/im;
const transactionRollback = /^\s*rollback;\s*$/im;
const transactionCommit = /^\s*commit;\s*$/im;
const assertion = /raise\s+exception/i;

export function auditSqlSuites(entries, minimumSuites = 33) {
  const errors = [];
  if (entries.length < minimumSuites)
    errors.push(`expected at least ${minimumSuites} SQL suites, found ${entries.length}`);

  const names = new Set();
  for (const entry of entries) {
    if (!sqlFilename.test(entry.name)) errors.push(`${entry.name}: filename is not normalized`);
    if (names.has(entry.name)) errors.push(`${entry.name}: duplicate suite name`);
    names.add(entry.name);

    const beginMatch = transactionStart.exec(entry.content);
    const rollbackMatch = transactionRollback.exec(entry.content);
    if (!beginMatch) errors.push(`${entry.name}: missing transaction start`);
    if (!rollbackMatch) errors.push(`${entry.name}: missing transaction rollback`);
    if (beginMatch && rollbackMatch && rollbackMatch.index <= beginMatch.index)
      errors.push(`${entry.name}: rollback must follow transaction start`);
    if (transactionCommit.test(entry.content))
      errors.push(`${entry.name}: committed fixtures are forbidden`);
    if (!assertion.test(entry.content)) errors.push(`${entry.name}: missing failure assertion`);
  }
  return errors;
}

async function run() {
  const directory = join(process.cwd(), "supabase", "tests");
  let entries;
  try {
    const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
    entries = await Promise.all(
      names.map(async (name) => ({ name, content: await readFile(join(directory, name), "utf8") })),
    );
  } catch {
    console.error("Bontraco SQL suite audit failed: test files are missing or unreadable");
    process.exitCode = 1;
    return;
  }

  const errors = auditSqlSuites(entries);
  if (errors.length) {
    console.error("Bontraco SQL suite audit failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log(`Bontraco SQL suite audit passed for ${entries.length} rollback-safe files`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await run();
