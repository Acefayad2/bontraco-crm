export function parseJsonObject(rawBody) {
  try {
    const payload = JSON.parse(rawBody);
    return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
  } catch {
    return null;
  }
}
