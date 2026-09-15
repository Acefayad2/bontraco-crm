/* global console, process */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const migrationFilename = /^(\d{14})_([a-z0-9_]+)\.sql$/;
const conflictMarker = /^(?:<{7}|={7}|>{7})(?:\s|$)/m;
const deprecatedAuthRole = /\bauth\.role\s*\(/i;

export function auditMigrations(entries, minimumMigrations = 82) {
  const errors = [];
  if (entries.length < minimumMigrations)
    errors.push(`expected at least ${minimumMigrations} migrations, found ${entries.length}`);

  const versions = new Set();
  const names = new Set();
  for (const entry of entries) {
    const match = migrationFilename.exec(entry.name);
    if (!match) {
      errors.push(`${entry.name}: filename must use a 14-digit version and normalized name`);
      continue;
    }
    const [, version, name] = match;
    if (versions.has(version)) errors.push(`${entry.name}: duplicate migration version`);
    if (names.has(name)) errors.push(`${entry.name}: duplicate migration name`);
    versions.add(version);
    names.add(name);

    if (!entry.content.trim()) errors.push(`${entry.name}: migration is empty`);
    if (conflictMarker.test(entry.content))
      errors.push(`${entry.name}: unresolved conflict marker`);
    if (deprecatedAuthRole.test(entry.content))
      errors.push(`${entry.name}: deprecated auth.role() authorization is forbidden`);
  }
  return errors;
}

async function run() {
  const directory = join(process.cwd(), "supabase", "migrations");
  let entries;
  try {
    const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
    entries = await Promise.all(
      names.map(async (name) => ({ name, content: await readFile(join(directory, name), "utf8") })),
    );
  } catch {
    console.error("Bontraco migration audit failed: migration files are missing or unreadable");
    process.exitCode = 1;
    return;
  }

  const errors = auditMigrations(entries);
  if (errors.length) {
    console.error("Bontraco migration audit failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log(`Bontraco migration audit passed for ${entries.length} ordered files`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await run();
