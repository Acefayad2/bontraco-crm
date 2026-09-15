/* global process, console */
import { Buffer } from "node:buffer";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const secretPatterns = [
  /\bgsk_[A-Za-z0-9]{20,}\b/,
  /\btvly-[A-Za-z0-9_-]{20,}\b/,
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/,
  /\bwhsec_[A-Za-z0-9]{16,}\b/,
  /\bsb_secret_[A-Za-z0-9._-]{16,}\b/,
  /\bAIza[A-Za-z0-9_-]{20,}\b/,
];
const demoFixturePatterns = [
  /\bdemo-[a-z0-9-]+\b/i,
  /\b(?:field|newrep|owner|sales)@example\.com\b/i,
  /\bBlue Ridge Exteriors\b/i,
  /\bSample workspace\b/i,
];
const maxBrowserScriptBytes = 350 * 1024;
const maxTotalBrowserScriptBytes = 1100 * 1024;

export function hasRecognizableSecret(content) {
  return secretPatterns.some((pattern) => pattern.test(content));
}

export function auditBuildArtifacts(entries, { production = false } = {}) {
  const errors = [];
  let totalBrowserScriptBytes = 0;
  for (const entry of entries) {
    if (entry.path.endsWith(".map")) errors.push(`${entry.path}: source map is not allowed`);
    if (!entry.content) continue;
    if (/sourceMappingURL\s*=/.test(entry.content))
      errors.push(`${entry.path}: embedded source map reference is not allowed`);
    if (hasRecognizableSecret(entry.content))
      errors.push(`${entry.path}: recognizable secret value is not allowed`);
    if (
      production &&
      entry.path.startsWith("dist/") &&
      entry.path.endsWith(".js") &&
      demoFixturePatterns.some((pattern) => pattern.test(entry.content))
    )
      errors.push(`${entry.path}: demo fixture content is not allowed in production`);
    if (entry.path.startsWith("dist/") && entry.path.endsWith(".js")) {
      const size = entry.size ?? Buffer.byteLength(entry.content);
      totalBrowserScriptBytes += size;
      if (size > maxBrowserScriptBytes)
        errors.push(`${entry.path}: browser script exceeds 350 KiB`);
    }
  }
  if (totalBrowserScriptBytes > maxTotalBrowserScriptBytes)
    errors.push("dist: browser scripts exceed 1100 KiB");
  return errors;
}

async function collectFiles(directory, root = directory) {
  const entries = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) entries.push(...(await collectFiles(path, root)));
    else {
      const content = await readFile(path);
      entries.push({
        path: relative(root, path),
        content: content.toString("utf8"),
        size: content.byteLength,
      });
    }
  }
  return entries;
}

async function run() {
  let entries;
  try {
    const browserEntries = await collectFiles(join(process.cwd(), "dist"));
    const functionEntries = await collectFiles(join(process.cwd(), "netlify", "functions"));
    entries = [
      ...browserEntries.map((entry) => ({ ...entry, path: `dist/${entry.path}` })),
      ...functionEntries.map((entry) => ({ ...entry, path: `netlify/functions/${entry.path}` })),
    ];
  } catch {
    console.error("Bontraco artifact audit failed: deployment files are missing or unreadable");
    process.exitCode = 1;
    return;
  }

  const errors = auditBuildArtifacts(entries, { production: process.env.CONTEXT === "production" });
  if (errors.length > 0) {
    console.error("Bontraco artifact audit failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log(`Bontraco deployment artifact audit passed for ${entries.length} files`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await run();
