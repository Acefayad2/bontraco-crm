const billingHosts = new Set(["billing.stripe.com", "checkout.stripe.com"]);

export function verifiedBillingRedirect(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !billingHosts.has(url.hostname.toLowerCase())) return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}
