import { PhoneCall } from "@phosphor-icons/react/PhoneCall";
import { ShieldCheck } from "@phosphor-icons/react/ShieldCheck";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  callErrorMessage,
  testCallResponseMessage,
  testCallSuccessMessage,
} from "../lib/call-error";
import { withAuthRequestDeadline } from "../lib/auth-request-deadline";
import { getSupabase } from "../lib/supabase";
import { useWorkspaceAutoRefresh } from "../lib/workspace-auto-refresh";
import { useWorkspace } from "../workspace/WorkspaceContext";

type Call = {
  id: string;
  assigned_to: string | null;
  caller_name: string | null;
  from_number: string | null;
  status: string;
  disposition: string | null;
  summary: string | null;
  duration_seconds: number | null;
  started_at: string;
  emergency_flag: boolean;
};
type AssignableMember = {
  user_id: string;
  display_name: string | null;
  email: string;
  role: string;
};
export const testCallRequestTimeoutMs = 45_000;

export function CallsPage() {
  const { demoMode, user } = useAuth();
  const { workspace } = useWorkspace();
  const [calls, setCalls] = useState<Call[]>([]);
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [settings, setSettings] = useState({
    enabled: false,
    provider: "unconfigured",
    phone_number: "",
    transfer_number: "",
    greeting: "Thank you for calling. How can we help today?",
    recording_enabled: false,
  });
  const [testNumber, setTestNumber] = useState("");
  const [usage, setUsage] = useState({ minutes: 0, providerCostCents: 0 });
  const canConfigure = ["owner", "admin"].includes(workspace?.role || "");
  const canAssign = ["owner", "admin", "dispatcher"].includes(workspace?.role || "");

  const load = useCallback(
    async (options: { showLoading?: boolean } = {}) => {
      if (!workspace) {
        setLoading(false);
        return false;
      }
      if (options.showLoading) setLoading(true);
      try {
        if (demoMode && import.meta.env.VITE_DEMO_MODE === "true") {
          const { createDemoCallsData } = await import("../demo/calls");
          const data = createDemoCallsData();
          setCalls(data.calls);
          setMembers(data.members);
          setSettings(data.settings);
          setUsage(data.usage);
          return true;
        }
        const supabase = await withAuthRequestDeadline(getSupabase());
        if (!supabase) throw new Error("client_unavailable");
        const monthStart = new Date();
        monthStart.setUTCDate(1);
        monthStart.setUTCHours(0, 0, 0, 0);
        const [callResult, memberResult, settingsResult, usageResult] =
          await withAuthRequestDeadline(
            Promise.all([
              supabase
                .from("calls")
                .select(
                  "id, assigned_to, caller_name, from_number, status, disposition, summary, duration_seconds, started_at, emergency_flag",
                )
                .eq("account_id", workspace.id)
                .order("started_at", { ascending: false })
                .limit(100),
              supabase
                .from("memberships")
                .select("user_id,display_name,email,role")
                .eq("account_id", workspace.id)
                .eq("active", true)
                .in("role", ["owner", "admin", "dispatcher", "sales"])
                .order("display_name"),
              canConfigure
                ? supabase
                    .from("receptionist_settings")
                    .select(
                      "enabled, provider, phone_number, transfer_number, greeting, recording_enabled",
                    )
                    .eq("account_id", workspace.id)
                    .maybeSingle()
                : Promise.resolve({ data: null, error: null }),
              canConfigure
                ? supabase
                    .from("call_usage")
                    .select("billable_minutes, provider_cost_cents")
                    .eq("account_id", workspace.id)
                    .gte("recorded_at", monthStart.toISOString())
                : Promise.resolve({ data: [], error: null }),
            ]),
          );
        if (callResult.error || memberResult.error || settingsResult.error || usageResult.error)
          throw new Error("call_load_failed");
        setCalls((callResult.data || []) as Call[]);
        setMembers((memberResult.data || []) as AssignableMember[]);
        if (settingsResult.data)
          setSettings({
            enabled: settingsResult.data.enabled,
            provider: settingsResult.data.provider,
            phone_number: settingsResult.data.phone_number || "",
            transfer_number: settingsResult.data.transfer_number || "",
            greeting: settingsResult.data.greeting,
            recording_enabled: settingsResult.data.recording_enabled,
          });
        setUsage({
          minutes:
            usageResult.data?.reduce((sum, item) => sum + Number(item.billable_minutes || 0), 0) ||
            0,
          providerCostCents:
            usageResult.data?.reduce(
              (sum, item) => sum + Number(item.provider_cost_cents || 0),
              0,
            ) || 0,
        });
        return true;
      } catch {
        setMessage("Bontraco could not load call history.");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [canConfigure, demoMode, workspace],
  );
  useEffect(() => {
    void Promise.resolve().then(() => load({ showLoading: true }));
  }, [load]);
  const refreshCalls = useCallback(() => load(), [load]);
  useWorkspaceAutoRefresh(!demoMode, refreshCalls, workspace?.id);

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!workspace || !user || demoMode || !canConfigure || busy) return;
    setBusy(true);
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase.from("receptionist_settings").upsert(
            {
              account_id: workspace.id,
              ...settings,
              enabled: settings.provider === "unconfigured" ? false : settings.enabled,
              transfer_number: settings.transfer_number.trim() || null,
              created_by: user.id,
            },
            { onConflict: "account_id" },
          ),
        ),
      );
      if (error) throw error;
      setMessage("Receptionist settings saved.");
    } catch (error) {
      setMessage(callErrorMessage("settings", error));
    } finally {
      setBusy(false);
    }
  }

  async function placeTestCall() {
    if (demoMode || !canConfigure || !workspace || busy) return;
    setBusy(true);
    try {
      const { response, result } = await withAuthRequestDeadline(
        (async () => {
          const supabase = await getSupabase();
          if (!supabase) throw new Error("client_unavailable");
          const { data, error } = await supabase.auth.getSession();
          if (error || !data.session) throw error || new Error("session_unavailable");
          const response = await fetch("/.netlify/functions/receptionist-test-call", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${data.session.access_token}`,
              "x-bontraco-account-id": workspace.id,
            },
            body: JSON.stringify({ to_number: testNumber }),
          });
          return { response, result: await response.json().catch(() => ({})) };
        })(),
        testCallRequestTimeoutMs,
      );
      setMessage(
        response.ok
          ? testCallSuccessMessage(result.tracked)
          : testCallResponseMessage(result.error),
      );
    } catch (error) {
      setMessage(callErrorMessage("test", error));
    } finally {
      setBusy(false);
    }
  }

  async function assignCall(call: Call, assignedTo: string) {
    if (!workspace || demoMode || !canAssign || busy) return;
    setBusy(true);
    const nextAssignee = assignedTo || null;
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase
            .from("calls")
            .update({ assigned_to: nextAssignee })
            .eq("account_id", workspace.id)
            .eq("id", call.id),
        ),
      );
      if (error) throw error;
      setCalls((current) =>
        current.map((candidate) =>
          candidate.id === call.id ? { ...candidate, assigned_to: nextAssignee } : candidate,
        ),
      );
      setMessage("Call assignment saved.");
    } catch (error) {
      setMessage(callErrorMessage("assign", error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="calls-page">
      <header className="section-heading">
        <div>
          <p>AI front desk</p>
          <h1>Calls</h1>
          <span>Review every conversation, outcome, and urgent handoff.</span>
        </div>
        <span className={settings.enabled ? "live-status" : "setup-status"}>
          {settings.enabled ? "Online" : "Setup needed"}
        </span>
      </header>
      {message && (
        <p className="commercial-message" role="status">
          {message}
        </p>
      )}
      {canConfigure && (
        <div className="call-usage-strip">
          <span>
            <strong>{usage.minutes}</strong>
            <small>minutes this month</small>
          </span>
          <span>
            <strong>
              {(usage.providerCostCents / 100).toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
            </strong>
            <small>reconciled provider cost</small>
          </span>
          <span>
            <strong>{calls.filter((call) => call.emergency_flag).length}</strong>
            <small>urgent calls in view</small>
          </span>
        </div>
      )}
      <div className="calls-layout">
        <article className="panel call-history-panel">
          <div className="panel-header">
            <div>
              <h2>Recent calls</h2>
              <p>Private to authorized office staff</p>
            </div>
            <span>{calls.length}</span>
          </div>
          <div className="call-record-list">
            {loading ? (
              <div className="empty-state">
                <strong>Loading call history…</strong>
              </div>
            ) : calls.length === 0 ? (
              <div className="empty-state">
                <PhoneCall size={30} />
                <strong>No calls yet</strong>
                <span>Connected receptionist calls will appear here.</span>
              </div>
            ) : (
              calls.map((call) => (
                <article key={call.id}>
                  <span
                    className={call.emergency_flag ? "call-record-icon urgent" : "call-record-icon"}
                  >
                    <PhoneCall />
                  </span>
                  <div className="call-record-copy">
                    <strong>{call.caller_name || call.from_number || "Unknown caller"}</strong>
                    <span>
                      {new Date(call.started_at).toLocaleString()} ·{" "}
                      {call.duration_seconds
                        ? `${Math.ceil(call.duration_seconds / 60)} min`
                        : call.status}
                    </span>
                    <p>{call.summary || "No summary available."}</p>
                  </div>
                  <div className="call-record-actions">
                    <b>{call.disposition || call.status}</b>
                    {canAssign && (
                      <select
                        aria-label={`Assignee for call from ${call.caller_name || call.from_number || "unknown caller"}`}
                        value={call.assigned_to || ""}
                        disabled={demoMode || busy}
                        onChange={(event) => void assignCall(call, event.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {members.map((member) => (
                          <option value={member.user_id} key={member.user_id}>
                            {member.display_name || member.email}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </article>
        <form className="panel receptionist-settings" onSubmit={saveSettings}>
          <div className="panel-header">
            <div>
              <h2>Receptionist setup</h2>
              <p>Provider-neutral call controls</p>
            </div>
            <ShieldCheck />
          </div>
          <label>
            <span>Voice provider</span>
            <select
              value={settings.provider}
              disabled={!canConfigure || demoMode}
              onChange={(event) => setSettings({ ...settings, provider: event.target.value })}
            >
              <option value="unconfigured">Not connected</option>
              <option value="retell">Retell AI</option>
              <option value="vapi">Vapi</option>
              <option value="twilio">Twilio</option>
            </select>
          </label>
          <label>
            <span>Human transfer number</span>
            <input
              value={settings.transfer_number}
              disabled={!canConfigure || demoMode}
              onChange={(event) =>
                setSettings({ ...settings, transfer_number: event.target.value })
              }
              placeholder="(630) 555-0100"
            />
          </label>
          <label>
            <span>AI phone number</span>
            <input
              value={settings.phone_number}
              disabled={!canConfigure || demoMode}
              onChange={(event) => setSettings({ ...settings, phone_number: event.target.value })}
              placeholder="+16305550101"
            />
          </label>
          <label>
            <span>Greeting</span>
            <textarea
              rows={4}
              value={settings.greeting}
              disabled={!canConfigure || demoMode}
              onChange={(event) => setSettings({ ...settings, greeting: event.target.value })}
            />
          </label>
          <label className="setting-check">
            <input
              type="checkbox"
              checked={settings.recording_enabled}
              disabled={!canConfigure || demoMode}
              onChange={(event) =>
                setSettings({ ...settings, recording_enabled: event.target.checked })
              }
            />
            <span>Record calls after disclosure and consent</span>
          </label>
          <label className="setting-check">
            <input
              type="checkbox"
              checked={settings.enabled}
              disabled={!canConfigure || demoMode || settings.provider === "unconfigured"}
              onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })}
            />
            <span>Enable AI receptionist</span>
          </label>
          <button
            className="button button-primary button-full"
            disabled={busy || demoMode || !canConfigure}
          >
            {busy ? "Saving…" : demoMode ? "Sample configuration" : "Save settings"}
          </button>
          <div className="test-call-box">
            <strong>Test the receptionist</strong>
            <span>Places a real call through Retell. Limited to five tests per day.</span>
            <input
              aria-label="Test call number"
              value={testNumber}
              disabled={demoMode || settings.provider !== "retell"}
              onChange={(event) => setTestNumber(event.target.value)}
              placeholder="+13125550123"
            />
            <button
              type="button"
              className="button button-secondary button-full"
              onClick={() => void placeTestCall()}
              disabled={busy || demoMode || settings.provider !== "retell" || !testNumber}
            >
              {busy ? "Working…" : "Place test call"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
