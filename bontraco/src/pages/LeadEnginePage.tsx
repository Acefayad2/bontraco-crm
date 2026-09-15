import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { ClockCountdown } from "@phosphor-icons/react/ClockCountdown";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
import { Plus } from "@phosphor-icons/react/Plus";
import { SpinnerGap } from "@phosphor-icons/react/SpinnerGap";
import { WarningCircle } from "@phosphor-icons/react/WarningCircle";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { withAuthRequestDeadline } from "../lib/auth-request-deadline";
import { leadEngineErrorMessage } from "../lib/lead-engine-error";
import { getSupabase } from "../lib/supabase";
import { useWorkspaceAutoRefresh } from "../lib/workspace-auto-refresh";
import {
  defaultLeadTerms,
  formatLeadCadence,
  isLeadProviderConfigured,
  normalizeLeadDomains,
  type LeadProviderStatus,
} from "../lib/lead-source-profile";
import { useWorkspace } from "../workspace/WorkspaceContext";

type SourceProfile = {
  id: string;
  name: string;
  provider: string;
  search_terms: string[];
  geography: { city?: string; region?: string };
  enabled: boolean;
  cadence_minutes: number;
  max_age_days: number;
  max_results_per_run: number;
  daily_request_limit: number;
  last_scanned_at: string | null;
  next_scan_at: string;
};

type ScanRun = {
  id: string;
  provider: string;
  status: string;
  found_count: number;
  inserted_count: number;
  duplicate_count: number;
  rejected_count: number;
  error_message: string | null;
  started_at: string;
};

export const leadScanRequestTimeoutMs = 45_000;

