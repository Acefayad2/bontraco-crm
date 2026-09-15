import { z } from "zod";

const configSchema = z.object({
  supabaseUrl: z.string().url().optional(),
  supabasePublishableKey: z.string().min(20).optional(),
  demoMode: z.boolean(),
});

export function isAllowedDemoHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost") ||
    (normalized.endsWith(".netlify.app") && normalized.includes("--"))
  );
}

const runtimeHostname = typeof window === "undefined" ? "" : window.location.hostname;

const parsed = configSchema.safeParse({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || undefined,
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || undefined,
  demoMode: import.meta.env.VITE_DEMO_MODE === "true" && isAllowedDemoHostname(runtimeHostname),
});

if (!parsed.success) {
  throw new Error("Bontraco environment configuration is invalid.");
}

export const config = {
  ...parsed.data,
  supabaseConfigured: Boolean(parsed.data.supabaseUrl && parsed.data.supabasePublishableKey),
};
