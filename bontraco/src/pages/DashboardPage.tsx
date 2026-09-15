import { Bell } from "@phosphor-icons/react/Bell";
import { CalendarBlank } from "@phosphor-icons/react/CalendarBlank";
import { ChartLineUp } from "@phosphor-icons/react/ChartLineUp";
import { ClipboardText } from "@phosphor-icons/react/ClipboardText";
import { CreditCard } from "@phosphor-icons/react/CreditCard";
import { GearSix } from "@phosphor-icons/react/GearSix";
import { HouseLine } from "@phosphor-icons/react/HouseLine";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
import { PhoneCall } from "@phosphor-icons/react/PhoneCall";
import { Plus } from "@phosphor-icons/react/Plus";
import { SignOut } from "@phosphor-icons/react/SignOut";
import { Sparkle } from "@phosphor-icons/react/Sparkle";
import { CheckSquare } from "@phosphor-icons/react/CheckSquare";
import { UserGear } from "@phosphor-icons/react/UserGear";
import { UsersThree } from "@phosphor-icons/react/UsersThree";
import { Wrench } from "@phosphor-icons/react/Wrench";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Brand } from "../components/Brand";
import { WorkspaceErrorBoundary } from "../components/WorkspaceErrorBoundary";
import type { DemoDashboardData } from "../demo/dashboard";
import { withAuthRequestDeadline } from "../lib/auth-request-deadline";
import { canShowWorkspaceNavigation } from "../lib/role-navigation";
import { getSupabase } from "../lib/supabase";
import { authErrorMessage } from "../lib/auth-error";
import { useDocumentTitle } from "../lib/use-document-title";
import { useWorkspaceAutoRefresh } from "../lib/workspace-auto-refresh";
import { useWorkspace } from "../workspace/WorkspaceContext";

const loadOnboardingPage = () =>
  import("./OnboardingPage").then((module) => ({ default: module.OnboardingPage }));
const loadCustomersPage = () =>
  import("./CustomersPage").then((module) => ({ default: module.CustomersPage }));
const loadCallsPage = () => import("./CallsPage").then((module) => ({ default: module.CallsPage }));
const loadJobsPage = () => import("./JobsPage").then((module) => ({ default: module.JobsPage }));
const loadLeadEnginePage = () =>
  import("./LeadEnginePage").then((module) => ({ default: module.LeadEnginePage }));
const loadLeadsPage = () => import("./LeadsPage").then((module) => ({ default: module.LeadsPage }));
const loadReportsPage = () =>
  import("./ReportsPage").then((module) => ({ default: module.ReportsPage }));
const loadSchedulePage = () =>
  import("./SchedulePage").then((module) => ({ default: module.SchedulePage }));
const loadSettingsPage = () =>
  import("./SettingsPage").then((module) => ({ default: module.SettingsPage }));
const loadTeamPage = () => import("./TeamPage").then((module) => ({ default: module.TeamPage }));
const loadTasksPage = () => import("./TasksPage").then((module) => ({ default: module.TasksPage }));

const OnboardingPage = lazy(loadOnboardingPage);
const CustomersPage = lazy(loadCustomersPage);
const CallsPage = lazy(loadCallsPage);
const JobsPage = lazy(loadJobsPage);
const LeadEnginePage = lazy(loadLeadEnginePage);
const LeadsPage = lazy(loadLeadsPage);
const ReportsPage = lazy(loadReportsPage);
const SchedulePage = lazy(loadSchedulePage);
const SettingsPage = lazy(loadSettingsPage);
const TeamPage = lazy(loadTeamPage);
const TasksPage = lazy(loadTasksPage);

const sectionLoaders: Record<string, (() => Promise<unknown>) | undefined> = {
  Leads: loadLeadsPage,
  "Lead Engine": loadLeadEnginePage,
  Customers: loadCustomersPage,
  Jobs: loadJobsPage,
  Schedule: loadSchedulePage,
  Tasks: loadTasksPage,
  Calls: loadCallsPage,
  Reports: loadReportsPage,
  Team: loadTeamPage,
  Settings: loadSettingsPage,
};

function preloadSection(section: string) {
  void sectionLoaders[section]?.().catch(() => undefined);
}

