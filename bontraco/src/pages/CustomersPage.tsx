import { EnvelopeSimple } from "@phosphor-icons/react/EnvelopeSimple";
import { HouseLine } from "@phosphor-icons/react/HouseLine";
import { MagnifyingGlass } from "@phosphor-icons/react/MagnifyingGlass";
import { MapPin } from "@phosphor-icons/react/MapPin";
import { Phone } from "@phosphor-icons/react/Phone";
import { Plus } from "@phosphor-icons/react/Plus";
import { UserCircle } from "@phosphor-icons/react/UserCircle";
import { X } from "@phosphor-icons/react/X";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { withAuthRequestDeadline } from "../lib/auth-request-deadline";
import { normalizeEmail, normalizeUsPhone } from "../lib/communication-preferences";
import { customerErrorMessage } from "../lib/customer-error";
import { getSupabase } from "../lib/supabase";
import { useModalFocus } from "../lib/use-modal-focus";
import { useWorkspaceAutoRefresh } from "../lib/workspace-auto-refresh";
import { useWorkspace } from "../workspace/WorkspaceContext";

type Contact = {
  id: string;
  assigned_to: string | null;
  first_name: string;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  updated_at: string;
};
type AssignableMember = {
  user_id: string;
  display_name: string | null;
  email: string;
};
type Property = {
  id: string;
  label: string | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  region: string;
  postal_code: string | null;
  active: boolean;
};
type CustomerJob = {
  id: string;
  title: string;
  trade: string;
  stage: string;
  status: string;
  property_id: string | null;
};
type CommunicationSuppression = {
  id: string;
  channel: "voice" | "sms" | "email";
  destination: string;
  reason: string;
  source: string;
  suppressed_at: string;
  lifted_at: string | null;
};
type CommunicationConsent = {
  id: string;
  channel: "voice" | "sms" | "email";
  purpose: "marketing" | "transactional" | "artificial_voice" | "recording";
  destination: string;
  status: "granted" | "revoked";
  source: string;
  disclosure_version: string;
  recorded_at: string;
};

