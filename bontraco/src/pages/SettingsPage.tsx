import { ArrowCounterClockwise } from "@phosphor-icons/react/ArrowCounterClockwise";
import { CreditCard } from "@phosphor-icons/react/CreditCard";
import { DownloadSimple } from "@phosphor-icons/react/DownloadSimple";
import { GearSix } from "@phosphor-icons/react/GearSix";
import { ShieldCheck } from "@phosphor-icons/react/ShieldCheck";
import { UploadSimple } from "@phosphor-icons/react/UploadSimple";
import { X } from "@phosphor-icons/react/X";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { verifyAccountExportIntegrity } from "../lib/account-export-integrity";
import { adminOperationErrorMessage } from "../lib/admin-operation-error";
import { withAuthRequestDeadline } from "../lib/auth-request-deadline";
import { verifiedBillingRedirect } from "../lib/billing-redirect";
import { getBillingDeadline } from "../lib/billing-deadline";
import { proposalLogoUrl } from "../lib/proposal-branding";
import { settingsErrorMessage } from "../lib/settings-error";
import { getSupabase } from "../lib/supabase";
import { useModalFocus } from "../lib/use-modal-focus";
import { useWorkspace } from "../workspace/WorkspaceContext";

type Subscription = {
  plan_slug: string;
  status: string;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  past_due_since: string | null;
  grace_ends_at: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
};
type IntegrationStatus = {
  providers: {
    public_web_search: boolean;
    google_places: boolean;
    stripe: boolean;
    retell: boolean;
    operations_alerts: boolean;
  };
  receptionist_workspace: boolean;
};
type DeletionRequest = {
  id: string;
  status: string;
  requested_at: string;
  scheduled_for: string;
};
type ImportReport = {
  source_counts: { clients: number; jobs: number };
  target_counts: { contacts: number; properties: number; jobs: number };
  warnings: string[];
  errors: string[];
};
type ImportBatch = {
  id: string;
  status: string;
  imported_counts: Record<string, number>;
  created_at: string;
};
type LegacyImportResult = {
  available: number;
  inserted: number;
  duplicates: number;
};
type SubscriptionPlan = {
  slug: string;
  display_name: string;
  summary: string;
  monthly_price_cents: number;
  included_users: number;
  included_lead_profiles: number;
};
function formatMonthlyPrice(monthlyPriceCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(monthlyPriceCents / 100);
}

export const exportRequestTimeoutMs = 45_000;
export const importRequestTimeoutMs = 45_000;

