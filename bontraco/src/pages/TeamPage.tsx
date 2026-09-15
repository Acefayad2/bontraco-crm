import { Copy } from "@phosphor-icons/react/Copy";
import { EnvelopeSimple } from "@phosphor-icons/react/EnvelopeSimple";
import { ShieldCheck } from "@phosphor-icons/react/ShieldCheck";
import { UserMinus } from "@phosphor-icons/react/UserMinus";
import { UsersThree } from "@phosphor-icons/react/UsersThree";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { withAuthRequestDeadline } from "../lib/auth-request-deadline";
import { getSupabase } from "../lib/supabase";
import { teamErrorMessage } from "../lib/team-error";
import { useWorkspaceAutoRefresh } from "../lib/workspace-auto-refresh";
import { useWorkspace, type WorkspaceRole } from "../workspace/WorkspaceContext";

type Member = {
  user_id: string;
  display_name: string | null;
  email: string;
  role: WorkspaceRole;
  active: boolean;
};

type Invitation = {
  id: string;
  email: string;
  role: WorkspaceRole;
  expires_at: string;
};

type SubscriptionPlan = {
  slug: string;
  display_name: string;
  included_users: number;
};

const staffRoles: WorkspaceRole[] = ["sales", "dispatcher", "field"];

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

export async function createInvitationToken() {
  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const tokenDigest = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return { token, tokenDigest };
}

