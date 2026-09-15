/* global process, console, fetch, setTimeout */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";

const cliPackage = "@playwright/cli@0.1.19";
const arguments_ = process.argv.slice(2);
const authGate = arguments_.includes("--auth-gate");
const suppliedUrl =
  arguments_.find((argument) => !argument.startsWith("--")) ||
  process.env.BONTRACO_PREVIEW_URL ||
  "";
if (suppliedUrl && !/^https?:\/\/[^\s]+$/i.test(suppliedUrl))
  throw new Error("Browser smoke URL must use HTTP(S)");

const session = `bontraco-${randomUUID().slice(0, 8)}`;
const outputDirectory = mkdtempSync(join(tmpdir(), "bontraco-browser-"));
let previewProcess;

async function availablePort() {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function cli(...arguments_) {
  const result = spawnSync(
    "npx",
    ["--yes", "--package", cliPackage, "playwright-cli", `-s=${session}`, ...arguments_],
    { cwd: outputDirectory, encoding: "utf8" },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    throw new Error(`Browser command failed: ${arguments_[0]}`);
  }
  return result.stdout;
}

async function waitForPreview(url) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The local preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Local preview did not become ready within 30 seconds");
}

const browserChecks = String.raw`async (page) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  async function assertPageStructure(section) {
    const issues = await page.evaluate(() => {
      const visible = (element) => element.getClientRects().length > 0;
      const found = [];
      const mains = Array.from(document.querySelectorAll("main")).filter(visible);
      if (mains.length !== 1) found.push("expected one visible main landmark, found " + mains.length);
      const headings = mains[0]
        ? Array.from(mains[0].querySelectorAll("h1, h2, h3, h4, h5, h6")).filter(visible)
        : [];
      if (headings.filter((heading) => heading.tagName === "H1").length !== 1)
        found.push("expected one visible H1");
      for (let index = 1; index < headings.length; index += 1) {
        const previousLevel = Number(headings[index - 1].tagName.slice(1));
        const level = Number(headings[index].tagName.slice(1));
        if (level > previousLevel + 1)
          found.push("heading level skips from H" + previousLevel + " to H" + level);
      }
      const ids = Array.from(document.querySelectorAll("[id]"), (element) => element.id);
      const duplicateIds = ids.filter((id, index) => id && ids.indexOf(id) !== index);
      if (duplicateIds.length) found.push("duplicate IDs: " + [...new Set(duplicateIds)].join(", "));
      for (const nav of Array.from(document.querySelectorAll("nav")).filter(visible)) {
        const labelledBy = nav.getAttribute("aria-labelledby");
        const name = nav.getAttribute("aria-label") || (labelledBy ? document.getElementById(labelledBy)?.textContent : "");
        if (!name?.trim()) found.push("visible navigation landmark has no accessible name");
      }
      const interactive = Array.from(
        document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea'),
      ).filter(visible);
      for (const element of interactive) {
        const labelledBy = element
          .getAttribute("aria-labelledby")
          ?.split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent || "")
          .join(" ");
        const labels = "labels" in element
          ? Array.from(element.labels || [], (label) => label.textContent || "").join(" ")
          : "";
        const imageAlt = element.querySelector("img")?.getAttribute("alt") || "";
        const value = element instanceof HTMLInputElement && ["button", "submit", "reset"].includes(element.type)
          ? element.value
          : "";
        const name = element.getAttribute("aria-label") || labelledBy || labels || element.textContent || imageAlt || value || element.getAttribute("title") || "";
        if (!name.trim()) found.push("unnamed visible " + element.tagName.toLowerCase());
      }
      return found;
    });
    if (issues.length) throw new Error(section + " structure: " + issues.join(" | "));
  }
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Good morning/ }).waitFor();
  if ((await page.title()) !== "Overview | Blue Ridge Exteriors | Bontraco") throw new Error("Overview document title is not workspace-specific");
  await assertPageStructure("Overview");
  await page.getByRole("button", { name: /^Leads(?:\s|$)/ }).first().focus();
  await page.waitForFunction(() =>
    performance
      .getEntriesByType("resource")
      .some((entry) => /\/LeadsPage(?:-[^/]+\.js|\.tsx)(?:$|\?)/.test(entry.name)),
  );
  if ((await page.getByRole("heading", { name: "Leads", exact: true }).count()) !== 0)
    throw new Error("Section preloading navigated away from Overview");
  await page.getByText("Lead assigned to Jordan Lee: Schaumburg roof leak", { exact: true }).waitFor();
  const notificationButton = page.getByRole("button", { name: "1 unread notifications", exact: true });
  await notificationButton.click();
  await page.getByText("Lead assigned to you", { exact: true }).waitFor();
  await page.getByText("Schaumburg roof leak", { exact: true }).last().waitFor();
  await page.getByRole("button").filter({ hasText: "Lead assigned to you" }).click();
  await page.getByRole("heading", { name: "Leads", exact: true }).waitFor();
  await page.getByRole("button", { name: "Overview", exact: true }).click();

  const sections = ["Leads", "Lead Engine", "Customers", "Jobs", "Schedule", "Tasks", "Calls", "Reports", "Team", "Settings"];
  for (const section of sections) {
    await page.getByRole("button", { name: new RegExp("^" + section + "(?:\\s|$)") }).first().click();
    await page.getByRole("heading", { name: section, exact: true }).waitFor();
    await page.waitForTimeout(80);
    if ((await page.title()) !== section + " | Blue Ridge Exteriors | Bontraco") throw new Error(section + " document title is incorrect");
    await assertPageStructure(section);
  }

  await page.getByRole("button", { name: "Reports", exact: true }).first().click();
  await page.getByText("$303,400", { exact: true }).waitFor();
  const reportDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const reportDownload = await reportDownloadPromise;
  if (!/^bontraco-report-\d{4}-\d{2}-\d{2}\.csv$/.test(reportDownload.suggestedFilename()))
    throw new Error("Report CSV filename is invalid");
  const reportStream = await reportDownload.createReadStream();
  let reportCsv = "";
  for await (const chunk of reportStream) reportCsv += chunk.toString();
  if (!reportCsv.includes("Metric,Last 30 days\r\nLeads,84\r\nQualified leads,31"))
    throw new Error("Report CSV is missing lead metrics");
  if (!reportCsv.includes("Collected,126450\r\nCalls,137\r\nAnswered calls,129"))
    throw new Error("Report CSV is missing revenue or call metrics");

  await page.getByRole("button", { name: "Tasks", exact: true }).first().click();
  await page.locator(".task-stats article").first().getByText("2", { exact: true }).waitFor();
  await page.getByText("open tasks", { exact: true }).waitFor();
  await page.getByText("Call Maria to confirm material color", { exact: true }).waitFor();
  const newTaskButton = page.getByRole("button", { name: "New task", exact: true });
  await newTaskButton.click();
  await page.getByLabel("Task", { exact: true }).waitFor();
  const taskDialog = page.getByRole("dialog", { name: "New task", exact: true });
  if (!(await taskDialog.evaluate((dialog) => dialog.contains(document.activeElement)))) throw new Error("New task dialog did not receive focus");
  const taskFocusable = taskDialog.locator('a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])');
  await taskFocusable.last().focus();
  await page.keyboard.press("Tab");
  if (!(await taskFocusable.first().evaluate((element) => element === document.activeElement))) throw new Error("Tab escaped the new task dialog");
  await taskFocusable.first().focus();
  await page.keyboard.press("Shift+Tab");
  if (!(await taskFocusable.last().evaluate((element) => element === document.activeElement))) throw new Error("Shift+Tab escaped the new task dialog");
  await page.keyboard.press("Escape");
  await taskDialog.waitFor({ state: "detached" });
  await page.waitForFunction(() => document.activeElement?.textContent?.replace(/\s+/g, " ").trim() === "New task");
  await newTaskButton.click();
  await page.getByLabel("Task", { exact: true }).waitFor();
  if (!(await page.getByRole("button", { name: "Disabled in sample", exact: true }).isDisabled())) throw new Error("Sample task creation is mutable");
  await page.getByRole("button", { name: "Close task form", exact: true }).click();

  await page.getByRole("button", { name: "Schedule", exact: true }).first().click();
  const appointmentAssignee = page.getByLabel("Assignee for Emergency leak inspection", { exact: true });
  if ((await appointmentAssignee.inputValue()) !== "demo-field") throw new Error("Appointment assignee is not loaded");
  if (!(await appointmentAssignee.isDisabled())) throw new Error("Sample appointment assignment is mutable");

  await page.getByRole("button", { name: "Team", exact: true }).first().click();
  await page.getByText("4/10", { exact: true }).waitFor();
  await page.getByText("AI Pro includes 10 users; pending invitations reserve a seat.", { exact: true }).waitFor();
  await page.getByText("Owners are protected; access changes are recorded in recent activity", { exact: true }).waitFor();
  const salesRole = page.getByLabel("Role for sales@example.com", { exact: true });
  if ((await salesRole.inputValue()) !== "sales") throw new Error("Sales team role is not loaded");
  if (!(await salesRole.isDisabled())) throw new Error("Sample team role is mutable");
  if ((await salesRole.locator('option[value="admin"]').count()) !== 1) throw new Error("Owner cannot promote an admin");
  if (!(await page.getByRole("button", { name: "Deactivate sales@example.com", exact: true }).isDisabled())) throw new Error("Sample team deactivation is mutable");
  if (!(await page.getByLabel("Work email", { exact: true }).isDisabled())) throw new Error("Sample invitation email is mutable");
  if (!(await page.getByRole("combobox", { name: "Role", exact: true }).isDisabled())) throw new Error("Sample invitation role is mutable");
  if (!(await page.getByRole("button", { name: "Cancel", exact: true }).isDisabled())) throw new Error("Sample invitation cancellation is mutable");

  await page.getByRole("button", { name: /Calls(?:\s|$)/ }).first().click();
  const callAssignee = page.getByLabel("Assignee for call from Lena Ortiz", { exact: true });
  if ((await callAssignee.inputValue()) !== "demo-sales") throw new Error("Call assignee is not loaded");
  if (!(await callAssignee.isDisabled())) throw new Error("Sample call assignment is mutable");
  if ((await callAssignee.locator('option[value="demo-field"]').count()) !== 0) throw new Error("Field-only teammate can receive a private call");

  await page.getByRole("button", { name: "Settings", exact: true }).first().click();
  await page.getByText("5 users included", { exact: true }).waitFor();
  if ((await page.getByText("10 users included", { exact: true }).count()) !== 2) throw new Error("Growth and AI Pro seat limits are not visible");
  await page.getByText("Lead Engine available on Growth", { exact: true }).waitFor();
  await page.getByText("3 lead searches included", { exact: true }).waitFor();
  await page.getByText("5 lead searches included", { exact: true }).waitFor();
  if ((await page.getByLabel("Legal business name").inputValue()) !== "Blue Ridge Exteriors LLC") throw new Error("Legal business name is not loaded");
  if ((await page.getByLabel("Scheduling timezone").inputValue()) !== "America/Chicago") throw new Error("Workspace timezone is not loaded");
  if ((await page.getByLabel("Business phone").inputValue()) !== "(630) 555-0100") throw new Error("Proposal business phone is not loaded");
  if ((await page.getByLabel("Business email").inputValue()) !== "estimates@blueridge.example") throw new Error("Proposal business email is not loaded");
  if ((await page.getByLabel("Business website").inputValue()) !== "https://blueridge.example") throw new Error("Proposal website is not loaded");
  if ((await page.getByLabel("Default tax rate (%)").inputValue()) !== "6.25") throw new Error("Estimate tax default is not loaded");
  if ((await page.getByLabel("Estimate valid for (days)").inputValue()) !== "30") throw new Error("Estimate validity default is not loaded");
  await page.getByText("Upload logo", { exact: true }).waitFor();
  if (!(await page.getByLabel("Upload logo", { exact: true }).isDisabled())) throw new Error("Sample logo upload is mutable");
  for (const label of ["Service area", "Business hours", "Emergency routing rules", "Business phone", "Business email", "Business website", "Proposal accent color", "Default tax rate (%)", "Estimate valid for (days)"])
    if (!(await page.getByLabel(label).isDisabled())) throw new Error(label + " sample field is mutable");

  await page.getByRole("button", { name: "Lead Engine", exact: true }).first().click();
  const runNow = page.getByRole("button", { name: "Run now", exact: true });
  await runNow.waitFor();
  if ((await runNow.count()) !== 1 || (await runNow.isEnabled()))
    throw new Error("Sample lead scan trigger must be visible and disabled");
  await page.getByText(/every 15 min · max 96 requests\/day/).waitFor();
  await page.getByRole("button", { name: "New search", exact: true }).click();
  const searchName = await page.getByLabel("Search name", { exact: true }).inputValue();
  const intentPhrases = await page.locator(".engine-form textarea").inputValue();
  if (!searchName.toLowerCase().includes("roofing")) throw new Error("Lead search name is not trade-aware");
  if (!intentPhrases.includes("need a roofer") || !intentPhrases.includes("roof leak")) throw new Error("Lead search intent defaults are not trade-aware");
  await page.locator(".engine-form select").first().selectOption("google_places");
  await page.getByText(/new profiles scan once daily by default/i).waitFor();
  await page.locator(".engine-form select").first().selectOption("tavily");
  const restoredIntentPhrases = await page.locator(".engine-form textarea").inputValue();
  if (!restoredIntentPhrases.includes("need a roofer")) throw new Error("Switching lead providers lost the trade-aware defaults");
  await page.getByRole("button", { name: "New search", exact: true }).click();

  await page.getByRole("button", { name: "Jobs", exact: true }).first().click();
  const jobAssignee = page.getByLabel("Assignee for Storm damage roof replacement", { exact: true });
  if ((await jobAssignee.inputValue()) !== "demo-field") throw new Error("Job assignee is not loaded");
  if (!(await jobAssignee.isDisabled())) throw new Error("Sample job assignment is mutable");
  await page.getByRole("button", { name: "Details", exact: true }).first().click();
  await page.getByRole("dialog").getByText("Marcus Reed", { exact: true }).waitFor();
  await page.getByText("Homeowner confirmed attic access. Bring moisture meter and document the north slope.", { exact: true }).waitFor();
  await page.getByText("north-slope-inspection.jpg", { exact: true }).waitFor();
  await page.getByLabel("Job note", { exact: true }).fill("Sample private note");
  if (!(await page.getByRole("button", { name: "Add note", exact: true }).isDisabled())) throw new Error("Sample note creation is mutable");
  if (!(await page.getByLabel("Attach job file", { exact: true }).isDisabled())) throw new Error("Sample file upload is mutable");
  if (!(await page.getByRole("button", { name: /north-slope-inspection\.jpg/ }).isDisabled())) throw new Error("Sample signed download is mutable");
  const estimatePreviewButton = page.getByRole("button", { name: /Preview\s*EST-1048/ });
  await estimatePreviewButton.click();
  const estimateDialog = page.getByRole("dialog", { name: "EST-1048" });
  await estimateDialog.getByText("Maria Torres", { exact: true }).waitFor();
  await estimateDialog.getByText("Architectural shingle roof replacement", { exact: true }).waitFor();
  await estimateDialog.getByText("(630) 555-0100 · estimates@blueridge.example", { exact: true }).waitFor();
  await estimateDialog.getByRole("link", { name: "blueridge.example", exact: true }).waitFor();
  await estimateDialog.getByRole("button", { name: "Print or save PDF", exact: true }).waitFor();
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(80);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) throw new Error("Estimate preview overflow at " + width + "px: " + overflow + "px");
  }
  await page.keyboard.press("Escape");
  await estimateDialog.waitFor({ state: "detached" });
  if ((await page.getByRole("dialog", { name: "Storm damage roof replacement" }).count()) !== 1) throw new Error("Closing the estimate preview also closed job details");
  await page.waitForFunction(() => document.activeElement instanceof HTMLButtonElement && document.activeElement.textContent?.includes("EST-1048"));

  await page.getByRole("button", { name: /Preview\s*INV-1048/ }).click();
  const invoiceDialog = page.getByRole("dialog", { name: "INV-1048" });
  await invoiceDialog.getByText("Customer invoice preview", { exact: true }).waitFor();
  await invoiceDialog.getByText("Architectural shingle roof replacement", { exact: true }).waitFor();
  await invoiceDialog.getByText("$12,828.13", { exact: true }).waitFor();
  await invoiceDialog.getByText("(630) 555-0100 · billing@blueridge.example", { exact: true }).waitFor();
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(80);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) throw new Error("Invoice preview overflow at " + width + "px: " + overflow + "px");
  }
  await invoiceDialog.getByRole("button", { name: "Close invoice preview", exact: true }).click();
  await page.getByRole("button", { name: "Close job details", exact: true }).click();

  await page.getByRole("button", { name: "Customers", exact: true }).first().click();
  const customerAssignee = page.getByLabel("Assignee for Maria Torres", { exact: true });
  if ((await customerAssignee.inputValue()) !== "demo-sales") throw new Error("Customer assignee is not loaded");
  if (!(await customerAssignee.isDisabled())) throw new Error("Sample customer assignment is mutable");
  await page.getByRole("button", { name: "View customer", exact: true }).first().click();
  await page.getByRole("heading", { name: "Maria Torres", exact: true }).waitFor();
  await page.getByText("Contact preferences", { exact: true }).waitFor();
  await page.getByText("Do not text", { exact: true }).waitFor();
  await page.getByText("Consent evidence", { exact: true }).waitFor();
  await page.getByRole("dialog").getByText("Jordan Lee", { exact: true }).waitFor();
  await page.getByText("Merge duplicate customer", { exact: true }).waitFor();
  if ((await page.getByLabel("Reason or recipient request").count()) !== 1) throw new Error("Do-not-contact reason input is not labeled");
  if (await page.getByRole("button", { name: "Record consent", exact: true }).isEnabled()) throw new Error("Sample consent mutation is enabled");
  if ((await page.getByLabel("Customer record to keep").count()) !== 1) throw new Error("Customer merge target is not labeled");
  if (await page.getByRole("button", { name: "Disabled in sample", exact: true }).last().isEnabled()) throw new Error("Sample customer merge is enabled");
  await page.getByRole("button", { name: "Close customer details" }).click();

  for (const width of [360, 390, 430, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const section of sections) {
      const navigationButton = page
        .locator(".app-sidebar button:visible")
        .filter({ hasText: new RegExp("^" + section + "(?:\\s|\\d|$)") })
        .first();
      await navigationButton.evaluate((button) =>
        button.scrollIntoView({ block: "nearest", inline: "center" }),
      );
      await navigationButton.click();
      await page.getByRole("heading", { name: section, exact: true }).waitFor();
      await page.waitForTimeout(80);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 0) throw new Error(section + " overflow at " + width + "px: " + overflow + "px");
      if ((await page.locator("main h1").count()) !== 1) throw new Error(section + " lost its heading at " + width + "px");
    }
  }

  await page.setViewportSize({ width: 640, height: 450 });
  for (const section of sections) {
    await page.getByRole("button", { name: new RegExp("^" + section + "(?:\\s|$)") }).first().click();
    await page.getByRole("heading", { name: section, exact: true }).waitFor();
    await page.waitForTimeout(80);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) throw new Error(section + " overflow at 200% desktop zoom equivalent: " + overflow + "px");
    if ((await page.locator("main h1").count()) !== 1) throw new Error(section + " lost its heading at 200% desktop zoom equivalent");
  }

  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole("button", { name: "Settings", exact: true }).last().click();
  await page.getByRole("heading", { name: "Settings", exact: true }).waitFor();
  const sampleButtons = page.getByRole("button", { name: /Sample|Available after sign-in|Disabled in sample/ });
  if ((await sampleButtons.count()) === 0) throw new Error("Demo mutation controls are not visibly disabled");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Good morning/ }).waitFor();
  await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => {
    const element = document.activeElement;
    const style = element ? getComputedStyle(element) : null;
    return { tag: element?.tagName || "", outlineStyle: style?.outlineStyle || "", outlineWidth: style?.outlineWidth || "0px" };
  });
  if (!focus.tag || focus.tag === "BODY" || focus.outlineStyle === "none" || focus.outlineWidth === "0px") throw new Error("Keyboard focus is not visibly indicated");
  if (!(await page.getByRole("link", { name: "Skip to workspace content", exact: true }).evaluate((element) => element === document.activeElement))) throw new Error("Skip link is not the first keyboard stop");
  await page.keyboard.press("Enter");
  if ((await page.evaluate(() => document.activeElement?.id)) !== "workspace-content") throw new Error("Skip link did not focus the workspace content");
  const currentNavigation = page.locator('[aria-current="page"]:visible');
  if ((await currentNavigation.count()) !== 1 || !(await currentNavigation.getByText("Overview", { exact: true }).count())) throw new Error("Active workspace navigation is not exposed to assistive technology");

  async function tabUntil(predicate, description, maximumTabs = 30) {
    for (let index = 0; index < maximumTabs; index += 1) {
      await page.keyboard.press("Tab");
      const active = await page.evaluate(() => {
        const element = document.activeElement;
        return {
          ariaLabel: element?.getAttribute("aria-label") || "",
          text: element?.textContent?.replace(/\s+/g, " ").trim() || "",
        };
      });
      if (predicate(active)) return;
    }
    throw new Error("Keyboard navigation could not reach " + description);
  }

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Good morning/ }).waitFor();
  await tabUntil((active) => active.text.startsWith("Leads"), "Leads navigation");
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Leads", exact: true }).waitFor();
  await page.locator('#workspace-announcement[aria-live="polite"][aria-atomic="true"]').getByText("Leads section loaded", { exact: true }).waitFor();
  if ((await page.locator('[aria-current="page"]:visible').getByText("Leads", { exact: true }).count()) !== 1) throw new Error("Section change did not update the current-page marker");

  await page.reload({ waitUntil: "networkidle" });
  await tabUntil((active) => active.ariaLabel === "Search workspace", "workspace search");
  await page.keyboard.type("Maria");
  await page.getByText("Maria Torres", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  if ((await page.getByLabel("Search workspace").inputValue()) !== "") throw new Error("Escape did not clear workspace search");
  await page.keyboard.press("Tab");
  const focusedNotificationLabel = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  if (focusedNotificationLabel !== "1 unread notifications") throw new Error("Keyboard navigation skipped notifications");
  await page.keyboard.press("Enter");
  await page.getByText("Lead assigned to you", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  if ((await page.getByRole("button", { name: "1 unread notifications", exact: true }).getAttribute("aria-expanded")) !== "false")
    throw new Error("Escape did not dismiss notifications");

  await page.emulateMedia({ reducedMotion: "reduce" });
  const transitionMilliseconds = await page.locator(".button").first().evaluate((element) =>
    getComputedStyle(element).transitionDuration.split(",").map((value) => value.trim().endsWith("ms") ? Number.parseFloat(value) : Number.parseFloat(value) * 1000)
  );
  if (transitionMilliseconds.some((duration) => duration > 0.02)) throw new Error("Reduced-motion transition remains active");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  const origin = page.url().split("/").slice(0, 3).join("/");
  const failureContext = await page.context().browser().newContext();
  const failurePage = await failureContext.newPage();
  await failurePage.route(/\/LeadsPage(?:-[^/]+\.js|\.tsx)(?:\?|$)/, (route) => route.abort());
  await failurePage.goto(origin + "/app", { waitUntil: "domcontentloaded" });
  await failurePage.getByRole("heading", { name: /Good morning/ }).waitFor();
  await failurePage.getByRole("button", { name: /^Leads(?:\s|$)/ }).first().click();
  await failurePage.getByRole("heading", { name: "Leads could not load", exact: true }).waitFor();
  await failurePage.getByRole("navigation", { name: "Workspace navigation" }).waitFor();
  await failurePage.getByRole("button", { name: "Return to Overview", exact: true }).click();
  await failurePage.getByRole("heading", { name: /Good morning/ }).waitFor();
  await failureContext.close();

  const publicRoutes = [
    { path: "/", name: "Marketing", heading: "Turn every call into organized work.", title: "Bontraco | Contractor operations" },
    { path: "/login", name: "Login", heading: "Welcome back", title: "Sign in | Bontraco" },
    { path: "/signup", name: "Signup", heading: "Create your company workspace", title: "Create workspace | Bontraco" },
    { path: "/forgot-password", name: "Password recovery", heading: "Reset your password", title: "Reset password | Bontraco" },
    { path: "/reset-password", name: "Password reset", heading: "Choose a new password", title: "Choose new password | Bontraco" },
    { path: "/accept-invite", name: "Invitation", heading: "Join your Bontraco team", title: "Join your team | Bontraco" },
    { path: "/estimate#invalid-customer-token", name: "Unavailable estimate", heading: "Estimate unavailable", title: "Review estimate | Bontraco" },
  ];
  for (const route of publicRoutes) {
    await page.goto(origin + route.path, { waitUntil: "domcontentloaded" });
    await page.locator("main").first().waitFor({ state: "visible" });
    await page.getByRole("heading", { name: route.heading, exact: true }).waitFor();
    if ((await page.title()) !== route.title) throw new Error(route.name + " document title is incorrect");
    await assertPageStructure(route.name);
    for (const width of [360, 390, 430, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 0) throw new Error(route.name + " overflow at " + width + "px: " + overflow + "px");
      if ((await page.locator("main h1").count()) !== 1) throw new Error(route.name + " lost its heading at " + width + "px");
    }
  }
  if ((await page.locator("body").innerText()).includes("invalid-customer-token")) throw new Error("Customer token leaked into the unavailable page");
  await page.goto(origin + "/login", { waitUntil: "domcontentloaded" });
  await page.getByRole("textbox", { name: "Work email" }).waitFor();
  if ((await page.getByLabel("Password").count()) !== 1) throw new Error("Password input is not labeled");
  if (consoleErrors.length) throw new Error("Browser console errors: " + consoleErrors.join(" | "));
}`;