export function SettingsPage() {
  const { demoMode } = useAuth();
  const { workspace, refresh } = useWorkspace();
  const [companyName, setCompanyName] = useState(workspace?.name || "");
  const [legalName, setLegalName] = useState(workspace?.name || "");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [serviceArea, setServiceArea] = useState("");
  const [businessHours, setBusinessHours] = useState("");
  const [emergencyRules, setEmergencyRules] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState("");
  const [proposalLogoPath, setProposalLogoPath] = useState("");
  const [proposalAccentColor, setProposalAccentColor] = useState("#0F5B4F");
  const [estimateDefaultTaxRate, setEstimateDefaultTaxRate] = useState("0");
  const [estimateDefaultValidDays, setEstimateDefaultValidDays] = useState("30");
  const [estimateDefaultCustomerNote, setEstimateDefaultCustomerNote] = useState("");
  const [estimateDefaultTerms, setEstimateDefaultTerms] = useState("");
  const [trades, setTrades] = useState<string[]>(workspace?.trades || []);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [deletionRequest, setDeletionRequest] = useState<DeletionRequest | null>(null);
  const [showDeletion, setShowDeletion] = useState(false);
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [importPayload, setImportPayload] = useState<unknown>(null);
  const [importFilename, setImportFilename] = useState("");
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [confirmLegacyImport, setConfirmLegacyImport] = useState(false);
  const [legacyImportResult, setLegacyImportResult] = useState<LegacyImportResult | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const latestSettingsRequestId = useRef(0);
  const { dialogRef: deletionDialogRef, rememberOpener: rememberDeletionOpener } =
    useModalFocus<HTMLElement>(showDeletion);
  const canManage = ["owner", "admin"].includes(workspace?.role || "");

  const refreshImportBatches = useCallback(
    async (expectedRequestId?: number) => {
      if (!workspace || !canManage || demoMode) return false;
      try {
        const supabase = await withAuthRequestDeadline(getSupabase());
        if (!supabase) throw new Error("client_unavailable");
        const { data, error } = await withAuthRequestDeadline(
          Promise.resolve(
            supabase
              .from("data_import_batches")
              .select("id,status,imported_counts,created_at")
              .eq("account_id", workspace.id)
              .order("created_at", { ascending: false })
              .limit(5),
          ),
        );
        if (error) throw error;
        if (expectedRequestId && expectedRequestId !== latestSettingsRequestId.current)
          return false;
        setImportBatches((data || []) as ImportBatch[]);
        return true;
      } catch {
        return false;
      }
    },
    [canManage, demoMode, workspace],
  );

  const loadBilling = useCallback(async () => {
    const requestId = ++latestSettingsRequestId.current;
    if (!workspace || !canManage) return;
    setMessage("");
    setCompanyName(workspace.name);
    setLegalName(workspace.name);
    setTimezone("America/Chicago");
    setServiceArea("");
    setBusinessHours("");
    setEmergencyRules("");
    setBusinessPhone("");
    setBusinessEmail("");
    setBusinessWebsite("");
    setProposalLogoPath("");
    setProposalAccentColor("#0F5B4F");
    setEstimateDefaultTaxRate("0");
    setEstimateDefaultValidDays("30");
    setEstimateDefaultCustomerNote("");
    setEstimateDefaultTerms("");
    setTrades(workspace.trades);
    setSubscription(null);
    setPlans([]);
    setIntegrations(null);
    setDeletionRequest(null);
    setImportBatches([]);
    try {
      if (demoMode && import.meta.env.VITE_DEMO_MODE === "true") {
        const { createDemoSettingsData } = await withAuthRequestDeadline(
          import("../demo/settings"),
        );
        if (requestId !== latestSettingsRequestId.current) return;
        const data = createDemoSettingsData();
        setPlans(data.plans);
        setCompanyName(workspace.name);
        setTrades(workspace.trades);
        setLegalName(data.company.legalName);
        setTimezone(data.company.timezone);
        setServiceArea(data.company.serviceArea);
        setBusinessHours(data.company.businessHours);
        setEmergencyRules(data.company.emergencyRules);
        setBusinessPhone(data.company.businessPhone);
        setBusinessEmail(data.company.businessEmail);
        setBusinessWebsite(data.company.businessWebsite);
        setProposalLogoPath(data.company.proposalLogoPath);
        setProposalAccentColor(data.company.proposalAccentColor);
        setEstimateDefaultTaxRate(data.company.estimateDefaultTaxRate);
        setEstimateDefaultValidDays(data.company.estimateDefaultValidDays);
        setEstimateDefaultCustomerNote(data.company.estimateDefaultCustomerNote);
        setEstimateDefaultTerms(data.company.estimateDefaultTerms);
        setSubscription(data.subscription);
        setIntegrations(data.integrations);
        return;
      }
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const [subscriptionResult, plansResult, accountResult] = await withAuthRequestDeadline(
        Promise.all([
          supabase
            .from("account_subscriptions")
            .select(
              "plan_slug,status,trial_ends_at,current_period_ends_at,past_due_since,grace_ends_at,cancel_at_period_end,stripe_customer_id",
            )
            .eq("account_id", workspace.id)
            .maybeSingle(),
          supabase
            .from("subscription_plans")
            .select(
              "slug,display_name,summary,monthly_price_cents,included_users,included_lead_profiles",
            )
            .eq("active", true)
            .order("sort_order"),
          supabase
            .from("accounts")
            .select(
              "legal_name,timezone,service_area,business_hours,emergency_rules,business_phone,business_email,business_website,proposal_logo_path,proposal_accent_color,estimate_default_tax_rate,estimate_default_valid_days,estimate_default_customer_note,estimate_default_terms",
            )
            .eq("id", workspace.id)
            .single(),
        ]),
      );
      if (subscriptionResult.error || plansResult.error || accountResult.error)
        throw new Error("settings_read_failed");
      const { data: sessionData } = await withAuthRequestDeadline(supabase.auth.getSession());
      const response = await withAuthRequestDeadline(
        fetch("/.netlify/functions/integration-status", {
          headers: {
            authorization: `Bearer ${sessionData.session?.access_token || ""}`,
            "x-bontraco-account-id": workspace.id,
          },
        }),
      );
      if (!response.ok) throw new Error("integration_status_failed");
      const integrationData = (await withAuthRequestDeadline(response.json())) as IntegrationStatus;
      let deletionData: DeletionRequest | null = null;
      if (workspace.role === "owner") {
        const deletionResult = await withAuthRequestDeadline(
          Promise.resolve(
            supabase
              .from("account_deletion_requests")
              .select("id,status,requested_at,scheduled_for")
              .eq("account_id", workspace.id)
              .in("status", ["pending", "approved", "processing"])
              .order("requested_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ),
        );
        if (deletionResult.error) throw deletionResult.error;
        deletionData = deletionResult.data as DeletionRequest | null;
      }
      if (!(await refreshImportBatches(requestId))) throw new Error("import_history_failed");
      if (requestId !== latestSettingsRequestId.current) return;
      setCompanyName(workspace.name);
      setTrades(workspace.trades);
      setSubscription(subscriptionResult.data as Subscription | null);
      setPlans((plansResult.data || []) as SubscriptionPlan[]);
      setLegalName(accountResult.data.legal_name || workspace.name);
      setTimezone(accountResult.data.timezone || "America/Chicago");
      setServiceArea(accountResult.data.service_area || "");
      setBusinessHours(accountResult.data.business_hours || "");
      setEmergencyRules(accountResult.data.emergency_rules || "");
      setBusinessPhone(accountResult.data.business_phone || "");
      setBusinessEmail(accountResult.data.business_email || "");
      setBusinessWebsite(accountResult.data.business_website || "");
      setProposalLogoPath(accountResult.data.proposal_logo_path || "");
      setProposalAccentColor(accountResult.data.proposal_accent_color || "#0F5B4F");
      setEstimateDefaultTaxRate(
        String(Number(accountResult.data.estimate_default_tax_rate || 0) * 100),
      );
      setEstimateDefaultValidDays(String(accountResult.data.estimate_default_valid_days || 30));
      setEstimateDefaultCustomerNote(accountResult.data.estimate_default_customer_note || "");
      setEstimateDefaultTerms(accountResult.data.estimate_default_terms || "");
      setIntegrations(integrationData);
      setDeletionRequest(deletionData);
    } catch {
      if (requestId === latestSettingsRequestId.current)
        setMessage("Workspace settings could not be loaded. Refresh Settings and try again.");
    }
  }, [canManage, demoMode, refreshImportBatches, workspace]);
  useEffect(() => {
    void Promise.resolve().then(loadBilling);
  }, [loadBilling]);
  useEffect(() => {
    if (!showDeletion) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowDeletion(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [showDeletion]);

  async function uploadCompanyLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !workspace || !canManage || demoMode || busy) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setMessage("Upload a JPG, PNG, or WebP logo.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage("Company logos must be 2 MB or smaller.");
      return;
    }
    setBusy("logo");
    setMessage("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const storagePath = `${workspace.id}/branding/${crypto.randomUUID()}`;
      const uploadResult = await withAuthRequestDeadline(
        supabase.storage.from("bontraco-branding").upload(storagePath, file, {
          contentType: file.type,
          cacheControl: "31536000",
          upsert: false,
        }),
      );
      if (uploadResult.error) throw uploadResult.error;
      const { error } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase
            .from("accounts")
            .update({ proposal_logo_path: storagePath })
            .eq("id", workspace.id),
        ),
      );
      if (error) {
        setMessage(settingsErrorMessage(error, "logo_save"));
        return;
      }
      setProposalLogoPath(storagePath);
      setMessage("Company logo uploaded for new estimates and invoices.");
    } catch (error) {
      setMessage(settingsErrorMessage(error, "logo_upload"));
    } finally {
      setBusy("");
    }
  }

  async function removeCompanyLogo() {
    if (!workspace || !canManage || demoMode || busy) return;
    setBusy("logo-remove");
    setMessage("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase.from("accounts").update({ proposal_logo_path: null }).eq("id", workspace.id),
        ),
      );
      if (error) throw error;
      setProposalLogoPath("");
      setMessage("Company logo removed from future documents.");
    } catch (error) {
      setMessage(settingsErrorMessage(error, "logo_remove"));
    } finally {
      setBusy("");
    }
  }

  async function saveCompany(event: FormEvent) {
    event.preventDefault();
    if (!workspace || !canManage || demoMode || busy) return;
    setBusy("company");
    setMessage("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase
            .from("accounts")
            .update({
              name: companyName.trim(),
              legal_name: legalName.trim(),
              timezone,
              service_area: serviceArea.trim() || null,
              business_hours: businessHours.trim() || null,
              emergency_rules: emergencyRules.trim() || null,
              business_phone: businessPhone.trim() || null,
              business_email: businessEmail.trim().toLowerCase() || null,
              business_website: businessWebsite.trim() || null,
              proposal_accent_color: proposalAccentColor.toUpperCase(),
              estimate_default_tax_rate: Number(estimateDefaultTaxRate) / 100,
              estimate_default_valid_days: Number(estimateDefaultValidDays),
              estimate_default_customer_note: estimateDefaultCustomerNote.trim() || null,
              estimate_default_terms: estimateDefaultTerms.trim() || null,
              trades,
            })
            .eq("id", workspace.id),
        ),
      );
      if (error) throw error;
      setMessage("Company settings saved.");
      try {
        await withAuthRequestDeadline(refresh());
      } catch {
        setMessage(
          "Company settings were saved, but the workspace could not refresh. Reload Bontraco.",
        );
      }
    } catch (error) {
      setMessage(settingsErrorMessage(error, "profile"));
    } finally {
      setBusy("");
    }
  }
  async function billingAction(path: string, plan?: string) {
    if (demoMode || !workspace || busy) return;
    setBusy(plan || "portal");
    setMessage("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("Database connection is unavailable.");
      const { data } = await withAuthRequestDeadline(supabase.auth.getSession());
      const response = await withAuthRequestDeadline(
        fetch(`/.netlify/functions/${path}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${data.session?.access_token || ""}`,
            "x-bontraco-account-id": workspace.id,
          },
          body: JSON.stringify(plan ? { plan } : {}),
        }),
      );
      const result = await withAuthRequestDeadline(response.json().catch(() => ({})));
      const redirectUrl = verifiedBillingRedirect(result.url);
      if (response.ok && redirectUrl) window.location.assign(redirectUrl);
      else setMessage(adminOperationErrorMessage(result.error, "billing"));
    } catch (error) {
      setMessage(adminOperationErrorMessage(error, "billing"));
    } finally {
      setBusy("");
    }
  }
  async function downloadAccountExport() {
    if (demoMode || !canManage || !workspace || busy) return;
    setBusy("export");
    setMessage("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("Database connection is unavailable.");
      const { data } = await withAuthRequestDeadline(supabase.auth.getSession());
      const response = await withAuthRequestDeadline(
        fetch("/.netlify/functions/account-export", {
          headers: {
            authorization: `Bearer ${data.session?.access_token || ""}`,
            "x-bontraco-account-id": workspace.id,
          },
        }),
        exportRequestTimeoutMs,
      );
      if (!response.ok) {
        const result = await withAuthRequestDeadline(response.json().catch(() => ({})));
        setMessage(adminOperationErrorMessage(result.error, "export"));
        return;
      }
      const disposition = response.headers.get("content-disposition") || "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || "bontraco-export.json";
      const bytes = await withAuthRequestDeadline(response.arrayBuffer(), exportRequestTimeoutMs);
      await withAuthRequestDeadline(
        verifyAccountExportIntegrity(bytes, response.headers.get("x-bontraco-sha256")),
        exportRequestTimeoutMs,
      );
      const url = URL.createObjectURL(
        new Blob([bytes], { type: response.headers.get("content-type") || "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Workspace export downloaded and recorded in activity history.");
    } catch (error) {
      setMessage(adminOperationErrorMessage(error, "export"));
    } finally {
      setBusy("");
    }
  }
  async function callPrototypeImport(body: Record<string, unknown>) {
    if (!workspace) throw new Error("Select a workspace before importing data.");
    const supabase = await withAuthRequestDeadline(getSupabase());
    if (!supabase) throw new Error("Database connection is unavailable.");
    const { data } = await withAuthRequestDeadline(supabase.auth.getSession());
    const response = await withAuthRequestDeadline(
      fetch("/.netlify/functions/prototype-import", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${data.session?.access_token || ""}`,
          "x-bontraco-account-id": workspace.id,
        },
        body: JSON.stringify(body),
      }),
      importRequestTimeoutMs,
    );
    const result = await withAuthRequestDeadline(
      response.json().catch(() => ({})),
      importRequestTimeoutMs,
    );
    if (!response.ok) throw new Error(result.error || "Prototype import failed.");
    return result;
  }
  async function inspectImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    setMessage("");
    setImportPayload(null);
    setImportReport(null);
    if (file.size > 2_000_000) {
      setMessage("Import files must be 2 MB or smaller.");
      return;
    }
    setBusy("import-dry-run");
    try {
      const payload = JSON.parse(await withAuthRequestDeadline(file.text())) as unknown;
      const result = await callPrototypeImport({ mode: "dry_run", data: payload });
      setImportFilename(file.name);
      setImportPayload(payload);
      setImportReport(result.report as ImportReport);
      setMessage(
        result.valid
          ? "Dry run passed. Review the counts before importing."
          : "Dry run found problems that must be fixed before importing.",
      );
    } catch (error) {
      setMessage(adminOperationErrorMessage(error, "import_validate"));
    }
    setBusy("");
  }
  async function commitPrototypeImport() {
    if (!importPayload || !importReport || importReport.errors.length > 0 || busy) return;
    setBusy("import-commit");
    setMessage("");
    try {
      const result = await callPrototypeImport({ mode: "commit", data: importPayload });
      setMessage(
        result.duplicate
          ? "This exact file was already imported; no duplicate records were created."
          : "Prototype customers and jobs imported. The batch can be rolled back below.",
      );
      setImportPayload(null);
      setImportReport(null);
      setImportFilename("");
      if (!(await refreshImportBatches())) {
        setMessage("The import completed, but import history could not refresh. Reload Settings.");
      }
    } catch (error) {
      setMessage(adminOperationErrorMessage(error, "import_commit"));
    }
    setBusy("");
  }
  async function rollbackPrototypeImport(batch: ImportBatch) {
    if (busy) return;
    const phrase = `ROLLBACK ${batch.id.slice(0, 8)}`;
    if (
      window.prompt(`Type ${phrase} to remove only the records created by this import.`) !== phrase
    )
      return;
    setBusy(`rollback-${batch.id}`);
    setMessage("");
    try {
      await callPrototypeImport({ mode: "rollback", batch_id: batch.id, confirmation: batch.id });
      setMessage("Imported records were rolled back and the action was recorded.");
      if (!(await refreshImportBatches())) {
        setMessage(
          "The rollback completed, but import history could not refresh. Reload Settings.",
        );
      }
    } catch (error) {
      setMessage(adminOperationErrorMessage(error, "import_rollback"));
    }
    setBusy("");
  }
  async function importLegacyLeads() {
    if (demoMode || workspace?.role !== "owner" || busy) return;
    setBusy("legacy-leads");
    setMessage("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("Database connection is unavailable.");
      const { data } = await withAuthRequestDeadline(supabase.auth.getSession());
      const response = await withAuthRequestDeadline(
        fetch("/.netlify/functions/legacy-lead-import", {
          method: "POST",
          headers: {
            authorization: `Bearer ${data.session?.access_token || ""}`,
            "x-bontraco-account-id": workspace.id,
          },
        }),
        importRequestTimeoutMs,
      );
      const result = await withAuthRequestDeadline(
        response.json().catch(() => ({})),
        importRequestTimeoutMs,
      );
      if (!response.ok) throw new Error(result.error || "Legacy lead import failed.");
      const imported = result.imported as LegacyImportResult;
      setLegacyImportResult(imported);
      setConfirmLegacyImport(false);
      setMessage(
        imported.inserted > 0
          ? `${imported.inserted} preserved leads were added to this workspace.`
          : "The preserved leads were already imported; no duplicates were created.",
      );
    } catch (error) {
      setMessage(adminOperationErrorMessage(error, "legacy_import"));
    }
    setBusy("");
  }
  async function requestDeletion(event: FormEvent) {
    event.preventDefault();
    if (!workspace || workspace.role !== "owner" || demoMode || busy) return;
    setBusy("delete");
    setMessage("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("Database connection is unavailable.");
      const { data, error } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase.rpc("request_bontraco_account_deletion", {
            target_account_id: workspace.id,
            confirmation_slug: deletionConfirmation,
          }),
        ),
      );
      if (error) throw error;
      setDeletionRequest({
        id: "pending",
        status: "pending",
        requested_at: new Date().toISOString(),
        scheduled_for: String(data),
      });
      setDeletionConfirmation("");
      setShowDeletion(false);
      setMessage("Deletion requested. You can cancel it during the 14-day grace period.");
    } catch (error) {
      setMessage(adminOperationErrorMessage(error, "deletion_request"));
    } finally {
      setBusy("");
    }
  }
  async function cancelDeletion() {
    if (!workspace || workspace.role !== "owner" || demoMode || busy) return;
    setBusy("cancel-delete");
    setMessage("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("Database connection is unavailable.");
      const { data, error } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase.rpc("cancel_bontraco_account_deletion", {
            target_account_id: workspace.id,
          }),
        ),
      );
      if (error || !data) throw error || new Error("No pending deletion request was found.");
      setDeletionRequest(null);
      setMessage("Workspace deletion cancelled.");
    } catch (error) {
      setMessage(adminOperationErrorMessage(error, "deletion_cancel"));
    } finally {
      setBusy("");
    }
  }
  function toggleTrade(trade: string) {
    setTrades((current) =>
      current.includes(trade) ? current.filter((item) => item !== trade) : [...current, trade],
    );
  }
  const billingDeadline = getBillingDeadline(subscription);
  const logoUrl = proposalLogoUrl(proposalLogoPath);
  return (
    <section className="settings-page">
      <header className="section-heading">
        <div>
          <p>Company administration</p>
          <h1>Settings</h1>
          <span>Manage your workspace, plan, and protected features.</span>
        </div>
      </header>
      {message && (
        <p className="commercial-message" role="status">
          {message}
        </p>
      )}
      <div className="settings-grid">
        <form className="panel company-settings" onSubmit={saveCompany}>
          <div className="panel-header">
            <div>
              <h2>Company profile</h2>
              <p>Shared across your Bontraco workspace</p>
            </div>
            <GearSix />
          </div>
          <label>
            <span>Company name</span>
            <input
              required
              minLength={2}
              value={companyName}
              disabled={!canManage || demoMode}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </label>
          <label>
            <span>Legal business name</span>
            <input
              required
              minLength={2}
              maxLength={160}
              value={legalName}
              disabled={!canManage || demoMode}
              onChange={(event) => setLegalName(event.target.value)}
            />
          </label>
          <label>
            <span>Scheduling timezone</span>
            <select
              value={timezone}
              disabled={!canManage || demoMode}
              onChange={(event) => setTimezone(event.target.value)}
            >
              <option value="America/Chicago">Central — Chicago</option>
              <option value="America/New_York">Eastern</option>
              <option value="America/Denver">Mountain</option>
              <option value="America/Phoenix">Arizona</option>
              <option value="America/Los_Angeles">Pacific</option>
              <option value="America/Anchorage">Alaska</option>
              <option value="Pacific/Honolulu">Hawaii</option>
            </select>
          </label>
          <label>
            <span>Service area</span>
            <textarea
              maxLength={300}
              rows={2}
              value={serviceArea}
              disabled={!canManage || demoMode}
              placeholder="Cities, counties, or radius served"
              onChange={(event) => setServiceArea(event.target.value)}
            />
          </label>
          <label>
            <span>Business hours</span>
            <textarea
              maxLength={500}
              rows={2}
              value={businessHours}
              disabled={!canManage || demoMode}
              placeholder="Monday-Friday 8:00 AM-5:00 PM"
              onChange={(event) => setBusinessHours(event.target.value)}
            />
          </label>
          <label>
            <span>Emergency routing rules</span>
            <textarea
              maxLength={1000}
              rows={3}
              value={emergencyRules}
              disabled={!canManage || demoMode}
              placeholder="Describe when staff should be alerted or a caller transferred"
              onChange={(event) => setEmergencyRules(event.target.value)}
            />
          </label>
          <div className="settings-subsection">
            <h3>Customer documents</h3>
            <p>Branding, contact details, and defaults for estimates and invoices.</p>
          </div>
          <div className="proposal-logo-field">
            <span>Company logo</span>
            <div>
              {logoUrl ? (
                <img src={logoUrl} alt="Current company logo" />
              ) : (
                <span className="proposal-logo-placeholder">{companyName.slice(0, 1) || "B"}</span>
              )}
              <span>
                <label className="button button-secondary">
                  <UploadSimple /> {busy === "logo" ? "Uploading…" : "Upload logo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={!canManage || demoMode || Boolean(busy)}
                    onChange={(event) => void uploadCompanyLogo(event)}
                  />
                </label>
                {proposalLogoPath && (
                  <button
                    type="button"
                    className="mini-action"
                    disabled={!canManage || demoMode || Boolean(busy)}
                    onClick={() => void removeCompanyLogo()}
                  >
                    {busy === "logo-remove" ? "Removing…" : "Remove"}
                  </button>
                )}
              </span>
            </div>
            <small>
              JPG, PNG, or WebP up to 2 MB. Prior accepted proposals retain their original logo.
            </small>
          </div>
          <label>
            <span>Business phone</span>
            <input
              type="tel"
              minLength={7}
              maxLength={40}
              value={businessPhone}
              disabled={!canManage || demoMode}
              placeholder="(312) 555-0123"
              onChange={(event) => setBusinessPhone(event.target.value)}
            />
          </label>
          <label>
            <span>Business email</span>
            <input
              type="email"
              maxLength={254}
              value={businessEmail}
              disabled={!canManage || demoMode}
              placeholder="estimates@company.com"
              onChange={(event) => setBusinessEmail(event.target.value)}
            />
          </label>
          <label>
            <span>Business website</span>
            <input
              type="url"
              maxLength={500}
              pattern="https://.*"
              value={businessWebsite}
              disabled={!canManage || demoMode}
              placeholder="https://company.com"
              onChange={(event) => setBusinessWebsite(event.target.value)}
            />
          </label>
          <label className="proposal-color-field">
            <span>Proposal accent color</span>
            <span>
              <input
                type="color"
                value={proposalAccentColor}
                disabled={!canManage || demoMode}
                onChange={(event) => setProposalAccentColor(event.target.value.toUpperCase())}
              />
              <output>{proposalAccentColor.toUpperCase()}</output>
            </span>
          </label>
          <div className="settings-inline-fields">
            <label>
              <span>Default tax rate (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.001"
                required
                value={estimateDefaultTaxRate}
                disabled={!canManage || demoMode}
                onChange={(event) => setEstimateDefaultTaxRate(event.target.value)}
              />
            </label>
            <label>
              <span>Estimate valid for (days)</span>
              <input
                type="number"
                min="1"
                max="365"
                step="1"
                required
                value={estimateDefaultValidDays}
                disabled={!canManage || demoMode}
                onChange={(event) => setEstimateDefaultValidDays(event.target.value)}
              />
            </label>
          </div>
          <label>
            <span>Default customer note</span>
            <textarea
              maxLength={2000}
              rows={3}
              value={estimateDefaultCustomerNote}
              disabled={!canManage || demoMode}
              placeholder="Thank the customer or explain next steps"
              onChange={(event) => setEstimateDefaultCustomerNote(event.target.value)}
            />
          </label>
          <label>
            <span>Default estimate terms</span>
            <textarea
              maxLength={5000}
              rows={4}
              value={estimateDefaultTerms}
              disabled={!canManage || demoMode}
              placeholder="Payment schedule, acceptance, warranty, and expiration terms"
              onChange={(event) => setEstimateDefaultTerms(event.target.value)}
            />
          </label>
          <fieldset disabled={!canManage || demoMode}>
            <legend>Trades served</legend>
            {["roofing", "plumbing", "electrical", "general"].map((trade) => (
              <label className="setting-check" key={trade}>
                <input
                  type="checkbox"
                  checked={trades.includes(trade)}
                  onChange={() => toggleTrade(trade)}
                />
                <span>{trade}</span>
              </label>
            ))}
          </fieldset>
          <button
            className="button button-primary"
            disabled={!canManage || demoMode || Boolean(busy) || trades.length === 0}
          >
            {busy === "company" ? "Saving…" : demoMode ? "Sample company" : "Save company"}
          </button>
        </form>
        <article className="panel billing-summary">
          <div className="panel-header">
            <div>
              <h2>Billing</h2>
              <p>Owner and administrators only</p>
            </div>
            <CreditCard />
          </div>
          {!canManage ? (
            <div className="empty-state">
              <ShieldCheck />
              <strong>Billing is private</strong>
              <span>Ask an owner or administrator to manage the plan.</span>
            </div>
          ) : (
            <>
              <div className="current-plan">
                <span>Current plan</span>
                <strong>
                  {plans.find((p) => p.slug === subscription?.plan_slug)?.display_name || "No plan"}
                </strong>
                <b className={`billing-status ${subscription?.status || "inactive"}`}>
                  {subscription?.status || "inactive"}
                </b>
                {billingDeadline && (
                  <small>
                    {billingDeadline.label} {new Date(billingDeadline.date).toLocaleDateString()}
                  </small>
                )}
                {subscription?.status === "past_due" && subscription.grace_ends_at && (
                  <p className="billing-grace-warning" role="alert">
                    Payment needs attention. Bontraco remains available through the date above;
                    update billing before then to avoid interruption.
                  </p>
                )}
                {subscription?.cancel_at_period_end && (
                  <small>Cancellation is scheduled for the period end.</small>
                )}
              </div>
              <button
                className="button button-secondary button-full"
                disabled={demoMode || !subscription?.stripe_customer_id || Boolean(busy)}
                onClick={() => void billingAction("billing-portal")}
              >
                {busy === "portal" ? "Opening…" : "Manage billing"}
              </button>
            </>
          )}
        </article>
        {canManage && (
          <article className="panel integration-health">
            <div className="panel-header">
              <div>
                <h2>Integration health</h2>
                <p>Configuration only — credentials are never displayed</p>
              </div>
              <ShieldCheck />
            </div>
            <div className="integration-list">
              {[
                ["Public web search", integrations?.providers.public_web_search],
                ["Google Places", integrations?.providers.google_places],
                ["Stripe billing", integrations?.providers.stripe],
                [
                  "Retell receptionist",
                  integrations?.providers.retell && integrations?.receptionist_workspace,
                ],
                ["On-call alerts", integrations?.providers.operations_alerts],
              ].map(([label, connected]) => (
                <div key={String(label)}>
                  <span>{label}</span>
                  <strong className={connected ? "connected" : "not-connected"}>
                    {connected ? "Connected" : "Setup needed"}
                  </strong>
                </div>
              ))}
            </div>
          </article>
        )}
        {canManage && (
          <article className="panel data-controls">
            <div>
              <strong>Workspace data</strong>
              <span>
                Download a tenant-scoped JSON archive of CRM, jobs, billing state, lead history, and
                receptionist records.
              </span>
            </div>
            <button
              className="button button-secondary"
              disabled={demoMode || Boolean(busy)}
              onClick={() => void downloadAccountExport()}
            >
              <DownloadSimple /> {busy === "export" ? "Preparing…" : "Download export"}
            </button>
          </article>
        )}
        {canManage && (
          <article className="panel prototype-import">
            <div className="panel-header">
              <div>
                <h2>Import original CRM data</h2>
                <p>Validate first, then migrate customers, addresses, and jobs with rollback</p>
              </div>
              <UploadSimple />
            </div>
            <div className="prototype-import-body">
              {workspace?.role === "owner" && (
                <div className="legacy-import-callout">
                  <div>
                    <strong>Preserved lead snapshot</strong>
                    <span>
                      Bring the server-protected pre-Bontraco leads into this workspace. The import
                      is audited and safe to repeat.
                    </span>
                    {legacyImportResult && (
                      <small role="status">
                        {legacyImportResult.inserted} added · {legacyImportResult.duplicates}{" "}
                        already present · {legacyImportResult.available} preserved
                      </small>
                    )}
                  </div>
                  {confirmLegacyImport ? (
                    <div
                      className="legacy-import-confirm"
                      role="group"
                      aria-label="Confirm legacy lead import"
                    >
                      <span>
                        Import into {workspace.name}? Existing matching leads will be skipped.
                      </span>
                      <div>
                        <button
                          type="button"
                          className="button button-secondary"
                          disabled={Boolean(busy)}
                          onClick={() => setConfirmLegacyImport(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="button button-primary"
                          disabled={demoMode || Boolean(busy)}
                          onClick={() => void importLegacyLeads()}
                        >
                          {busy === "legacy-leads" ? "Importing…" : "Confirm import"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="button button-secondary"
                      disabled={demoMode || Boolean(busy)}
                      onClick={() => setConfirmLegacyImport(true)}
                    >
                      <UploadSimple /> {demoMode ? "Available after sign-in" : "Review lead import"}
                    </button>
                  )}
                </div>
              )}
              <label className="button button-secondary import-file-button">
                <UploadSimple />
                {busy === "import-dry-run" ? "Checking file…" : "Choose Abundant CRM JSON"}
                <input
                  type="file"
                  accept="application/json,.json"
                  disabled={demoMode || Boolean(busy)}
                  onChange={(event) => void inspectImportFile(event)}
                />
              </label>
              <span className="import-limit">Maximum 2 MB and 2,000 source rows per type.</span>
              {importReport && (
                <div className="import-report" role="status">
                  <div>
                    <strong>{importFilename}</strong>
                    <span>
                      {importReport.target_counts.contacts} contacts ·{" "}
                      {importReport.target_counts.properties} locations ·{" "}
                      {importReport.target_counts.jobs} jobs
                    </span>
                  </div>
                  {importReport.errors.length > 0 && (
                    <ul className="import-errors">
                      {importReport.errors.slice(0, 5).map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  )}
                  {importReport.warnings.length > 0 && (
                    <details>
                      <summary>{importReport.warnings.length} assignment warnings</summary>
                      <ul>
                        {importReport.warnings.slice(0, 10).map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <button
                    className="button button-primary"
                    disabled={demoMode || importReport.errors.length > 0 || Boolean(busy)}
                    onClick={() => void commitPrototypeImport()}
                  >
                    {busy === "import-commit" ? "Importing…" : "Import validated records"}
                  </button>
                </div>
              )}
              {importBatches.length > 0 && (
                <div className="import-history">
                  <strong>Recent import batches</strong>
                  {importBatches.map((batch) => (
                    <div key={batch.id}>
                      <span>
                        {new Date(batch.created_at).toLocaleString()} · {batch.status} ·{" "}
                        {batch.imported_counts.jobs || 0} jobs
                      </span>
                      {batch.status === "completed" && (
                        <button
                          className="button button-secondary"
                          disabled={Boolean(busy)}
                          onClick={() => void rollbackPrototypeImport(batch)}
                        >
                          <ArrowCounterClockwise />
                          {busy === `rollback-${batch.id}` ? "Rolling back…" : "Rollback"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>
        )}
        {workspace?.role === "owner" && (
          <article className="panel danger-zone">
            <div>
              <strong>Danger zone</strong>
              <span>
                {deletionRequest
                  ? `Deletion is scheduled after ${new Date(deletionRequest.scheduled_for).toLocaleString()}.`
                  : "Request deletion with a 14-day recovery window. Nothing is removed immediately."}
              </span>
            </div>
            {deletionRequest ? (
              <button
                className="button button-secondary"
                disabled={demoMode || Boolean(busy)}
                onClick={() => void cancelDeletion()}
              >
                {busy === "cancel-delete" ? "Cancelling…" : "Cancel deletion"}
              </button>
            ) : (
              <button
                className="button button-danger"
                disabled={demoMode || Boolean(busy)}
                onClick={(event) => {
                  rememberDeletionOpener(event.currentTarget);
                  setShowDeletion(true);
                }}
              >
                Request deletion
              </button>
            )}
          </article>
        )}
      </div>
      {canManage && (
        <section className="plan-section">
          <div>
            <p>Choose a plan</p>
            <h2>Features that grow with the company</h2>
          </div>
          <div className="plan-grid">
            {plans.map((plan) => (
              <article
                className={subscription?.plan_slug === plan.slug ? "active" : ""}
                key={plan.slug}
              >
                <span>{plan.display_name}</span>
                <strong>
                  {formatMonthlyPrice(plan.monthly_price_cents)}
                  <small>/month</small>
                </strong>
                <p>{plan.summary}</p>
                <small>{plan.included_users} users included</small>
                <small>
                  {plan.slug === "starter"
                    ? "Lead Engine available on Growth"
                    : `${plan.included_lead_profiles} lead searches included`}
                </small>
                <button
                  className="button button-primary button-full"
                  disabled={
                    demoMode ||
                    Boolean(busy) ||
                    (subscription?.plan_slug === plan.slug &&
                      Boolean(subscription.stripe_customer_id))
                  }
                  onClick={() => void billingAction("billing-checkout", plan.slug)}
                >
                  {subscription?.plan_slug === plan.slug && subscription.stripe_customer_id
                    ? "Current plan"
                    : busy === plan.slug
                      ? "Opening…"
                      : subscription?.plan_slug === plan.slug
                        ? "Activate plan"
                        : "Select plan"}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
      {showDeletion && workspace?.role === "owner" && (
        <div
          className="drawer-backdrop deletion-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowDeletion(false);
          }}
        >
          <aside
            ref={deletionDialogRef}
            className="lead-drawer deletion-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deletion-title"
          >
            <header>
              <div>
                <span>Owner confirmation</span>
                <h2 id="deletion-title">Request workspace deletion</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close deletion request"
                onClick={() => setShowDeletion(false)}
              >
                <X />
              </button>
            </header>
            <form onSubmit={requestDeletion}>
              <p className="deletion-warning">
                Bontraco will create a recoverable request. The workspace remains available for 14
                days and the owner can cancel during that period. Final purge requires the protected
                operations process.
              </p>
              <label>
                <span>
                  Type <b>{workspace.slug}</b> to confirm
                </span>
                <input
                  autoFocus
                  autoComplete="off"
                  value={deletionConfirmation}
                  onChange={(event) => setDeletionConfirmation(event.target.value)}
                />
              </label>
              <div className="deletion-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setShowDeletion(false)}
                >
                  Keep workspace
                </button>
                <button
                  className="button button-danger"
                  disabled={
                    demoMode ||
                    Boolean(busy) ||
                    deletionConfirmation.trim().toLowerCase() !== workspace.slug.toLowerCase()
                  }
                >
                  {busy === "delete" ? "Requesting…" : "Start 14-day grace period"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </section>
  );
}
