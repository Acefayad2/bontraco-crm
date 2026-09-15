import { ClockCountdown } from "@phosphor-icons/react/ClockCountdown";
import { ArrowRight } from "@phosphor-icons/react/ArrowRight";
import { FunnelSimple } from "@phosphor-icons/react/FunnelSimple";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
import { Phone } from "@phosphor-icons/react/Phone";
import { Plus } from "@phosphor-icons/react/Plus";
import { Sparkle } from "@phosphor-icons/react/Sparkle";
import { X } from "@phosphor-icons/react/X";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { withAuthRequestDeadline } from "../lib/auth-request-deadline";
import { leadErrorMessage } from "../lib/lead-error";
import { getSupabase } from "../lib/supabase";
import { useModalFocus } from "../lib/use-modal-focus";
import { useWorkspaceAutoRefresh } from "../lib/workspace-auto-refresh";
import { useWorkspace } from "../workspace/WorkspaceContext";

type Lead = {
  id: string;
  assigned_to: string | null;
  contact_id: string | null;
  title: string;
  status: string;
  trade: string;
  source: string;
  source_url: string | null;
  source_posted_at: string | null;
  discovered_at: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  location_text: string | null;
  score: number | null;
};

type AssignableMember = {
  user_id: string;
  display_name: string | null;
  email: string;
  role: string;
};

const statuses = ["new", "qualified", "contacted", "appointment", "won", "lost", "archived"];

