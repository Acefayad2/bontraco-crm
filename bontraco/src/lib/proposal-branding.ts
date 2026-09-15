import { config } from "./config";

const logoPathPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/branding\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function proposalLogoUrl(path: unknown) {
  if (typeof path !== "string" || !logoPathPattern.test(path) || !config.supabaseUrl) return null;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${config.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/bontraco-branding/${encodedPath}`;
}