const authGateChecks = String.raw`async (page) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Welcome back", exact: true }).waitFor();
  if (!page.url().endsWith("/login")) throw new Error("Protected app did not redirect to login");
  if ((await page.getByText("Sample workspace", { exact: true }).count()) !== 0) throw new Error("Production bundle exposed sample workspace");
  await page.setViewportSize({ width: 360, height: 800 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) throw new Error("Login has horizontal overflow: " + overflow + "px");
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement?.tagName || "");
  if (!focused || focused === "BODY") throw new Error("Login keyboard navigation did not move focus");
  if (consoleErrors.length) throw new Error("Browser console errors: " + consoleErrors.join(" | "));
}`;

try {
  let baseUrl = suppliedUrl;
  if (!suppliedUrl) {
    const port = await availablePort();
    baseUrl = `http://127.0.0.1:${port}/app`;
    previewProcess = spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        authGate ? "preview" : "dev",
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      {
        cwd: process.cwd(),
        stdio: "ignore",
        env: authGate ? process.env : { ...process.env, VITE_DEMO_MODE: "true" },
      },
    );
    await waitForPreview(baseUrl);
  }
  cli("open", baseUrl);
  cli("run-code", authGate ? authGateChecks : browserChecks);
  console.log(
    `Bontraco ${authGate ? "production auth gate" : "browser smoke"} passed at ${baseUrl}`,
  );
} finally {
  try {
    cli("close");
  } catch {
    // There may be no browser to close after an early setup failure.
  }
  if (previewProcess) previewProcess.kill("SIGTERM");
  rmSync(outputDirectory, { recursive: true, force: true });
}
