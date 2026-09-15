import type { CSSProperties } from "react";

export type EstimateProposalItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  taxable: boolean;
  line_total: number;
};

export type EstimateProposalDocument = {
  estimate: {
    estimate_number: string;
    status: string;
    subtotal: number;
    tax_amount: number;
    total: number;
    valid_until: string | null;
    customer_note: string | null;
    terms: string | null;
    created_at: string;
  };
  items: EstimateProposalItem[];
  companyName: string;
  legalName: string;
  jobTitle: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  propertyAddress: string;
  businessPhone: string | null;
  businessEmail: string | null;
  businessWebsite: string | null;
  logoUrl: string | null;
  accentColor: string;
};

export type EstimateAcceptance = {
  acceptedAt: string;
  signerName: string;
  signerEmail?: string | null;
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function proposalContrastText(hexColor: string) {
  const red = Number.parseInt(hexColor.slice(1, 3), 16);
  const green = Number.parseInt(hexColor.slice(3, 5), 16);
  const blue = Number.parseInt(hexColor.slice(5, 7), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.58 ? "#172235" : "#FFFFFF";
}

export function EstimateProposal({
  document,
  acceptance,
}: {
  document: EstimateProposalDocument;
  acceptance?: EstimateAcceptance | null;
}) {
  return (
    <article
      className="estimate-document-sheet"
      style={{ "--proposal-accent": document.accentColor } as CSSProperties}
    >
      <header className="estimate-document-header">
        <div className="estimate-document-brand">
          {document.logoUrl ? (
            <img src={document.logoUrl} alt={`${document.companyName} logo`} />
          ) : (
            <span style={{ color: proposalContrastText(document.accentColor) }}>
              {document.companyName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <strong>{document.companyName}</strong>
            <small>{document.legalName}</small>
            {(document.businessPhone || document.businessEmail) && (
              <span className="estimate-document-brand-contact">
                {[document.businessPhone, document.businessEmail].filter(Boolean).join(" · ")}
              </span>
            )}
            {document.businessWebsite && (
              <a
                className="estimate-document-brand-contact"
                href={document.businessWebsite}
                target="_blank"
                rel="noreferrer"
              >
                {document.businessWebsite.replace(/^https:\/\//, "")}
              </a>
            )}
          </div>
        </div>
        <div className="estimate-document-number">
          <p>Estimate</p>
          <h2 id="estimate-document-title">{document.estimate.estimate_number}</h2>
          <span>{acceptance ? "accepted" : document.estimate.status}</span>
        </div>
      </header>
      <div className="estimate-document-meta">
        <section>
          <p>Prepared for</p>
          <strong>{document.customerName}</strong>
          {document.customerPhone && <span>{document.customerPhone}</span>}
          {document.customerEmail && <span>{document.customerEmail}</span>}
        </section>
        <section>
          <p>Project</p>
          <strong>{document.jobTitle}</strong>
          <span>{document.propertyAddress}</span>
        </section>
        <section>
          <p>Dates</p>
          <span>Issued {new Date(document.estimate.created_at).toLocaleDateString()}</span>
          <span>
            {document.estimate.valid_until
              ? `Valid through ${new Date(`${document.estimate.valid_until}T00:00:00`).toLocaleDateString()}`
              : "Validity date not specified"}
          </span>
        </section>
      </div>
      <div className="estimate-document-table-wrap">
        <table className="estimate-document-table">
          <thead>
            <tr>
              <th>Scope</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {document.items.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.description}
                  {!item.taxable && <small>Non-taxable</small>}
                </td>
                <td>{Number(item.quantity).toLocaleString()}</td>
                <td>{item.unit}</td>
                <td>{money.format(Number(item.unit_price))}</td>
                <td>{money.format(Number(item.line_total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="estimate-document-summary">
        <div>
          {document.estimate.customer_note && (
            <section>
              <p>Note</p>
              <span>{document.estimate.customer_note}</span>
            </section>
          )}
        </div>
        <dl>
          <div>
            <dt>Subtotal</dt>
            <dd>{money.format(Number(document.estimate.subtotal))}</dd>
          </div>
          <div>
            <dt>Tax</dt>
            <dd>{money.format(Number(document.estimate.tax_amount))}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{money.format(Number(document.estimate.total))}</dd>
          </div>
        </dl>
      </div>
      {document.estimate.terms && (
        <section className="estimate-document-terms">
          <p>Terms and conditions</p>
          <span>{document.estimate.terms}</span>
        </section>
      )}
      <div className={`estimate-document-acceptance${acceptance ? " is-signed" : ""}`}>
        {acceptance ? (
          <>
            <span>
              Accepted by <strong>{acceptance.signerName}</strong>
              {acceptance.signerEmail ? ` · ${acceptance.signerEmail}` : ""}
            </span>
            <span>{new Date(acceptance.acceptedAt).toLocaleString()}</span>
          </>
        ) : (
          <>
            <span>Customer acceptance</span>
            <span>Date</span>
          </>
        )}
      </div>
      <footer>
        Prepared with Bontraco · Review the scope, amounts, and terms before acceptance.
      </footer>
    </article>
  );
}
