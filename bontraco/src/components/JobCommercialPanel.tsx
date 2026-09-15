import { CheckCircle } from "@phosphor-icons/react/CheckCircle";
import { Copy } from "@phosphor-icons/react/Copy";
import { CurrencyDollar } from "@phosphor-icons/react/CurrencyDollar";
import { FileText } from "@phosphor-icons/react/FileText";
import { Plus } from "@phosphor-icons/react/Plus";
import { Printer } from "@phosphor-icons/react/Printer";
import { Receipt } from "@phosphor-icons/react/Receipt";
import { Trash } from "@phosphor-icons/react/Trash";
import { X } from "@phosphor-icons/react/X";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { withAuthRequestDeadline } from "../lib/auth-request-deadline";
import { commercialErrorMessage } from "../lib/commercial-error";
import { getSupabase } from "../lib/supabase";
import { proposalLogoUrl } from "../lib/proposal-branding";
import { useModalFocus } from "../lib/use-modal-focus";
import { useWorkspace } from "../workspace/WorkspaceContext";
import {
  EstimateProposal,
  type EstimateProposalDocument,
  type EstimateProposalItem,
} from "./EstimateProposal";
import { InvoiceDocument, type InvoiceDocumentData } from "./InvoiceDocument";

type Estimate = {
  id: string;
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
type EstimateDefaults = {
  taxRate: string;
  validDays: number;
  customerNote: string;
  terms: string;
};
type Invoice = {
  id: string;
  estimate_id: string | null;
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
type EstimateLineDraft = {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  taxable: boolean;
};
let nextEstimateLineId = 0;
function createEstimateLine(): EstimateLineDraft {
  nextEstimateLineId += 1;
  return {
    id: `estimate-line-${nextEstimateLineId}`,
    description: "",
    quantity: "1",
    unit: "each",
    unitPrice: "",
    taxable: true,
  };
}
const blankEstimateDefaults: EstimateDefaults = {
  taxRate: "0",
  validDays: 30,
  customerNote: "",
  terms: "",
};
function createEstimateDraft(defaults: EstimateDefaults = blankEstimateDefaults) {
  const validUntil = new Date(Date.now() + defaults.validDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return {
    lines: [createEstimateLine()],
    taxRate: defaults.taxRate,
    validUntil,
    customerNote: defaults.customerNote,
    terms: defaults.terms,
  };
}
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export function JobCommercialPanel({ jobId }: { jobId: string }) {
  const { demoMode, session, user } = useAuth();
  const { workspace } = useWorkspace();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showEstimateForm, setShowEstimateForm] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<string | null>(null);
  const [estimateDocument, setEstimateDocument] = useState<EstimateProposalDocument | null>(null);
  const [invoiceDocument, setInvoiceDocument] = useState<InvoiceDocumentData | null>(null);
  const [documentLoadingId, setDocumentLoadingId] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [sharingEstimateId, setSharingEstimateId] = useState("");
  const [copyingShareLink, setCopyingShareLink] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { dialogRef: estimateDialogRef, rememberOpener: rememberEstimateOpener } =
    useModalFocus<HTMLElement>(Boolean(estimateDocument));
  const { dialogRef: invoiceDialogRef, rememberOpener: rememberInvoiceOpener } =
    useModalFocus<HTMLElement>(Boolean(invoiceDocument));
  const [estimateDefaults, setEstimateDefaults] = useState<EstimateDefaults>(blankEstimateDefaults);
  const [draft, setDraft] = useState(createEstimateDraft);
  const [payment, setPayment] = useState({ amount: "", method: "card", note: "" });
  const latestCommercialRequestId = useRef(0);
  const latestDocumentRequestId = useRef(0);
  const canRecordPayment = ["owner", "admin", "dispatcher"].includes(workspace?.role || "");
  const canShareEstimate = ["owner", "admin", "dispatcher", "sales"].includes(
    workspace?.role || "",
  );

  const loadCommercial = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!workspace) return false;
      const requestId = ++latestCommercialRequestId.current;
      if (demoMode && import.meta.env.VITE_DEMO_MODE === "true") {
        const { createDemoCommercialData } = await import("../demo/job-commercial");
        const data = createDemoCommercialData();
        if (requestId !== latestCommercialRequestId.current) return false;
        setEstimates(data.estimates);
        setInvoices(data.invoices);
        setEstimateDefaults(data.estimateDefaults);
        return true;
      }
      try {
        const supabase = await withAuthRequestDeadline(getSupabase());
        if (!supabase) throw new Error("client_unavailable");
        const [estimateResult, invoiceResult, settingsResult] = await withAuthRequestDeadline(
          Promise.all([
            supabase
              .from("estimates")
              .select(
                "id, estimate_number, status, subtotal, tax_amount, total, valid_until, customer_note, terms, created_at",
              )
              .eq("account_id", workspace.id)
              .eq("job_id", jobId)
              .order("created_at", { ascending: false }),
            supabase
              .from("invoices")
              .select(
                "id, estimate_id, invoice_number, status, subtotal, tax_amount, total, amount_paid, balance_due, issued_at, due_date, paid_at, customer_note, created_at",
              )
              .eq("account_id", workspace.id)
              .eq("job_id", jobId)
              .order("created_at", { ascending: false }),
            supabase
              .from("accounts")
              .select(
                "estimate_default_tax_rate,estimate_default_valid_days,estimate_default_customer_note,estimate_default_terms",
              )
              .eq("id", workspace.id)
              .single(),
          ]),
        );
        if (requestId !== latestCommercialRequestId.current) return false;
        if (estimateResult.error || invoiceResult.error || settingsResult.error) {
          if (!silent) setMessage("Bontraco could not load this job's financial records.");
          return false;
        }
        setEstimates((estimateResult.data || []) as Estimate[]);
        setInvoices((invoiceResult.data || []) as Invoice[]);
        setEstimateDefaults({
          taxRate: String(Number(settingsResult.data.estimate_default_tax_rate || 0) * 100),
          validDays: Number(settingsResult.data.estimate_default_valid_days || 30),
          customerNote: settingsResult.data.estimate_default_customer_note || "",
          terms: settingsResult.data.estimate_default_terms || "",
        });
        return true;
      } catch {
        if (!silent && requestId === latestCommercialRequestId.current) {
          setMessage("Bontraco could not load this job's financial records. Try again.");
        }
        return false;
      }
    },
    [demoMode, jobId, workspace],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadCommercial());
  }, [loadCommercial]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      latestDocumentRequestId.current += 1;
      setDocumentLoadingId("");
      setEstimateDocument(null);
      setInvoiceDocument(null);
    });
    return () => {
      latestDocumentRequestId.current += 1;
    };
  }, [jobId, workspace?.id]);

  useEffect(() => {
    if (!estimateDocument && !invoiceDocument) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEstimateDocument(null);
        setInvoiceDocument(null);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [estimateDocument, invoiceDocument]);

  async function loadCommercialDocument(
    itemTable: "estimate_items" | "invoice_items",
    parentColumn: "estimate_id" | "invoice_id",
    recordId: string,
  ) {
    if (!workspace) throw new Error("workspace_unavailable");
    const supabase = await withAuthRequestDeadline(getSupabase());
    if (!supabase) throw new Error("client_unavailable");
    return withAuthRequestDeadline(
      Promise.all([
        supabase
          .from("accounts")
          .select(
            "name,legal_name,business_phone,business_email,business_website,proposal_logo_path,proposal_accent_color",
          )
          .eq("id", workspace.id)
          .single(),
        supabase
          .from("jobs")
          .select(
            "title,contact:contacts(first_name,last_name,company_name,phone,email),property:properties(address_line_1,address_line_2,city,region,postal_code)",
          )
          .eq("account_id", workspace.id)
          .eq("id", jobId)
          .single(),
        supabase
          .from(itemTable)
          .select("id,description,quantity,unit,unit_price,taxable,line_total")
          .eq("account_id", workspace.id)
          .eq(parentColumn, recordId)
          .order("sort_order"),
      ]),
    );
  }

  async function previewEstimate(estimate: Estimate) {
    if (!workspace || documentLoadingId) return;
    const requestId = ++latestDocumentRequestId.current;
    setDocumentLoadingId(estimate.id);
    setMessage("");
    if (demoMode && import.meta.env.VITE_DEMO_MODE === "true") {
      const { createDemoCommercialDocument } = await import("../demo/job-commercial");
      const data = createDemoCommercialDocument();
      if (requestId !== latestDocumentRequestId.current) return;
      setEstimateDocument({
        estimate,
        items: data.items,
        companyName: workspace.name,
        legalName: data.legalName,
        jobTitle: data.jobTitle,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,
        propertyAddress: data.propertyAddress,
        businessPhone: data.businessPhone,
        businessEmail: data.estimateBusinessEmail,
        businessWebsite: data.businessWebsite,
        logoUrl: null,
        accentColor: data.accentColor,
      });
      setDocumentLoadingId("");
      return;
    }
    try {
      const [accountResult, jobResult, itemResult] = await loadCommercialDocument(
        "estimate_items",
        "estimate_id",
        estimate.id,
      );
      if (requestId !== latestDocumentRequestId.current) return;
      if (accountResult.error || jobResult.error || itemResult.error) {
        throw new Error("document_read_failed");
      }
      const job = jobResult.data as unknown as {
        title: string;
        contact: {
          first_name: string;
          last_name: string | null;
          company_name: string | null;
          phone: string | null;
          email: string | null;
        } | null;
        property: {
          address_line_1: string;
          address_line_2: string | null;
          city: string;
          region: string;
          postal_code: string | null;
        } | null;
      };
      const customerName =
        job.contact?.company_name ||
        [job.contact?.first_name, job.contact?.last_name].filter(Boolean).join(" ") ||
        "Customer";
      const propertyAddress = job.property
        ? [
            job.property.address_line_1,
            job.property.address_line_2,
            [job.property.city, job.property.region, job.property.postal_code]
              .filter(Boolean)
              .join(" "),
          ]
            .filter(Boolean)
            .join(", ")
        : "Service location not specified";
      setEstimateDocument({
        estimate,
        items: (itemResult.data || []) as EstimateProposalItem[],
        companyName: accountResult.data.name,
        legalName: accountResult.data.legal_name || accountResult.data.name,
        jobTitle: job.title,
        customerName,
        customerPhone: job.contact?.phone || null,
        customerEmail: job.contact?.email || null,
        propertyAddress,
        businessPhone: accountResult.data.business_phone || null,
        businessEmail: accountResult.data.business_email || null,
        businessWebsite: accountResult.data.business_website || null,
        logoUrl: proposalLogoUrl(accountResult.data.proposal_logo_path),
        accentColor: accountResult.data.proposal_accent_color || "#0F5B4F",
      });
    } catch {
      if (requestId === latestDocumentRequestId.current) {
        setMessage("Bontraco could not assemble this estimate document. Try again.");
      }
    } finally {
      if (requestId === latestDocumentRequestId.current) setDocumentLoadingId("");
    }
  }

  async function previewInvoice(invoice: Invoice) {
    if (!workspace || documentLoadingId) return;
    const requestId = ++latestDocumentRequestId.current;
    setDocumentLoadingId(invoice.id);
    setMessage("");
    if (demoMode && import.meta.env.VITE_DEMO_MODE === "true") {
      const { createDemoCommercialDocument } = await import("../demo/job-commercial");
      const data = createDemoCommercialDocument();
      if (requestId !== latestDocumentRequestId.current) return;
      setInvoiceDocument({
        invoice,
        items: data.items,
        companyName: workspace.name,
        legalName: data.legalName,
        logoUrl: null,
        jobTitle: data.jobTitle,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,
        propertyAddress: data.propertyAddress,
        businessPhone: data.businessPhone,
        businessEmail: data.invoiceBusinessEmail,
        businessWebsite: data.businessWebsite,
        accentColor: data.accentColor,
      });
      setDocumentLoadingId("");
      return;
    }
    try {
      const [accountResult, jobResult, itemResult] = await loadCommercialDocument(
        "invoice_items",
        "invoice_id",
        invoice.id,
      );
      if (requestId !== latestDocumentRequestId.current) return;
      if (accountResult.error || jobResult.error || itemResult.error) {
        throw new Error("document_read_failed");
      }
      const job = jobResult.data as unknown as {
        title: string;
        contact: {
          first_name: string;
          last_name: string | null;
          company_name: string | null;
          phone: string | null;
          email: string | null;
        } | null;
        property: {
          address_line_1: string;
          address_line_2: string | null;
          city: string;
          region: string;
          postal_code: string | null;
        } | null;
      };
      const customerName =
        job.contact?.company_name ||
        [job.contact?.first_name, job.contact?.last_name].filter(Boolean).join(" ") ||
        "Customer";
      const propertyAddress = job.property
        ? [
            job.property.address_line_1,
            job.property.address_line_2,
            [job.property.city, job.property.region, job.property.postal_code]
              .filter(Boolean)
              .join(" "),
          ]
            .filter(Boolean)
            .join(", ")
        : "Service location not specified";
      setInvoiceDocument({
        invoice,
        items: (itemResult.data || []) as EstimateProposalItem[],
        companyName: accountResult.data.name,
        legalName: accountResult.data.legal_name || accountResult.data.name,
        logoUrl: proposalLogoUrl(accountResult.data.proposal_logo_path),
        jobTitle: job.title,
        customerName,
        customerPhone: job.contact?.phone || null,
        customerEmail: job.contact?.email || null,
        propertyAddress,
        businessPhone: accountResult.data.business_phone || null,
        businessEmail: accountResult.data.business_email || null,
        businessWebsite: accountResult.data.business_website || null,
        accentColor: accountResult.data.proposal_accent_color || "#0F5B4F",
      });
    } catch {
      if (requestId === latestDocumentRequestId.current) {
        setMessage("Bontraco could not assemble this invoice document. Try again.");
      }
    } finally {
      if (requestId === latestDocumentRequestId.current) setDocumentLoadingId("");
    }
  }

  async function createEstimate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace || !user || demoMode || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const estimateNumber = `EST-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Date.now().toString().slice(-4)}`;
      const { error } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase.rpc("create_bontraco_estimate", {
            target_account_id: workspace.id,
            target_job_id: jobId,
            target_estimate_number: estimateNumber,
            target_tax_rate: Number(draft.taxRate || 0) / 100,
            target_valid_until: draft.validUntil || null,
            target_customer_note: draft.customerNote.trim() || null,
            target_terms: draft.terms.trim() || null,
            target_items: draft.lines.map((line) => ({
              description: line.description.trim(),
              quantity: Number(line.quantity),
              unit: line.unit.trim() || "each",
              unit_price: Number(line.unitPrice),
              taxable: line.taxable,
            })),
          }),
        ),
      );
      if (error) throw error;
      setDraft(createEstimateDraft(estimateDefaults));
      setShowEstimateForm(false);
      setMessage("Multi-line draft estimate created atomically.");
      if (!(await loadCommercial({ silent: true }))) {
        setMessage(
          "The estimate was created, but financial records could not refresh. Reload Bontraco.",
        );
      }
    } catch (error) {
      setMessage(commercialErrorMessage(error, "estimate_create"));
    } finally {
      setBusy(false);
    }
  }

  async function updateEstimateStatus(estimate: Estimate, status: string) {
    if (!workspace || demoMode || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const dates =
        status === "sent"
          ? { sent_at: new Date().toISOString() }
          : status === "accepted"
            ? { accepted_at: new Date().toISOString() }
            : {};
      const { error } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase
            .from("estimates")
            .update({ status, ...dates })
            .eq("account_id", workspace.id)
            .eq("id", estimate.id),
        ),
      );
      if (error) throw error;
      if (!(await loadCommercial({ silent: true }))) {
        setMessage(
          "The estimate status was saved, but financial records could not refresh. Reload Bontraco.",
        );
      }
    } catch (error) {
      setMessage(commercialErrorMessage(error, "estimate_status"));
    } finally {
      setBusy(false);
    }
  }

  async function createInvoice(estimate: Estimate) {
    if (demoMode || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase.rpc("create_invoice_from_estimate", {
            target_estimate_id: estimate.id,
            target_invoice_number: estimate.estimate_number.replace(/^EST-/, "INV-"),
            target_due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
          }),
        ),
      );
      if (error) throw error;
      setMessage("Invoice created from the accepted estimate.");
      if (!(await loadCommercial({ silent: true }))) {
        setMessage(
          "The invoice was created, but financial records could not refresh. Reload Bontraco.",
        );
      }
    } catch (error) {
      setMessage(commercialErrorMessage(error, "invoice_create"));
    } finally {
      setBusy(false);
    }
  }

  async function createCustomerLink(estimate: Estimate) {
    if (!workspace || !session?.access_token || demoMode || sharingEstimateId || busy) return;
    setSharingEstimateId(estimate.id);
    setMessage("");
    setShareLink("");
    try {
      const response = await withAuthRequestDeadline(
        fetch("/.netlify/functions/estimate-share-create", {
          method: "POST",
          headers: {
            authorization: `Bearer ${session.access_token}`,
            "content-type": "application/json",
            "x-bontraco-workspace-id": workspace.id,
          },
          body: JSON.stringify({ estimate_id: estimate.id }),
        }),
      );
      const payload = (await withAuthRequestDeadline(response.json().catch(() => ({})))) as {
        share_url?: string;
        error?: string;
      };
      if (!response.ok || !payload.share_url) {
        throw new Error(payload.error || "Customer link creation failed.");
      }
      setShareLink(payload.share_url);
      setMessage("Customer link created. Copy it now—Bontraco does not store the secret link.");
      if (!(await loadCommercial({ silent: true }))) {
        setMessage(
          "Customer link created, but financial records could not refresh. Copy the link now, then reload Bontraco.",
        );
      }
    } catch (error) {
      setMessage(commercialErrorMessage(error, "share"));
    } finally {
      setSharingEstimateId("");
    }
  }

  async function copyCustomerLink() {
    if (!shareLink || copyingShareLink) return;
    setCopyingShareLink(true);
    try {
      if (!navigator.clipboard) throw new Error("clipboard_unavailable");
      await withAuthRequestDeadline(navigator.clipboard.writeText(shareLink));
      setMessage("Customer link copied to the clipboard.");
    } catch {
      setMessage("Bontraco could not copy this link automatically. Select and copy it manually.");
    } finally {
      setCopyingShareLink(false);
    }
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace || !user || !paymentInvoice || demoMode || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase.from("payments").insert({
            account_id: workspace.id,
            invoice_id: paymentInvoice,
            amount: Number(payment.amount),
            method: payment.method,
            note: payment.note.trim() || null,
            created_by: user.id,
          }),
        ),
      );
      if (error) throw error;
      setPayment({ amount: "", method: "card", note: "" });
      setPaymentInvoice(null);
      setMessage("Payment recorded and invoice balance updated.");
      if (!(await loadCommercial({ silent: true }))) {
        setMessage(
          "The payment was recorded, but financial records could not refresh. Reload Bontraco.",
        );
      }
    } catch (error) {
      setMessage(commercialErrorMessage(error, "payment"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="job-detail-section commercial-panel">
        <div className="job-detail-heading">
          <div>
            <CurrencyDollar />
            <strong>Estimates & invoices</strong>
          </div>
          <button
            className="mini-action"
            onClick={() =>
              setShowEstimateForm((value) => {
                if (!value) setDraft(createEstimateDraft(estimateDefaults));
                return !value;
              })
            }
            disabled={demoMode}
          >
            <Plus /> Estimate
          </button>
        </div>
        {message && (
          <p className="commercial-message" role="status">
            {message}
          </p>
        )}
        {shareLink && (
          <div className="estimate-share-result" role="group" aria-label="Customer estimate link">
            <div>
              <strong>Secure customer link</strong>
              <span>
                Anyone with this link can review and accept the estimate. A replacement link
                invalidates the previous one.
              </span>
            </div>
            <input aria-label="Customer estimate link" value={shareLink} readOnly />
            <button
              type="button"
              className="button button-primary"
              disabled={copyingShareLink}
              onClick={() => void copyCustomerLink()}
            >
              <Copy /> {copyingShareLink ? "Copying…" : "Copy link"}
            </button>
          </div>
        )}
        {showEstimateForm && (
          <form className="commercial-form" onSubmit={createEstimate}>
            <div className="estimate-lines wide">
              <div className="estimate-lines-heading">
                <div>
                  <strong>Scope and pricing</strong>
                  <span>Up to 50 line items</span>
                </div>
                <button
                  type="button"
                  className="mini-action"
                  disabled={draft.lines.length >= 50}
                  onClick={() =>
                    setDraft({ ...draft, lines: [...draft.lines, createEstimateLine()] })
                  }
                >
                  <Plus /> Add line
                </button>
              </div>
              {draft.lines.map((line, index) => (
                <div className="estimate-line-editor" key={line.id}>
                  <label className="estimate-line-description">
                    <span>Description</span>
                    <input
                      required
                      maxLength={500}
                      value={line.description}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          lines: draft.lines.map((item) =>
                            item.id === line.id
                              ? { ...item, description: event.target.value }
                              : item,
                          ),
                        })
                      }
                      placeholder="Architectural shingle roof replacement"
                    />
                  </label>
                  <label>
                    <span>Quantity</span>
                    <input
                      required
                      type="number"
                      min="0.001"
                      max="1000000"
                      step="0.001"
                      value={line.quantity}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          lines: draft.lines.map((item) =>
                            item.id === line.id ? { ...item, quantity: event.target.value } : item,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Unit</span>
                    <input
                      required
                      maxLength={30}
                      value={line.unit}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          lines: draft.lines.map((item) =>
                            item.id === line.id ? { ...item, unit: event.target.value } : item,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Unit price</span>
                    <input
                      required
                      type="number"
                      min="0"
                      max="100000000"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          lines: draft.lines.map((item) =>
                            item.id === line.id ? { ...item, unitPrice: event.target.value } : item,
                          ),
                        })
                      }
                    />
                  </label>
                  <label className="estimate-taxable">
                    <input
                      type="checkbox"
                      checked={line.taxable}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          lines: draft.lines.map((item) =>
                            item.id === line.id ? { ...item, taxable: event.target.checked } : item,
                          ),
                        })
                      }
                    />
                    <span>Taxable</span>
                  </label>
                  <button
                    type="button"
                    className="estimate-line-remove"
                    aria-label={`Remove estimate line ${index + 1}`}
                    disabled={draft.lines.length === 1}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        lines: draft.lines.filter((item) => item.id !== line.id),
                      })
                    }
                  >
                    <Trash />
                  </button>
                </div>
              ))}
            </div>
            <label>
              <span>Tax rate %</span>
              <input
                required
                type="number"
                min="0"
                max="100"
                step="0.001"
                value={draft.taxRate}
                onChange={(event) => setDraft({ ...draft, taxRate: event.target.value })}
              />
            </label>
            <label className="wide">
              <span>Customer note</span>
              <textarea
                rows={2}
                maxLength={2000}
                value={draft.customerNote}
                onChange={(event) => setDraft({ ...draft, customerNote: event.target.value })}
                placeholder="Thank the customer or explain the proposed scope"
              />
            </label>
            <label className="wide">
              <span>Terms</span>
              <textarea
                rows={3}
                maxLength={5000}
                value={draft.terms}
                onChange={(event) => setDraft({ ...draft, terms: event.target.value })}
                placeholder="Payment schedule, exclusions, warranty, and change-order terms"
              />
            </label>
            <label>
              <span>Valid until</span>
              <input
                type="date"
                value={draft.validUntil}
                onChange={(event) => setDraft({ ...draft, validUntil: event.target.value })}
              />
            </label>
            <button className="button button-primary wide" disabled={busy}>
              {busy ? "Creating…" : "Create draft estimate"}
            </button>
          </form>
        )}
        <div className="commercial-list">
          {estimates.length === 0 ? (
            <p className="detail-state">No estimates yet.</p>
          ) : (
            estimates.map((estimate) => {
              const invoiced = invoices.some((invoice) => invoice.estimate_id === estimate.id);
              return (
                <article key={estimate.id}>
                  <div className="commercial-record-icon">
                    <FileText />
                  </div>
                  <div className="commercial-record-main">
                    <strong>{estimate.estimate_number}</strong>
                    <span>
                      {new Date(estimate.created_at).toLocaleDateString()} ·{" "}
                      {money.format(Number(estimate.total))}
                    </span>
                  </div>
                  <select
                    aria-label={`Status for ${estimate.estimate_number}`}
                    value={estimate.status}
                    disabled={busy || demoMode || invoiced}
                    onChange={(event) => void updateEstimateStatus(estimate, event.target.value)}
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="viewed">Viewed</option>
                    <option value="accepted">Accepted</option>
                    <option value="declined">Declined</option>
                    <option value="expired">Expired</option>
                    <option value="void">Void</option>
                  </select>
                  <button
                    className="mini-action"
                    disabled={Boolean(documentLoadingId)}
                    onClick={(event) => {
                      rememberEstimateOpener(event.currentTarget);
                      void previewEstimate(estimate);
                    }}
                  >
                    <FileText />
                    {documentLoadingId === estimate.id ? "Loading…" : "Preview"}
                    <span className="sr-only"> {estimate.estimate_number}</span>
                  </button>
                  {canShareEstimate && ["draft", "sent", "viewed"].includes(estimate.status) && (
                    <button
                      className="mini-action"
                      disabled={demoMode || busy || Boolean(sharingEstimateId)}
                      onClick={() => void createCustomerLink(estimate)}
                      title="Creating a new link invalidates the previous active link"
                    >
                      {sharingEstimateId === estimate.id ? "Creating link…" : "Customer link"}
                    </button>
                  )}
                  {estimate.status === "accepted" && !invoiced && (
                    <button
                      className="mini-action"
                      disabled={busy || demoMode}
                      onClick={() => void createInvoice(estimate)}
                    >
                      Create invoice
                    </button>
                  )}
                  {invoiced && (
                    <span className="record-complete">
                      <CheckCircle /> Invoiced
                    </span>
                  )}
                </article>
              );
            })
          )}
        </div>
        <div className="commercial-subheading">
          <Receipt />
          <strong>Invoices</strong>
          <span>{invoices.length}</span>
        </div>
        <div className="commercial-list invoices">
          {invoices.length === 0 ? (
            <p className="detail-state">No invoices yet.</p>
          ) : (
            invoices.map((invoice) => (
              <article key={invoice.id}>
                <div className="commercial-record-icon">
                  <Receipt />
                </div>
                <div className="commercial-record-main">
                  <strong>{invoice.invoice_number}</strong>
                  <span>
                    {invoice.status} · {money.format(Number(invoice.amount_paid))} paid
                  </span>
                </div>
                <div className="invoice-balance">
                  <small>Balance</small>
                  <strong>{money.format(Number(invoice.balance_due))}</strong>
                </div>
                <button
                  className="mini-action"
                  disabled={Boolean(documentLoadingId)}
                  onClick={(event) => {
                    rememberInvoiceOpener(event.currentTarget);
                    void previewInvoice(invoice);
                  }}
                >
                  <Receipt />
                  {documentLoadingId === invoice.id ? "Loading…" : "Preview"}
                  <span className="sr-only"> {invoice.invoice_number}</span>
                </button>
                {canRecordPayment && invoice.balance_due > 0 && (
                  <button
                    className="mini-action"
                    disabled={demoMode}
                    onClick={() => {
                      setPaymentInvoice(invoice.id);
                      setPayment({ ...payment, amount: String(invoice.balance_due) });
                    }}
                  >
                    Record payment
                  </button>
                )}
              </article>
            ))
          )}
        </div>
        {paymentInvoice && (
          <form className="payment-form" onSubmit={recordPayment}>
            <label>
              <span>Amount</span>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={payment.amount}
                onChange={(event) => setPayment({ ...payment, amount: event.target.value })}
              />
            </label>
            <label>
              <span>Method</span>
              <select
                value={payment.method}
                onChange={(event) => setPayment({ ...payment, method: event.target.value })}
              >
                <option value="card">Card</option>
                <option value="ach">ACH</option>
                <option value="check">Check</option>
                <option value="cash">Cash</option>
                <option value="financing">Financing</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="wide">
              <span>Note</span>
              <input
                value={payment.note}
                onChange={(event) => setPayment({ ...payment, note: event.target.value })}
                placeholder="Deposit, final payment, check number…"
              />
            </label>
            <div className="payment-actions wide">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setPaymentInvoice(null)}
              >
                Cancel
              </button>
              <button className="button button-primary" disabled={busy}>
                {busy ? "Recording…" : "Record payment"}
              </button>
            </div>
          </form>
        )}
      </section>
      {estimateDocument && (
        <div className="estimate-document-overlay" role="presentation">
          <section
            ref={estimateDialogRef}
            className="estimate-document-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="estimate-document-title"
          >
            <div className="estimate-document-actions">
              <span>Customer estimate preview</span>
              <div>
                <button className="button button-primary" onClick={() => window.print()}>
                  <Printer /> Print or save PDF
                </button>
                <button
                  className="icon-button"
                  aria-label="Close estimate preview"
                  onClick={() => setEstimateDocument(null)}
                >
                  <X />
                </button>
              </div>
            </div>
            <EstimateProposal document={estimateDocument} />
          </section>
        </div>
      )}
      {invoiceDocument && (
        <div className="estimate-document-overlay" role="presentation">
          <section
            ref={invoiceDialogRef}
            className="estimate-document-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-document-title"
          >
            <div className="estimate-document-actions">
              <span>Customer invoice preview</span>
              <div>
                <button className="button button-primary" onClick={() => window.print()}>
                  <Printer /> Print or save PDF
                </button>
                <button
                  className="icon-button"
                  aria-label="Close invoice preview"
                  onClick={() => setInvoiceDocument(null)}
                >
                  <X />
                </button>
              </div>
            </div>
            <InvoiceDocument document={invoiceDocument} />
          </section>
        </div>
      )}
    </>
  );
}
