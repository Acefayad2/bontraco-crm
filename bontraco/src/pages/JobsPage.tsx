import { CalendarBlank } from "@phosphor-icons/react/CalendarBlank";
import { CurrencyDollar } from "@phosphor-icons/react/CurrencyDollar";
import { DownloadSimple } from "@phosphor-icons/react/DownloadSimple";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
import { NotePencil } from "@phosphor-icons/react/NotePencil";
import { Paperclip } from "@phosphor-icons/react/Paperclip";
import { Plus } from "@phosphor-icons/react/Plus";
import { ShieldCheck } from "@phosphor-icons/react/ShieldCheck";
import { Wrench } from "@phosphor-icons/react/Wrench";
import { X } from "@phosphor-icons/react/X";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { JobCommercialPanel } from "../components/JobCommercialPanel";
import {
  formatSafetyIntakeValue,
  getSafetyIntakeFields,
  hasUrgentSafetySignal,
  type SafetyIntake,
} from "../lib/job-safety-intake";
import { jobErrorMessage } from "../lib/job-error";
import { withAuthRequestDeadline } from "../lib/auth-request-deadline";
import { getSupabase } from "../lib/supabase";
import { useModalFocus } from "../lib/use-modal-focus";
import { useWorkspaceAutoRefresh } from "../lib/workspace-auto-refresh";
import { useWorkspace } from "../workspace/WorkspaceContext";

type ContactChoice = {
  id: string;
  first_name: string;
  last_name: string | null;
  company_name: string | null;
};
type PropertyChoice = {
  id: string;
  contact_id: string;
  label: string | null;
  address_line_1: string;
  city: string;
  region: string;
  active: boolean;
};
type Job = {
  id: string;
  assigned_to: string | null;
  title: string;
  trade: string;
  stage: string;
  status: string;
  estimated_value: number | null;
  scheduled_start: string | null;
  safety_intake: SafetyIntake;
  contact: ContactChoice | null;
  property: Omit<PropertyChoice, "contact_id"> | null;
};
type AssignableMember = {
  user_id: string;
  display_name: string | null;
  email: string;
};
type JobNote = {
  id: string;
  body: string;
  pinned: boolean;
  created_at: string;
};
type JobFile = {
  id: string;
  storage_path: string;
  original_name: string;
  byte_size: number;
  created_at: string;
};
type JobChecklistItem = {
  id: string;
  category: string;
  label: string;
  required: boolean;
  completed_at: string | null;
  completed_by: string | null;
};

const tradeStages: Record<string, string[]> = {
  roofing: ["New", "Inspection", "Estimate", "Insurance", "Approved", "Production", "Complete"],
  plumbing: ["New", "Diagnosed", "Estimate", "Scheduled", "In progress", "Complete"],
  electrical: ["New", "Safety review", "Estimate", "Scheduled", "In progress", "Complete"],
  general: ["New", "Estimate", "Scheduled", "In progress", "Complete"],
};
const fileTransferTimeoutMs = 45_000;

function contactLabel(contact: ContactChoice | null) {
  if (!contact) return "Customer unavailable";
  return contact.company_name || `${contact.first_name} ${contact.last_name || ""}`.trim();
}

