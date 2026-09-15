export function createDemoLeadEngineData() {
  const scannedAt = new Date(Date.now() - 8 * 60_000).toISOString();
  return {
    profiles: [
      {
        id: "demo-source",
        name: "Chicagoland high-intent search",
        provider: "tavily",
        search_terms: ["need a roofer", "roof leak", "commercial roof inspection"],
        geography: { city: "Chicago", region: "IL" },
        enabled: true,
        cadence_minutes: 15,
        max_age_days: 7,
        max_results_per_run: 20,
        daily_request_limit: 96,
        last_scanned_at: scannedAt,
        next_scan_at: new Date(Date.now() + 7 * 60_000).toISOString(),
      },
    ],
    runs: [
      {
        id: "demo-run",
        provider: "tavily",
        status: "succeeded",
        found_count: 18,
        inserted_count: 6,
        duplicate_count: 9,
        rejected_count: 3,
        error_message: null,
        started_at: scannedAt,
      },
    ],
  };
}
