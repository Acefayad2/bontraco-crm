const jsonHeaders = {
  "Content-Type": "application/json",
};

function requiredEnvironment(name) {
  const value = Netlify.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function databaseRequest(path, options = {}) {
  const baseUrl = requiredEnvironment("SUPABASE_URL");
  const serviceKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...options,
    signal: options.signal || AbortSignal.timeout(10_000),
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...jsonHeaders,
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Database request failed (${response.status}): ${await response.text()}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export function domainFor(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "web_search";
  }
}

const datedPostDomains = [
  "reddit.com",
  "facebook.com",
  "nextdoor.com",
  "x.com",
  "twitter.com",
  "craigslist.org",
  "patch.com",
];

function domainMatches(domain, allowedDomain) {
  return domain === allowedDomain || domain.endsWith(`.${allowedDomain}`);
}

export function assessResultFreshness(result, maxAgeDays, now = new Date()) {
  const publishedValue = result?.published_date;
  const domain = domainFor(typeof result?.url === "string" ? result.url : "");
  if (!publishedValue) {
    const requiresDate = datedPostDomains.some((candidate) => domainMatches(domain, candidate));
    return requiresDate
      ? { accepted: false, postedAt: null, basis: "missing_post_date" }
      : { accepted: true, postedAt: null, basis: "provider_date_filter" };
  }
  const postedAt = new Date(publishedValue);
  if (!Number.isFinite(postedAt.getTime()))
    return { accepted: false, postedAt: null, basis: "invalid_post_date" };
  const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(nowTime)) throw new Error("Freshness comparison time is invalid");
  if (postedAt.getTime() > nowTime + 86_400_000)
    return { accepted: false, postedAt, basis: "future_post_date" };
  const cutoff = nowTime - Math.max(1, Number(maxAgeDays) || 1) * 86_400_000;
  if (postedAt.getTime() < cutoff) return { accepted: false, postedAt, basis: "stale_post_date" };
  return { accepted: true, postedAt, basis: "published_date" };
}

export function normalizeAllowedDomains(values) {
  const domainPattern = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) =>
          String(value)
            .trim()
            .toLowerCase()
            .replace(/^www\./, ""),
        )
        .filter((value) => domainPattern.test(value)),
    ),
  ].slice(0, 20);
}

export function publicCollectorErrorMessage(error, provider) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const name = error instanceof Error ? error.name.toLowerCase() : "";
  if (message.includes("no valid permitted domains"))
    return "This search profile has no valid permitted domains.";
  if (
    message.includes("missing tavily_api_key") ||
    message.includes("missing google_places_api_key") ||
    message.includes("missing google_maps_api_key")
  )
    return "This lead provider is not configured.";
  if (name.includes("timeout") || name.includes("abort") || message.includes("timed out"))
    return "The lead provider timed out. Bontraco will retry on the next scheduled run.";
  const providerStatus = message.match(/request failed \((\d{3})\)/)?.[1];
  if (providerStatus === "429")
    return "The lead provider request limit was reached. Bontraco will retry later.";
  if (providerStatus === "401" || providerStatus === "403")
    return "The lead provider rejected its server credential. Review the integration in Settings.";
  if (message.includes("database request failed"))
    return "Bontraco could not save this scan. It will retry on the next scheduled run.";
  return `${provider === "google_places" ? "Google Places" : "The public-web provider"} failed. Bontraco will retry on the next scheduled run.`;
}

export function normalizePhone(value) {
  const digits = value.replace(/\D/g, "");
  const normalized = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return normalized.length === 10 ? normalized : null;
}

export function extractContact(text) {
  const phoneMatch = text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/);
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return {
    phone: phoneMatch ? normalizePhone(phoneMatch[0]) : null,
    email: emailMatch ? emailMatch[0].toLowerCase() : null,
  };
}

