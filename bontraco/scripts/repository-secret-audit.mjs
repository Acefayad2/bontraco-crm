/* global console, process */
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { hasRecognizableSecret } from "./build-artifact-audit.mjs";

const executeFile = promisify(execFile);

export function auditRepositoryEntries(entries) {
  return entries
    .filter((entry) => hasRecognizableSecret(entry.content))
    .map((entry) => `${entry.path}: recognizable secret value is not allowed`);
}

async function run() {
  let entries;
  try {
    const { stdout: repositoryRoot } = await executeFile("git", ["rev-parse", "--show-toplevel"]);
    const root = repositoryRoot.trim();
    const { stdout } = await executeFile("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
      cwd: root,
      encoding: "buffer",
      maxBuffer: 20 * 1024 * 1024,
    });
    const paths = stdout.toString("utf8").split("\0").filter(Boolean);
    entries = await Promise.all(
      paths.map(async (path) => ({
        path,
        content: (await readFile(join(root, path))).toString("utf8"),
      })),
    );
  } catch {
    console.error("Bontraco repository secret audit failed: source files are unreadable");
    process.exitCode = 1;
    return;
  }

  const errors = auditRepositoryEntries(entries);
  if (errors.length) {
    console.error("Bontraco repository secret audit failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log(`Bontraco repository secret audit passed for ${entries.length} source files`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await run();