export function LeadEnginePage() {
  const { demoMode, user } = useAuth();
  const { workspace } = useWorkspace();
  const [profiles, setProfiles] = useState<SourceProfile[]>([]);
  const [runs, setRuns] = useState<ScanRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [scanningProfileId, setScanningProfileId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [providerStatus, setProviderStatus] = useState<LeadProviderStatus | null>();
  const [draft, setDraft] = useState({
    name: "Chicagoland high-intent search",
    provider: "tavily",
    terms: defaultLeadTerms(["roofing"]).join(", "),
    city: "Chicago",
    region: "IL",
    domains: "reddit.com, nextdoor.com, facebook.com",
    maxAgeDays: "7",
  });
  const canManage = workspace?.role === "owner" || workspace?.role === "admin";

  function openCreateProfile() {
    const trades = workspace?.trades || ["general"];
    const primaryTrade = trades[0] || "general";
    setDraft((current) => ({
      ...current,
      name: `Chicagoland ${primaryTrade} high-intent search`,
      provider: "tavily",
      terms: defaultLeadTerms(trades).join(", "),
    }));
    setError("");
    setShowCreate(true);
  }

  const loadData = useCallback(
    async (options: { preserveMessages?: boolean } = {}) => {
      if (!workspace) return false;
      if (demoMode && import.meta.env.VITE_DEMO_MODE === "true") {
        const { createDemoLeadEngineData } = await import("../demo/lead-engine");
        const data = createDemoLeadEngineData();
        setProfiles(data.profiles as SourceProfile[]);
        setRuns(data.runs as ScanRun[]);
        setProviderStatus({ public_web_search: true, google_places: true });
        setLoading(false);
        return true;
      }
      try {
        const [profileResult, runResult, integrations] = await withAuthRequestDeadline(
          (async () => {
            const supabase = await getSupabase();
            if (!supabase) throw new Error("Lead Engine client unavailable");
            const providerRequest = canManage
              ? (async () => {
                  const { data, error: sessionError } = await supabase.auth.getSession();
                  if (sessionError) throw sessionError;
                  const token = data.session?.access_token;
                  if (!token) return null;
                  const response = await fetch("/.netlify/functions/integration-status", {
                    headers: {
                      authorization: "Bearer " + token,
                      "x-bontraco-account-id": workspace.id,
                    },
                  });
                  const result = await response.json().catch(() => ({}));
                  if (!response.ok) return null;
                  return {
                    public_web_search: Boolean(result.providers?.public_web_search),
                    google_places: Boolean(result.providers?.google_places),
                  } satisfies LeadProviderStatus;
                })().catch(() => null)
              : Promise.resolve(null);
            return Promise.all([
              supabase
                .from("lead_source_profiles")
                .select(
                  "id, name, provider, search_terms, geography, enabled, cadence_minutes, max_age_days, max_results_per_run, daily_request_limit, last_scanned_at, next_scan_at",
                )
                .eq("account_id", workspace.id)
                .order("created_at"),
              supabase
                .from("lead_scan_runs")
                .select(
                  "id, provider, status, found_count, inserted_count, duplicate_count, rejected_count, error_message, started_at",
                )
                .eq("account_id", workspace.id)
                .order("started_at", { ascending: false })
                .limit(12),
              providerRequest,
            ]);
          })(),
        );
        if (profileResult.error || runResult.error) throw new Error("Lead Engine query failed");
        setProviderStatus(integrations);
        setProfiles((profileResult.data || []) as SourceProfile[]);
        setRuns((runResult.data || []) as ScanRun[]);
        if (!options.preserveMessages) setError("");
        return true;
      } catch {
        if (!options.preserveMessages) setError("Bontraco could not load scan health.");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [canManage, demoMode, workspace],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadData());
  }, [loadData]);
  useWorkspaceAutoRefresh(!demoMode, loadData, workspace?.id);

  async function createProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace || !user || demoMode || !canManage || busy) return;
    const terms = draft.terms
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const { domains, invalid } = normalizeLeadDomains(draft.domains);
    if (draft.provider === "tavily" && (domains.length === 0 || invalid.length > 0)) {
      setError(
        invalid.length > 0
          ? `Use domain names only, without paths or wildcards: ${invalid.slice(0, 3).join(", ")}`
          : "Add at least one permitted public domain.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error: insertError } = await withAuthRequestDeadline(
        (async () => {
          const supabase = await getSupabase();
          if (!supabase) throw new Error("Lead Engine client unavailable");
          return supabase.from("lead_source_profiles").insert({
            account_id: workspace.id,
            name: draft.name.trim(),
            provider: draft.provider,
            trades: workspace.trades,
            search_terms: terms,
            geography: { city: draft.city.trim(), region: draft.region.trim(), country: "US" },
            allowed_domains: domains,
            cadence_minutes: draft.provider === "google_places" ? 1440 : 15,
            max_age_days: Number(draft.maxAgeDays),
            max_results_per_run: 20,
            daily_result_limit: 200,
            daily_request_limit: draft.provider === "google_places" ? 20 : 96,
            enabled: false,
            created_by: user.id,
          });
        })(),
      );
      if (insertError) throw insertError;
      setShowCreate(false);
      if (!(await loadData({ preserveMessages: true })))
        setError(
          "The search profile was created, but Lead Engine could not refresh. Reload Bontraco.",
        );
    } catch (cause) {
      setError(leadEngineErrorMessage(cause, "create"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleProfile(profile: SourceProfile) {
    if (!workspace || demoMode || !canManage || busy) return;
    if (!profile.enabled && !isLeadProviderConfigured(profile.provider, providerStatus)) {
      setError("Connect this lead provider in Settings before enabling its schedule.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error: updateError } = await withAuthRequestDeadline(
        (async () => {
          const supabase = await getSupabase();
          if (!supabase) throw new Error("Lead Engine client unavailable");
          return supabase
            .from("lead_source_profiles")
            .update({ enabled: !profile.enabled, next_scan_at: new Date().toISOString() })
            .eq("account_id", workspace.id)
            .eq("id", profile.id);
        })(),
      );
      if (updateError) throw updateError;
      if (!(await loadData({ preserveMessages: true })))
        setError("The schedule was changed, but Lead Engine could not refresh. Reload Bontraco.");
    } catch (cause) {
      setError(leadEngineErrorMessage(cause, "toggle"));
    } finally {
      setBusy(false);
    }
  }

  async function runProfileNow(profile: SourceProfile) {
    if (!workspace || demoMode || !canManage || scanningProfileId) return;
    if (!isLeadProviderConfigured(profile.provider, providerStatus)) {
      setError("Connect this lead provider in Settings before running a scan.");
      return;
    }
    setScanningProfileId(profile.id);
    setError("");
    setMessage("");
    try {
      const { response, result } = await withAuthRequestDeadline(
        (async () => {
          const supabase = await getSupabase();
          if (!supabase) throw new Error("Lead Engine client unavailable");
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          const response = await fetch("/.netlify/functions/lead-scan-now", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${data.session?.access_token || ""}`,
              "x-bontraco-account-id": workspace.id,
            },
            body: JSON.stringify({ profile_id: profile.id }),
          });
          const result = await response.json().catch(() => ({}));
          return { response, result };
        })(),
        leadScanRequestTimeoutMs,
      );
      if (!response.ok) {
        setError(leadEngineErrorMessage(result.error, "scan"));
      } else if (result.result?.status === "succeeded") {
        setMessage(
          `Scan complete: ${result.result.inserted || 0} added, ${result.result.duplicates || 0} duplicate, and ${result.result.rejected || 0} rejected.`,
        );
      } else if (result.result?.status === "skipped") {
        setMessage("Scan skipped. Review the latest run for the reason and configuration needed.");
      } else {
        setError("The provider scan failed. Review the latest run for its recorded error.");
      }
    } catch (cause) {
      setError(leadEngineErrorMessage(cause, "scan"));
    } finally {
      await loadData({ preserveMessages: true });
      setScanningProfileId(null);
    }
  }

  return (
    <section className="lead-engine-page">
      <header className="section-heading">
        <div>
          <p>Automated prospecting</p>
          <h1>Lead Engine</h1>
          <span>Collect fresh, attributable opportunities on a controlled 15-minute schedule.</span>
        </div>
        {canManage && (
          <button
            className="button button-primary"
            onClick={() => (showCreate ? setShowCreate(false) : openCreateProfile())}
          >
            <Plus weight="bold" /> New search
          </button>
        )}
      </header>

      {error && <div className="inline-error">{error}</div>}
      {message && (
        <p className="commercial-message" role="status">
          {message}
        </p>
      )}

      {canManage &&
        providerStatus !== undefined &&
        (!providerStatus?.public_web_search || !providerStatus.google_places) && (
          <div className="provider-readiness" role="status">
            <WarningCircle size={20} weight="fill" />
            <div>
              <strong>Lead provider setup is incomplete</strong>
              <span>
                {!providerStatus
                  ? "Bontraco could not verify provider status. Check Settings and try again."
                  : [
                      !providerStatus.public_web_search ? "Public web search" : "",
                      !providerStatus.google_places ? "Google Places" : "",
                    ]
                      .filter(Boolean)
                      .join(" and ") + " must be connected in Settings before use."}
              </span>
            </div>
          </div>
        )}

      <div className="engine-health-grid">
        <article className="engine-health-card">
          <ClockCountdown size={22} />
          <span>Schedule</span>
          <strong>Public web: every 15 minutes</strong>
          <small>Business-directory searches default to daily to control provider cost.</small>
        </article>
        <article className="engine-health-card">
          <MagnifyingGlass size={22} />
          <span>Freshness guardrail</span>
          <strong>{profiles[0]?.max_age_days || 7} days maximum</strong>
          <small>Social posts without a valid recent date are rejected before Leads.</small>
        </article>
        <article className="engine-health-card">
          {runs[0]?.status === "succeeded" ? (
            <CheckCircle size={22} />
          ) : (
            <WarningCircle size={22} />
          )}
          <span>Latest scan</span>
          <strong>{runs[0]?.status || "Not run yet"}</strong>
          <small>
            {runs[0]
              ? new Date(runs[0].started_at).toLocaleString()
              : "Enable a configured source to begin."}
          </small>
        </article>
      </div>

      {showCreate && (
        <form className="engine-form" onSubmit={createProfile}>
          <div className="engine-form-heading">
            <div>
              <strong>Create a controlled web search</strong>
              <span>
                New searches start paused so you can review them before spending provider credits.
              </span>
            </div>
          </div>
          <label>
            Search name
            <input
              required
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <label>
            Lead source
            <select
              value={draft.provider}
              onChange={(event) => {
                const provider = event.target.value;
                setDraft({
                  ...draft,
                  provider,
                  name:
                    provider === "google_places"
                      ? "Chicagoland commercial prospects"
                      : "Chicagoland high-intent search",
                  terms:
                    provider === "google_places"
                      ? "property management company, HOA management company, commercial property management company"
                      : defaultLeadTerms(workspace?.trades || ["general"]).join(", "),
                });
              }}
            >
              <option value="tavily">Fresh public web posts</option>
              <option value="google_places">Google Places businesses</option>
            </select>
          </label>
          <label className="engine-field-wide">
            {draft.provider === "google_places"
              ? "Business categories, separated by commas"
              : "Intent phrases, separated by commas"}
            <textarea
              required
              rows={3}
              value={draft.terms}
              onChange={(event) => setDraft({ ...draft, terms: event.target.value })}
            />
          </label>
          <label>
            City / metro
            <input
              required
              value={draft.city}
              onChange={(event) => setDraft({ ...draft, city: event.target.value })}
            />
          </label>
          <label>
            State
            <input
              required
              maxLength={2}
              value={draft.region}
              onChange={(event) => setDraft({ ...draft, region: event.target.value.toUpperCase() })}
            />
          </label>
          {draft.provider === "tavily" ? (
            <>
              <label className="engine-field-wide">
                Permitted domains, separated by commas
                <input
                  required
                  value={draft.domains}
                  onChange={(event) => setDraft({ ...draft, domains: event.target.value })}
                />
                <small>
                  Publicly indexed pages only. Bontraco cannot read private groups, accounts, or
                  neighborhood feeds.
                </small>
              </label>
              <label>
                Maximum result age
                <select
                  value={draft.maxAgeDays}
                  onChange={(event) => setDraft({ ...draft, maxAgeDays: event.target.value })}
                >
                  <option value="1">1 day</option>
                  <option value="3">3 days</option>
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                </select>
              </label>
            </>
          ) : (
            <div className="engine-field-wide provider-note">
              Google Places returns named businesses, addresses, websites, Maps links, and published
              phone numbers.
              {providerStatus?.google_places
                ? " The server integration is connected; new profiles scan once daily by default."
                : " Searches remain paused until a restricted server API key is connected. New profiles scan once daily by default."}
            </div>
          )}
          <div className="engine-form-actions">
            <button
              type="button"
              className="button button-ghost"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
            <button className="button button-primary" disabled={busy}>
              {busy ? "Saving…" : "Save paused search"}
            </button>
          </div>
        </form>
      )}

      <div className="engine-layout">
        <div className="panel engine-sources">
          <div className="panel-header">
            <div>
              <p>Sources</p>
              <h2>Search profiles</h2>
            </div>
          </div>
          {loading ? (
            <div className="empty-state">Loading source profiles…</div>
          ) : profiles.length === 0 ? (
            <div className="empty-state">
              <MagnifyingGlass size={28} />
              <strong>No searches configured</strong>
              <span>Create a paused search, review its sources, then enable it.</span>
            </div>
          ) : (
            profiles.map((profile) => (
              <article className="source-profile" key={profile.id}>
                <div className="source-profile-main">
                  <span className={`status-dot ${profile.enabled ? "online" : ""}`} />
                  <div>
                    <strong>{profile.name}</strong>
                    <span className="source-provider-label">
                      {profile.provider === "google_places" ? "Google Places" : "Public web"}
                    </span>
                    {!isLeadProviderConfigured(profile.provider, providerStatus) && canManage && (
                      <span className="source-provider-missing">Setup required</span>
                    )}
                    <span>{profile.search_terms.slice(0, 3).join(" · ")}</span>
                    <small>
                      {profile.geography.city}, {profile.geography.region} ·{" "}
                      {profile.provider === "google_places"
                        ? "verified business data"
                        : `${profile.max_age_days} day freshness`}{" "}
                      · max {profile.max_results_per_run}
                      /run · {formatLeadCadence(profile.cadence_minutes)} · max{" "}
                      {profile.daily_request_limit} requests/day
                    </small>
                  </div>
                </div>
                <div className="source-profile-actions">
                  {canManage && (
                    <button
                      className="button button-secondary profile-run"
                      disabled={
                        busy ||
                        demoMode ||
                        scanningProfileId !== null ||
                        !isLeadProviderConfigured(profile.provider, providerStatus)
                      }
                      onClick={() => void runProfileNow(profile)}
                    >
                      {scanningProfileId === profile.id ? (
                        <>
                          <SpinnerGap className="spin" weight="bold" /> Scanning…
                        </>
                      ) : (
                        "Run now"
                      )}
                    </button>
                  )}
                  <button
                    className={`profile-toggle ${profile.enabled ? "enabled" : ""}`}
                    disabled={
                      busy ||
                      demoMode ||
                      !canManage ||
                      scanningProfileId !== null ||
                      (!profile.enabled &&
                        !isLeadProviderConfigured(profile.provider, providerStatus))
                    }
                    onClick={() => void toggleProfile(profile)}
                  >
                    {profile.enabled ? "Enabled" : "Paused"}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="panel engine-runs">
          <div className="panel-header">
            <div>
              <p>Observability</p>
              <h2>Recent runs</h2>
            </div>
          </div>
          {runs.length === 0 ? (
            <div className="empty-state">
              <ClockCountdown size={28} />
              <strong>No scan history</strong>
              <span>Run status and counts will appear here.</span>
            </div>
          ) : (
            runs.map((run) => (
              <article className="scan-run" key={run.id}>
                <div>
                  <strong className={`run-status ${run.status}`}>{run.status}</strong>
                  <span>{new Date(run.started_at).toLocaleString()}</span>
                </div>
                <div className="run-counts">
                  <span>
                    <b>{run.inserted_count}</b> added
                  </span>
                  <span>
                    <b>{run.duplicate_count}</b> duplicate
                  </span>
                  <span>
                    <b>{run.rejected_count}</b> rejected
                  </span>
                </div>
                {run.error_message && (
                  <small>{leadEngineErrorMessage(run.error_message, "history")}</small>
                )}
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