const navItems = [
  { label: "Overview", icon: HouseLine },
  { label: "Leads", icon: Sparkle },
  { label: "Lead Engine", icon: MagnifyingGlass },
  { label: "Customers", icon: UsersThree },
  { label: "Jobs", icon: Wrench },
  { label: "Schedule", icon: CalendarBlank },
  { label: "Tasks", icon: CheckSquare },
  { label: "Calls", icon: PhoneCall },
  { label: "Reports", icon: ChartLineUp },
  { label: "Team", icon: UserGear },
];

type Activity = { title: string; meta: string; time: string };

type Notification = {
  id: string;
  title: string;
  body: string;
  kind: string;
  metadata: { source_table?: string } | null;
  read_at: string | null;
  created_at: string;
};

type WorkspaceSearchResult = {
  id: string;
  section: "Customers" | "Jobs" | "Calls";
  title: string;
  detail: string;
};

export function DashboardPage() {
  const { demoMode, signOut, user } = useAuth();
  const {
    error: workspaceError,
    loading: workspaceLoading,
    refresh: refreshWorkspace,
    selectWorkspace,
    workspace,
    workspaceOptions,
  } = useWorkspace();
  const [active, setActive] = useState("Overview");
  useDocumentTitle(workspace ? `${active} | ${workspace.name} | Bontraco` : "Bontraco workspace");
  const [leadComposerRequest, setLeadComposerRequest] = useState(0);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [demoData, setDemoData] = useState<DemoDashboardData | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [workspaceSearchResults, setWorkspaceSearchResults] = useState<WorkspaceSearchResult[]>([]);
  const [workspaceSearchBusy, setWorkspaceSearchBusy] = useState(false);
  const [workspaceSearchError, setWorkspaceSearchError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [overviewRefreshRequest, setOverviewRefreshRequest] = useState(0);
  const [overviewError, setOverviewError] = useState("");
  const [hasLoadedOverview, setHasLoadedOverview] = useState(false);
  const [overview, setOverview] = useState({
    leads: 0,
    newLeads: 0,
    appointments: 0,
    pipelineValue: 0,
    pipeline: [] as { stage: string; count: number; value: string }[],
    activities: [] as Activity[],
  });

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError("");
    try {
      await signOut();
    } catch (cause) {
      setSignOutError(authErrorMessage(cause, "logout"));
    } finally {
      setSigningOut(false);
    }
  }

  useEffect(() => {
    if (!demoMode || import.meta.env.VITE_DEMO_MODE !== "true") return;
    let activeRequest = true;
    void import("../demo/dashboard").then(({ createDemoDashboardData }) => {
      if (!activeRequest) return;
      const data = createDemoDashboardData();
      setDemoData(data);
      setNotifications(data.notifications);
      setHasLoadedOverview(true);
    });
    return () => {
      activeRequest = false;
    };
  }, [demoMode]);

  const workspaceInitials = (workspace?.name || "Bontraco")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (demoMode || !workspace) return;
    let activeRequest = true;
    void (async () => {
      try {
        const supabase = await withAuthRequestDeadline(getSupabase());
        if (!supabase) throw new Error("client_unavailable");
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        const results = await withAuthRequestDeadline(
          Promise.all([
            supabase
              .from("leads")
              .select("id", { count: "exact", head: true })
              .eq("account_id", workspace.id)
              .not("status", "in", "(won,lost,archived)"),
            supabase
              .from("leads")
              .select("id", { count: "exact", head: true })
              .eq("account_id", workspace.id)
              .eq("status", "new"),
            supabase
              .from("appointments")
              .select("id", { count: "exact", head: true })
              .eq("account_id", workspace.id)
              .gte("starts_at", start.toISOString())
              .lt("starts_at", end.toISOString()),
            supabase
              .from("jobs")
              .select("stage, estimated_value")
              .eq("account_id", workspace.id)
              .eq("status", "open"),
            supabase
              .from("activities")
              .select("summary, kind, occurred_at")
              .eq("account_id", workspace.id)
              .order("occurred_at", { ascending: false })
              .limit(20),
            supabase
              .from("notifications")
              .select("id, title, body, kind, metadata, read_at, created_at")
              .eq("account_id", workspace.id)
              .order("created_at", { ascending: false })
              .limit(8),
          ]),
        );
        if (!activeRequest) return;
        if (results.some((result) => result.error)) throw new Error("overview_load_failed");
        const [
          leadResult,
          newLeadResult,
          appointmentResult,
          jobResult,
          activityResult,
          notificationResult,
        ] = results;
        const stageTotals = new Map<string, { count: number; value: number }>();
        (jobResult.data || []).forEach((job) => {
          const current = stageTotals.get(job.stage) || { count: 0, value: 0 };
          stageTotals.set(job.stage, {
            count: current.count + 1,
            value: current.value + Number(job.estimated_value || 0),
          });
        });
        const pipelineRows = Array.from(stageTotals.entries())
          .slice(0, 5)
          .map(([stage, value]) => ({
            stage,
            count: value.count,
            value: value.value.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            }),
          }));
        const totalValue = (jobResult.data || []).reduce(
          (sum, job) => sum + Number(job.estimated_value || 0),
          0,
        );
        setOverview({
          leads: leadResult.count || 0,
          newLeads: newLeadResult.count || 0,
          appointments: appointmentResult.count || 0,
          pipelineValue: totalValue,
          pipeline: pipelineRows,
          activities: (activityResult.data || []).map((item) => ({
            title: item.summary,
            meta: item.kind.replaceAll("_", " "),
            time: new Date(item.occurred_at).toLocaleDateString(),
          })),
        });
        setNotifications((notificationResult.data || []) as Notification[]);
        setHasLoadedOverview(true);
        setOverviewError("");
      } catch {
        if (activeRequest)
          setOverviewError(
            "Bontraco could not load the workspace overview. Try again in a moment.",
          );
      }
    })();
    return () => {
      activeRequest = false;
    };
  }, [demoMode, overviewRefreshRequest, workspace]);

  const refreshOverview = useCallback(async () => {
    setOverviewRefreshRequest((current) => current + 1);
  }, []);
  useWorkspaceAutoRefresh(!demoMode, refreshOverview, workspace?.id);

  useEffect(() => {
    const normalized = workspaceSearch.trim().toLowerCase();
    if (!workspace || normalized.length < 2) return;
    let activeRequest = true;
    const timer = window.setTimeout(() => {
      if (demoMode) {
        const sample: WorkspaceSearchResult[] = demoData?.searchResults || [];
        setWorkspaceSearchResults(
          sample.filter((result) =>
            `${result.title} ${result.detail} ${result.section}`.toLowerCase().includes(normalized),
          ),
        );
        setWorkspaceSearchBusy(false);
        return;
      }
      setWorkspaceSearchBusy(true);
      void (async () => {
        try {
          const supabase = await withAuthRequestDeadline(getSupabase());
          if (!supabase) throw new Error("client_unavailable");
          const [contactResult, jobResult, callResult] = await withAuthRequestDeadline(
            Promise.all([
              supabase
                .from("contacts")
                .select("id,first_name,last_name,company_name,phone,email")
                .eq("account_id", workspace.id)
                .order("updated_at", { ascending: false })
                .limit(50),
              supabase
                .from("jobs")
                .select("id,title,stage,status")
                .eq("account_id", workspace.id)
                .order("updated_at", { ascending: false })
                .limit(50),
              supabase
                .from("calls")
                .select("id,caller_name,from_number,summary,status")
                .eq("account_id", workspace.id)
                .order("started_at", { ascending: false })
                .limit(50),
            ]),
          );
          if (!activeRequest) return;
          if (contactResult.error || jobResult.error || callResult.error)
            throw new Error("workspace_search_failed");
          const includes = (...values: unknown[]) =>
            values.some((value) =>
              String(value || "")
                .toLowerCase()
                .includes(normalized),
            );
          const results: WorkspaceSearchResult[] = [];
          for (const contact of contactResult.data || []) {
            if (
              includes(
                contact.first_name,
                contact.last_name,
                contact.company_name,
                contact.phone,
                contact.email,
              )
            )
              results.push({
                id: contact.id,
                section: "Customers",
                title:
                  contact.company_name ||
                  `${contact.first_name || ""} ${contact.last_name || ""}`.trim() ||
                  "Customer",
                detail: contact.phone || contact.email || "Customer record",
              });
          }
          for (const job of jobResult.data || [])
            if (includes(job.title, job.stage, job.status))
              results.push({
                id: job.id,
                section: "Jobs",
                title: job.title,
                detail: `${job.stage} job`,
              });
          for (const call of callResult.data || [])
            if (includes(call.caller_name, call.from_number, call.summary, call.status))
              results.push({
                id: call.id,
                section: "Calls",
                title: call.caller_name || call.from_number || "Phone call",
                detail: call.summary || call.status,
              });
          setWorkspaceSearchResults(results.slice(0, 8));
          setWorkspaceSearchError("");
        } catch {
          if (activeRequest) {
            setWorkspaceSearchResults([]);
            setWorkspaceSearchError("Workspace search is unavailable. Try again in a moment.");
          }
        } finally {
          if (activeRequest) setWorkspaceSearchBusy(false);
        }
      })();
    }, 220);
    return () => {
      activeRequest = false;
      window.clearTimeout(timer);
    };
  }, [demoData, demoMode, workspace, workspaceSearch]);

  const displayedPipeline = demoMode
    ? demoData?.pipeline || []
    : overview.pipeline.length
      ? overview.pipeline
      : [{ stage: "No open jobs", count: 0, value: "$0" }];
  const displayedActivities = demoMode ? demoData?.activities || [] : overview.activities;
  const visibleActivities = showAllActivities
    ? displayedActivities
    : displayedActivities.slice(0, 4);
  const coreEnabled = demoMode || workspace?.entitlements.includes("core_crm");
  const leadEngineEnabled = demoMode || workspace?.entitlements.includes("lead_engine");
  const receptionistEnabled = demoMode || workspace?.entitlements.includes("ai_receptionist");
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const unreadNotifications = notifications.filter((notification) => !notification.read_at).length;

  function updateWorkspaceSearch(value: string) {
    setWorkspaceSearch(value);
    setWorkspaceSearchResults([]);
    setWorkspaceSearchError("");
    setWorkspaceSearchBusy(value.trim().length >= 2);
  }

  async function markNotificationsRead() {
    if (!workspace || demoMode || unreadNotifications === 0 || notificationBusy) return;
    setNotificationBusy(true);
    setNotificationError("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const readAt = new Date().toISOString();
      const { error } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase
            .from("notifications")
            .update({ read_at: readAt })
            .eq("account_id", workspace.id)
            .is("read_at", null),
        ),
      );
      if (error) throw error;
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          read_at: notification.read_at || readAt,
        })),
      );
    } catch (cause) {
      const code =
        typeof (cause as { code?: unknown })?.code === "string"
          ? (cause as { code: string }).code
          : "";
      setNotificationError(
        code === "auth_request_timeout"
          ? "Notifications may still be marked as read. Refresh before trying again."
          : "Bontraco could not mark notifications as read. Try again in a moment.",
      );
    } finally {
      setNotificationBusy(false);
    }
  }

  if (workspaceLoading) {
    return (
      <main className="state-page" aria-live="polite">
        <div className="brand-mark">B</div>
        <h1>Loading your company</h1>
        <p>Bontraco is checking your workspace access.</p>
      </main>
    );
  }
  if (workspaceError) {
    return (
      <main className="state-page">
        <div className="brand-mark">B</div>
        <h1>Workspace unavailable</h1>
        <p>{workspaceError}</p>
        <button className="button button-primary" onClick={() => void refreshWorkspace()}>
          Try again
        </button>
      </main>
    );
  }
  if (!workspace) return <OnboardingPage />;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-content">
        Skip to workspace content
      </a>
      <aside className="app-sidebar">
        <Brand inverse />
        <div className="workspace-switcher" aria-label="Current workspace">
          <span className="workspace-avatar">{workspaceInitials}</span>
          <span>
            <strong>{workspace.name}</strong>
            {workspaceOptions.length > 1 ? (
              <select
                aria-label="Switch company workspace"
                onChange={(event) => {
                  setActive("Overview");
                  selectWorkspace(event.target.value);
                }}
                value={workspace.id}
              >
                {workspaceOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            ) : (
              <small>{workspace.trades[0] || "Contractor"} workspace</small>
            )}
          </span>
        </div>
        <nav aria-label="Workspace navigation">
          {navItems
            .filter(({ label }) =>
              canShowWorkspaceNavigation(label, workspace.role, {
                leadEngine: Boolean(leadEngineEnabled),
                receptionist: Boolean(receptionistEnabled),
              }),
            )
            .map(({ label, icon: Icon }) => (
              <button
                aria-current={active === label ? "page" : undefined}
                className={active === label ? "active" : ""}
                key={label}
                onFocus={() => preloadSection(label)}
                onClick={() => setActive(label)}
                onPointerDown={() => preloadSection(label)}
                onPointerEnter={() => preloadSection(label)}
              >
                <Icon size={19} weight={active === label ? "fill" : "regular"} />
                <span>{label}</span>
                {demoMode && demoData?.badges[label] && <b>{demoData.badges[label]}</b>}
              </button>
            ))}
          {workspace.role !== "field" && (
            <button
              aria-current={active === "Settings" ? "page" : undefined}
              className={`mobile-nav-only ${active === "Settings" ? "active" : ""}`}
              onFocus={() => preloadSection("Settings")}
              onClick={() => setActive("Settings")}
              onPointerDown={() => preloadSection("Settings")}
              onPointerEnter={() => preloadSection("Settings")}
            >
              <GearSix size={19} weight={active === "Settings" ? "fill" : "regular"} />
              <span>Settings</span>
            </button>
          )}
          <button
            className="mobile-nav-only"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
          >
            <SignOut size={19} />
            <span>{signingOut ? "Signing out" : "Sign out"}</span>
          </button>
        </nav>
        <div className="sidebar-foot">
          {workspace.role !== "field" && (
            <button
              aria-current={active === "Settings" ? "page" : undefined}
              className={active === "Settings" ? "active" : ""}
              onFocus={() => preloadSection("Settings")}
              onClick={() => setActive("Settings")}
              onPointerDown={() => preloadSection("Settings")}
              onPointerEnter={() => preloadSection("Settings")}
            >
              <GearSix size={19} />
              <span>Settings</span>
            </button>
          )}
          <button disabled={signingOut} onClick={() => void handleSignOut()}>
            <SignOut size={19} />
            <span>{signingOut ? "Signing out" : "Sign out"}</span>
          </button>
        </div>
      </aside>

      <main className="app-main" id="workspace-content" tabIndex={-1}>
        {signOutError && (
          <p className="form-message error" role="alert">
            {signOutError}
          </p>
        )}
        {notificationError && (
          <p className="form-message error" role="alert">
            {notificationError}
          </p>
        )}
        <p className="sr-only" id="workspace-announcement" aria-live="polite" aria-atomic="true">
          {active} section loaded
        </p>
        <header className="app-topbar">
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="app-search-wrap">
            <label className="app-search">
              <MagnifyingGlass />
              <input
                aria-label="Search workspace"
                aria-expanded={workspaceSearch.trim().length >= 2}
                placeholder="Search customers, jobs, or calls"
                value={workspaceSearch}
                onChange={(event) => updateWorkspaceSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") updateWorkspaceSearch("");
                }}
              />
            </label>
            {workspaceSearch.trim().length >= 2 && (
              <div className="workspace-search-results" aria-label="Workspace search results">
                {workspaceSearchBusy ? (
                  <p>Searching…</p>
                ) : workspaceSearchError ? (
                  <p role="alert">{workspaceSearchError}</p>
                ) : workspaceSearchResults.length === 0 ? (
                  <p>No matching customers, jobs, or calls.</p>
                ) : (
                  workspaceSearchResults.map((result) => (
                    <button
                      key={`${result.section}-${result.id}`}
                      onClick={() => {
                        setActive(result.section);
                        updateWorkspaceSearch("");
                      }}
                    >
                      <span>
                        <strong>{result.title}</strong>
                        <small>{result.detail}</small>
                      </span>
                      <b>{result.section}</b>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="topbar-actions">
            {import.meta.env.VITE_DEMO_MODE === "true" && demoMode && (
              <span className="demo-label">Sample workspace</span>
            )}
            <button
              className="icon-button notification-button"
              aria-label={`${unreadNotifications} unread notifications`}
              aria-expanded={showNotifications}
              onClick={() => setShowNotifications((value) => !value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setShowNotifications(false);
              }}
            >
              <Bell />
              {unreadNotifications > 0 && <span>{Math.min(9, unreadNotifications)}</span>}
            </button>
            {showNotifications && (
              <div className="notification-popover">
                <div className="notification-popover-header">
                  <div>
                    <strong>Notifications</strong>
                    <span>{unreadNotifications} unread</span>
                  </div>
                  <button
                    disabled={notificationBusy || unreadNotifications === 0}
                    onClick={() => void markNotificationsRead()}
                  >
                    {notificationBusy ? "Marking read" : "Mark all read"}
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <div className="notification-empty">You’re all caught up.</div>
                ) : (
                  notifications.map((notification) => (
                    <button
                      className={`notification-item ${notification.read_at ? "" : "unread"}`}
                      key={notification.id}
                      onClick={() => {
                        if (notification.kind === "new_lead") setActive("Leads");
                        if (notification.kind === "urgent_call") setActive("Calls");
                        if (notification.kind === "billing_issue") setActive("Settings");
                        if (notification.kind === "assignment") {
                          const assignmentSections: Record<string, string> = {
                            contacts: "Customers",
                            leads: "Leads",
                            jobs: "Jobs",
                            appointments: "Schedule",
                            tasks: "Tasks",
                            calls: "Calls",
                          };
                          const section =
                            assignmentSections[notification.metadata?.source_table || ""];
                          if (section) setActive(section);
                        }
                        setShowNotifications(false);
                      }}
                    >
                      <span className="notification-indicator" />
                      <span>
                        <strong>{notification.title}</strong>
                        <small>{notification.body}</small>
                        <time>{new Date(notification.created_at).toLocaleString()}</time>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
            <span className="user-avatar">{(user?.email?.[0] || "A").toUpperCase()}</span>
          </div>
        </header>

        <div className={active === "Overview" ? "dashboard-content" : "workspace-content"}>
          {!coreEnabled && active !== "Settings" ? (
            <section className="empty-section subscription-required">
              <CreditCard size={34} />
              <h2>Subscription attention needed</h2>
              <p>
                {workspace.role === "owner" || workspace.role === "admin"
                  ? "Open Settings to start or restore the company plan."
                  : "Ask your company owner to restore the Bontraco subscription."}
              </p>
              {(workspace.role === "owner" || workspace.role === "admin") && (
                <button className="button button-primary" onClick={() => setActive("Settings")}>
                  Open billing settings
                </button>
              )}
            </section>
          ) : active === "Team" ? (
            <WorkspaceErrorBoundary
              key="Team"
              section="Team"
              onReturnToOverview={() => setActive("Overview")}
            >
              <Suspense fallback={<p role="status">Loading Team…</p>}>
                <TeamPage />
              </Suspense>
            </WorkspaceErrorBoundary>
          ) : active === "Leads" ? (
            <WorkspaceErrorBoundary
              key="Leads"
              section="Leads"
              onReturnToOverview={() => setActive("Overview")}
            >
              <Suspense fallback={<p role="status">Loading Leads…</p>}>
                <LeadsPage openComposerRequest={leadComposerRequest} />
              </Suspense>
            </WorkspaceErrorBoundary>
          ) : active === "Lead Engine" ? (
            <WorkspaceErrorBoundary
              key="Lead Engine"
              section="Lead Engine"
              onReturnToOverview={() => setActive("Overview")}
            >
              <Suspense fallback={<p role="status">Loading Lead Engine…</p>}>
                <LeadEnginePage />
              </Suspense>
            </WorkspaceErrorBoundary>
          ) : active === "Customers" ? (
            <WorkspaceErrorBoundary
              key="Customers"
              section="Customers"
              onReturnToOverview={() => setActive("Overview")}
            >
              <Suspense fallback={<p role="status">Loading Customers…</p>}>
                <CustomersPage />
              </Suspense>
            </WorkspaceErrorBoundary>
          ) : active === "Jobs" ? (
            <WorkspaceErrorBoundary
              key="Jobs"
              section="Jobs"
              onReturnToOverview={() => setActive("Overview")}
            >
              <Suspense fallback={<p role="status">Loading Jobs…</p>}>
                <JobsPage />
              </Suspense>
            </WorkspaceErrorBoundary>
          ) : active === "Schedule" ? (
            <WorkspaceErrorBoundary
              key="Schedule"
              section="Schedule"
              onReturnToOverview={() => setActive("Overview")}
            >
              <Suspense fallback={<p role="status">Loading Schedule…</p>}>
                <SchedulePage />
              </Suspense>
            </WorkspaceErrorBoundary>
          ) : active === "Tasks" ? (
            <WorkspaceErrorBoundary
              key="Tasks"
              section="Tasks"
              onReturnToOverview={() => setActive("Overview")}
            >
              <Suspense fallback={<p role="status">Loading Tasks…</p>}>
                <TasksPage />
              </Suspense>
            </WorkspaceErrorBoundary>
          ) : active === "Calls" ? (
            <WorkspaceErrorBoundary
              key="Calls"
              section="Calls"
              onReturnToOverview={() => setActive("Overview")}
            >
              <Suspense fallback={<p role="status">Loading Calls…</p>}>
                <CallsPage />
              </Suspense>
            </WorkspaceErrorBoundary>
          ) : active === "Reports" ? (
            <WorkspaceErrorBoundary
              key="Reports"
              section="Reports"
              onReturnToOverview={() => setActive("Overview")}
            >
              <Suspense fallback={<p role="status">Loading Reports…</p>}>
                <ReportsPage />
              </Suspense>
            </WorkspaceErrorBoundary>
          ) : active === "Settings" ? (
            <WorkspaceErrorBoundary
              key="Settings"
              section="Settings"
              onReturnToOverview={() => setActive("Overview")}
            >
              <Suspense fallback={<p role="status">Loading Settings…</p>}>
                <SettingsPage />
              </Suspense>
            </WorkspaceErrorBoundary>
          ) : active !== "Overview" ? (
            <section className="empty-section">
              <Wrench size={34} />
              <h2>{active} is being connected</h2>
              <p>This module will use your secure {workspace.name} workspace records.</p>
            </section>
          ) : (
            <>
              <section className="dashboard-heading">
                <div>
                  <p>{todayLabel}</p>
                  <h1>Good morning. Here is what needs attention.</h1>
                </div>
                {workspace.role !== "field" && (
                  <button
                    className="button button-primary"
                    onClick={() => {
                      setActive("Leads");
                      setLeadComposerRequest((value) => value + 1);
                    }}
                  >
                    <Plus weight="bold" /> New lead
                  </button>
                )}
              </section>
              {overviewError && (
                <p className="form-message error" role="alert">
                  {overviewError}
                </p>
              )}
              {overviewError && !hasLoadedOverview ? (
                <section className="empty-section">
                  <ChartLineUp size={34} />
                  <h2>Overview unavailable</h2>
                  <p>Your workspace records are still protected. Try loading the overview again.</p>
                  <button
                    className="button button-primary"
                    onClick={() => setOverviewRefreshRequest((current) => current + 1)}
                  >
                    Try again
                  </button>
                </section>
              ) : (
                <>
                  <section className="metric-strip" aria-label="Workspace metrics">
                    <article>
                      <span>New leads</span>
                      <strong>{demoMode ? demoData?.metrics.leads || "0" : overview.leads}</strong>
                      <small>
                        {demoMode
                          ? demoData?.metrics.leadHint || "Loading sample"
                          : `${overview.newLeads} need a response`}
                      </small>
                    </article>
                    <article>
                      <span>Appointments today</span>
                      <strong>
                        {demoMode ? demoData?.metrics.appointments || "0" : overview.appointments}
                      </strong>
                      <small>
                        {demoMode
                          ? demoData?.metrics.appointmentHint || "Loading sample"
                          : overview.appointments
                            ? "Review today's schedule"
                            : "Nothing scheduled"}
                      </small>
                    </article>
                    <article>
                      <span>Open pipeline</span>
                      <strong>
                        {demoMode
                          ? demoData?.metrics.pipelineValue || "$0"
                          : overview.pipelineValue.toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                              maximumFractionDigits: 0,
                            })}
                      </strong>
                      <small>
                        {demoMode
                          ? demoData?.metrics.pipelineHint || "Loading sample"
                          : "No open opportunities"}
                      </small>
                    </article>
                    <article>
                      <span>Calls answered</span>
                      <strong>{demoMode ? demoData?.metrics.answerRate || "—" : "—"}</strong>
                      <small>
                        {demoMode
                          ? demoData?.metrics.answerHint || "Loading sample"
                          : "Receptionist not connected"}
                      </small>
                    </article>
                  </section>

                  <section className="dashboard-grid">
                    <article className="panel pipeline-panel">
                      <div className="panel-header">
                        <div>
                          <h2>Sales pipeline</h2>
                          <p>Open opportunity value by current stage</p>
                        </div>
                        <button onClick={() => setActive("Jobs")}>View jobs</button>
                      </div>
                      <div className="pipeline-list">
                        {displayedPipeline.map((item) => (
                          <div key={item.stage}>
                            <span>
                              {item.stage}
                              <small>{item.count} jobs</small>
                            </span>
                            <strong>{item.value}</strong>
                          </div>
                        ))}
                      </div>
                    </article>

                    <article className="panel call-panel">
                      <div className="panel-header">
                        <div>
                          <h2>AI front desk</h2>
                          <p>Live receptionist performance</p>
                        </div>
                        <span className={demoMode ? "live-status" : "setup-status"}>
                          {demoMode ? demoData?.receptionist.status || "Loading" : "Setup needed"}
                        </span>
                      </div>
                      <div className="call-summary">
                        <PhoneCall weight="duotone" />
                        <div>
                          <strong>
                            {demoMode ? demoData?.receptionist.calls || "0 calls" : "0 calls"}
                          </strong>
                          <span>
                            {demoMode
                              ? demoData?.receptionist.callsHint || "Loading sample"
                              : "receptionist not connected"}
                          </span>
                        </div>
                      </div>
                      <dl>
                        <div>
                          <dt>Appointments booked</dt>
                          <dd>{demoMode ? demoData?.receptionist.appointments || "0" : "0"}</dd>
                        </div>
                        <div>
                          <dt>Qualified leads</dt>
                          <dd>{demoMode ? demoData?.receptionist.qualified || "0" : "0"}</dd>
                        </div>
                        <div>
                          <dt>Human transfers</dt>
                          <dd>{demoMode ? demoData?.receptionist.transfers || "0" : "0"}</dd>
                        </div>
                      </dl>
                      {(receptionistEnabled ||
                        workspace.role === "owner" ||
                        workspace.role === "admin") && (
                        <button
                          className="button button-secondary button-full"
                          onClick={() => setActive(receptionistEnabled ? "Calls" : "Settings")}
                        >
                          {receptionistEnabled ? "Review calls" : "Set up receptionist"}
                        </button>
                      )}
                    </article>

                    <article className="panel activity-panel">
                      <div className="panel-header">
                        <div>
                          <h2>Recent activity</h2>
                          <p>Team, calls, customers, and job movement</p>
                        </div>
                        {displayedActivities.length > 4 && (
                          <button onClick={() => setShowAllActivities((value) => !value)}>
                            {showAllActivities ? "Show latest" : "View all"}
                          </button>
                        )}
                      </div>
                      <div className="activity-list">
                        {visibleActivities.length === 0 && (
                          <p className="panel-state">No activity yet</p>
                        )}
                        {visibleActivities.map((item) => (
                          <div key={item.title}>
                            <span className="activity-icon">
                              <ClipboardText />
                            </span>
                            <span>
                              <strong>{item.title}</strong>
                              <small>{item.meta}</small>
                            </span>
                            <time>{item.time}</time>
                          </div>
                        ))}
                      </div>
                    </article>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
