import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { SignIn } from "@phosphor-icons/react/SignIn";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Brand } from "../components/Brand";
import { authErrorMessage } from "../lib/auth-error";
import { withAuthRequestDeadline } from "../lib/auth-request-deadline";
import { getSupabase } from "../lib/supabase";
import { useDocumentTitle } from "../lib/use-document-title";
import { useWorkspace } from "../workspace/WorkspaceContext";

export function AcceptInvitePage() {
  useDocumentTitle("Join your team | Bontraco");
  const { user } = useAuth();
  const { refresh } = useWorkspace();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || sessionStorage.getItem("bontraco_invite_token") || "";
  const [status, setStatus] = useState<"waiting" | "accepting" | "error">("waiting");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      void Promise.resolve().then(() => {
        setStatus("error");
        setError("This invitation link is missing its secure token.");
      });
      return;
    }
    if (!user) {
      sessionStorage.setItem("bontraco_invite_token", token);
      return;
    }

    let active = true;
    void Promise.resolve().then(() => setStatus("accepting"));
    const acceptance = (async () => {
      const supabase = await getSupabase();
      if (!supabase) throw new Error("Network unavailable");
      const { error: acceptError } = await supabase.rpc("accept_bontraco_invitation", {
        raw_token: token,
      });
      if (acceptError) throw acceptError;
    })();
    void withAuthRequestDeadline(acceptance)
      .then(async () => {
        if (!active) return;
        sessionStorage.removeItem("bontraco_invite_token");
        try {
          await refresh();
        } catch {
          // The destination performs its own workspace recovery if this refresh fails.
        }
        if (active) navigate("/app", { replace: true });
      })
      .catch((cause) => {
        if (!active) return;
        setStatus("error");
        setError(authErrorMessage(cause, "invite"));
      });
    return () => {
      active = false;
    };
  }, [navigate, refresh, token, user]);

  return (
    <main className="invite-accept-page">
      <Brand />
      <section>
        <CheckCircle size={42} weight="duotone" />
        <h1>Join your Bontraco team</h1>
        {!user && (
          <>
            <p>
              Sign in or create an account with the email address that received this invitation.
            </p>
            <div>
              <Link className="button button-primary" to="/login">
                <SignIn /> Sign in
              </Link>
              <Link className="button button-secondary" to="/signup">
                Create account
              </Link>
            </div>
          </>
        )}
        {user && status === "accepting" && <p>Verifying your invitation and company access.</p>}
        {status === "error" && (
          <p className="form-message error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
