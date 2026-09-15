import { ArrowRight } from "@phosphor-icons/react/ArrowRight";
import { Buildings } from "@phosphor-icons/react/Buildings";
import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { Wrench } from "@phosphor-icons/react/Wrench";
import { useMemo, useState, type FormEvent } from "react";
import { Brand } from "../components/Brand";
import { withAuthRequestDeadline } from "../lib/auth-request-deadline";
import { onboardingErrorMessage } from "../lib/onboarding-error";
import { toWorkspaceSlug } from "../lib/slug";
import { getSupabase } from "../lib/supabase";
import { useWorkspace } from "../workspace/WorkspaceContext";

const trades = ["roofing", "plumbing", "electrical", "general"] as const;

export function OnboardingPage() {
  const { refresh } = useWorkspace();
  const [companyName, setCompanyName] = useState("");
  const [trade, setTrade] = useState<(typeof trades)[number]>("roofing");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const slug = useMemo(() => toWorkspaceSlug(companyName), [companyName]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slug) return;
    setBusy(true);
    setError("");
    try {
      await withAuthRequestDeadline(
        (async () => {
          const supabase = await getSupabase();
          if (!supabase) throw new Error("Network unavailable");
          const { error: createError } = await supabase.rpc("create_bontraco_account", {
            account_name: companyName.trim(),
            account_slug: slug,
            primary_trade: trade,
          });
          if (createError) throw createError;
        })(),
      );
    } catch (cause) {
      setError(onboardingErrorMessage(cause));
      setBusy(false);
      return;
    }
    try {
      await withAuthRequestDeadline(refresh());
    } catch {
      setError("Your workspace was created, but access could not refresh. Reload Bontraco.");
    }
    setBusy(false);
  }

  return (
    <main className="onboarding-page">
      <Brand />
      <section className="onboarding-card">
        <div className="onboarding-copy">
          <span className="step-label">Workspace setup</span>
          <Buildings size={34} weight="duotone" />
          <h1>Tell us about your company.</h1>
          <p>
            This creates your private Bontraco workspace. You will be its owner and can invite your
            team next.
          </p>
          <ul>
            <li>
              <CheckCircle weight="fill" /> Company data stays separated
            </li>
            <li>
              <CheckCircle weight="fill" /> Role-based access is enforced
            </li>
            <li>
              <CheckCircle weight="fill" /> You control team invitations
            </li>
          </ul>
        </div>
        <form className="onboarding-form" onSubmit={submit}>
          <label>
            <span>Company name</span>
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Example Roofing Company"
              minLength={2}
              maxLength={100}
              required
            />
          </label>
          <fieldset>
            <legend>Primary trade</legend>
            <div className="trade-options">
              {trades.map((item) => (
                <label key={item} className={trade === item ? "selected" : ""}>
                  <input
                    type="radio"
                    name="trade"
                    value={item}
                    checked={trade === item}
                    onChange={() => setTrade(item)}
                  />
                  <Wrench size={20} />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <small>
            Your workspace address will be <strong>{slug || "your-company"}</strong>.
          </small>
          {error && (
            <p className="form-message error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button button-primary button-large button-full"
            disabled={busy || !slug}
          >
            {busy ? "Creating workspace" : "Continue to Bontraco"}
            <ArrowRight weight="bold" />
          </button>
        </form>
      </section>
    </main>
  );
}