function relativeTime(value: string, referenceTime: number) {
  const minutes = Math.max(1, Math.floor((referenceTime - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function LeadsPage({ openComposerRequest = 0 }: { openComposerRequest?: number }) {
  const { demoMode, user } = useAuth();
  const { workspace } = useWorkspace();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(openComposerRequest > 0);
  const [convertLead, setConvertLead] = useState<Lead | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { dialogRef: createDialogRef, rememberOpener: rememberCreateOpener } =
    useModalFocus<HTMLElement>(showCreate);
  const { dialogRef: conversionDialogRef, rememberOpener: rememberConversionOpener } =
    useModalFocus<HTMLElement>(Boolean(convertLead));
  const [referenceTime] = useState(() => Date.now());
  const [draft, setDraft] = useState({
    title: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    location_text: "",
    trade: workspace?.trades[0] || "roofing",
    source: "manual",
  });
  const [conversionDraft, setConversionDraft] = useState({
    firstName: "",
    lastName: "",
    jobTitle: "",
    estimatedValue: "",
  });
  const canCreate = workspace?.role !== "field";
  const canAssign = ["owner", "admin", "dispatcher"].includes(workspace?.role || "");

  const loadLeads = useCallback(
    async (options: { preserveError?: boolean } = {}) => {
      if (!workspace) {
        setLoading(false);
        return false;
      }
      try {
        if (demoMode && import.meta.env.VITE_DEMO_MODE === "true") {
          const { createDemoLeadsData } = await import("../demo/leads");
          const data = createDemoLeadsData();
          setLeads(data.leads);
          setMembers(data.members);
          return true;
        }
        const supabase = await withAuthRequestDeadline(getSupabase());
        if (!supabase) throw new Error("client_unavailable");
        const [leadResult, memberResult] = await withAuthRequestDeadline(
          Promise.all([
            supabase
              .from("leads")
              .select(
                "id, assigned_to, contact_id, title, status, trade, source, source_url, source_posted_at, discovered_at, contact_name, contact_phone, contact_email, location_text, score",
              )
              .eq("account_id", workspace.id)
              .order("discovered_at", { ascending: false })
              .limit(150),
            canAssign
              ? supabase
                  .from("memberships")
                  .select("user_id, display_name, email, role")
                  .eq("account_id", workspace.id)
                  .eq("active", true)
                  .in("role", ["owner", "admin", "sales", "dispatcher"])
                  .order("display_name")
              : Promise.resolve({ data: [], error: null }),
          ]),
        );
        if (leadResult.error || memberResult.error) throw new Error("lead_load_failed");
        setLeads((leadResult.data || []) as Lead[]);
        setMembers((memberResult.data || []) as AssignableMember[]);
        if (!options.preserveError) setError("");
        return true;
      } catch {
        if (!options.preserveError) setError("Bontraco could not load leads.");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [canAssign, demoMode, workspace],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadLeads());
  }, [loadLeads]);
  useWorkspaceAutoRefresh(!demoMode, loadLeads, workspace?.id);

  useEffect(() => {
    if (!showCreate && !convertLead) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowCreate(false);
        setConvertLead(null);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [convertLead, showCreate]);

  const visibleLeads = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active"
          ? !["won", "lost", "archived"].includes(lead.status)
          : lead.status === statusFilter);
      const matchesQuery =
        !normalized ||
        [lead.title, lead.contact_name, lead.contact_phone, lead.location_text, lead.source].some(
          (value) => value?.toLowerCase().includes(normalized),
        );
      return matchesStatus && matchesQuery;
    });
  }, [leads, query, statusFilter]);

  const freshCount = leads.filter(
    (lead) => referenceTime - new Date(lead.discovered_at).getTime() < 86400000,
  ).length;
  const contactableCount = leads.filter((lead) => lead.contact_phone || lead.contact_email).length;

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace || !user || demoMode || busy) return;
    setBusy(true);
    setError("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const assignedTo = workspace.role === "sales" ? user.id : null;
      const now = new Date().toISOString();
      const { error: insertError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase.from("leads").insert({
            account_id: workspace.id,
            assigned_to: assignedTo,
            title: draft.title.trim(),
            trade: draft.trade,
            source: draft.source,
            source_posted_at: now,
            discovered_at: now,
            contact_name: draft.contact_name.trim() || null,
            contact_phone: draft.contact_phone.trim() || null,
            contact_email: draft.contact_email.trim().toLowerCase() || null,
            location_text: draft.location_text.trim() || null,
            dedup_key: `manual:${crypto.randomUUID()}`,
            evidence: { entered_by: user.id },
          }),
        ),
      );
      if (insertError) throw insertError;
      setShowCreate(false);
      setDraft({
        title: "",
        contact_name: "",
        contact_phone: "",
        contact_email: "",
        location_text: "",
        trade: workspace.trades[0] || "roofing",
        source: "manual",
      });
      if (!(await loadLeads({ preserveError: true })))
        setError("The lead was created, but the lead list could not refresh. Reload Bontraco.");
    } catch (cause) {
      setError(leadErrorMessage(cause, "create"));
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(lead: Lead, status: string) {
    if (!workspace || demoMode || busy) return;
    setBusy(true);
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error: updateError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase
            .from("leads")
            .update({ status })
            .eq("account_id", workspace.id)
            .eq("id", lead.id),
        ),
      );
      if (updateError) throw updateError;
      setLeads((current) =>
        current.map((item) => (item.id === lead.id ? { ...item, status } : item)),
      );
      setError("");
    } catch (cause) {
      setError(leadErrorMessage(cause, "status"));
    } finally {
      setBusy(false);
    }
  }

  async function assignLead(lead: Lead, assignedTo: string) {
    if (!workspace || demoMode || !canAssign || busy) return;
    setBusy(true);
    const value = assignedTo || null;
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error: updateError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase
            .from("leads")
            .update({ assigned_to: value })
            .eq("account_id", workspace.id)
            .eq("id", lead.id),
        ),
      );
      if (updateError) throw updateError;
      setLeads((current) =>
        current.map((item) => (item.id === lead.id ? { ...item, assigned_to: value } : item)),
      );
      setError("");
    } catch (cause) {
      setError(leadErrorMessage(cause, "assign"));
    } finally {
      setBusy(false);
    }
  }

  function openConversion(lead: Lead) {
    const nameParts = (lead.contact_name || "").trim().split(/\s+/).filter(Boolean);
    setConversionDraft({
      firstName: nameParts.shift() || "",
      lastName: nameParts.join(" "),
      jobTitle: lead.title,
      estimatedValue: "",
    });
    setConvertLead(lead);
  }

  async function convertToJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace || !convertLead || demoMode || busy) return;
    setBusy(true);
    setError("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error: conversionError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase.rpc("convert_bontraco_lead", {
            target_account_id: workspace.id,
            target_lead_id: convertLead.id,
            customer_first_name: conversionDraft.firstName.trim(),
            customer_last_name: conversionDraft.lastName.trim() || null,
            job_title: conversionDraft.jobTitle.trim() || null,
            job_estimated_value: conversionDraft.estimatedValue
              ? Number(conversionDraft.estimatedValue)
              : null,
          }),
        ),
      );
      if (conversionError) throw conversionError;
      setConvertLead(null);
      if (!(await loadLeads({ preserveError: true })))
        setError("The lead was converted, but the lead list could not refresh. Reload Bontraco.");
    } catch (cause) {
      setError(leadErrorMessage(cause, "convert"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="leads-page">
      <header className="section-heading">
        <div>
          <p>Opportunity inbox</p>
          <h1>Leads</h1>
          <span>Fresh, attributable prospects collected for {workspace?.name}.</span>
        </div>
        {canCreate && (
          <button
            className="button button-primary"
            disabled={busy || demoMode}
            onClick={(event) => {
              rememberCreateOpener(event.currentTarget);
              setShowCreate(true);
            }}
          >
            <Plus weight="bold" /> Add lead
          </button>
        )}
      </header>
      <div className="lead-stats">
        <article>
          <Sparkle />
          <span>
            <strong>{leads.length}</strong>
            <small>visible leads</small>
          </span>
        </article>
        <article>
          <ClockCountdown />
          <span>
            <strong>{freshCount}</strong>
            <small>found in 24 hours</small>
          </span>
        </article>
        <article>
          <Phone />
          <span>
            <strong>{contactableCount}</strong>
            <small>with direct contact</small>
          </span>
        </article>
      </div>
      {error && (
        <p className="form-message error" role="alert">
          {error}
        </p>
      )}
      <article className="panel lead-table-panel">
        <div className="lead-toolbar">
          <label>
            <MagnifyingGlass />
            <input
              aria-label="Search leads"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, phone, location, or source"
            />
          </label>
          <label>
            <FunnelSimple />
            <select
              aria-label="Filter leads by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="active">Active</option>
              <option value="all">All leads</option>
              {statuses.map((status) => (
                <option value={status} key={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loading ? (
          <p className="panel-state">Loading leads</p>
        ) : visibleLeads.length === 0 ? (
          <div className="empty-list">
            <Sparkle size={30} />
            <strong>No leads match this view</strong>
            <span>New qualified prospects will appear here.</span>
          </div>
        ) : (
          <div className="lead-table">
            {visibleLeads.map((lead) => (
              <div className={`lead-row ${canAssign ? "manager" : ""}`} key={lead.id}>
                <span
                  className={`score score-${lead.score && lead.score >= 85 ? "high" : "standard"}`}
                >
                  {lead.score ?? "—"}
                </span>
                <span className="lead-main">
                  <strong>{lead.title}</strong>
                  <small>
                    {lead.contact_name || "Public prospect"} ·{" "}
                    {lead.location_text || "Location unavailable"}
                  </small>
                </span>
                <span className="lead-contact">
                  {lead.contact_phone ? (
                    <a href={`tel:${lead.contact_phone}`}>{lead.contact_phone}</a>
                  ) : (
                    lead.contact_email || "No direct contact"
                  )}
                  <small>
                    {lead.source.replaceAll("_", " ")} ·{" "}
                    {relativeTime(lead.discovered_at, referenceTime)}
                  </small>
                </span>
                {canAssign && (
                  <select
                    className="lead-assignee"
                    aria-label={`Assignee for ${lead.title}`}
                    value={lead.assigned_to || ""}
                    disabled={demoMode || busy}
                    onChange={(event) => void assignLead(lead, event.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {members.map((member) => (
                      <option value={member.user_id} key={member.user_id}>
                        {member.display_name || member.email}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  className="lead-status"
                  aria-label={`Status for ${lead.title}`}
                  value={lead.status}
                  disabled={demoMode || busy}
                  onChange={(event) => void updateStatus(lead, event.target.value)}
                >
                  {statuses.map((status) => (
                    <option value={status} key={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <button
                  className="lead-convert"
                  disabled={Boolean(lead.contact_id) || busy || demoMode}
                  onClick={(event) => {
                    rememberConversionOpener(event.currentTarget);
                    openConversion(lead);
                  }}
                  title={lead.contact_id ? "Already converted" : "Create customer and job"}
                >
                  {lead.contact_id ? "Converted" : "Convert"} <ArrowRight />
                </button>
              </div>
            ))}
          </div>
        )}
      </article>

      {showCreate && (
        <div
          className="drawer-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowCreate(false);
          }}
        >
          <aside
            ref={createDialogRef}
            className="lead-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-lead-title"
          >
            <header>
              <div>
                <span>Manual prospect</span>
                <h2 id="new-lead-title">Add a lead</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close lead form"
                onClick={() => setShowCreate(false)}
              >
                <X />
              </button>
            </header>
            <form onSubmit={createLead}>
              <label>
                <span>Opportunity</span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  placeholder="Roof repair requested after storm"
                  autoFocus
                  required
                />
              </label>
              <div className="form-pair">
                <label>
                  <span>Contact name</span>
                  <input
                    value={draft.contact_name}
                    onChange={(event) => setDraft({ ...draft, contact_name: event.target.value })}
                  />
                </label>
                <label>
                  <span>Phone</span>
                  <input
                    type="tel"
                    value={draft.contact_phone}
                    onChange={(event) => setDraft({ ...draft, contact_phone: event.target.value })}
                  />
                </label>
              </div>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  value={draft.contact_email}
                  onChange={(event) => setDraft({ ...draft, contact_email: event.target.value })}
                />
              </label>
              <label>
                <span>Location</span>
                <input
                  value={draft.location_text}
                  onChange={(event) => setDraft({ ...draft, location_text: event.target.value })}
                  placeholder="Naperville, IL"
                />
              </label>
              <div className="form-pair">
                <label>
                  <span>Trade</span>
                  <select
                    value={draft.trade}
                    onChange={(event) => setDraft({ ...draft, trade: event.target.value })}
                  >
                    <option value="roofing">Roofing</option>
                    <option value="plumbing">Plumbing</option>
                    <option value="electrical">Electrical</option>
                    <option value="general">General</option>
                  </select>
                </label>
                <label>
                  <span>Source</span>
                  <select
                    value={draft.source}
                    onChange={(event) => setDraft({ ...draft, source: event.target.value })}
                  >
                    <option value="manual">Manual</option>
                    <option value="referral">Referral</option>
                    <option value="website">Website</option>
                    <option value="phone">Phone call</option>
                  </select>
                </label>
              </div>
              <button
                className="button button-primary button-large button-full"
                disabled={busy || demoMode}
              >
                {busy ? "Saving lead" : demoMode ? "Disabled in sample" : "Save lead"}
              </button>
            </form>
          </aside>
        </div>
      )}

      {convertLead && (
        <div
          className="drawer-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConvertLead(null);
          }}
        >
          <aside
            ref={conversionDialogRef}
            className="lead-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="convert-lead-title"
          >
            <header>
              <div>
                <span>Lead conversion</span>
                <h2 id="convert-lead-title">Create customer & job</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close conversion form"
                onClick={() => setConvertLead(null)}
              >
                <X />
              </button>
            </header>
            <form onSubmit={convertToJob}>
              <p className="conversion-note">
                Bontraco will link the new customer and job to this lead and mark the opportunity
                won in one transaction.
              </p>
              <div className="form-pair">
                <label>
                  <span>First name</span>
                  <input
                    required
                    autoFocus
                    value={conversionDraft.firstName}
                    onChange={(event) =>
                      setConversionDraft({ ...conversionDraft, firstName: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Last name</span>
                  <input
                    value={conversionDraft.lastName}
                    onChange={(event) =>
                      setConversionDraft({ ...conversionDraft, lastName: event.target.value })
                    }
                  />
                </label>
              </div>
              <label>
                <span>Job title</span>
                <input
                  required
                  value={conversionDraft.jobTitle}
                  onChange={(event) =>
                    setConversionDraft({ ...conversionDraft, jobTitle: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Estimated value</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={conversionDraft.estimatedValue}
                  onChange={(event) =>
                    setConversionDraft({ ...conversionDraft, estimatedValue: event.target.value })
                  }
                  placeholder="0.00"
                />
              </label>
              <button
                className="button button-primary button-large button-full"
                disabled={busy || demoMode}
              >
                {busy
                  ? "Creating records…"
                  : demoMode
                    ? "Disabled in sample"
                    : "Create customer & job"}
              </button>
            </form>
          </aside>
        </div>
      )}
    </section>
  );
}
