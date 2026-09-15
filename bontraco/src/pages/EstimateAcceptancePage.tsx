import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { Printer } from "@phosphor-icons/react/Printer";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  EstimateProposal,
  type EstimateAcceptance,
  type EstimateProposalDocument,
} from "../components/EstimateProposal";
import { withAuthRequestDeadline } from "../lib/auth-request-deadline";
import { estimateAcceptanceErrorMessage } from "../lib/estimate-acceptance-error";
import { proposalLogoUrl } from "../lib/proposal-branding";
import { useDocumentTitle } from "../lib/use-document-title";

type SharePayload = {
  company?: Record<string, unknown>;
  customer?: Record<string, unknown>;
  property?: Record<string, unknown>;
  job?: Record<string, unknown>;
  estimate?: Record<string, unknown>;
  items?: Array<Record<string, unknown>>;
  share?: Record<string, unknown>;
};

const acceptanceStatement =
  "I reviewed and accept this estimate, including its scope, price, and terms.";
export const estimateShareRequestTimeoutMs = 30_000;

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function nullableText(value: unknown) {
  const normalized = text(value);
  return normalized || null;
}

function number(value: unknown) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

export function proposalFromShare(payload: SharePayload): EstimateProposalDocument {
  const company = payload.company || {};
  const customer = payload.customer || {};
  const property = payload.property || {};
  const job = payload.job || {};
  const estimate = payload.estimate || {};
  const customerName =
    text(customer.company_name) ||
    [text(customer.first_name), text(customer.last_name)].filter(Boolean).join(" ") ||
    "Customer";
  const locality = [text(property.city), text(property.region), text(property.postal_code)]
    .filter(Boolean)
    .join(" ");
  const propertyAddress = [text(property.address_line_1), text(property.address_line_2), locality]
    .filter(Boolean)
    .join(", ");

  return {
    companyName: text(company.name, "Service provider"),
    legalName: text(company.legal_name, text(company.name, "Service provider")),
    businessPhone: nullableText(company.phone),
    businessEmail: nullableText(company.email),
    businessWebsite: nullableText(company.website),
    logoUrl: proposalLogoUrl(company.logo_path),
    accentColor: /^#[0-9a-f]{6}$/i.test(text(company.accent_color))
      ? text(company.accent_color)
      : "#2864DC",
    customerName,
    customerPhone: nullableText(customer.phone),
    customerEmail: nullableText(customer.email),
    jobTitle: text(job.title, "Proposed work"),
    propertyAddress: propertyAddress || "Service location not specified",
    estimate: {
      estimate_number: text(estimate.number, "Estimate"),
      status: text(payload.share?.status, text(estimate.status, "sent")),
      subtotal: number(estimate.subtotal),
      tax_amount: number(estimate.tax_amount),
      total: number(estimate.total),
      valid_until: nullableText(estimate.valid_until),
      customer_note: nullableText(estimate.customer_note),
      terms: nullableText(estimate.terms),
      created_at: text(estimate.issued_at, text(estimate.created_at, new Date().toISOString())),
    },
    items: (payload.items || []).map((item, index) => ({
      id: `proposal-item-${index + 1}`,
      description: text(item.description, "Scope item"),
      quantity: number(item.quantity),
      unit: text(item.unit, "each"),
      unit_price: number(item.unit_price),
      taxable: item.taxable !== false,
      line_total: number(item.line_total),
    })),
  };
}

function acceptanceFromShare(payload: SharePayload): EstimateAcceptance | null {
  const acceptedAt = text(payload.share?.accepted_at);
  const signerName = text(payload.share?.signer_name);
  if (!acceptedAt || !signerName) return null;
  return {
    acceptedAt,
    signerName,
    signerEmail: nullableText(payload.share?.signer_email),
  };
}

