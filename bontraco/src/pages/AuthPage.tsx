import { ArrowLeft } from "@phosphor-icons/react/ArrowLeft";
import { ArrowRight } from "@phosphor-icons/react/ArrowRight";
import { LockKey } from "@phosphor-icons/react/LockKey";
import { PhoneCall } from "@phosphor-icons/react/PhoneCall";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Brand } from "../components/Brand";
import { authErrorMessage } from "../lib/auth-error";
import { useDocumentTitle } from "../lib/use-document-title";

type AuthPageProps = { mode: "login" | "signup" | "forgot" | "reset" };

export function AuthPage({ mode }: AuthPageProps) {
  const navigate = useNavigate();
  const { configured, requestPasswordReset, signIn, signOut, signUp, updatePassword } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";
  const pageTitle = {
    login: "Sign in | Bontraco",
    signup: "Create workspace | Bontraco",
    forgot: "Reset password | Bontraco",
    reset: "Choose new password | Bontraco",
  }[mode];
  useDocumentTitle(pageTitle);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (isForgot) {
        await requestPasswordReset(email.trim());
        setMessage("If an account matches that email, a secure password-reset link is on its way.");
      } else if (isReset) {
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        await updatePassword(password);
        await signOut();
        setPassword("");
        setConfirmPassword("");
        setMessage("Password updated. Return to sign in with your new password.");
      } else if (isSignup) {
        await signUp(email.trim(), password, fullName.trim());
        setMessage("Check your email to verify your account, then return to sign in.");
      } else {
        await signIn(email.trim(), password);
        navigate(sessionStorage.getItem("bontraco_invite_token") ? "/accept-invite" : "/app");
      }
    } catch (cause) {
      setError(authErrorMessage(cause, mode));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-panel">
        <Brand />
        <div className="auth-copy">
          <Link className="back-link" to="/">
            <ArrowLeft /> Back to Bontraco
          </Link>
          <h1>
            {isSignup
              ? "Create your company workspace"
              : isForgot
                ? "Reset your password"
                : isReset
                  ? "Choose a new password"
                  : "Welcome back"}
          </h1>
          <p>
            {isSignup
              ? "Set up the operating system your team will use from first call to final payment."
              : isForgot
                ? "Enter your work email. We’ll send a secure link if it matches an account."
                : isReset
                  ? "Use at least 8 characters, then sign in again on every device."
                  : "Sign in to leads, calls, schedules, customers, and jobs."}
          </p>
        </div>

        {!configured && (
          <div className="inline-alert" role="status">
            <LockKey size={20} weight="duotone" />
            <div>
              <strong>Secure authentication is being connected</strong>
              <span>The production Supabase environment has not been added to this build.</span>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="auth-form">
          {isSignup && (
            <label>
              <span>Full name</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
                required
              />
            </label>
          )}
          {!isReset && (
            <label>
              <span>Work email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
          )}
          {!isForgot && (
            <label>
              <span>{isReset ? "New password" : "Password"}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isSignup || isReset ? "new-password" : "current-password"}
                minLength={8}
                required
              />
              {(isSignup || isReset) && <small>Use at least 8 characters.</small>}
            </label>
          )}
          {isReset && (
            <label>
              <span>Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
          )}
          {mode === "login" && (
            <Link className="auth-help-link" to="/forgot-password">
              Forgot password?
            </Link>
          )}
          {error && (
            <p className="form-message error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="form-message success" role="status">
              {message}
            </p>
          )}
          <button
            className="button button-primary button-large button-full"
            disabled={busy || !configured}
            type="submit"
          >
            {busy
              ? "Please wait"
              : isSignup
                ? "Create workspace"
                : isForgot
                  ? "Send reset link"
                  : isReset
                    ? "Update password"
                    : "Sign in"}
            {!busy && <ArrowRight weight="bold" />}
          </button>
        </form>
        <p className="auth-switch">
          {isSignup
            ? "Already have an account?"
            : isForgot || isReset
              ? "Ready to continue?"
              : "New to Bontraco?"}{" "}
          <Link to={isSignup || isForgot || isReset ? "/login" : "/signup"}>
            {isSignup || isForgot || isReset ? "Sign in" : "Create a workspace"}
          </Link>
        </p>
      </section>

      <aside className="auth-visual">
        <div className="auth-proof">
          <PhoneCall size={32} weight="duotone" />
          <h2>When the phone rings, Bontraco is ready.</h2>
          <p>
            Qualify the request, book the next step, and give your team a complete record before
            they answer.
          </p>
        </div>
      </aside>
    </main>
  );
}