const intentTermsByTrade = {
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

export function defaultIntentTerms(trades) {
  const selectedTrades = Array.isArray(trades) && trades.length ? trades : ["general"];
  return [
    ...new Set(
      selectedTrades.flatMap((trade) => intentTermsByTrade[trade] || intentTermsByTrade.general),
    ),
  ].slice(0, 16);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function buildQuery(profile) {
  const searchTerms = profile.search_terms.length
    ? profile.search_terms
    : defaultIntentTerms(profile.trades);
  const terms = searchTerms.map((term) => `"${term}"`).join(" OR ");
  const area = [profile.geography?.city, profile.geography?.region, profile.geography?.country]
    .filter(Boolean)
    .join(" ");
  return `${terms} ${area}`.trim();
}

const defaultGooglePlaceTerms = [
  "property management company",
  "HOA management company",
  "commercial property management company",
];

export function buildGooglePlacesQueries(profile) {
  const area = [profile.geography?.city, profile.geography?.region].filter(Boolean).join(", ");
  const terms = profile.search_terms.length ? profile.search_terms : defaultGooglePlaceTerms;
  return [...new Set(terms.map((term) => `${term.trim()}${area ? ` in ${area}` : ""}`))]
    .filter(Boolean)
    .slice(0, 5);
}

export function mapGooglePlaceToLead(place, profile, collectedAt = new Date().toISOString()) {
  const placeId = typeof place.id === "string" ? place.id.trim() : "";
  const title = typeof place.displayName?.text === "string" ? place.displayName.text.trim() : "";
  if (!placeId || !title || place.businessStatus === "CLOSED_PERMANENTLY") return null;
  const phone = normalizePhone(place.nationalPhoneNumber || place.internationalPhoneNumber || "");
  const mapsUrl = typeof place.googleMapsUri === "string" ? place.googleMapsUri : null;
  const website = typeof place.websiteUri === "string" ? place.websiteUri : null;
  return {
    account_id: profile.account_id,
    source_profile_id: profile.id,
    title: title.slice(0, 240),
    status: "new",
    trade: profile.trades[0] || "general",
    source: "google_places",
    source_url: mapsUrl || website,
    source_external_id: placeId,
    source_posted_at: null,
    last_verified_at: collectedAt,
    contact_name: title.slice(0, 160),
    contact_phone: phone,
    contact_email: null,
    location_text:
      typeof place.formattedAddress === "string" ? place.formattedAddress.slice(0, 300) : null,
    score: phone ? (website ? 90 : 84) : website ? 70 : 58,
    qualification_reason: phone
      ? "Named local business prospect with a phone number verified through Google Places."
      : "Named local business prospect found through Google Places; contact enrichment is needed.",
    evidence: {
      provider: "google_places",
      google_place_id: placeId,
      google_maps_url: mapsUrl,
      website,
      business_status: place.businessStatus || null,
      primary_type: place.primaryType || null,
      collected_at: collectedAt,
      refresh_by: new Date(new Date(collectedAt).getTime() + 30 * 86_400_000).toISOString(),
      attribution: "Google Maps",
    },
    dedup_key: `google_places:${placeId}`,
  };
}

async function searchTavily(profile) {
  const apiKey = requiredEnvironment("TAVILY_API_KEY");
  const allowedDomains = normalizeAllowedDomains(profile.allowed_domains);
  if (allowedDomains.length === 0) throw new Error("Tavily profile has no valid permitted domains");
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: jsonHeaders,
    signal: AbortSignal.timeout(12_000),
    body: JSON.stringify({
      api_key: apiKey,
      query: buildQuery(profile),
      topic: "general",
      search_depth: "basic",
      max_results: profile.max_results_per_run,
      include_answer: false,
      include_raw_content: false,
      include_images: false,
      include_domains: allowedDomains,
      days: profile.max_age_days,
      country: "united states",
    }),
  });
  if (!response.ok) {
    throw new Error(`Tavily request failed (${response.status}): ${await response.text()}`);
  }
  const body = await response.json();
  return Array.isArray(body.results) ? body.results : [];
}

async function searchGooglePlaces(profile, requestBudget) {
  const apiKey =
    Netlify.env.get("GOOGLE_PLACES_API_KEY") || requiredEnvironment("GOOGLE_MAPS_API_KEY");
  const queries = buildGooglePlacesQueries(profile).slice(0, Math.max(0, requestBudget));
  const placesById = new Map();
  const resultsPerQuery = Math.max(
    1,
    Math.min(20, Math.ceil(profile.max_results_per_run / Math.max(1, queries.length))),
  );
  const payloads = await Promise.all(
    queries.map(async (textQuery) => {
      const body = {
        textQuery,
        pageSize: resultsPerQuery,
        languageCode: "en",
        regionCode: "US",
      };
      const latitude = Number(profile.geography?.latitude);
      const longitude = Number(profile.geography?.longitude);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        body.locationBias = {
          circle: {
            center: { latitude, longitude },
            radius: Math.min(
              50_000,
              Math.max(1_000, Number(profile.geography?.radius_meters) || 50_000),
            ),
          },
        };
      }
      const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: {
          ...jsonHeaders,
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": [
            "places.id",
            "places.displayName",
            "places.formattedAddress",
            "places.nationalPhoneNumber",
            "places.internationalPhoneNumber",
            "places.websiteUri",
            "places.googleMapsUri",
            "places.businessStatus",
            "places.primaryType",
          ].join(","),
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(
          `Google Places request failed (${response.status}): ${await response.text()}`,
        );
      }
      return response.json();
    }),
  );
  for (const payload of payloads) {
    for (const place of Array.isArray(payload.places) ? payload.places : []) {
      if (place?.id && !placesById.has(place.id)) placesById.set(place.id, place);
      if (placesById.size >= profile.max_results_per_run) break;
    }
    if (placesById.size >= profile.max_results_per_run) break;
  }
  return {
    queries,
    requestCount: queries.length,
    results: [...placesById.values()].slice(0, profile.max_results_per_run),
  };
}

