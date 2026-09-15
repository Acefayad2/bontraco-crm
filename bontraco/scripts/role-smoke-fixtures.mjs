/* global process */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const [mode, rawRunId] = process.argv.slice(2);
const runId = String(rawRunId || "").toLowerCase();
if (!/^[a-z0-9]{6,24}$/.test(runId)) throw new Error("Provide a 6-24 character run id");
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error("Supabase service environment is required");
if (process.env.SUPABASE_SERVICE_ROLE_KEY.length < 32)
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is incomplete; reconnect the full Supabase backend secret",
  );

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const roles = ["owner", "admin", "dispatcher", "sales", "field"];
const actors = [...roles, "outsider"];
const emailFor = (role) => `bontraco-${runId}-${role}@example.org`;

async function findFixtureUsers(emails) {
  const matches = [];
  const perPage = 200;
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Could not list smoke-test users: ${error.message}`);
    matches.push(...data.users.filter((candidate) => emails.has(candidate.email || "")));
    if (matches.length === emails.size || data.users.length < perPage) break;
  }
  return matches;
}

async function deleteFixtures() {
  const slugs = [`bontraco-smoke-${runId}`, `bontraco-smoke-foreign-${runId}`];
  const { data: accounts, error: accountLookupError } = await supabase
    .from("accounts")
    .select("id")
    .in("slug", slugs);
  if (accountLookupError) throw new Error("Could not locate smoke-test workspaces");
  if (accounts?.length) {
    const { error } = await supabase
      .from("accounts")
      .delete()
      .in(
        "id",
        accounts.map((account) => account.id),
      );
    if (error) throw new Error("Could not remove the smoke-test workspace");
  }
  const emails = new Set(actors.map(emailFor));
  for (const user of await findFixtureUsers(emails)) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) throw new Error("Could not remove a smoke-test user");
  }
  return { cleaned: true, runId };
}

async function createFixtures() {
  await deleteFixtures();
  const createdUsers = [];
  const password = `Bontraco-${runId}-Qa!4937`;
  try {
    for (const role of actors) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: emailFor(role),
        password,
        email_confirm: true,
        user_metadata: { full_name: `Smoke ${role}` },
      });
      if (error || !data.user) throw new Error(`Could not create ${role} smoke user`);
      createdUsers.push({ id: data.user.id, role, email: emailFor(role) });
    }
    const owner = createdUsers.find((user) => user.role === "owner");
    const sales = createdUsers.find((user) => user.role === "sales");
    const field = createdUsers.find((user) => user.role === "field");
    const outsider = createdUsers.find((user) => user.role === "outsider");
    const accountId = randomUUID();
    const { error: accountError } = await supabase.from("accounts").insert({
      id: accountId,
      name: `Bontraco Role Smoke ${runId}`,
      slug: `bontraco-smoke-${runId}`,
      trades: ["roofing", "plumbing", "electrical"],
      created_by: owner.id,
    });
    if (accountError) throw new Error("Could not create smoke-test workspace");
    const { error: memberError } = await supabase.from("memberships").insert(
      createdUsers
        .filter((user) => roles.includes(user.role))
        .map((user) => ({
          account_id: accountId,
          user_id: user.id,
          role: user.role,
          display_name: `Smoke ${user.role}`,
          email: user.email,
        })),
    );
    if (memberError) throw new Error("Could not create smoke-test memberships");

    const contacts = [
      {
        id: randomUUID(),
        assigned_to: sales.id,
        first_name: "Sales",
        last_name: "Customer",
        phone: "+13125550101",
        email: `sales-customer-${runId}@example.invalid`,
      },
      {
        id: randomUUID(),
        assigned_to: field.id,
        first_name: "Field",
        last_name: "Customer",
        phone: "+13125550102",
        email: `field-customer-${runId}@example.invalid`,
      },
      {
        id: randomUUID(),
        assigned_to: null,
        first_name: "Manager",
        last_name: "Customer",
        phone: "+13125550103",
        email: `manager-customer-${runId}@example.invalid`,
      },
    ];
    const { error: contactError } = await supabase.from("contacts").insert(
      contacts.map((contact) => ({
        ...contact,
        account_id: accountId,
        source: "role_smoke_test",
        created_by: owner.id,
      })),
    );
    if (contactError) throw new Error("Could not create smoke-test customers");
    const properties = contacts.map((contact, index) => ({
      id: randomUUID(),
      account_id: accountId,
      contact_id: contact.id,
      label: `${contact.first_name} jobsite`,
      address_line_1: `${100 + index} Test Avenue`,
      city: "Chicago",
      region: "IL",
      postal_code: "60601",
    }));
    const { error: propertyError } = await supabase.from("properties").insert(properties);
    if (propertyError) throw new Error("Could not create smoke-test properties");
    const jobs = contacts.map((contact, index) => ({
      id: randomUUID(),
      account_id: accountId,
      contact_id: contact.id,
      property_id: properties[index].id,
      assigned_to: contact.assigned_to,
      title: `${contact.first_name} assigned roof job`,
      trade: "roofing",
      stage: "Inspection",
      created_by: owner.id,
    }));
    const { error: jobError } = await supabase.from("jobs").insert(jobs);
    if (jobError) throw new Error("Could not create smoke-test jobs");
    const { error: appointmentError } = await supabase.from("appointments").insert(
      jobs.map((job, index) => ({
        account_id: accountId,
        job_id: job.id,
        contact_id: job.contact_id,
        assigned_to: job.assigned_to,
        title: `${job.title} appointment`,
        starts_at: new Date(Date.now() + (index + 1) * 86400000).toISOString(),
        ends_at: new Date(Date.now() + (index + 1) * 86400000 + 3600000).toISOString(),
        created_by: owner.id,
      })),
    );
    if (appointmentError) throw new Error("Could not create smoke-test appointments");
    const { error: leadError } = await supabase.from("leads").insert({
      account_id: accountId,
      assigned_to: sales.id,
      title: "Sales assigned smoke lead",
      trade: "roofing",
      source: "role_smoke_test",
      dedup_key: `role-smoke-${runId}`,
    });
    if (leadError) throw new Error("Could not create smoke-test lead");
    const { error: suppressionError } = await supabase.from("communication_suppressions").insert(
      contacts.map((contact) => ({
        account_id: accountId,
        contact_id: contact.id,
        channel: "sms",
        destination: contact.phone,
        reason: "Five-role isolation acceptance fixture",
        source: "manual",
        created_by: owner.id,
      })),
    );
    if (suppressionError) throw new Error("Could not create smoke-test suppressions");
    const { error: consentError } = await supabase.from("communication_consents").insert(
      contacts.map((contact) => ({
        account_id: accountId,
        contact_id: contact.id,
        channel: "email",
        purpose: "transactional",
        destination: contact.email,
        status: "granted",
        source: "manual",
        disclosure_version: "role-smoke-v1",
        evidence: { fixture: true, run_id: runId },
        created_by: owner.id,
      })),
    );
    if (consentError) throw new Error("Could not create smoke-test consents");

    const foreignAccountId = randomUUID();
    const foreignContactId = randomUUID();
    const foreignPropertyId = randomUUID();
    const foreignJobId = randomUUID();
    const foreignAppointmentId = randomUUID();
    const foreignLeadId = randomUUID();
    const foreignSuppressionId = randomUUID();
    const foreignConsentId = randomUUID();
    const { error: foreignAccountError } = await supabase.from("accounts").insert({
      id: foreignAccountId,
      name: `Bontraco Foreign Smoke ${runId}`,
      slug: `bontraco-smoke-foreign-${runId}`,
      trades: ["plumbing"],
      created_by: outsider.id,
    });
    if (foreignAccountError) throw new Error("Could not create foreign smoke-test workspace");
    const { error: foreignMembershipError } = await supabase.from("memberships").insert({
      account_id: foreignAccountId,
      user_id: outsider.id,
      role: "owner",
      display_name: "Smoke outsider",
      email: outsider.email,
    });
    if (foreignMembershipError) throw new Error("Could not create foreign smoke-test membership");
    const { error: foreignContactError } = await supabase.from("contacts").insert({
      id: foreignContactId,
      account_id: foreignAccountId,
      first_name: "Foreign",
      last_name: "Customer",
      phone: "+17735550199",
      email: `foreign-customer-${runId}@example.invalid`,
      source: "role_smoke_test",
      created_by: outsider.id,
    });
    if (foreignContactError) throw new Error("Could not create foreign smoke-test customer");
    const { error: foreignPropertyError } = await supabase.from("properties").insert({
      id: foreignPropertyId,
      account_id: foreignAccountId,
      contact_id: foreignContactId,
      label: "Foreign jobsite",
      address_line_1: "999 Foreign Test Avenue",
      city: "Chicago",
      region: "IL",
      postal_code: "60601",
    });
    if (foreignPropertyError) throw new Error("Could not create foreign smoke-test property");
    const { error: foreignJobError } = await supabase.from("jobs").insert({
      id: foreignJobId,
      account_id: foreignAccountId,
      contact_id: foreignContactId,
      property_id: foreignPropertyId,
      title: "Foreign plumbing job",
      trade: "plumbing",
      stage: "New",
      created_by: outsider.id,
    });
    if (foreignJobError) throw new Error("Could not create foreign smoke-test job");
    const { error: foreignAppointmentError } = await supabase.from("appointments").insert({
      id: foreignAppointmentId,
      account_id: foreignAccountId,
      job_id: foreignJobId,
      contact_id: foreignContactId,
      title: "Foreign plumbing appointment",
      starts_at: new Date(Date.now() + 86400000).toISOString(),
      ends_at: new Date(Date.now() + 90000000).toISOString(),
      created_by: outsider.id,
    });
    if (foreignAppointmentError) throw new Error("Could not create foreign smoke-test appointment");
    const { error: foreignLeadError } = await supabase.from("leads").insert({
      id: foreignLeadId,
      account_id: foreignAccountId,
      title: "Foreign smoke lead",
      trade: "plumbing",
      source: "role_smoke_test",
      dedup_key: `role-smoke-foreign-${runId}`,
    });
    if (foreignLeadError) throw new Error("Could not create foreign smoke-test lead");
    const { error: foreignSuppressionError } = await supabase
      .from("communication_suppressions")
      .insert({
        id: foreignSuppressionId,
        account_id: foreignAccountId,
        contact_id: foreignContactId,
        channel: "sms",
        destination: "+17735550199",
        reason: "Foreign isolation acceptance fixture",
        source: "manual",
        created_by: outsider.id,
      });
    if (foreignSuppressionError) throw new Error("Could not create foreign smoke-test suppression");
    const { error: foreignConsentError } = await supabase.from("communication_consents").insert({
      id: foreignConsentId,
      account_id: foreignAccountId,
      contact_id: foreignContactId,
      channel: "email",
      purpose: "transactional",
      destination: `foreign-customer-${runId}@example.invalid`,
      status: "granted",
      source: "manual",
      disclosure_version: "role-smoke-v1",
      evidence: { fixture: true, run_id: runId },
      created_by: outsider.id,
    });
    if (foreignConsentError) throw new Error("Could not create foreign smoke-test consent");
    return {
      runId,
      accountId,
      users: createdUsers
        .filter((user) => roles.includes(user.role))
        .map(({ role, email }) => ({ role, email })),
    };
  } catch (error) {
    await deleteFixtures().catch(() => undefined);
    throw error;
  }
}

const result =
  mode === "create" ? await createFixtures() : mode === "cleanup" ? await deleteFixtures() : null;
if (!result) throw new Error("Mode must be create or cleanup");
process.stdout.write(`${JSON.stringify(result)}\n`);
