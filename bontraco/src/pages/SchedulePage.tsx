import { CalendarBlank } from "@phosphor-icons/react/CalendarBlank";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { Clock } from "@phosphor-icons/react/Clock";
import { MapPin } from "@phosphor-icons/react/MapPin";
import { Plus } from "@phosphor-icons/react/Plus";
import { UserCircle } from "@phosphor-icons/react/UserCircle";
import { X } from "@phosphor-icons/react/X";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { withAuthRequestDeadline } from "../lib/auth-request-deadline";
import { getSupabase } from "../lib/supabase";
import { useModalFocus } from "../lib/use-modal-focus";
import { useWorkspaceAutoRefresh } from "../lib/workspace-auto-refresh";
import { workPlanningErrorMessage } from "../lib/work-planning-error";
import { useWorkspace } from "../workspace/WorkspaceContext";

type RelatedRecord = {
  id?: string;
  title?: string;
  first_name?: string;
  last_name?: string | null;
  company_name?: string | null;
};
type Appointment = {
  id: string;
  assigned_to: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  job: RelatedRecord | null;
  contact: RelatedRecord | null;
};
type AssignableMember = {
  user_id: string;
  display_name: string | null;
  email: string;
};

const appointmentStatuses = ["scheduled", "confirmed", "completed", "cancelled", "no_show"];
function dateKey(value: string) {
  return new Date(value).toLocaleDateString("en-CA");
}

function relatedLabel(record: RelatedRecord | null) {
  if (!record) return "No customer attached";
  return (
    record.company_name ||
    `${record.first_name || ""} ${record.last_name || ""}`.trim() ||
    record.title ||
    "Related record"
  );
}