async function updateRun(runId, patch) {
  await databaseRequest(`lead_scan_runs?id=eq.${encodeURIComponent(runId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
}

export function hasLeadEngineAccess(subscription, now = new Date()) {
  if (!subscription || !["growth", "pro"].includes(subscription.plan_slug)) return false;
  if (["trialing", "active"].includes(subscription.status)) return true;
  if (subscription.status !== "past_due") return false;
  const graceEndsAt = new Date(subscription.grace_ends_at || "");
  const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return Number.isFinite(nowTime) && graceEndsAt.getTime() > nowTime;
}

export function summarizeDailyScanUsage(runs) {
  return (Array.isArray(runs) ? runs : []).reduce(
    (usage, run) => ({
      results: usage.results + Math.max(0, Number(run?.found_count) || 0),
      requests: usage.requests + Math.max(0, Number(run?.request_count) || 0),
    }),
    { results: 0, requests: 0 },
  );
}

export function normalizeLeaseToken(value) {
  const token = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(token)
    ? token
    : null;
}

async function acquireProfileLease(profileId) {
  const token = await databaseRequest("rpc/acquire_lead_scan_lease", {
    method: "POST",
    body: JSON.stringify({ target_profile_id: profileId, lease_seconds: 120 }),
  });
  return normalizeLeaseToken(token);
}

async function releaseProfileLease(profileId, leaseToken) {
  return databaseRequest("rpc/release_lead_scan_lease", {
    method: "POST",
    body: JSON.stringify({ target_profile_id: profileId, lease_token: leaseToken }),
  });
}

async function readSubscription(accountId) {
  const rows = await databaseRequest(
    `account_subscriptions?account_id=eq.${encodeURIComponent(accountId)}&select=plan_slug,status,grace_ends_at&limit=1`,
  );
  return rows[0] || null;
}

export function selectScheduledProfiles(entries, maximumEligible = 4) {
  const selected = [];
  let eligible = 0;
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (entry.eligible && eligible >= maximumEligible) break;
    selected.push(entry);
    if (entry.eligible) eligible += 1;
  }
  return selected;
}

async function executeProfileRun(profile, options = {}) {
  const [run] = await databaseRequest("lead_scan_runs", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      account_id: profile.account_id,
      source_profile_id: profile.id,
      provider: profile.provider,
      status: "running",
      request_count: 0,
    }),
  });

  let entitlementVerified = false;
  try {
    const scannedAt = options.scannedAt || new Date();
    const subscription = Object.hasOwn(options, "subscription")
      ? options.subscription
      : await readSubscription(profile.account_id);
    if (!hasLeadEngineAccess(subscription, scannedAt)) {
      const nextScanAt = new Date(scannedAt.getTime() + 24 * 60 * 60_000).toISOString();
      await databaseRequest(`lead_source_profiles?id=eq.${encodeURIComponent(profile.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          last_scanned_at: scannedAt.toISOString(),
          next_scan_at: nextScanAt,
        }),
      });
      await updateRun(run.id, {
        status: "skipped",
        error_code: "lead_engine_entitlement_inactive",
        error_message: "An active Growth or Pro plan is required for automated lead scans.",
        completed_at: new Date().toISOString(),
      });
      return {
        status: "skipped",
        inserted: 0,
        duplicates: 0,
        rejected: 0,
        eligible: false,
        reason: "lead_engine_entitlement_inactive",
      };
    }
    entitlementVerified = true;

    const nextScanAt = new Date(
      scannedAt.getTime() + profile.cadence_minutes * 60_000,
    ).toISOString();
    await databaseRequest(`lead_source_profiles?id=eq.${encodeURIComponent(profile.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_scanned_at: scannedAt.toISOString(), next_scan_at: nextScanAt }),
    });

    if (!["tavily", "google_places"].includes(profile.provider)) {
      await updateRun(run.id, {
        status: "skipped",
        error_code: "provider_not_configured",
        error_message: `${profile.provider} adapter is not enabled yet.`,
        completed_at: new Date().toISOString(),
      });
      return {
        status: "skipped",
        inserted: 0,
        duplicates: 0,
        rejected: 0,
        eligible: true,
        reason: "provider_not_configured",
      };
    }

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const priorRuns = await databaseRequest(
      `lead_scan_runs?source_profile_id=eq.${encodeURIComponent(profile.id)}&started_at=gte.${encodeURIComponent(startOfDay.toISOString())}&select=found_count,request_count`,
    );
    const usageToday = summarizeDailyScanUsage(priorRuns);
    const resultsToday = usageToday.results;
    if (resultsToday >= profile.daily_result_limit) {
      await updateRun(run.id, {
        status: "skipped",
        request_count: 0,
        error_code: "daily_limit_reached",
        error_message: "The source profile reached its daily result limit.",
        completed_at: new Date().toISOString(),
        metrics: { results_today: resultsToday, daily_result_limit: profile.daily_result_limit },
      });
      return {
        status: "skipped",
        inserted: 0,
        duplicates: 0,
        rejected: 0,
        eligible: true,
        reason: "daily_limit_reached",
      };
    }

    const remainingRequests = Math.max(0, profile.daily_request_limit - usageToday.requests);
    if (remainingRequests === 0) {
      await updateRun(run.id, {
        status: "skipped",
        request_count: 0,
        error_code: "daily_request_limit_reached",
        error_message: "The source profile reached its daily provider-request limit.",
        completed_at: new Date().toISOString(),
        metrics: {
          requests_today: usageToday.requests,
          daily_request_limit: profile.daily_request_limit,
        },
      });
      return {
        status: "skipped",
        inserted: 0,
        duplicates: 0,
        rejected: 0,
        eligible: true,
        reason: "daily_request_limit_reached",
      };
    }

    const plannedRequestCount =
      profile.provider === "google_places"
        ? Math.min(buildGooglePlacesQueries(profile).length, remainingRequests)
        : 1;
    await updateRun(run.id, { request_count: plannedRequestCount });
    const searchResult =
      profile.provider === "google_places"
        ? await searchGooglePlaces(profile, plannedRequestCount)
        : { results: await searchTavily(profile), requestCount: 1, queries: [buildQuery(profile)] };
    const results = searchResult.results.slice(
      0,
      Math.max(0, profile.daily_result_limit - resultsToday),
    );
    let inserted = 0;
    let duplicates = 0;
    let rejected = 0;
    const rejectionReasons = {};
    const reject = (reason) => {
      rejected += 1;
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
    };

    for (const result of results) {
      if (profile.provider === "google_places") {
        const lead = mapGooglePlaceToLead(result, profile);
        if (!lead) {
          reject("invalid_or_closed_place");
          continue;
        }
        const existing = await databaseRequest(
          `leads?account_id=eq.${encodeURIComponent(profile.account_id)}&dedup_key=eq.${encodeURIComponent(lead.dedup_key)}&select=id&limit=1`,
        );
        if (existing.length > 0) {
          await databaseRequest(
            `leads?id=eq.${encodeURIComponent(existing[0].id)}&account_id=eq.${encodeURIComponent(profile.account_id)}`,
            {
              method: "PATCH",
              headers: { Prefer: "return=minimal" },
              body: JSON.stringify({
                source_url: lead.source_url,
                source_external_id: lead.source_external_id,
                last_verified_at: lead.last_verified_at,
                contact_name: lead.contact_name,
                contact_phone: lead.contact_phone,
                location_text: lead.location_text,
                score: lead.score,
                qualification_reason: lead.qualification_reason,
                evidence: lead.evidence,
              }),
            },
          );
          duplicates += 1;
          continue;
        }
        const insertedRows = await databaseRequest("leads?on_conflict=account_id,dedup_key", {
          method: "POST",
          headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
          body: JSON.stringify(lead),
        });
        if (insertedRows.length > 0) inserted += 1;
        else duplicates += 1;
        continue;
      }
      const url = typeof result.url === "string" ? result.url : "";
      const title = typeof result.title === "string" ? result.title.trim() : "";
      if (!url || !title) {
        reject("missing_url_or_title");
        continue;
      }
      const freshness = assessResultFreshness(result, profile.max_age_days);
      if (!freshness.accepted) {
        reject(freshness.basis);
        continue;
      }
      const postedAt = freshness.postedAt;
      const excerpt = typeof result.content === "string" ? result.content.slice(0, 1500) : "";
      const contact = extractContact(`${title} ${excerpt}`);
      const canonical = url
        .replace(/[?#].*$/, "")
        .replace(/\/$/, "")
        .toLowerCase();
      const dedupKey = `tavily:${await sha256(canonical)}`;
      const lead = {
        account_id: profile.account_id,
        source_profile_id: profile.id,
        title: title.slice(0, 240),
        status: "new",
        trade: profile.trades[0] || "general",
        source: domainFor(url),
        source_url: url,
        source_external_id: canonical,
        source_posted_at: postedAt?.toISOString() || null,
        last_verified_at: new Date().toISOString(),
        contact_phone: contact.phone,
        contact_email: contact.email,
        location_text:
          [profile.geography?.city, profile.geography?.region].filter(Boolean).join(", ") || null,
        score: Math.max(0, Math.min(100, Math.round((Number(result.score) || 0.5) * 100))),
        qualification_reason:
          "Matched an enabled Bontraco search profile. Confirm the service location and request before outreach.",
        evidence: {
          excerpt,
          provider: "tavily",
          provider_score: result.score ?? null,
          collected_at: new Date().toISOString(),
          freshness_basis: freshness.basis,
          target_geography: profile.geography || {},
        },
        dedup_key: dedupKey,
      };
      const insertedRows = await databaseRequest("leads?on_conflict=account_id,dedup_key", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify(lead),
      });
      if (insertedRows.length > 0) inserted += 1;
      else duplicates += 1;
    }

    await updateRun(run.id, {
      status: "succeeded",
      request_count: searchResult.requestCount,
      found_count: results.length,
      inserted_count: inserted,
      duplicate_count: duplicates,
      rejected_count: rejected,
      completed_at: new Date().toISOString(),
      metrics: {
        queries: searchResult.queries,
        max_age_days: profile.provider === "tavily" ? profile.max_age_days : null,
        rejection_reasons: rejectionReasons,
      },
    });
    return { status: "succeeded", inserted, duplicates, rejected, eligible: true };
  } catch (error) {
    await updateRun(run.id, {
      status: "failed",
      error_code: "collector_failed",
      error_message: publicCollectorErrorMessage(error, profile.provider),
      completed_at: new Date().toISOString(),
    });
    return {
      status: "failed",
      inserted: 0,
      duplicates: 0,
      rejected: 0,
      eligible: entitlementVerified,
      reason: "collector_failed",
    };
  }
}

export async function runProfile(profile, options = {}) {
  const leaseToken = await acquireProfileLease(profile.id);
  if (!leaseToken) {
    return {
      status: "skipped",
      inserted: 0,
      duplicates: 0,
      rejected: 0,
      eligible: true,
      reason: "scan_in_progress",
    };
  }

  try {
    return await executeProfileRun(profile, options);
  } finally {
    try {
      await releaseProfileLease(profile.id, leaseToken);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "bontraco_lead_scan_lease_release_failed",
          profile_id: profile.id,
          message: error instanceof Error ? error.message : "Unknown lease release error",
        }),
      );
    }
  }
}

export default async () => {
  try {
    const now = new Date().toISOString();
    const fields = [
      "id",
      "account_id",
      "provider",
      "trades",
      "search_terms",
      "geography",
      "allowed_domains",
      "cadence_minutes",
      "max_age_days",
      "max_results_per_run",
      "daily_result_limit",
      "daily_request_limit",
    ].join(",");
    const profiles = await databaseRequest(
      `lead_source_profiles?enabled=eq.true&next_scan_at=lte.${encodeURIComponent(now)}&select=${fields}&order=next_scan_at.asc&limit=20`,
    );
    const subscriptions = await Promise.all(
      profiles.map((profile) => readSubscription(profile.account_id)),
    );
    const selected = selectScheduledProfiles(
      profiles.map((profile, index) => ({
        profile,
        subscription: subscriptions[index],
        eligible: hasLeadEngineAccess(subscriptions[index]),
      })),
    );
    const results = await Promise.all(
      selected.map(({ profile, subscription }) => runProfile(profile, { subscription })),
    );
    const eligibleProfiles = results.filter((result) => result.eligible).length;
    console.log(
      JSON.stringify({
        event: "bontraco_lead_scan",
        profiles_considered: results.length,
        eligible_profiles: eligibleProfiles,
        results,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "bontraco_lead_scan_failed",
        message: error instanceof Error ? error.message : "Unknown scheduler error",
      }),
    );
  }
};

export const config = {
  schedule: "*/15 * * * *",
};