export function JobsPage() {
  const { demoMode, user } = useAuth();
  const { workspace } = useWorkspace();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [contacts, setContacts] = useState<ContactChoice[]>([]);
  const [properties, setProperties] = useState<PropertyChoice[]>([]);
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [files, setFiles] = useState<JobFile[]>([]);
  const [checklist, setChecklist] = useState<JobChecklistItem[]>([]);
  const [checklistBusy, setChecklistBusy] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const latestJobsRequestId = useRef(0);
  const latestDetailRequestId = useRef(0);
  const { dialogRef: createDialogRef, rememberOpener: rememberCreateOpener } =
    useModalFocus<HTMLElement>(showCreate);
  const { dialogRef: detailsDialogRef, rememberOpener: rememberDetailsOpener } =
    useModalFocus<HTMLElement>(Boolean(selectedJob));
  const defaultTrade = workspace?.trades[0] || "roofing";
  const [draft, setDraft] = useState({
    title: "",
    contact_id: "",
    property_id: "",
    trade: defaultTrade,
    stage: tradeStages[defaultTrade]?.[0] || "New",
    estimated_value: "",
    scheduled_start: "",
    safety_intake: {} as SafetyIntake,
    assigned_to: "",
  });
  const canCreate = workspace?.role !== "field";
  const canAssign = ["owner", "admin", "dispatcher"].includes(workspace?.role || "");

  const loadJobs = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const requestId = ++latestJobsRequestId.current;
      if (!workspace) {
        setLoading(false);
        return false;
      }
      if (!options.silent) setLoading(true);
      try {
        if (demoMode && import.meta.env.VITE_DEMO_MODE === "true") {
          const { createDemoJobsData } = await import("../demo/jobs");
          const data = createDemoJobsData();
          if (requestId !== latestJobsRequestId.current) return false;
          setJobs(data.jobs as Job[]);
          setContacts(data.contacts);
          setProperties(data.properties);
          setMembers(data.members);
          return true;
        }
        const supabase = await withAuthRequestDeadline(getSupabase());
        if (!supabase) throw new Error("client_unavailable");
        const [jobResult, contactResult, propertyResult, memberResult] =
          await withAuthRequestDeadline(
            Promise.all([
              supabase
                .from("jobs")
                .select(
                  "id, assigned_to, title, trade, stage, status, estimated_value, scheduled_start, safety_intake, contact:contacts(first_name, last_name, company_name), property:properties(id,label,address_line_1,city,region)",
                )
                .eq("account_id", workspace.id)
                .order("updated_at", { ascending: false })
                .limit(200),
              supabase
                .from("contacts")
                .select("id, first_name, last_name, company_name")
                .eq("account_id", workspace.id)
                .order("first_name")
                .limit(300),
              supabase
                .from("properties")
                .select("id,contact_id,label,address_line_1,city,region,active")
                .eq("account_id", workspace.id)
                .eq("active", true)
                .order("created_at")
                .limit(1000),
              supabase
                .from("memberships")
                .select("user_id,display_name,email")
                .eq("account_id", workspace.id)
                .eq("active", true)
                .order("display_name"),
            ]),
          );
        if (requestId !== latestJobsRequestId.current) return false;
        if (jobResult.error || contactResult.error || propertyResult.error || memberResult.error)
          throw new Error("job_load_failed");
        setJobs((jobResult.data || []) as unknown as Job[]);
        setContacts((contactResult.data || []) as ContactChoice[]);
        setProperties((propertyResult.data || []) as PropertyChoice[]);
        setMembers((memberResult.data || []) as AssignableMember[]);
        setError("");
        return true;
      } catch {
        if (requestId === latestJobsRequestId.current && !options.silent)
          setError("Bontraco could not load jobs and service locations.");
        return false;
      } finally {
        if (requestId === latestJobsRequestId.current && !options.silent) setLoading(false);
      }
    },
    [demoMode, workspace],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadJobs());
  }, [loadJobs]);
  const refreshJobsSilently = useCallback(() => loadJobs({ silent: true }), [loadJobs]);
  useWorkspaceAutoRefresh(!demoMode, refreshJobsSilently, workspace?.id);

  useEffect(() => {
    if (!showCreate && !selectedJob) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (document.querySelectorAll('[role="dialog"][aria-modal="true"]').length > 1) return;
        setShowCreate(false);
        setSelectedJob(null);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedJob, showCreate]);

  const loadJobDetails = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const requestId = ++latestDetailRequestId.current;
      if (!workspace || !selectedJob) return false;
      if (!options.silent) setDetailLoading(true);
      try {
        if (demoMode && import.meta.env.VITE_DEMO_MODE === "true") {
          const { createDemoJobDetails } = await import("../demo/jobs");
          const data = createDemoJobDetails();
          if (requestId !== latestDetailRequestId.current) return false;
          setNotes(data.notes);
          setFiles(data.files);
          setChecklist(data.checklist);
          return true;
        }
        const supabase = await withAuthRequestDeadline(getSupabase());
        if (!supabase) throw new Error("client_unavailable");
        const [noteResult, fileResult, checklistResult] = await withAuthRequestDeadline(
          Promise.all([
            supabase
              .from("notes")
              .select("id, body, pinned, created_at")
              .eq("account_id", workspace.id)
              .eq("job_id", selectedJob.id)
              .order("pinned", { ascending: false })
              .order("created_at", { ascending: false }),
            supabase
              .from("files")
              .select("id, storage_path, original_name, byte_size, created_at")
              .eq("account_id", workspace.id)
              .eq("job_id", selectedJob.id)
              .order("created_at", { ascending: false }),
            supabase
              .from("job_checklist_items")
              .select("id, category, label, required, completed_at, completed_by")
              .eq("account_id", workspace.id)
              .eq("job_id", selectedJob.id)
              .order("sort_order"),
          ]),
        );
        if (requestId !== latestDetailRequestId.current) return false;
        if (noteResult.error || fileResult.error || checklistResult.error)
          throw new Error("job_detail_load_failed");
        setNotes((noteResult.data || []) as JobNote[]);
        setFiles((fileResult.data || []) as JobFile[]);
        setChecklist((checklistResult.data || []) as JobChecklistItem[]);
        return true;
      } catch {
        if (requestId === latestDetailRequestId.current && !options.silent)
          setError("Bontraco could not load the job checklist, notes, and files.");
        return false;
      } finally {
        if (requestId === latestDetailRequestId.current && !options.silent) setDetailLoading(false);
      }
    },
    [demoMode, selectedJob, workspace],
  );

  useEffect(() => {
    if (selectedJob) void Promise.resolve().then(() => loadJobDetails());
  }, [loadJobDetails, selectedJob]);
  const refreshJobDetailsSilently = useCallback(
    () => loadJobDetails({ silent: true }),
    [loadJobDetails],
  );
  useWorkspaceAutoRefresh(
    !demoMode && Boolean(selectedJob),
    refreshJobDetailsSilently,
    workspace && selectedJob ? `${workspace.id}:${selectedJob.id}` : "",
  );

  const visibleJobs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return jobs;
    return jobs.filter((job) =>
      [job.title, job.trade, job.stage, contactLabel(job.contact)].some((value) =>
        value.toLowerCase().includes(normalized),
      ),
    );
  }, [jobs, query]);
  const openValue = jobs
    .filter((job) => job.status === "open")
    .reduce((sum, job) => sum + Number(job.estimated_value || 0), 0);

  async function createJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace || !user || demoMode || busy) return;
    setBusy(true);
    setError("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error: insertError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase.from("jobs").insert({
            account_id: workspace.id,
            contact_id: draft.contact_id,
            property_id: draft.property_id || null,
            title: draft.title.trim(),
            trade: draft.trade,
            stage: draft.stage,
            estimated_value: draft.estimated_value ? Number(draft.estimated_value) : null,
            scheduled_start: draft.scheduled_start
              ? new Date(draft.scheduled_start).toISOString()
              : null,
            safety_intake: draft.safety_intake,
            assigned_to: canAssign ? draft.assigned_to || null : user.id,
            created_by: user.id,
          }),
        ),
      );
      if (insertError) throw insertError;
      setShowCreate(false);
      setDraft({
        title: "",
        contact_id: "",
        property_id: "",
        trade: defaultTrade,
        stage: tradeStages[defaultTrade]?.[0] || "New",
        estimated_value: "",
        scheduled_start: "",
        safety_intake: {},
        assigned_to: "",
      });
      if (!(await loadJobs({ silent: true }))) {
        setError("The job was created, but the job list could not refresh. Reload Bontraco.");
      }
    } catch (cause) {
      setError(jobErrorMessage("create", cause));
    } finally {
      setBusy(false);
    }
  }

  async function assignJob(job: Job, assignedTo: string) {
    if (!workspace || demoMode || !canAssign || busy) return;
    const nextAssignee = assignedTo || null;
    setBusy(true);
    setError("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error: updateError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase
            .from("jobs")
            .update({ assigned_to: nextAssignee })
            .eq("account_id", workspace.id)
            .eq("id", job.id),
        ),
      );
      if (updateError) throw updateError;
      setJobs((current) =>
        current.map((item) => (item.id === job.id ? { ...item, assigned_to: nextAssignee } : item)),
      );
      setSelectedJob((current) =>
        current?.id === job.id ? { ...current, assigned_to: nextAssignee } : current,
      );
    } catch (cause) {
      setError(jobErrorMessage("assign", cause));
    } finally {
      setBusy(false);
    }
  }

  function assigneeName(userId: string | null) {
    const member = members.find((candidate) => candidate.user_id === userId);
    return member?.display_name || member?.email || "Unassigned";
  }

  async function updateStage(job: Job, stage: string) {
    if (!workspace || demoMode || busy) return;
    const status = stage === "Complete" ? "completed" : job.status;
    setBusy(true);
    setError("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error: updateError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase
            .from("jobs")
            .update({ stage, status })
            .eq("account_id", workspace.id)
            .eq("id", job.id),
        ),
      );
      if (updateError) throw updateError;
      setJobs((current) =>
        current.map((item) => (item.id === job.id ? { ...item, stage, status } : item)),
      );
    } catch (cause) {
      setError(jobErrorMessage("stage", cause));
    } finally {
      setBusy(false);
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace || !selectedJob || !user || demoMode || !noteBody.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error: insertError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase.from("notes").insert({
            account_id: workspace.id,
            job_id: selectedJob.id,
            body: noteBody.trim(),
            created_by: user.id,
          }),
        ),
      );
      if (insertError) throw insertError;
      setNoteBody("");
      if (!(await loadJobDetails({ silent: true }))) {
        setError("The note was added, but job details could not refresh. Reload Bontraco.");
      }
    } catch (cause) {
      setError(jobErrorMessage("note", cause));
    } finally {
      setBusy(false);
    }
  }

  async function toggleChecklistItem(item: JobChecklistItem) {
    if (!workspace || !selectedJob || checklistBusy || (!demoMode && !user)) return;
    const completing = !item.completed_at;
    if (demoMode) {
      setChecklist((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                completed_at: completing ? new Date().toISOString() : null,
                completed_by: completing ? selectedJob.assigned_to : null,
              }
            : entry,
        ),
      );
      return;
    }
    if (!user) return;
    setChecklistBusy(item.id);
    setError("");
    const completedAt = completing ? new Date().toISOString() : null;
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error: updateError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase
            .from("job_checklist_items")
            .update({ completed_at: completedAt, completed_by: completing ? user.id : null })
            .eq("account_id", workspace.id)
            .eq("job_id", selectedJob.id)
            .eq("id", item.id),
        ),
      );
      if (updateError) throw updateError;
      setChecklist((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                completed_at: completedAt,
                completed_by: completing ? user.id : null,
              }
            : entry,
        ),
      );
    } catch (cause) {
      setError(jobErrorMessage("checklist", cause));
    } finally {
      setChecklistBusy("");
    }
  }

  async function uploadFile(file: File | undefined) {
    if (!file || !workspace || !selectedJob || !user || demoMode || uploading) return;
    if (file.size > 25 * 1024 * 1024) {
      setError("Files must be 25 MB or smaller.");
      return;
    }
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"];
    if (!allowedTypes.includes(file.type)) {
      setError("Upload a PDF, JPG, PNG, WebP, or text file.");
      return;
    }
    setUploading(true);
    setError("");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
    const storagePath = `${workspace.id}/${selectedJob.id}/${crypto.randomUUID()}-${safeName}`;
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      let uploadResult;
      try {
        uploadResult = await withAuthRequestDeadline(
          Promise.resolve(
            supabase.storage
              .from("bontraco-files")
              .upload(storagePath, file, { contentType: file.type, upsert: false }),
          ),
          fileTransferTimeoutMs,
        );
      } catch (cause) {
        setError(jobErrorMessage("upload", cause));
        return;
      }
      if (uploadResult.error) {
        setError(jobErrorMessage("upload", uploadResult.error));
        return;
      }
      try {
        const { error: metadataError } = await withAuthRequestDeadline(
          Promise.resolve(
            supabase.from("files").insert({
              account_id: workspace.id,
              job_id: selectedJob.id,
              storage_path: storagePath,
              original_name: file.name,
              content_type: file.type,
              byte_size: file.size,
              created_by: user.id,
            }),
          ),
        );
        if (metadataError) throw metadataError;
      } catch (cause) {
        const timedOut =
          cause instanceof Object && "code" in cause && cause.code === "auth_request_timeout";
        if (!timedOut) {
          try {
            await withAuthRequestDeadline(
              Promise.resolve(supabase.storage.from("bontraco-files").remove([storagePath])),
            );
          } catch {
            // The safe error below asks the user to inspect files before retrying.
          }
        }
        setError(jobErrorMessage("save_file", cause));
        return;
      }
      if (!(await loadJobDetails({ silent: true }))) {
        setError("The file was saved, but job details could not refresh. Reload Bontraco.");
      }
    } catch (cause) {
      setError(jobErrorMessage("upload", cause));
    } finally {
      setUploading(false);
    }
  }

  async function downloadFile(file: JobFile) {
    if (demoMode || downloadingFileId) return;
    setDownloadingFileId(file.id);
    setError("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { data, error: signedError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase.storage
            .from("bontraco-files")
            .createSignedUrl(file.storage_path, 60, { download: file.original_name }),
        ),
      );
      if (signedError) throw signedError;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(jobErrorMessage("download", cause));
    } finally {
      setDownloadingFileId("");
    }
  }

  return (
    <section className="jobs-page">
      <header className="section-heading">
        <div>
          <p>Production pipeline</p>
          <h1>Jobs</h1>
          <span>Trade-specific work from qualification through completion.</span>
        </div>
        {canCreate && (
          <button
            className="button button-primary"
            onClick={(event) => {
              rememberCreateOpener(event.currentTarget);
              setShowCreate(true);
            }}
          >
            <Plus weight="bold" /> New job
          </button>
        )}
      </header>
      <div className="job-stats">
        <article>
          <Wrench />
          <span>
            <strong>{jobs.filter((job) => job.status === "open").length}</strong>
            <small>open jobs</small>
          </span>
        </article>
        <article>
          <CurrencyDollar />
          <span>
            <strong>
              {openValue.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              })}
            </strong>
            <small>open pipeline</small>
          </span>
        </article>
        <article>
          <CalendarBlank />
          <span>
            <strong>{jobs.filter((job) => job.scheduled_start).length}</strong>
            <small>scheduled jobs</small>
          </span>
        </article>
      </div>
      {error && (
        <p className="form-message error" role="alert">
          {error}
        </p>
      )}
      <article className="panel jobs-panel">
        <div className="customer-toolbar">
          <label>
            <MagnifyingGlass />
            <input
              aria-label="Search jobs"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search job, customer, trade, or stage"
            />
          </label>
          <span>{visibleJobs.length} jobs</span>
        </div>
        {loading ? (
          <p className="panel-state">Loading jobs</p>
        ) : visibleJobs.length === 0 ? (
          <div className="empty-list">
            <Wrench size={32} />
            <strong>No jobs match this view</strong>
            <span>Create a job from a qualified customer or lead.</span>
          </div>
        ) : (
          <div className="job-list">
            {visibleJobs.map((job) => (
              <article className={canAssign ? "manager" : ""} key={job.id}>
                <span className="job-trade">
                  <Wrench />
                  {job.trade}
                </span>
                <span className="job-main">
                  <strong>{job.title}</strong>
                  <small>{contactLabel(job.contact)}</small>
                </span>
                <span className="job-value">
                  <strong>
                    {job.estimated_value
                      ? Number(job.estimated_value).toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        })
                      : "Not priced"}
                  </strong>
                  <small>
                    {job.scheduled_start
                      ? new Date(job.scheduled_start).toLocaleDateString()
                      : "Not scheduled"}
                  </small>
                </span>
                {canAssign && (
                  <select
                    aria-label={`Assignee for ${job.title}`}
                    value={job.assigned_to || ""}
                    disabled={busy || demoMode}
                    onChange={(event) => void assignJob(job, event.target.value)}
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
                  aria-label={`Stage for ${job.title}`}
                  value={job.stage}
                  disabled={busy || demoMode}
                  onChange={(event) => void updateStage(job, event.target.value)}
                >
                  {(tradeStages[job.trade] || tradeStages.general).map((stage) => (
                    <option value={stage} key={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
                <button
                  className="job-details-button"
                  onClick={(event) => {
                    rememberDetailsOpener(event.currentTarget);
                    setSelectedJob(job);
                  }}
                >
                  Details
                </button>
              </article>
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
            aria-labelledby="new-job-title"
          >
            <header>
              <div>
                <span>Production record</span>
                <h2 id="new-job-title">Create a job</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close job form"
                onClick={() => setShowCreate(false)}
              >
                <X />
              </button>
            </header>
            <form onSubmit={createJob}>
              <label>
                <span>Job title</span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  autoFocus
                  required
                />
              </label>
              <label>
                <span>Customer</span>
                <select
                  value={draft.contact_id}
                  onChange={(event) =>
                    setDraft({ ...draft, contact_id: event.target.value, property_id: "" })
                  }
                  required
                >
                  <option value="">Select a customer</option>
                  {contacts.map((contact) => (
                    <option value={contact.id} key={contact.id}>
                      {contactLabel(contact)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Service location</span>
                <select
                  value={draft.property_id}
                  disabled={!draft.contact_id}
                  onChange={(event) => setDraft({ ...draft, property_id: event.target.value })}
                >
                  <option value="">No location selected</option>
                  {properties
                    .filter(
                      (property) => property.contact_id === draft.contact_id && property.active,
                    )
                    .map((property) => (
                      <option value={property.id} key={property.id}>
                        {property.label || "Service location"} — {property.address_line_1},{" "}
                        {property.city}
                      </option>
                    ))}
                </select>
                {draft.contact_id &&
                  properties.every(
                    (property) => property.contact_id !== draft.contact_id || !property.active,
                  ) && <small>Add a service location from the customer record when needed.</small>}
              </label>
              <div className="form-pair">
                <label>
                  <span>Trade</span>
                  <select
                    value={draft.trade}
                    onChange={(event) => {
                      const trade = event.target.value;
                      setDraft({
                        ...draft,
                        trade,
                        stage: tradeStages[trade]?.[0] || "New",
                        safety_intake: {},
                      });
                    }}
                  >
                    <option value="roofing">Roofing</option>
                    <option value="plumbing">Plumbing</option>
                    <option value="electrical">Electrical</option>
                    <option value="general">General</option>
                  </select>
                </label>
                <label>
                  <span>Stage</span>
                  <select
                    value={draft.stage}
                    onChange={(event) => setDraft({ ...draft, stage: event.target.value })}
                  >
                    {(tradeStages[draft.trade] || tradeStages.general).map((stage) => (
                      <option value={stage} key={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {canAssign && (
                <label>
                  <span>Assign to</span>
                  <select
                    value={draft.assigned_to}
                    onChange={(event) => setDraft({ ...draft, assigned_to: event.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {members.map((member) => (
                      <option value={member.user_id} key={member.user_id}>
                        {member.display_name || member.email}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="form-pair">
                <label>
                  <span>Estimated value</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.estimated_value}
                    onChange={(event) =>
                      setDraft({ ...draft, estimated_value: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Scheduled start</span>
                  <input
                    type="datetime-local"
                    value={draft.scheduled_start}
                    onChange={(event) =>
                      setDraft({ ...draft, scheduled_start: event.target.value })
                    }
                  />
                </label>
              </div>
              <fieldset className="job-safety-intake">
                <legend>Safety intake</legend>
                <p>
                  Record what the customer reports before dispatch. This does not replace an on-site
                  assessment or emergency services.
                </p>
                <div className="job-safety-fields">
                  {getSafetyIntakeFields(draft.trade).map((field) =>
                    field.kind === "checkbox" ? (
                      <label className="job-safety-checkbox" key={field.key}>
                        <input
                          type="checkbox"
                          checked={draft.safety_intake[field.key] === true}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              safety_intake: {
                                ...draft.safety_intake,
                                [field.key]: event.target.checked,
                              },
                            })
                          }
                        />
                        <span>{field.label}</span>
                      </label>
                    ) : (
                      <label key={field.key}>
                        <span>{field.label}</span>
                        <input
                          type={field.kind}
                          min={field.min}
                          max={field.max}
                          maxLength={field.kind === "text" ? 1000 : undefined}
                          value={String(draft.safety_intake[field.key] ?? "")}
                          onChange={(event) => {
                            const value =
                              field.kind === "number"
                                ? event.target.value
                                  ? Number(event.target.value)
                                  : ""
                                : event.target.value;
                            const safetyIntake = { ...draft.safety_intake };
                            if (value === "") delete safetyIntake[field.key];
                            else safetyIntake[field.key] = value;
                            setDraft({ ...draft, safety_intake: safetyIntake });
                          }}
                        />
                        {field.help && <small>{field.help}</small>}
                      </label>
                    ),
                  )}
                </div>
                {hasUrgentSafetySignal(draft.trade, draft.safety_intake) && (
                  <p className="job-safety-alert" role="alert">
                    Urgent hazard reported. Follow company emergency escalation procedures and
                    direct the caller to emergency services when appropriate.
                  </p>
                )}
              </fieldset>
              {contacts.length === 0 && (
                <p className="form-message error">Add a customer before creating a job.</p>
              )}
              <button
                className="button button-primary button-large button-full"
                disabled={busy || demoMode || contacts.length === 0}
              >
                {busy ? "Saving job" : demoMode ? "Disabled in sample" : "Create job"}
              </button>
            </form>
          </aside>
        </div>
      )}
      {selectedJob && (
        <div
          className="drawer-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedJob(null);
          }}
        >
          <aside
            ref={detailsDialogRef}
            className="lead-drawer job-detail-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-details-title"
          >
            <header>
              <div>
                <span>{selectedJob.trade} workspace</span>
                <h2 id="job-details-title">{selectedJob.title}</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close job details"
                onClick={() => setSelectedJob(null)}
              >
                <X />
              </button>
            </header>
            <div className="job-detail-content">
              <section className="job-detail-summary">
                <div>
                  <span>Customer</span>
                  <strong>{contactLabel(selectedJob.contact)}</strong>
                </div>
                <div>
                  <span>Stage</span>
                  <strong>{selectedJob.stage}</strong>
                </div>
                <div>
                  <span>Value</span>
                  <strong>
                    {selectedJob.estimated_value
                      ? Number(selectedJob.estimated_value).toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        })
                      : "Not priced"}
                  </strong>
                </div>
                <div>
                  <span>Service location</span>
                  <strong>
                    {selectedJob.property
                      ? `${selectedJob.property.address_line_1}, ${selectedJob.property.city}`
                      : "Not linked"}
                  </strong>
                </div>
                <div>
                  <span>Assigned to</span>
                  <strong>{assigneeName(selectedJob.assigned_to)}</strong>
                </div>
              </section>

              <section className="job-detail-section job-safety-summary">
                <div className="job-detail-heading">
                  <div>
                    <ShieldCheck />
                    <strong>Pre-dispatch safety intake</strong>
                  </div>
                  <span>{Object.keys(selectedJob.safety_intake || {}).length} answers</span>
                </div>
                {hasUrgentSafetySignal(selectedJob.trade, selectedJob.safety_intake || {}) && (
                  <p className="job-safety-alert" role="alert">
                    This intake contains an urgent hazard signal. Review before dispatch.
                  </p>
                )}
                {Object.keys(selectedJob.safety_intake || {}).length === 0 ? (
                  <p className="detail-state">No pre-dispatch safety answers were recorded.</p>
                ) : (
                  <dl>
                    {getSafetyIntakeFields(selectedJob.trade)
                      .filter((field) => field.key in (selectedJob.safety_intake || {}))
                      .map((field) => (
                        <div key={field.key}>
                          <dt>{field.label}</dt>
                          <dd>
                            {formatSafetyIntakeValue(field, selectedJob.safety_intake[field.key])}
                          </dd>
                        </div>
                      ))}
                  </dl>
                )}
              </section>

              <JobCommercialPanel jobId={selectedJob.id} />

              <section className="job-detail-section job-checklist-section">
                <div className="job-detail-heading">
                  <div>
                    <ShieldCheck />
                    <strong>{selectedJob.trade} field checklist</strong>
                  </div>
                  <span>
                    {checklist.filter((item) => item.completed_at).length}/{checklist.length}
                  </span>
                </div>
                <p className="checklist-guidance">
                  Workflow support only. Follow company policy, licensing rules, manufacturer
                  instructions, and applicable safety requirements.
                </p>
                {detailLoading ? (
                  <p className="detail-state">Loading checklist…</p>
                ) : checklist.length === 0 ? (
                  <p className="detail-state">No checklist is configured for this job.</p>
                ) : (
                  <div className="job-checklist-list">
                    {checklist.map((item) => (
                      <label className={item.completed_at ? "completed" : ""} key={item.id}>
                        <input
                          type="checkbox"
                          checked={Boolean(item.completed_at)}
                          disabled={Boolean(checklistBusy)}
                          onChange={() => void toggleChecklistItem(item)}
                        />
                        <span>
                          <strong>{item.label}</strong>
                          <small>
                            {item.category}
                            {item.required ? " · required" : ""}
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </section>

              <section className="job-detail-section">
                <div className="job-detail-heading">
                  <div>
                    <NotePencil />
                    <strong>Notes</strong>
                  </div>
                  <span>{notes.length}</span>
                </div>
                <form className="job-note-form" onSubmit={addNote}>
                  <textarea
                    aria-label="Job note"
                    rows={3}
                    value={noteBody}
                    onChange={(event) => setNoteBody(event.target.value)}
                    placeholder="Add access details, inspection findings, or a customer update"
                  />
                  <button
                    className="button button-primary"
                    disabled={busy || demoMode || !noteBody.trim()}
                  >
                    {busy ? "Saving…" : "Add note"}
                  </button>
                </form>
                {detailLoading ? (
                  <p className="detail-state">Loading notes…</p>
                ) : notes.length === 0 ? (
                  <p className="detail-state">No notes on this job yet.</p>
                ) : (
                  <div className="job-note-list">
                    {notes.map((note) => (
                      <article key={note.id} className={note.pinned ? "pinned" : ""}>
                        <p>{note.body}</p>
                        <span>
                          {note.pinned ? "Pinned · " : ""}
                          {new Date(note.created_at).toLocaleString()}
                        </span>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="job-detail-section">
                <div className="job-detail-heading">
                  <div>
                    <Paperclip />
                    <strong>Files</strong>
                  </div>
                  <span>{files.length}</span>
                </div>
                <label className="job-file-upload">
                  <Paperclip />
                  <span>
                    {uploading ? "Uploading securely…" : "Attach PDF, photo, or text file"}
                  </span>
                  <input
                    aria-label="Attach job file"
                    type="file"
                    disabled={uploading || demoMode}
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.txt"
                    onChange={(event) => {
                      void uploadFile(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
                {files.length === 0 ? (
                  <p className="detail-state">No files attached.</p>
                ) : (
                  <div className="job-file-list">
                    {files.map((file) => (
                      <button
                        key={file.id}
                        disabled={demoMode || Boolean(downloadingFileId)}
                        aria-label={
                          downloadingFileId === file.id
                            ? `Preparing ${file.original_name}`
                            : `Download ${file.original_name}`
                        }
                        onClick={() => void downloadFile(file)}
                      >
                        <span>
                          <Paperclip />
                          <strong>{file.original_name}</strong>
                          <small>
                            {(file.byte_size / 1024 / 1024).toFixed(1)} MB ·{" "}
                            {new Date(file.created_at).toLocaleDateString()}
                          </small>
                        </span>
                        <DownloadSimple />
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
