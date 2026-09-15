import type { CSSProperties } from "react";
import { proposalContrastText, type EstimateProposalItem } from "./EstimateProposal";

export type InvoiceDocumentData = {
  invoice: {
    invoice_number: string;
    status: string;
    subtotal: number;
    tax_amount: number;
    total: number;
    amount_paid: number;
    balance_due: number;
    issued_at: string | null;
    due_date: string | null;
    paid_at: string | null;
    customer_note: string | null;
    created_at: string;
  };
  items: EstimateProposalItem[];
  companyName: string;
  legalName: string;
  logoUrl: string | null;
  jobTitle: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  propertyAddress: string;
  businessPhone: string | null;
  businessEmail: string | null;
  businessWebsite: string | null;
  accentColor: string;
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function InvoiceDocument({ document }: { document: InvoiceDocumentData }) {
  const issuedAt = document.invoice.issued_at || document.invoice.created_at;
  return (
    <article
      className="estimate-document-sheet invoice-document-sheet"
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
          <p>Invoice</p>
          <h2 id="invoice-document-title">{document.invoice.invoice_number}</h2>
          <span>{document.invoice.status}</span>
        </div>
      </header>
      <div className="estimate-document-meta">
        <section>
          <p>Bill to</p>
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
          <span>Issued {new Date(issuedAt).toLocaleDateString()}</span>
          <span>
            {document.invoice.due_date
              ? `Due ${new Date(`${document.invoice.due_date}T00:00:00`).toLocaleDateString()}`
              : "Due on receipt"}
          </span>
        </section>
      </div>
      <div className="estimate-document-table-wrap">
        <table className="estimate-document-table">
          <thead>
            <tr>
              <th>Description</th>
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
      <div className="estimate-document-summary invoice-document-summary">
        <div>
          {document.invoice.customer_note && (
            <section>
              <p>Note</p>
              <span>{document.invoice.customer_note}</span>
            </section>
          )}
          {document.invoice.paid_at && (
            <section className="invoice-paid-note">
              <p>Payment status</p>
              <span>
                Paid in full on {new Date(document.invoice.paid_at).toLocaleDateString()}.
              </span>
            </section>
          )}
        </div>
        <dl>
          <div>
            <dt>Subtotal</dt>
            <dd>{money.format(Number(document.invoice.subtotal))}</dd>
          </div>
          <div>
            <dt>Tax</dt>
            <dd>{money.format(Number(document.invoice.tax_amount))}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{money.format(Number(document.invoice.total))}</dd>
          </div>
          <div className="invoice-payment-row">
            <dt>Payments</dt>
            <dd>−{money.format(Number(document.invoice.amount_paid))}</dd>
          </div>
          <div className="invoice-balance-row">
            <dt>Balance due</dt>
            <dd>{money.format(Number(document.invoice.balance_due))}</dd>
          </div>
        </dl>
      </div>
      <footer>Prepared with Bontraco · Please reference the invoice number with payment.</footer>
    </article>
  );
}
