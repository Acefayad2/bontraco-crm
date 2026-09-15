const sha256Pattern = /^[a-f0-9]{64}$/;

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyAccountExportIntegrity(
  bytes: ArrayBuffer,
  expectedSha256: string | null,
  subtle: SubtleCrypto = globalThis.crypto.subtle,
) {
  const expected = expectedSha256?.trim().toLowerCase() || "";
  if (!sha256Pattern.test(expected)) throw new Error("Workspace export integrity check failed");

  const actual = hex(await subtle.digest("SHA-256", bytes));
  if (actual !== expected) throw new Error("Workspace export integrity check failed");
  return actual;
}