export function TeamPage() {
  const { demoMode, user } = useAuth();
  const { workspace } = useWorkspace();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("sales");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [planName, setPlanName] = useState("AI Pro");
  const [seatLimit, setSeatLimit] = useState(10);
  const [seatAccessAvailable, setSeatAccessAvailable] = useState(true);
  const canManage = workspace?.role === "owner" || workspace?.role === "admin";
  const assignableRoles = workspace?.role === "owner" ? ["admin", ...staffRoles] : staffRoles;

  const loadTeam = useCallback(async () => {
    if (!workspace) return false;
    if (demoMode && import.meta.env.VITE_DEMO_MODE === "true") {
      const { createDemoTeamData } = await import("../demo/team");
      const data = createDemoTeamData();
      setMembers(data.members);
      setInvitations(data.invitations);
      setPlanName("AI Pro");
      setSeatLimit(10);
      setSeatAccessAvailable(true);
      setLoading(false);
      return true;
    }

    try {
      const [memberResult, inviteResult, subscriptionResult, planResult] =
        await withAuthRequestDeadline(
          (async () => {
            const supabase = await getSupabase();
            if (!supabase) throw new Error("Team client unavailable");
            return Promise.all([
              supabase
                .from("memberships")
                .select("user_id, display_name, email, role, active")
                .eq("account_id", workspace.id)
                .order("created_at"),
              supabase
                .from("invitations")
                .select("id, email, role, expires_at")
                .eq("account_id", workspace.id)
                .is("accepted_at", null)
                .gt("expires_at", new Date().toISOString())
                .order("created_at", { ascending: false }),
              supabase
                .from("account_subscriptions")
                .select("plan_slug,status,grace_ends_at")
                .eq("account_id", workspace.id)
                .maybeSingle(),
              supabase
                .from("subscription_plans")
                .select("slug, display_name, included_users")
                .eq("active", true),
            ]);
          })(),
        );
      if (memberResult.error || inviteResult.error || subscriptionResult.error || planResult.error)
        throw new Error("Team query failed");

      setMembers((memberResult.data || []) as Member[]);
      setInvitations((inviteResult.data || []) as Invitation[]);
      const plan = ((planResult.data || []) as SubscriptionPlan[]).find(
        (candidate) => candidate.slug === subscriptionResult.data?.plan_slug,
      );
      if (plan) {
        setPlanName(plan.display_name);
        setSeatLimit(plan.included_users);
      }
      const subscription = subscriptionResult.data;
      setSeatAccessAvailable(
        subscription?.status === "trialing" ||
          subscription?.status === "active" ||
          (subscription?.status === "past_due" &&
            Boolean(
              subscription.grace_ends_at &&
                new Date(subscription.grace_ends_at).getTime() > Date.now(),
            )),
      );
      setError("");
      return true;
    } catch {
      setError("Bontraco could not load the team list.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [demoMode, workspace]);

  useEffect(() => {
    void Promise.resolve().then(loadTeam);
  }, [loadTeam]);
  useWorkspaceAutoRefresh(!demoMode, loadTeam, workspace?.id);

  const activeCount = useMemo(() => members.filter((member) => member.active).length, [members]);
  const occupiedSeats = activeCount + invitations.length;
  const seatLimitReached = occupiedSeats >= seatLimit;
  const invitationsDisabled = seatLimitReached || !seatAccessAvailable;

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace || !user || demoMode || busy) return;
    if (!seatAccessAvailable) {
      setError("An active subscription is required before teammates can be added.");
      return;
    }
    if (seatLimitReached) {
      setError(`The ${planName} plan's ${seatLimit}-user limit has been reached.`);
      return;
    }
    setBusy(true);
    setError("");
    setInviteLink("");
    try {
      const { token, tokenDigest } = await createInvitationToken();
      const { error: insertError } = await withAuthRequestDeadline(
        (async () => {
          const supabase = await getSupabase();
          if (!supabase) throw new Error("Team client unavailable");
          return supabase.from("invitations").insert({
            account_id: workspace.id,
            email: email.trim().toLowerCase(),
            role,
            token_digest: tokenDigest,
            invited_by: user.id,
            expires_at: new Date(Date.now() + 604800000).toISOString(),
          });
        })(),
      );
      if (insertError) throw insertError;
      setInviteLink(`${window.location.origin}/accept-invite?token=${encodeURIComponent(token)}`);
      setEmail("");
      if (!(await loadTeam()))
        setError(
          "The invitation was created, but the team list could not refresh. Reload Bontraco.",
        );
    } catch (cause) {
      setError(teamErrorMessage(cause, "invite", planName, seatLimit));
    } finally {
      setBusy(false);
    }
  }

  async function updateMember(member: Member, changes: Partial<Pick<Member, "role" | "active">>) {
    if (!workspace || demoMode || member.role === "owner" || busy) return;
    setBusy(true);
    setError("");
    try {
      const { error: updateError } = await withAuthRequestDeadline(
        (async () => {
          const supabase = await getSupabase();
          if (!supabase) throw new Error("Team client unavailable");
          return supabase
            .from("memberships")
            .update(changes)
            .eq("account_id", workspace.id)
            .eq("user_id", member.user_id);
        })(),
      );
      if (updateError) throw updateError;
      if (!(await loadTeam()))
        setError("The teammate was updated, but the team list could not refresh. Reload Bontraco.");
    } catch (cause) {
      setError(teamErrorMessage(cause, "update", planName, seatLimit));
    } finally {
      setBusy(false);
    }
  }

  async function cancelInvitation(id: string) {
    if (!workspace || demoMode || busy) return;
    setBusy(true);
    setError("");
    try {
      const { error: deleteError } = await withAuthRequestDeadline(
        (async () => {
          const supabase = await getSupabase();
          if (!supabase) throw new Error("Team client unavailable");
          return supabase.from("invitations").delete().eq("account_id", workspace.id).eq("id", id);
        })(),
      );
      if (deleteError) throw deleteError;
      if (!(await loadTeam()))
        setError(
          "The invitation was canceled, but the team list could not refresh. Reload Bontraco.",
        );
    } catch (cause) {
      setError(teamErrorMessage(cause, "cancel", planName, seatLimit));
    } finally {
      setBusy(false);
    }
  }

  if (!canManage)
    return (
      <section className="empty-section">
        <ShieldCheck size={34} />
        <h2>Owner or admin access required</h2>
        <p>Your role does not include company team management.</p>
      </section>
    );

  return (
    <section className="team-page">
      <header className="section-heading">
        <div>
          <p>Company access</p>
          <h1>Team</h1>
          <span>Manage who can access {workspace?.name} and what they are allowed to see.</span>
        </div>
        <div className="team-count">
          <UsersThree />
          <strong>
            {occupiedSeats}/{seatLimit}
          </strong>
          <span>seats in use</span>
        </div>
      </header>
      {error && (
        <p className="form-message error" role="alert">
          {error}
        </p>
      )}
      <div className="team-layout">
        <article className="panel team-panel">
          <div className="panel-header">
            <div>
              <h2>People</h2>
              <p>Owners are protected; access changes are recorded in recent activity</p>
            </div>
          </div>
          {loading ? (
            <p className="panel-state">Loading team members</p>
          ) : (
            <div className="member-list">
              {members.map((member) => (
                <div className={!member.active ? "inactive" : ""} key={member.user_id}>
                  <span className="member-avatar">
                    {(member.display_name || member.email).slice(0, 1).toUpperCase()}
                  </span>
                  <span className="member-identity">
                    <strong>{member.display_name || member.email}</strong>
                    <small>{member.email}</small>
                  </span>
                  {member.role === "owner" ||
                  (workspace?.role === "admin" && member.role === "admin") ? (
                    <span className="role-pill">{member.role === "owner" ? "Owner" : "Admin"}</span>
                  ) : (
                    <select
                      aria-label={`Role for ${member.email}`}
                      value={member.role}
                      disabled={demoMode || busy}
                      onChange={(event) =>
                        void updateMember(member, { role: event.target.value as WorkspaceRole })
                      }
                    >
                      {assignableRoles.map((item) => (
                        <option value={item} key={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  )}
                  {member.role !== "owner" &&
                    !(workspace?.role === "admin" && member.role === "admin") && (
                      <button
                        className="icon-button"
                        aria-label={`${member.active ? "Deactivate" : "Reactivate"} ${member.email}`}
                        disabled={demoMode || busy}
                        onClick={() => void updateMember(member, { active: !member.active })}
                      >
                        <UserMinus />
                      </button>
                    )}
                </div>
              ))}
            </div>
          )}
        </article>
        <aside className="team-side">
          <form className="panel invite-panel" onSubmit={invite}>
            <div className="panel-header">
              <div>
                <h2>Invite a teammate</h2>
                <p>
                  {planName} includes {seatLimit} users; pending invitations reserve a seat.
                </p>
              </div>
              <EnvelopeSimple />
            </div>
            <div className="invite-fields">
              <label>
                <span>Work email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                  disabled={demoMode}
                  required
                />
              </label>
              <label>
                <span>Role</span>
                <select
                  value={role}
                  disabled={demoMode}
                  onChange={(event) => setRole(event.target.value as WorkspaceRole)}
                >
                  {assignableRoles.map((item) => (
                    <option value={item} key={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button button-primary button-full"
                disabled={busy || demoMode || invitationsDisabled}
              >
                {busy
                  ? "Creating invitation"
                  : demoMode
                    ? "Disabled in sample"
                    : !seatAccessAvailable
                      ? "Subscription required"
                      : seatLimitReached
                        ? "User limit reached"
                        : "Create invitation"}
              </button>
            </div>
            {inviteLink && (
              <div className="invite-link">
                <span>Secure invitation created</span>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(inviteLink)}
                >
                  <Copy /> Copy link
                </button>
              </div>
            )}
          </form>
          <article className="panel pending-panel">
            <div className="panel-header">
              <div>
                <h2>Pending</h2>
                <p>{invitations.length} invitations awaiting acceptance</p>
              </div>
            </div>
            <div className="pending-list">
              {invitations.length === 0 && <p className="panel-state">No pending invitations</p>}
              {invitations.map((invitation) => (
                <div key={invitation.id}>
                  <span>
                    <strong>{invitation.email}</strong>
                    <small>
                      {invitation.role} · expires{" "}
                      {new Date(invitation.expires_at).toLocaleDateString()}
                    </small>
                  </span>
                  <button
                    onClick={() => void cancelInvitation(invitation.id)}
                    disabled={demoMode || busy}
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}