export function EstimateAcceptancePage() {
  useDocumentTitle("Review estimate | Bontraco");
  const token = useMemo(() => window.location.hash.slice(1), []);
  const tokenValid = /^[A-Za-z0-9_-]{43}$/.test(token);
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [loading, setLoading] = useState(tokenValid);
  const [error, setError] = useState(
    tokenValid ? "" : "This estimate link is unavailable or incomplete.",
  );
  const [submitting, setSubmitting] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const createdRobots = !robots;
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.append(robots);
    }
    const previousRobots = robots.content;
    robots.content = "noindex,nofollow,noarchive";
    const controller = new AbortController();
    if (tokenValid) {
      void (async () => {
        try {
          const response = await withAuthRequestDeadline(
            fetch("/.netlify/functions/estimate-share-read", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ token }),
              signal: controller.signal,
            }),
            estimateShareRequestTimeoutMs,
          );
          const result = (await withAuthRequestDeadline(
            response.json().catch(() => ({})),
            estimateShareRequestTimeoutMs,
          )) as {
            estimate?: SharePayload;
            error?: string;
          };
          if (!response.ok || !result.estimate) {
            throw new Error(result.error || "This estimate link is unavailable or expired.");
          }
          if (!controller.signal.aborted) {
            setPayload(result.estimate);
            setSignerEmail(text(result.estimate.customer?.email));
          }
        } catch (reason) {
          if (reason instanceof DOMException && reason.name === "AbortError") return;
          if (!controller.signal.aborted) setError(estimateAcceptanceErrorMessage(reason, "load"));
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
    }
    return () => {
      controller.abort();
      if (createdRobots) robots?.remove();
      else if (robots) robots.content = previousRobots;
    };
  }, [token, tokenValid]);

  async function acceptEstimate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await withAuthRequestDeadline(
        fetch("/.netlify/functions/estimate-share-accept", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            token,
            signer_name: signerName,
            signer_email: signerEmail,
            acknowledged,
          }),
        }),
        estimateShareRequestTimeoutMs,
      );
      const result = (await withAuthRequestDeadline(
        response.json().catch(() => ({})),
        estimateShareRequestTimeoutMs,
      )) as {
        estimate?: SharePayload;
        error?: string;
      };
      if (!response.ok || !result.estimate) {
        throw new Error(result.error || "This estimate could not be accepted.");
      }
      setPayload(result.estimate);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      setError(estimateAcceptanceErrorMessage(reason, "accept"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="estimate-customer-state" aria-live="polite">
        <div className="brand-mark">B</div>
        <h1>Loading your estimate</h1>
        <p>Bontraco is opening the secure proposal.</p>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="estimate-customer-state" aria-live="polite">
        <div className="brand-mark">B</div>
        <h1>Estimate unavailable</h1>
        <p>{error || "Ask the company that sent this estimate for a new customer link."}</p>
      </main>
    );
  }

  const proposal = proposalFromShare(payload);
  const acceptance = acceptanceFromShare(payload);

  return (
    <main className="estimate-customer-page">
      <header className="estimate-customer-toolbar">
        <a className="brand" href="#proposal" aria-label="Bontraco estimate">
          <span className="brand-mark">B</span>
          <span className="brand-name">Bontraco</span>
        </a>
        <button className="button button-secondary" type="button" onClick={() => window.print()}>
          <Printer /> Print or save PDF
        </button>
      </header>
      <section className="estimate-customer-shell" id="proposal">
        {acceptance && (
          <div className="estimate-accepted-banner" role="status">
            <CheckCircle weight="fill" />
            <div>
              <strong>Estimate accepted</strong>
              <span>
                {acceptance.signerName} accepted on{" "}
                {new Date(acceptance.acceptedAt).toLocaleString()}.
              </span>
            </div>
          </div>
        )}
        <EstimateProposal document={proposal} acceptance={acceptance} />
        {!acceptance && (
          <form className="estimate-acceptance-card" onSubmit={acceptEstimate}>
            <div>
              <p className="eyebrow">Customer approval</p>
              <h2>Accept this estimate</h2>
              <p>
                Enter the name of the person approving the work. Bontraco records the accepted
                proposal and time for the company that sent it.
              </p>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <label>
              <span>Full name</span>
              <input
                required
                autoComplete="name"
                minLength={2}
                maxLength={120}
                value={signerName}
                onChange={(event) => setSignerName(event.target.value)}
              />
            </label>
            <label>
              <span>Email (optional)</span>
              <input
                type="email"
                autoComplete="email"
                maxLength={254}
                value={signerEmail}
                onChange={(event) => setSignerEmail(event.target.value)}
              />
            </label>
            <label className="estimate-acceptance-check">
              <input
                required
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              <span>{acceptanceStatement}</span>
            </label>
            <button className="button button-primary" disabled={submitting}>
              {submitting ? "Recording acceptance…" : "Accept estimate"}
            </button>
            <small>
              Only accept if you are authorized to approve this work. Contact the sender before
              accepting if anything needs to change.
            </small>
          </form>
        )}
      </section>
    </main>
  );
}
