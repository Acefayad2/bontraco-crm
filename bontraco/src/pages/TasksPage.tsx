import { Check } from "@phosphor-icons/react/Check";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { ClockCountdown } from "@phosphor-icons/react/ClockCountdown";
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

type Task = {
  id: string;
  title: string;
  assigned_to: string | null;
  due_at: string | null;
  completed_at: string | null;
  job: { title: string } | null;
  lead: { title: string } | null;
};

type Member = {
  user_id: string;
  display_name: string | null;
  email: string;
};

type RelatedRecord = { id: string; title: string };

function dueLabel(value: string | null) {
  if (!value) return "No due date";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TasksPage() {
  const { demoMode, user } = useAuth();
  const { workspace } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [jobs, setJobs] = useState<RelatedRecord[]>([]);
  const [leads, setLeads] = useState<RelatedRecord[]>([]);
  const [filter, setFilter] = useState<"open" | "completed">("open");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [referenceTime] = useState(() => Date.now());
  const { dialogRef: createDialogRef, rememberOpener: rememberCreateOpener } =
    useModalFocus<HTMLElement>(showCreate);
  const [draft, setDraft] = useState({
    title: "",
    assigned_to: user?.id || "",
    due_at: "",
    related_type: "none",
    related_id: "",
  });
  const canAssign = ["owner", "admin", "dispatcher"].includes(workspace?.role || "");

  const loadTasks = useCallback(
    async (options: { preserveError?: boolean } = {}) => {
      if (!workspace) {
        setLoading(false);
        return false;
      }
      if (demoMode && import.meta.env.VITE_DEMO_MODE === "true") {
        const { createDemoTasksData } = await import("../demo/tasks");
        const data = createDemoTasksData();
        setTasks(data.tasks);
        setMembers(data.members);
        setJobs(data.jobs);
        setLeads(data.leads);
        setLoading(false);
        return true;
      }
      try {
        const supabase = await withAuthRequestDeadline(getSupabase());
        if (!supabase) throw new Error("client_unavailable");
        const [taskResult, memberResult, jobResult, leadResult] = await withAuthRequestDeadline(
          Promise.all([
            supabase
              .from("tasks")
              .select("id,title,assigned_to,due_at,completed_at,job:jobs(title),lead:leads(title)")
              .eq("account_id", workspace.id)
              .order("completed_at", { ascending: true, nullsFirst: true })
              .order("due_at", { ascending: true, nullsFirst: false })
              .limit(300),
            supabase
              .from("memberships")
              .select("user_id,display_name,email")
              .eq("account_id", workspace.id)
              .eq("active", true)
              .order("display_name"),
            supabase
              .from("jobs")
              .select("id,title")
              .eq("account_id", workspace.id)
              .eq("status", "open")
              .order("title")
              .limit(300),
            supabase
              .from("leads")
              .select("id,title")
              .eq("account_id", workspace.id)
              .not("status", "in", "(won,lost,archived)")
              .order("discovered_at", { ascending: false })
              .limit(300),
          ]),
        );
        if (taskResult.error || memberResult.error || jobResult.error || leadResult.error)
          throw new Error("task_load_failed");
        setTasks((taskResult.data || []) as unknown as Task[]);
        setMembers((memberResult.data || []) as Member[]);
        setJobs((jobResult.data || []) as RelatedRecord[]);
        setLeads((leadResult.data || []) as RelatedRecord[]);
        if (!options.preserveError) setError("");
        return true;
      } catch {
        if (!options.preserveError) setError("Bontraco could not load tasks.");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [demoMode, workspace],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadTasks());
  }, [loadTasks]);
  useWorkspaceAutoRefresh(!demoMode, loadTasks, workspace?.id);

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

  const visibleTasks = useMemo(
    () => tasks.filter((task) => (filter === "completed" ? task.completed_at : !task.completed_at)),
    [filter, tasks],
  );
  const overdueCount = tasks.filter(
    (task) => !task.completed_at && task.due_at && new Date(task.due_at).getTime() < referenceTime,
  ).length;
  const memberName = useCallback(
    (userId: string | null) => {
      const member = members.find((candidate) => candidate.user_id === userId);
      return member?.display_name || member?.email || "Unassigned";
    },
    [members],
  );

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace || !user || demoMode || busy) return;
    setBusy(true);
    setError("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const assignee = canAssign ? draft.assigned_to || null : user.id;
      const { error: insertError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase.from("tasks").insert({
            account_id: workspace.id,
            assigned_to: assignee,
            title: draft.title.trim(),
            due_at: draft.due_at ? new Date(draft.due_at).toISOString() : null,
            job_id: draft.related_type === "job" ? draft.related_id || null : null,
            lead_id: draft.related_type === "lead" ? draft.related_id || null : null,
            created_by: user.id,
          }),
        ),
      );
      if (insertError) throw insertError;
      setShowCreate(false);
      setDraft({
        title: "",
        assigned_to: user.id,
        due_at: "",
        related_type: "none",
        related_id: "",
      });
      if (!(await loadTasks({ preserveError: true })))
        setError("The task was created, but the task list could not refresh. Reload Bontraco.");
    } catch (cause) {
      setError(workPlanningErrorMessage("task_create", cause));
    } finally {
      setBusy(false);
    }
  }

  async function toggleTask(task: Task) {
    if (!workspace || demoMode || busy) return;
    setBusy(true);
    setError("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const completedAt = task.completed_at ? null : new Date().toISOString();
      const { error: updateError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase
            .from("tasks")
            .update({ completed_at: completedAt })
            .eq("account_id", workspace.id)
            .eq("id", task.id),
        ),
      );
      if (updateError) throw updateError;
      setTasks((current) =>
        current.map((candidate) =>
          candidate.id === task.id ? { ...candidate, completed_at: completedAt } : candidate,
        ),
      );
    } catch (cause) {
      setError(workPlanningErrorMessage("task_update", cause));
    } finally {
      setBusy(false);
    }
  }

  const relatedOptions =
    draft.related_type === "job" ? jobs : draft.related_type === "lead" ? leads : [];

  return (
    <section className="tasks-page">
      <header className="section-heading">
        <div>
          <p>Team follow-through</p>
          <h1>Tasks</h1>
          <span>Assigned work stays private to each teammate and company managers.</span>
        </div>
        <button
          className="button button-primary"
          disabled={busy}
          onClick={(event) => {
            rememberCreateOpener(event.currentTarget);
            setShowCreate(true);
          }}
        >
          <Plus weight="bold" /> New task
        </button>
      </header>

      <div className="task-stats">
        <article>
          <ClockCountdown />
          <span>
            <strong>{tasks.filter((task) => !task.completed_at).length}</strong>
            <small>open tasks</small>
          </span>
        </article>
        <article>
          <CheckCircle />
          <span>
            <strong>{tasks.filter((task) => task.completed_at).length}</strong>
            <small>completed</small>
          </span>
        </article>
        <article className={overdueCount ? "attention" : ""}>
          <ClockCountdown />
          <span>
            <strong>{overdueCount}</strong>
            <small>overdue</small>
          </span>
        </article>
      </div>

      {error && (
        <p className="form-message error" role="alert">
          {error}
        </p>
      )}

      <article className="panel task-panel">
        <header className="task-toolbar">
          <div role="group" aria-label="Task status">
            <button className={filter === "open" ? "active" : ""} onClick={() => setFilter("open")}>
              Open
            </button>
            <button
              className={filter === "completed" ? "active" : ""}
              onClick={() => setFilter("completed")}
            >
              Completed
            </button>
          </div>
          <span>
            {visibleTasks.length} {visibleTasks.length === 1 ? "task" : "tasks"}
          </span>
        </header>
        {loading ? (
          <p className="panel-state">Loading tasks</p>
        ) : visibleTasks.length === 0 ? (
          <div className="empty-list">
            <CheckCircle size={32} />
            <strong>{filter === "open" ? "You’re all caught up" : "No completed tasks yet"}</strong>
            <span>
              {filter === "open"
                ? "Create a task for the next follow-up."
                : "Finished work will collect here."}
            </span>
          </div>
        ) : (
          <div className="task-list">
            {visibleTasks.map((task) => {
              const overdue =
                !task.completed_at &&
                task.due_at &&
                new Date(task.due_at).getTime() < referenceTime;
              return (
                <article key={task.id} className={task.completed_at ? "completed" : ""}>
                  <button
                    className="task-check"
                    aria-label={`${task.completed_at ? "Reopen" : "Complete"} ${task.title}`}
                    disabled={busy || demoMode}
                    onClick={() => void toggleTask(task)}
                  >
                    {task.completed_at && <Check weight="bold" />}
                  </button>
                  <span className="task-main">
                    <strong>{task.title}</strong>
                    <small>{task.job?.title || task.lead?.title || "General workspace task"}</small>
                  </span>
                  <span className="task-assignee">
                    <UserCircle />
                    {memberName(task.assigned_to)}
                  </span>
                  <time className={overdue ? "overdue" : ""}>
                    {overdue ? "Overdue · " : ""}
                    {dueLabel(task.due_at)}
                  </time>
                </article>
              );
            })}
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
            aria-labelledby="new-task-title"
          >
            <header>
              <div>
                <span>Team follow-through</span>
                <h2 id="new-task-title">New task</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close task form"
                onClick={() => setShowCreate(false)}
              >
                <X />
              </button>
            </header>
            <form onSubmit={createTask}>
              <label>
                <span>Task</span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  autoFocus
                  required
                  maxLength={240}
                />
              </label>
              <label>
                <span>Due date</span>
                <input
                  type="datetime-local"
                  value={draft.due_at}
                  onChange={(event) => setDraft({ ...draft, due_at: event.target.value })}
                />
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
                <span>Related record</span>
                <select
                  value={draft.related_type}
                  onChange={(event) =>
                    setDraft({ ...draft, related_type: event.target.value, related_id: "" })
                  }
                >
                  <option value="none">General task</option>
                  <option value="job">Job</option>
                  {workspace?.role !== "field" && <option value="lead">Lead</option>}
                </select>
              </label>
              {draft.related_type !== "none" && (
                <label>
                  <span>{draft.related_type === "job" ? "Job" : "Lead"}</span>
                  <select
                    value={draft.related_id}
                    onChange={(event) => setDraft({ ...draft, related_id: event.target.value })}
                    required
                  >
                    <option value="">Choose a {draft.related_type}</option>
                    {relatedOptions.map((record) => (
                      <option value={record.id} key={record.id}>
                        {record.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                className="button button-primary button-large button-full"
                disabled={busy || demoMode}
              >
                {busy ? "Saving task" : demoMode ? "Disabled in sample" : "Save task"}
              </button>
            </form>
          </aside>
        </div>
      )}
    </section>
  );
}