export function SchedulePage() {
  const { demoMode, user } = useAuth();
  const { workspace } = useWorkspace();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [contacts, setContacts] = useState<RelatedRecord[]>([]);
  const [jobs, setJobs] = useState<RelatedRecord[]>([]);
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { dialogRef: createDialogRef, rememberOpener: rememberCreateOpener } =
    useModalFocus<HTMLElement>(showCreate);
  const [referenceTime] = useState(() => Date.now());
  const [draft, setDraft] = useState({
    title: "",
    contact_id: "",
    job_id: "",
    starts_at: "",
    duration: "60",
    notes: "",
    assigned_to: "",
  });
  const canAssign = ["owner", "admin", "dispatcher"].includes(workspace?.role || "");
  const canCreate = workspace?.role !== "field";

  const loadSchedule = useCallback(
    async (options: { preserveError?: boolean } = {}) => {
      if (!workspace) {
        setLoading(false);
        return false;
      }
      try {
        if (demoMode && import.meta.env.VITE_DEMO_MODE === "true") {
          const { createDemoScheduleData } = await import("../demo/schedule");
          const data = createDemoScheduleData();
          setAppointments(data.appointments);
          setContacts(data.contacts);
          setJobs(data.jobs);
          setMembers(data.members);
          return true;
        }
        const supabase = await withAuthRequestDeadline(getSupabase());
        if (!supabase) throw new Error("client_unavailable");
        const [appointmentResult, contactResult, jobResult, memberResult] =
          await withAuthRequestDeadline(
            Promise.all([
              supabase
                .from("appointments")
                .select(
                  "id, assigned_to, title, starts_at, ends_at, status, notes, job:jobs(title), contact:contacts(first_name, last_name, company_name)",
                )
                .eq("account_id", workspace.id)
                .gte("ends_at", new Date().toISOString())
                .order("starts_at")
                .limit(200),
              supabase
                .from("contacts")
                .select("id, first_name, last_name, company_name")
                .eq("account_id", workspace.id)
                .order("first_name")
                .limit(300),
              supabase
                .from("jobs")
                .select("id, title")
                .eq("account_id", workspace.id)
                .eq("status", "open")
                .order("title")
                .limit(300),
              supabase
                .from("memberships")
                .select("user_id,display_name,email")
                .eq("account_id", workspace.id)
                .eq("active", true)
                .order("display_name"),
            ]),
          );
        if (appointmentResult.error || contactResult.error || jobResult.error || memberResult.error)
          throw new Error("schedule_load_failed");
        setAppointments((appointmentResult.data || []) as unknown as Appointment[]);
        setContacts((contactResult.data || []) as RelatedRecord[]);
        setJobs((jobResult.data || []) as RelatedRecord[]);
        setMembers((memberResult.data || []) as AssignableMember[]);
        if (!options.preserveError) setError("");
        return true;
      } catch {
        if (!options.preserveError) setError("Bontraco could not load the schedule.");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [demoMode, workspace],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadSchedule());
  }, [loadSchedule]);
  useWorkspaceAutoRefresh(!demoMode, loadSchedule, workspace?.id);

  useEffect(() => {
    if (!showCreate) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setShowCreate(false);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [showCreate]);

  const grouped = useMemo(() => {
    const result = new Map<string, Appointment[]>();
    appointments.forEach((appointment) => {
      const key = dateKey(appointment.starts_at);
      result.set(key, [...(result.get(key) || []), appointment]);
    });
    return Array.from(result.entries());
  }, [appointments]);
  const todayKey = dateKey(new Date(referenceTime).toISOString());
  const todayCount = appointments.filter((item) => dateKey(item.starts_at) === todayKey).length;
  const confirmedCount = appointments.filter((item) => item.status === "confirmed").length;

  async function createAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace || !user || demoMode || busy) return;
    setBusy(true);
    setError("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const startsAt = new Date(draft.starts_at);
      const endsAt = new Date(startsAt.getTime() + Number(draft.duration) * 60000);
      const { error: insertError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase.from("appointments").insert({
            account_id: workspace.id,
            job_id: draft.job_id || null,
            contact_id: draft.contact_id || null,
            assigned_to: canAssign ? draft.assigned_to || null : user.id,
            title: draft.title.trim(),
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            notes: draft.notes.trim() || null,
            created_by: user.id,
          }),
        ),
      );
      if (insertError) throw insertError;
      setShowCreate(false);
      setDraft({
        title: "",
        contact_id: "",
        job_id: "",
        starts_at: "",
        duration: "60",
        notes: "",
        assigned_to: "",
      });
      if (!(await loadSchedule({ preserveError: true })))
        setError(
          "The appointment was scheduled, but the calendar could not refresh. Reload Bontraco.",
        );
    } catch (cause) {
      setError(workPlanningErrorMessage("appointment_create", cause));
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(appointment: Appointment, status: string) {
    if (!workspace || demoMode || busy) return;
    setBusy(true);
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error: updateError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase
            .from("appointments")
            .update({ status })
            .eq("account_id", workspace.id)
            .eq("id", appointment.id),
        ),
      );
      if (updateError) throw updateError;
      setAppointments((current) =>
        current.map((item) => (item.id === appointment.id ? { ...item, status } : item)),
      );
      setError("");
    } catch (cause) {
      setError(workPlanningErrorMessage("appointment_status", cause));
    } finally {
      setBusy(false);
    }
  }

  async function assignAppointment(appointment: Appointment, assignedTo: string) {
    if (!workspace || demoMode || !canAssign || busy) return;
    setBusy(true);
    const nextAssignee = assignedTo || null;
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error: updateError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase
            .from("appointments")
            .update({ assigned_to: nextAssignee })
            .eq("account_id", workspace.id)
            .eq("id", appointment.id),
        ),
      );
      if (updateError) throw updateError;
      setAppointments((current) =>
        current.map((item) =>
          item.id === appointment.id ? { ...item, assigned_to: nextAssignee } : item,
        ),
      );
      setError("");
    } catch (cause) {
      setError(workPlanningErrorMessage("appointment_assign", cause));
    } finally {
      setBusy(false);
    }
  }

  function assigneeName(userId: string | null) {
    const member = members.find((candidate) => candidate.user_id === userId);
    return member?.display_name || member?.email || "Unassigned";
  }

  return (
    <section className="schedule-page">
      <header className="section-heading">
        <div>
          <p>Dispatch calendar</p>
          <h1>Schedule</h1>
          <span>Appointments and field commitments visible to your role.</span>
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
            <Plus weight="bold" /> New appointment
          </button>
        )}
      </header>
      <div className="schedule-stats">
        <article>
          <CalendarBlank />
          <span>
            <strong>{todayCount}</strong>
            <small>appointments today</small>
          </span>
        </article>
        <article>
          <CheckCircle />
          <span>
            <strong>{confirmedCount}</strong>
            <small>confirmed upcoming</small>
          </span>
        </article>
        <article>
          <Clock />
          <span>
            <strong>{appointments.length}</strong>
            <small>upcoming total</small>
          </span>
        </article>
      </div>
      {error && (
        <p className="form-message error" role="alert">
          {error}
        </p>
      )}
      <article className="panel schedule-panel">
        {loading ? (
          <p className="panel-state">Loading schedule</p>
        ) : grouped.length === 0 ? (
          <div className="empty-list">
            <CalendarBlank size={32} />
            <strong>Nothing is scheduled</strong>
            <span>Create an appointment from a customer or job.</span>
          </div>
        ) : (
          grouped.map(([day, items]) => (
            <section className="schedule-day" key={day}>
              <header>
                <span>
                  {new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "long" })}
                </span>
                <strong>
                  {new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </strong>
              </header>
              <div>
                {items.map((appointment) => (
                  <article key={appointment.id}>
                    <time>
                      <strong>
                        {new Date(appointment.starts_at).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </strong>
                      <small>
                        {Math.round(
                          (new Date(appointment.ends_at).getTime() -
                            new Date(appointment.starts_at).getTime()) /
                            60000,
                        )}{" "}
                        min
                      </small>
                    </time>
                    <span className="appointment-main">
                      <strong>{appointment.title}</strong>
                      <small>
                        <MapPin /> {relatedLabel(appointment.contact)}
                        {appointment.job?.title ? ` · ${appointment.job.title}` : ""}
                      </small>
                    </span>
                    {canAssign ? (
                      <select
                        aria-label={`Assignee for ${appointment.title}`}
                        value={appointment.assigned_to || ""}
                        disabled={demoMode || busy}
                        onChange={(event) =>
                          void assignAppointment(appointment, event.target.value)
                        }
                      >
                        <option value="">Unassigned</option>
                        {members.map((member) => (
                          <option value={member.user_id} key={member.user_id}>
                            {member.display_name || member.email}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="appointment-assignee">
                        <UserCircle /> {assigneeName(appointment.assigned_to)}
                      </span>
                    )}
                    <select
                      aria-label={`Status for ${appointment.title}`}
                      value={appointment.status}
                      disabled={demoMode || busy}
                      onChange={(event) => void updateStatus(appointment, event.target.value)}
                    >
                      {appointmentStatuses.map((status) => (
                        <option value={status} key={status}>
                          {status.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </article>
                ))}
              </div>
            </section>
          ))
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
            aria-labelledby="new-appointment-title"
          >
            <header>
              <div>
                <span>Calendar commitment</span>
                <h2 id="new-appointment-title">New appointment</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close appointment form"
                onClick={() => setShowCreate(false)}
              >
                <X />
              </button>
            </header>
            <form onSubmit={createAppointment}>
              <label>
                <span>Appointment title</span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  autoFocus
                  required
                />
              </label>
              <div className="form-pair">
                <label>
                  <span>Starts</span>
                  <input
                    type="datetime-local"
                    value={draft.starts_at}
                    onChange={(event) => setDraft({ ...draft, starts_at: event.target.value })}
                    required
                  />
                </label>
                <label>
                  <span>Duration</span>
                  <select
                    value={draft.duration}
                    onChange={(event) => setDraft({ ...draft, duration: event.target.value })}
                  >
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="90">90 minutes</option>
                    <option value="120">2 hours</option>
                  </select>
                </label>
              </div>
              <label>
                <span>Customer</span>
                <select
                  value={draft.contact_id}
                  onChange={(event) => setDraft({ ...draft, contact_id: event.target.value })}
                >
                  <option value="">No customer</option>
                  {contacts.map((contact) => (
                    <option value={contact.id} key={contact.id}>
                      {relatedLabel(contact)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Job</span>
                <select
                  value={draft.job_id}
                  onChange={(event) => setDraft({ ...draft, job_id: event.target.value })}
                >
                  <option value="">No job</option>
                  {jobs.map((job) => (
                    <option value={job.id} key={job.id}>
                      {job.title}
                    </option>
                  ))}
                </select>
              </label>
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
              <label>
                <span>Notes</span>
                <textarea
                  value={draft.notes}
                  onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                  rows={4}
                />
              </label>
              <button
                className="button button-primary button-large button-full"
                disabled={busy || demoMode}
              >
                {busy ? "Saving appointment" : demoMode ? "Disabled in sample" : "Save appointment"}
              </button>
            </form>
          </aside>
        </div>
      )}
    </section>
  );
}