export function CustomersPage() {
  const { demoMode, user } = useAuth();
  const { workspace } = useWorkspace();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [customerJobs, setCustomerJobs] = useState<CustomerJob[]>([]);
  const [suppressions, setSuppressions] = useState<CommunicationSuppression[]>([]);
  const [consents, setConsents] = useState<CommunicationConsent[]>([]);
  const [preferenceDestination, setPreferenceDestination] = useState("");
  const [preferenceReason, setPreferenceReason] = useState("");
  const [preferenceMessage, setPreferenceMessage] = useState("");
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [consentDestination, setConsentDestination] = useState("");
  const [consentPurpose, setConsentPurpose] =
    useState<CommunicationConsent["purpose"]>("transactional");
  const [consentEvidence, setConsentEvidence] = useState("");
  const [consentMessage, setConsentMessage] = useState("");
  const [consentBusy, setConsentBusy] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [mergeConfirmation, setMergeConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const latestContactsRequestId = useRef(0);
  const latestDetailRequestId = useRef(0);
  const { dialogRef: createDialogRef, rememberOpener: rememberCreateOpener } =
    useModalFocus<HTMLElement>(showCreate);
  const { dialogRef: detailsDialogRef, rememberOpener: rememberDetailsOpener } =
    useModalFocus<HTMLElement>(Boolean(selectedContact));
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState({
    first_name: "",
    last_name: "",
    company_name: "",
    phone: "",
    email: "",
    source: "manual",
    address_line_1: "",
    city: "",
    region: "IL",
    postal_code: "",
  });
  const [locationDraft, setLocationDraft] = useState({
    label: "Service location",
    address_line_1: "",
    address_line_2: "",
    city: "",
    region: "IL",
    postal_code: "",
  });
  const canCreate = workspace?.role !== "field";
  const canAssign = ["owner", "admin", "dispatcher"].includes(workspace?.role || "");
  const canArchiveLocations = ["owner", "admin", "dispatcher"].includes(workspace?.role || "");
  const canLiftSuppressions = ["owner", "admin"].includes(workspace?.role || "");
  const canMergeCustomers = ["owner", "admin"].includes(workspace?.role || "");

  const closeCustomerDetails = useCallback(() => {
    latestDetailRequestId.current += 1;
    setSelectedContact(null);
    setSuppressions([]);
    setConsents([]);
    setPreferenceDestination("");
    setPreferenceReason("");
    setPreferenceMessage("");
    setConsentDestination("");
    setConsentPurpose("transactional");
    setConsentEvidence("");
    setConsentMessage("");
    setEditingLocationId("");
    setMergeTargetId("");
    setMergeConfirmation("");
    setLocationDraft({
      label: "Service location",
      address_line_1: "",
      address_line_2: "",
      city: "",
      region: "IL",
      postal_code: "",
    });
  }, []);

  const loadContacts = useCallback(
    async (options: { preserveError?: boolean } = {}) => {
      const requestId = ++latestContactsRequestId.current;
      if (!workspace) {
        setLoading(false);
        return false;
      }
      try {
        if (demoMode && import.meta.env.VITE_DEMO_MODE === "true") {
          const { createDemoCustomersData } = await import("../demo/customers");
          const data = createDemoCustomersData();
          if (requestId !== latestContactsRequestId.current) return false;
          setContacts(data.contacts);
          setMembers(data.members);
          return true;
        }
        const supabase = await withAuthRequestDeadline(getSupabase());
        if (!supabase) throw new Error("client_unavailable");
        const [contactResult, memberResult] = await withAuthRequestDeadline(
          Promise.all([
            supabase
              .from("contacts")
              .select(
                "id, assigned_to, first_name, last_name, company_name, email, phone, source, updated_at",
              )
              .eq("account_id", workspace.id)
              .order("updated_at", { ascending: false })
              .limit(200),
            supabase
              .from("memberships")
              .select("user_id,display_name,email")
              .eq("account_id", workspace.id)
              .eq("active", true)
              .order("display_name"),
          ]),
        );
        if (requestId !== latestContactsRequestId.current) return false;
        if (contactResult.error || memberResult.error) throw new Error("customer_load_failed");
        setContacts((contactResult.data || []) as Contact[]);
        setMembers((memberResult.data || []) as AssignableMember[]);
        if (!options.preserveError) setError("");
        return true;
      } catch {
        if (requestId === latestContactsRequestId.current && !options.preserveError)
          setError("Bontraco could not load customers.");
        return false;
      } finally {
        if (requestId === latestContactsRequestId.current) setLoading(false);
      }
    },
    [demoMode, workspace],
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadContacts());
  }, [loadContacts]);
  useWorkspaceAutoRefresh(!demoMode, loadContacts, workspace?.id);

  useEffect(() => {
    if (!showCreate && !selectedContact) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowCreate(false);
        closeCustomerDetails();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeCustomerDetails, selectedContact, showCreate]);

  const loadCustomerDetails = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const requestId = ++latestDetailRequestId.current;
      if (!workspace || !selectedContact) return false;
      if (!options.silent) setDetailLoading(true);
      try {
        if (demoMode && import.meta.env.VITE_DEMO_MODE === "true") {
          const { createDemoCustomerDetails, createDemoCustomersData } = await import(
            "../demo/customers"
          );
          const data = createDemoCustomersData();
          const details = createDemoCustomerDetails(selectedContact.id);
          if (requestId !== latestDetailRequestId.current) return false;
          setProperties(
            (data.properties[selectedContact.id as keyof typeof data.properties] ||
              []) as Property[],
          );
          setCustomerJobs(
            (data.jobs[selectedContact.id as keyof typeof data.jobs] || []) as CustomerJob[],
          );
          setSuppressions(details.suppressions as CommunicationSuppression[]);
          setConsents(details.consents as CommunicationConsent[]);
          return true;
        }
        const supabase = await withAuthRequestDeadline(getSupabase());
        if (!supabase) throw new Error("client_unavailable");
        const [propertyResult, jobResult, suppressionResult, consentResult] =
          await withAuthRequestDeadline(
            Promise.all([
              supabase
                .from("properties")
                .select("id,label,address_line_1,address_line_2,city,region,postal_code,active")
                .eq("account_id", workspace.id)
                .eq("contact_id", selectedContact.id)
                .order("active", { ascending: false })
                .order("created_at"),
              supabase
                .from("jobs")
                .select("id,title,trade,stage,status,property_id")
                .eq("account_id", workspace.id)
                .eq("contact_id", selectedContact.id)
                .order("updated_at", { ascending: false }),
              supabase
                .from("communication_suppressions")
                .select("id,channel,destination,reason,source,suppressed_at,lifted_at")
                .eq("account_id", workspace.id)
                .eq("contact_id", selectedContact.id)
                .is("lifted_at", null)
                .order("suppressed_at", { ascending: false }),
              supabase
                .from("communication_consents")
                .select(
                  "id,channel,purpose,destination,status,source,disclosure_version,recorded_at",
                )
                .eq("account_id", workspace.id)
                .eq("contact_id", selectedContact.id)
                .order("recorded_at", { ascending: false })
                .limit(20),
            ]),
          );
        if (requestId !== latestDetailRequestId.current) return false;
        if (
          propertyResult.error ||
          jobResult.error ||
          suppressionResult.error ||
          consentResult.error
        )
          throw new Error("customer_detail_load_failed");
        setProperties((propertyResult.data || []) as Property[]);
        setCustomerJobs((jobResult.data || []) as CustomerJob[]);
        setSuppressions((suppressionResult.data || []) as CommunicationSuppression[]);
        setConsents((consentResult.data || []) as CommunicationConsent[]);
        return true;
      } catch {
        if (requestId === latestDetailRequestId.current)
          setError("Bontraco could not load all customer details.");
        return false;
      } finally {
        if (requestId === latestDetailRequestId.current && !options.silent) setDetailLoading(false);
      }
    },
    [demoMode, selectedContact, workspace],
  );

  const preferenceOptions = useMemo(() => {
    if (!selectedContact) return [];
    const phone = normalizeUsPhone(selectedContact.phone);
    const email = normalizeEmail(selectedContact.email);
    return [
      ...(phone
        ? [
            { value: `voice:${phone}`, label: `Do not call · ${phone}` },
            { value: `sms:${phone}`, label: `Do not text · ${phone}` },
          ]
        : []),
      ...(email ? [{ value: `email:${email}`, label: `Do not email · ${email}` }] : []),
    ];
  }, [selectedContact]);

  const consentOptions = useMemo(
    () =>
      preferenceOptions.map((option) => ({
        value: option.value,
        label: option.label.replace(/^Do not (call|text|email) · /, ""),
      })),
    [preferenceOptions],
  );

  useEffect(() => {
    if (selectedContact) void Promise.resolve().then(() => loadCustomerDetails());
  }, [loadCustomerDetails, selectedContact]);
  const refreshCustomerDetails = useCallback(
    () => loadCustomerDetails({ silent: true }),
    [loadCustomerDetails],
  );
  useWorkspaceAutoRefresh(
    !demoMode && Boolean(selectedContact),
    refreshCustomerDetails,
    workspace && selectedContact ? `${workspace.id}:${selectedContact.id}` : "",
  );

  const visibleContacts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return contacts;
    return contacts.filter((contact) =>
      [
        contact.first_name,
        contact.last_name,
        contact.company_name,
        contact.phone,
        contact.email,
      ].some((value) => value?.toLowerCase().includes(normalized)),
    );
  }, [contacts, query]);

  const mergeCandidates = useMemo(
    () => contacts.filter((contact) => contact.id !== selectedContact?.id),
    [contacts, selectedContact],
  );

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace || !user || demoMode || busy) return;
    if (Boolean(draft.address_line_1.trim()) !== Boolean(draft.city.trim())) {
      setError("Enter both a street address and city, or leave both blank.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error: insertError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase.rpc("create_bontraco_contact", {
            target_account_id: workspace.id,
            contact_first_name: draft.first_name.trim(),
            contact_last_name: draft.last_name.trim() || null,
            contact_company_name: draft.company_name.trim() || null,
            contact_phone: draft.phone.trim() || null,
            contact_email: draft.email.trim().toLowerCase() || null,
            contact_source: draft.source,
            property_address_line_1: draft.address_line_1.trim() || null,
            property_city: draft.city.trim() || null,
            property_region: draft.region.trim() || "IL",
            property_postal_code: draft.postal_code.trim() || null,
          }),
        ),
      );
      if (insertError) throw insertError;
      setShowCreate(false);
      setDraft({
        first_name: "",
        last_name: "",
        company_name: "",
        phone: "",
        email: "",
        source: "manual",
        address_line_1: "",
        city: "",
        region: "IL",
        postal_code: "",
      });
      if (!(await loadContacts({ preserveError: true })))
        setError(
          "The customer was created, but the customer list could not refresh. Reload Bontraco.",
        );
    } catch (cause) {
      setError(customerErrorMessage(cause, "create"));
    } finally {
      setBusy(false);
    }
  }

  async function assignCustomer(contact: Contact, assignedTo: string) {
    if (!workspace || demoMode || !canAssign || busy) return;
    setBusy(true);
    setError("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const nextAssignee = assignedTo || null;
      const { error: updateError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase
            .from("contacts")
            .update({ assigned_to: nextAssignee })
            .eq("account_id", workspace.id)
            .eq("id", contact.id),
        ),
      );
      if (updateError) throw updateError;
      setContacts((current) =>
        current.map((candidate) =>
          candidate.id === contact.id ? { ...candidate, assigned_to: nextAssignee } : candidate,
        ),
      );
      setSelectedContact((current) =>
        current?.id === contact.id ? { ...current, assigned_to: nextAssignee } : current,
      );
    } catch (cause) {
      setError(customerErrorMessage(cause, "assign"));
    } finally {
      setBusy(false);
    }
  }

  function assigneeName(userId: string | null) {
    const member = members.find((candidate) => candidate.user_id === userId);
    return member?.display_name || member?.email || "Unassigned";
  }

  async function addLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace || !selectedContact || demoMode || busy) return;
    setBusy(true);
    setError("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error: insertError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase.from("properties").insert({
            account_id: workspace.id,
            contact_id: selectedContact.id,
            label: locationDraft.label.trim() || "Service location",
            address_line_1: locationDraft.address_line_1.trim(),
            address_line_2: locationDraft.address_line_2.trim() || null,
            city: locationDraft.city.trim(),
            region: locationDraft.region.trim() || "IL",
            postal_code: locationDraft.postal_code.trim() || null,
          }),
        ),
      );
      if (insertError) throw insertError;
      setLocationDraft({
        label: "Service location",
        address_line_1: "",
        address_line_2: "",
        city: "",
        region: "IL",
        postal_code: "",
      });
      if (!(await loadCustomerDetails({ silent: true }))) {
        setError(
          "The service location was added, but customer details could not refresh. Reload Bontraco.",
        );
      }
    } catch (cause) {
      setError(customerErrorMessage(cause, "add_location"));
    } finally {
      setBusy(false);
    }
  }

  function beginLocationEdit(property: Property) {
    setEditingLocationId(property.id);
    setLocationDraft({
      label: property.label || "Service location",
      address_line_1: property.address_line_1,
      address_line_2: property.address_line_2 || "",
      city: property.city,
      region: property.region,
      postal_code: property.postal_code || "",
    });
  }

  async function saveLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace || !selectedContact || !editingLocationId || demoMode || busy) return;
    setBusy(true);
    setError("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error: updateError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase
            .from("properties")
            .update({
              label: locationDraft.label.trim() || "Service location",
              address_line_1: locationDraft.address_line_1.trim(),
              address_line_2: locationDraft.address_line_2.trim() || null,
              city: locationDraft.city.trim(),
              region: locationDraft.region.trim() || "IL",
              postal_code: locationDraft.postal_code.trim() || null,
            })
            .eq("account_id", workspace.id)
            .eq("contact_id", selectedContact.id)
            .eq("id", editingLocationId),
        ),
      );
      if (updateError) throw updateError;
      setEditingLocationId("");
      setLocationDraft({
        label: "Service location",
        address_line_1: "",
        address_line_2: "",
        city: "",
        region: "IL",
        postal_code: "",
      });
      if (!(await loadCustomerDetails({ silent: true }))) {
        setError(
          "The service location was updated, but customer details could not refresh. Reload Bontraco.",
        );
      }
    } catch (cause) {
      setError(customerErrorMessage(cause, "update_location"));
    } finally {
      setBusy(false);
    }
  }

  async function setLocationActive(property: Property, active: boolean) {
    if (!workspace || demoMode || !canArchiveLocations || busy) return;
    setBusy(true);
    setError("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error: updateError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase.rpc("set_bontraco_property_active", {
            target_account_id: workspace.id,
            target_property_id: property.id,
            desired_active: active,
          }),
        ),
      );
      if (updateError) throw updateError;
      if (editingLocationId === property.id) setEditingLocationId("");
      if (!(await loadCustomerDetails({ silent: true }))) {
        setError(
          "The service location status changed, but customer details could not refresh. Reload Bontraco.",
        );
      }
    } catch (cause) {
      setError(customerErrorMessage(cause, "archive_location"));
    } finally {
      setBusy(false);
    }
  }

  async function recordSuppression(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedPreference = preferenceDestination || preferenceOptions[0]?.value || "";
    if (
      !workspace ||
      !selectedContact ||
      !user ||
      demoMode ||
      !selectedPreference ||
      preferenceBusy
    )
      return;
    const [channel, ...destinationParts] = selectedPreference.split(":");
    const destination = destinationParts.join(":");
    if (!(["voice", "sms", "email"] as string[]).includes(channel) || !destination) return;
    const reason = preferenceReason.trim();
    if (reason.length < 2) {
      setPreferenceMessage("Add a reason so the request has a durable audit record.");
      return;
    }
    setPreferenceBusy(true);
    setPreferenceMessage("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error: insertError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase.from("communication_suppressions").insert({
            account_id: workspace.id,
            contact_id: selectedContact.id,
            channel,
            destination,
            reason,
            source: "recipient_request",
            created_by: user.id,
          }),
        ),
      );
      if (insertError) throw insertError;
      setPreferenceReason("");
      setPreferenceMessage("Do-not-contact preference saved.");
      if (!(await loadCustomerDetails({ silent: true }))) {
        setError("");
        setPreferenceMessage(
          "Do-not-contact preference saved, but customer details could not refresh. Reload Bontraco.",
        );
      }
    } catch (cause) {
      setPreferenceMessage(customerErrorMessage(cause, "record_suppression"));
    } finally {
      setPreferenceBusy(false);
    }
  }

  async function liftSuppression(suppression: CommunicationSuppression) {
    if (!workspace || !user || demoMode || !canLiftSuppressions || preferenceBusy) return;
    const reason = window.prompt("Why is this do-not-contact preference being lifted?")?.trim();
    if (!reason || reason.length < 2) return;
    setPreferenceBusy(true);
    setPreferenceMessage("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error: updateError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase
            .from("communication_suppressions")
            .update({
              lifted_at: new Date().toISOString(),
              lifted_by: user.id,
              lift_reason: reason,
            })
            .eq("account_id", workspace.id)
            .eq("id", suppression.id)
            .is("lifted_at", null),
        ),
      );
      if (updateError) throw updateError;
      setPreferenceMessage("Do-not-contact preference lifted.");
      if (!(await loadCustomerDetails({ silent: true }))) {
        setError("");
        setPreferenceMessage(
          "Do-not-contact preference lifted, but customer details could not refresh. Reload Bontraco.",
        );
      }
    } catch (cause) {
      setPreferenceMessage(customerErrorMessage(cause, "lift_suppression"));
    } finally {
      setPreferenceBusy(false);
    }
  }

  async function recordConsent(status: CommunicationConsent["status"]) {
    const selectedConsent = consentDestination || consentOptions[0]?.value || "";
    if (!workspace || !selectedContact || !user || demoMode || !selectedConsent || consentBusy)
      return;
    const [channel, ...destinationParts] = selectedConsent.split(":");
    const destination = destinationParts.join(":");
    const evidenceNote = consentEvidence.trim();
    if (!(["voice", "sms", "email"] as string[]).includes(channel) || !destination) return;
    if (["artificial_voice", "recording"].includes(consentPurpose) && channel !== "voice") {
      setConsentMessage("AI voice and recording consent must use a phone-call destination.");
      return;
    }
    if (evidenceNote.length < 4) {
      setConsentMessage("Describe where the consent or revocation was received.");
      return;
    }
    setConsentBusy(true);
    setConsentMessage("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error: insertError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase.from("communication_consents").insert({
            account_id: workspace.id,
            contact_id: selectedContact.id,
            channel,
            purpose: consentPurpose,
            destination,
            status,
            source: "manual",
            disclosure_version: "bontraco-manual-v1",
            evidence: { note: evidenceNote },
            created_by: user.id,
          }),
        ),
      );
      if (insertError) throw insertError;
      setConsentEvidence("");
      setConsentMessage(
        status === "granted" ? "Consent evidence recorded." : "Revocation recorded.",
      );
      if (!(await loadCustomerDetails({ silent: true }))) {
        setError("");
        setConsentMessage(
          `${status === "granted" ? "Consent evidence" : "Revocation"} was recorded, but customer details could not refresh. Reload Bontraco.`,
        );
      }
    } catch (cause) {
      setConsentMessage(customerErrorMessage(cause, "record_consent"));
    } finally {
      setConsentBusy(false);
    }
  }

  async function mergeCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !workspace ||
      !selectedContact ||
      !mergeTargetId ||
      mergeConfirmation !== "MERGE" ||
      demoMode ||
      !canMergeCustomers ||
      busy
    )
      return;
    const target = contacts.find((contact) => contact.id === mergeTargetId);
    if (!target) return;
    const sourceName = `${selectedContact.first_name} ${selectedContact.last_name || ""}`.trim();
    const targetName = `${target.first_name} ${target.last_name || ""}`.trim();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const { error: mergeError } = await withAuthRequestDeadline(
        Promise.resolve(
          supabase.rpc("merge_bontraco_contacts", {
            target_account_id: workspace.id,
            source_contact_id: selectedContact.id,
            destination_contact_id: target.id,
          }),
        ),
      );
      if (mergeError) throw mergeError;
      closeCustomerDetails();
      setNotice(`${sourceName} was merged into ${targetName}.`);
      if (!(await loadContacts({ preserveError: true }))) {
        setNotice(
          `${sourceName} was merged into ${targetName}, but the customer list could not refresh. Reload Bontraco.`,
        );
      }
    } catch (cause) {
      setError(customerErrorMessage(cause, "merge"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="customers-page">
      <header className="section-heading">
        <div>
          <p>Relationship records</p>
          <h1>Customers</h1>
          <span>People and companies visible to your role in {workspace?.name}.</span>
        </div>
        {canCreate && (
          <button
            className="button button-primary"
            disabled={busy}
            onClick={(event) => {
              rememberCreateOpener(event.currentTarget);
              setShowCreate(true);
            }}
          >
            <Plus weight="bold" /> Add customer
          </button>
        )}
      </header>
      {error && (
        <p className="form-message error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="form-message" role="status">
          {notice}
        </p>
      )}
      <article className="panel customer-panel">
        <div className="customer-toolbar">
          <label>
            <MagnifyingGlass />
            <input
              aria-label="Search customers"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, company, phone, or email"
            />
          </label>
          <span>{visibleContacts.length} customers</span>
        </div>
        {loading ? (
          <p className="panel-state">Loading customers</p>
        ) : visibleContacts.length === 0 ? (
          <div className="empty-list">
            <UserCircle size={32} />
            <strong>No customers match this view</strong>
            <span>Add a customer or convert a qualified lead.</span>
          </div>
        ) : (
          <div className="customer-grid">
            {visibleContacts.map((contact) => {
              const name = `${contact.first_name} ${contact.last_name || ""}`.trim();
              return (
                <article key={contact.id} className={`customer-card ${canAssign ? "manager" : ""}`}>
                  <span className="customer-avatar">
                    {contact.first_name[0]}
                    {contact.last_name?.[0] || ""}
                  </span>
                  <div className="customer-name">
                    <strong>{name}</strong>
                    <small>{contact.company_name || "Residential customer"}</small>
                  </div>
                  <div className="customer-methods">
                    {contact.phone ? (
                      <a href={`tel:${contact.phone}`}>
                        <Phone /> {contact.phone}
                      </a>
                    ) : (
                      <span>
                        <Phone /> No phone
                      </span>
                    )}
                    {contact.email ? (
                      <a href={`mailto:${contact.email}`}>
                        <EnvelopeSimple /> {contact.email}
                      </a>
                    ) : (
                      <span>
                        <EnvelopeSimple /> No email
                      </span>
                    )}
                  </div>
                  <span className="source-pill">{contact.source || "manual"}</span>
                  {canAssign && (
                    <select
                      className="customer-assignee"
                      aria-label={`Assignee for ${name}`}
                      value={contact.assigned_to || ""}
                      disabled={busy || demoMode}
                      onChange={(event) => void assignCustomer(contact, event.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {members.map((member) => (
                        <option value={member.user_id} key={member.user_id}>
                          {member.display_name || member.email}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    className="customer-details-button"
                    onClick={(event) => {
                      rememberDetailsOpener(event.currentTarget);
                      setSelectedContact(contact);
                    }}
                  >
                    View customer
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </article>

      {showCreate && (
        <div
          className="drawer-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowCreate(false);
          }}
        >
          <aside
            ref={createDialogRef}
            className="lead-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-customer-title"
          >
            <header>
              <div>
                <span>Customer record</span>
                <h2 id="new-customer-title">Add a customer</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close customer form"
                onClick={() => setShowCreate(false)}
              >
                <X />
              </button>
            </header>
            <form onSubmit={createCustomer}>
              <div className="form-pair">
                <label>
                  <span>First name</span>
                  <input
                    value={draft.first_name}
                    onChange={(event) => setDraft({ ...draft, first_name: event.target.value })}
                    autoFocus
                    required
                  />
                </label>
                <label>
                  <span>Last name</span>
                  <input
                    value={draft.last_name}
                    onChange={(event) => setDraft({ ...draft, last_name: event.target.value })}
                  />
                </label>
              </div>
              <label>
                <span>Company or HOA</span>
                <input
                  value={draft.company_name}
                  onChange={(event) => setDraft({ ...draft, company_name: event.target.value })}
                />
              </label>
              <div className="form-pair">
                <label>
                  <span>Phone</span>
                  <input
                    type="tel"
                    value={draft.phone}
                    onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                  />
                </label>
                <label>
                  <span>Email</span>
                  <input
                    type="email"
                    value={draft.email}
                    onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                  />
                </label>
              </div>
              <label>
                <span>Source</span>
                <select
                  value={draft.source}
                  onChange={(event) => setDraft({ ...draft, source: event.target.value })}
                >
                  <option value="manual">Manual</option>
                  <option value="lead_conversion">Lead conversion</option>
                  <option value="referral">Referral</option>
                  <option value="website">Website</option>
                  <option value="phone">Phone call</option>
                </select>
              </label>
              <fieldset className="customer-location-fields">
                <legend>
                  First service location <small>optional</small>
                </legend>
                <label>
                  <span>Street address</span>
                  <input
                    value={draft.address_line_1}
                    onChange={(event) => setDraft({ ...draft, address_line_1: event.target.value })}
                  />
                </label>
                <div className="form-pair">
                  <label>
                    <span>City</span>
                    <input
                      value={draft.city}
                      onChange={(event) => setDraft({ ...draft, city: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>State</span>
                    <input
                      value={draft.region}
                      maxLength={30}
                      onChange={(event) => setDraft({ ...draft, region: event.target.value })}
                    />
                  </label>
                </div>
                <label>
                  <span>Postal code</span>
                  <input
                    value={draft.postal_code}
                    onChange={(event) => setDraft({ ...draft, postal_code: event.target.value })}
                  />
                </label>
              </fieldset>
              <button
                className="button button-primary button-large button-full"
                disabled={busy || demoMode}
              >
                {busy ? "Saving customer" : demoMode ? "Disabled in sample" : "Save customer"}
              </button>
            </form>
          </aside>
        </div>
      )}
      {selectedContact && (
        <div
          className="drawer-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCustomerDetails();
          }}
        >
          <aside
            ref={detailsDialogRef}
            className="lead-drawer customer-detail-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-details-title"
          >
            <header>
              <div>
                <span>{selectedContact.company_name || "Customer record"}</span>
                <h2 id="customer-details-title">
                  {selectedContact.first_name} {selectedContact.last_name || ""}
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close customer details"
                onClick={closeCustomerDetails}
              >
                <X />
              </button>
            </header>
            <div className="customer-detail-content">
              <section className="customer-contact-summary">
                <div>
                  <Phone />
                  {selectedContact.phone ? (
                    <a href={`tel:${selectedContact.phone}`}>{selectedContact.phone}</a>
                  ) : (
                    <span>No phone</span>
                  )}
                </div>
                <div>
                  <EnvelopeSimple />
                  {selectedContact.email ? (
                    <a href={`mailto:${selectedContact.email}`}>{selectedContact.email}</a>
                  ) : (
                    <span>No email</span>
                  )}
                </div>
                <div>
                  <UserCircle />
                  <span>{assigneeName(selectedContact.assigned_to)}</span>
                </div>
              </section>

              <section
                className="communication-preferences"
                aria-labelledby="contact-preferences-title"
              >
                <div className="job-detail-heading">
                  <div>
                    <Phone />
                    <strong id="contact-preferences-title">Contact preferences</strong>
                  </div>
                  <span>{suppressions.length} blocked</span>
                </div>
                <div className="communication-preference-body">
                  <p>
                    Public contact information is not consent. Record every request to stop calls,
                    texts, or email.
                  </p>
                  {suppressions.length > 0 && (
                    <ul className="suppression-list" aria-label="Active do-not-contact preferences">
                      {suppressions.map((suppression) => (
                        <li key={suppression.id}>
                          <div>
                            <strong>
                              Do not{" "}
                              {suppression.channel === "voice"
                                ? "call"
                                : suppression.channel === "sms"
                                  ? "text"
                                  : "email"}
                            </strong>
                            <span>
                              {suppression.destination} · {suppression.reason}
                            </span>
                          </div>
                          {canLiftSuppressions && (
                            <button
                              type="button"
                              disabled={preferenceBusy || demoMode}
                              onClick={() => void liftSuppression(suppression)}
                            >
                              Lift
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {preferenceOptions.length > 0 ? (
                    <form className="suppression-form" onSubmit={recordSuppression}>
                      <label>
                        <span>Channel and destination</span>
                        <select
                          value={preferenceDestination || preferenceOptions[0]?.value || ""}
                          onChange={(event) => setPreferenceDestination(event.target.value)}
                        >
                          {preferenceOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Reason or recipient request</span>
                        <input
                          value={preferenceReason}
                          onChange={(event) => setPreferenceReason(event.target.value)}
                          placeholder="Requested no more calls"
                          minLength={2}
                          maxLength={500}
                          required
                        />
                      </label>
                      <button
                        className="button button-secondary"
                        disabled={preferenceBusy || demoMode}
                      >
                        {preferenceBusy
                          ? "Saving"
                          : demoMode
                            ? "Disabled in sample"
                            : "Record do-not-contact"}
                      </button>
                    </form>
                  ) : (
                    <p className="detail-state">
                      Add a valid US phone number or email to record a channel preference.
                    </p>
                  )}
                  {preferenceMessage && (
                    <p className="preference-message" role="status">
                      {preferenceMessage}
                    </p>
                  )}
                  <div className="consent-divider">
                    <strong>Consent evidence</strong>
                    <span>Append-only history; a do-not-contact preference always wins.</span>
                  </div>
                  {consents.length > 0 && (
                    <ul className="consent-list" aria-label="Recent communication consent events">
                      {consents.slice(0, 5).map((consent) => (
                        <li key={consent.id}>
                          <strong className={consent.status}>{consent.status}</strong>
                          <span>
                            {consent.channel} · {consent.purpose.replace("_", " ")} ·{" "}
                            {consent.destination}
                          </span>
                          <time dateTime={consent.recorded_at}>
                            {new Date(consent.recorded_at).toLocaleDateString()}
                          </time>
                        </li>
                      ))}
                    </ul>
                  )}
                  {canCreate && consentOptions.length > 0 && (
                    <div className="consent-form">
                      <div className="form-pair">
                        <label>
                          <span>Destination</span>
                          <select
                            value={consentDestination || consentOptions[0]?.value || ""}
                            onChange={(event) => {
                              setConsentDestination(event.target.value);
                              if (
                                !event.target.value.startsWith("voice:") &&
                                ["artificial_voice", "recording"].includes(consentPurpose)
                              )
                                setConsentPurpose("transactional");
                            }}
                          >
                            {consentOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Purpose</span>
                          <select
                            value={consentPurpose}
                            onChange={(event) =>
                              setConsentPurpose(
                                event.target.value as CommunicationConsent["purpose"],
                              )
                            }
                          >
                            <option value="transactional">Transactional updates</option>
                            <option value="marketing">Marketing</option>
                            {(consentDestination || consentOptions[0]?.value || "").startsWith(
                              "voice:",
                            ) && <option value="artificial_voice">AI / artificial voice</option>}
                            {(consentDestination || consentOptions[0]?.value || "").startsWith(
                              "voice:",
                            ) && <option value="recording">Call recording</option>}
                          </select>
                        </label>
                      </div>
                      <label>
                        <span>Evidence note</span>
                        <input
                          value={consentEvidence}
                          onChange={(event) => setConsentEvidence(event.target.value)}
                          placeholder="Signed form received on 09/09/2026"
                          minLength={4}
                          maxLength={500}
                        />
                      </label>
                      <div className="consent-actions">
                        <button
                          className="button button-secondary"
                          type="button"
                          disabled={consentBusy || demoMode}
                          onClick={() => void recordConsent("granted")}
                        >
                          Record consent
                        </button>
                        <button
                          className="button button-ghost"
                          type="button"
                          disabled={consentBusy || demoMode}
                          onClick={() => void recordConsent("revoked")}
                        >
                          Record revocation
                        </button>
                      </div>
                    </div>
                  )}
                  {consentMessage && (
                    <p className="preference-message" role="status">
                      {consentMessage}
                    </p>
                  )}
                </div>
              </section>

              <section className="job-detail-section">
                <div className="job-detail-heading">
                  <div>
                    <MapPin />
                    <strong>Service locations</strong>
                  </div>
                  <span>{properties.length}</span>
                </div>
                {detailLoading ? (
                  <p className="detail-state">Loading locations…</p>
                ) : properties.length === 0 ? (
                  <p className="detail-state">No service locations have been added.</p>
                ) : (
                  <div className="service-location-list">
                    {properties.map((property) => {
                      const address = [
                        property.address_line_1,
                        property.address_line_2,
                        property.city,
                        property.region,
                        property.postal_code,
                      ]
                        .filter(Boolean)
                        .join(", ");
                      return (
                        <div
                          className={`service-location-entry${property.active ? "" : " archived"}`}
                          key={property.id}
                        >
                          <article>
                            <HouseLine />
                            <div>
                              <strong>
                                {property.label || "Service location"}
                                {!property.active && <b>Archived</b>}
                              </strong>
                              <span>{address}</span>
                            </div>
                            <span className="service-location-actions">
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Map
                              </a>
                              {canCreate && property.active && (
                                <button type="button" onClick={() => beginLocationEdit(property)}>
                                  Edit
                                </button>
                              )}
                              {canArchiveLocations && (
                                <button
                                  type="button"
                                  disabled={busy || demoMode}
                                  onClick={() => void setLocationActive(property, !property.active)}
                                >
                                  {property.active ? "Archive" : "Reactivate"}
                                </button>
                              )}
                            </span>
                          </article>
                          {editingLocationId === property.id && (
                            <form className="service-location-form editing" onSubmit={saveLocation}>
                              <strong>Edit service location</strong>
                              <div className="form-pair">
                                <label>
                                  <span>Label</span>
                                  <input
                                    value={locationDraft.label}
                                    onChange={(event) =>
                                      setLocationDraft({
                                        ...locationDraft,
                                        label: event.target.value,
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  <span>Street address</span>
                                  <input
                                    required
                                    value={locationDraft.address_line_1}
                                    onChange={(event) =>
                                      setLocationDraft({
                                        ...locationDraft,
                                        address_line_1: event.target.value,
                                      })
                                    }
                                  />
                                </label>
                              </div>
                              <label>
                                <span>Unit, suite, or building</span>
                                <input
                                  value={locationDraft.address_line_2}
                                  onChange={(event) =>
                                    setLocationDraft({
                                      ...locationDraft,
                                      address_line_2: event.target.value,
                                    })
                                  }
                                />
                              </label>
                              <div className="form-location-row">
                                <label>
                                  <span>City</span>
                                  <input
                                    required
                                    value={locationDraft.city}
                                    onChange={(event) =>
                                      setLocationDraft({
                                        ...locationDraft,
                                        city: event.target.value,
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  <span>State</span>
                                  <input
                                    required
                                    maxLength={30}
                                    value={locationDraft.region}
                                    onChange={(event) =>
                                      setLocationDraft({
                                        ...locationDraft,
                                        region: event.target.value,
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  <span>Postal code</span>
                                  <input
                                    value={locationDraft.postal_code}
                                    onChange={(event) =>
                                      setLocationDraft({
                                        ...locationDraft,
                                        postal_code: event.target.value,
                                      })
                                    }
                                  />
                                </label>
                              </div>
                              <div className="service-location-edit-actions">
                                <button
                                  className="button button-ghost"
                                  type="button"
                                  onClick={() => setEditingLocationId("")}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="button button-secondary"
                                  disabled={busy || demoMode}
                                >
                                  {demoMode
                                    ? "Disabled in sample"
                                    : busy
                                      ? "Saving…"
                                      : "Save location"}
                                </button>
                              </div>
                            </form>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {canCreate && !editingLocationId && (
                  <form className="service-location-form" onSubmit={addLocation}>
                    <strong>Add another location</strong>
                    <div className="form-pair">
                      <label>
                        <span>Label</span>
                        <input
                          value={locationDraft.label}
                          onChange={(event) =>
                            setLocationDraft({ ...locationDraft, label: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        <span>Street address</span>
                        <input
                          required
                          value={locationDraft.address_line_1}
                          onChange={(event) =>
                            setLocationDraft({
                              ...locationDraft,
                              address_line_1: event.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                    <label>
                      <span>Unit, suite, or building</span>
                      <input
                        value={locationDraft.address_line_2}
                        onChange={(event) =>
                          setLocationDraft({ ...locationDraft, address_line_2: event.target.value })
                        }
                      />
                    </label>
                    <div className="form-location-row">
                      <label>
                        <span>City</span>
                        <input
                          required
                          value={locationDraft.city}
                          onChange={(event) =>
                            setLocationDraft({ ...locationDraft, city: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        <span>State</span>
                        <input
                          required
                          maxLength={30}
                          value={locationDraft.region}
                          onChange={(event) =>
                            setLocationDraft({ ...locationDraft, region: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        <span>Postal code</span>
                        <input
                          value={locationDraft.postal_code}
                          onChange={(event) =>
                            setLocationDraft({ ...locationDraft, postal_code: event.target.value })
                          }
                        />
                      </label>
                    </div>
                    <button className="button button-secondary" disabled={busy || demoMode}>
                      <Plus /> {demoMode ? "Disabled in sample" : busy ? "Saving…" : "Add location"}
                    </button>
                  </form>
                )}
              </section>

              <section className="job-detail-section">
                <div className="job-detail-heading">
                  <div>
                    <HouseLine />
                    <strong>Customer jobs</strong>
                  </div>
                  <span>{customerJobs.length}</span>
                </div>
                {detailLoading ? (
                  <p className="detail-state">Loading jobs…</p>
                ) : customerJobs.length === 0 ? (
                  <p className="detail-state">No jobs are linked to this customer.</p>
                ) : (
                  <div className="customer-job-list">
                    {customerJobs.map((job) => (
                      <article key={job.id}>
                        <div>
                          <strong>{job.title}</strong>
                          <span>
                            {job.trade} · {job.stage}
                          </span>
                        </div>
                        <b className={job.status}>{job.status.replace("_", " ")}</b>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              {canMergeCustomers && (
                <section className="job-detail-section customer-merge-section">
                  <div className="job-detail-heading">
                    <div>
                      <UserCircle />
                      <strong>Merge duplicate customer</strong>
                    </div>
                  </div>
                  <p>
                    Move this customer’s locations, leads, jobs, appointments, files, calls, and
                    contact-preference history into the record you keep. This customer record is
                    then permanently removed.
                  </p>
                  {mergeCandidates.length > 0 ? (
                    <form className="customer-merge-form" onSubmit={mergeCustomer}>
                      <label>
                        <span>Customer record to keep</span>
                        <select
                          value={mergeTargetId}
                          onChange={(event) => {
                            setMergeTargetId(event.target.value);
                            setMergeConfirmation("");
                          }}
                          required
                        >
                          <option value="">Select the surviving customer</option>
                          {mergeCandidates.map((contact) => (
                            <option key={contact.id} value={contact.id}>
                              {contact.first_name} {contact.last_name || ""}
                              {contact.company_name ? ` · ${contact.company_name}` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Type MERGE to confirm</span>
                        <input
                          value={mergeConfirmation}
                          onChange={(event) => setMergeConfirmation(event.target.value)}
                          placeholder="MERGE"
                          autoComplete="off"
                          required
                        />
                      </label>
                      <button
                        className="button button-ghost"
                        disabled={
                          busy || demoMode || !mergeTargetId || mergeConfirmation !== "MERGE"
                        }
                      >
                        {demoMode
                          ? "Disabled in sample"
                          : busy
                            ? "Merging…"
                            : "Merge and remove duplicate"}
                      </button>
                    </form>
                  ) : (
                    <p className="detail-state">Add another customer before merging duplicates.</p>
                  )}
                </section>
              )}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
