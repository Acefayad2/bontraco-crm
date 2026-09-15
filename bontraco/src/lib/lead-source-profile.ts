export function normalizeLeadDomains(value: string) {
  const domainPattern = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
  const entries = value
    .split(",")
    .map((item) =>
      item
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/$/, ""),
    )
    .filter(Boolean);
  const invalid = entries.filter((entry) => !domainPattern.test(entry));
  return {
    domains: [...new Set(entries.filter((entry) => domainPattern.test(entry)))].slice(0, 20),
    invalid,
  };
}

const intentTermsByTrade: Record<string, string[]> = {
  roofing: ["need a roofer", "roof leak", "storm damage", "roof replacement"],
  plumbing: ["need a plumber", "burst pipe", "water heater repair", "sewer backup"],
  electrical: [
    "need an electrician",
    "electrical panel upgrade",
    "partial power outage",
    "EV charger installation",
  ],
  general: ["contractor needed", "property repair", "home repair estimate"],
};

export function defaultLeadTerms(trades: readonly string[]) {
  const selectedTrades = trades.length ? trades : ["general"];
  return [
    ...new Set(
      selectedTrades.flatMap((trade) => intentTermsByTrade[trade] || intentTermsByTrade.general),
    ),
  ].slice(0, 16);
}

export type LeadProviderStatus = {
  public_web_search: boolean;
  google_places: boolean;
};

export function isLeadProviderConfigured(
  provider: string,
  status: LeadProviderStatus | null | undefined,
) {
  if (!status) return false;
  if (provider === "tavily") return status.public_web_search;
  if (provider === "google_places") return status.google_places;
  return false;
}

export function formatLeadCadence(minutes: number) {
  if (minutes === 1440) return "daily";
  if (minutes === 60) return "hourly";
  if (minutes > 60 && minutes % 60 === 0) return `every ${minutes / 60} hours`;
  return `every ${minutes} min`;
}
