import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authRequestTimeoutMs } from "../lib/auth-request-deadline";

const mocks = vi.hoisted(() => ({
  getSupabase: vi.fn(),
  workspace: {
    id: "account-one",
    name: "Ace Roofing",
    slug: "ace-roofing",
    trades: ["roofing"],
    role: "owner" as const,
    entitlements: ["core_crm"],
  },
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ demoMode: false, user: { id: "owner-one" } }),
}));

vi.mock("../workspace/WorkspaceContext", () => ({
  useWorkspace: () => ({ workspace: mocks.workspace }),
}));

vi.mock("../lib/supabase", () => ({ getSupabase: mocks.getSupabase }));
vi.mock("../lib/workspace-auto-refresh", () => ({ useWorkspaceAutoRefresh: vi.fn() }));
vi.mock("../components/JobCommercialPanel", () => ({
  JobCommercialPanel: () => <div>Commercial details</div>,
}));

import { JobsPage } from "./JobsPage";

const job = {
  id: "job-one",
  assigned_to: "owner-one",
  title: "Roof replacement",
  trade: "roofing",
  stage: "Inspection",
  status: "open",
  estimated_value: 12000,
  scheduled_start: null,
  safety_intake: {},
  contact: {
    id: "contact-one",
    first_name: "Jordan",
    last_name: "Homeowner",
    company_name: null,
  },
  property: null,
};

function mutationBuilder(result: unknown) {
  const builder = {
    eq: () => builder,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

function queryBuilder(result: unknown, insert: unknown, update: unknown) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: () => insert,
    update: () => mutationBuilder(update),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

function jobsClient(
  options: {
    stalled?: boolean;
    failedTable?: string;
    insert?: unknown;
    update?: unknown;
    checklist?: unknown[];
    files?: unknown[];
    upload?: unknown;
    remove?: (paths: string[]) => unknown;
    signedUrl?: unknown;
  } = {},
) {
  const stalled = new Promise(() => undefined);
  const insert = options.insert ?? Promise.resolve({ error: null });
  const update = options.update ?? Promise.resolve({ error: null });
  return {
    from: vi.fn((table: string) => {
      if (options.stalled) return queryBuilder(stalled, insert, update);
      const data =
        table === "jobs"
          ? [job]
          : table === "contacts"
            ? [job.contact]
            : table === "memberships"
              ? [{ user_id: "owner-one", display_name: "Owner One", email: "owner@example.com" }]
              : table === "job_checklist_items"
                ? (options.checklist ?? [])
                : table === "files"
                  ? (options.files ?? [])
                  : [];
      return queryBuilder(
        {
          data,
          error: options.failedTable === table ? new Error("query failed") : null,
        },
        insert,
        update,
      );
    }),
    storage: {
      from: () => ({
        upload: () => options.upload ?? Promise.resolve({ error: null }),
        remove: (paths: string[]) => options.remove?.(paths) ?? Promise.resolve({ error: null }),
        createSignedUrl: () =>
          options.signedUrl ??
          Promise.resolve({ data: { signedUrl: "https://files.example/test" }, error: null }),
      }),
    },
  };
}

async function advanceRequestDeadline() {
  await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs + 1));
}

async function renderLoadedJobs() {
  mocks.getSupabase.mockResolvedValue(jobsClient());
  render(<JobsPage />);
  expect(await screen.findByText("Roof replacement")).toBeInTheDocument();
}

describe("JobsPage read recovery", () => {
  beforeEach(() => mocks.getSupabase.mockReset());

  afterEach(() => vi.useRealTimers());

  it("releases job loading when the client is unavailable", async () => {
    mocks.getSupabase.mockResolvedValue(null);
    render(<JobsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not load jobs and service locations",
    );
    expect(screen.queryByText("Loading jobs")).not.toBeInTheDocument();
  });

  it("releases a stalled job-list request", async () => {
    vi.useFakeTimers();
    mocks.getSupabase.mockResolvedValue(jobsClient({ stalled: true }));
    render(<JobsPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "could not load jobs and service locations",
    );
    expect(screen.queryByText("Loading jobs")).not.toBeInTheDocument();
  });

  it("releases detail loading when the client becomes unavailable", async () => {
    await renderLoadedJobs();
    mocks.getSupabase.mockReset().mockResolvedValue(null);
    fireEvent.click(screen.getByRole("button", { name: "Details" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not load the job checklist, notes, and files",
    );
    expect(screen.queryByText("Loading checklist…")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading notes…")).not.toBeInTheDocument();
  });

  it("releases a stalled job-detail request", async () => {
    await renderLoadedJobs();
    mocks.getSupabase.mockReset().mockResolvedValue(jobsClient({ stalled: true }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Loading checklist…")).toBeInTheDocument();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "could not load the job checklist, notes, and files",
    );
    expect(screen.queryByText("Loading checklist…")).not.toBeInTheDocument();
  });

  it("releases stalled job creation without encouraging a duplicate", async () => {
    await renderLoadedJobs();
    const stalled = new Promise(() => undefined);
    mocks.getSupabase.mockReset().mockResolvedValue(jobsClient({ insert: stalled }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "New job" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Job title" }), {
      target: { value: "Leak repair" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Customer" }), {
      target: { value: "contact-one" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    expect(screen.getByRole("button", { name: "Saving job" })).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("may still be created");
    expect(screen.getByRole("button", { name: "Create job" })).toBeEnabled();
  });

  it("releases a stalled job assignment", async () => {
    await renderLoadedJobs();
    const stalled = new Promise(() => undefined);
    mocks.getSupabase.mockReset().mockResolvedValue(jobsClient({ update: stalled }));
    vi.useFakeTimers();
    const assignee = screen.getByRole("combobox", { name: "Assignee for Roof replacement" });
    fireEvent.change(assignee, { target: { value: "" } });
    expect(assignee).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("assignment may still be saved");
    expect(assignee).toBeEnabled();
  });

  it("distinguishes successful job creation from a failed list refresh", async () => {
    const client = jobsClient();
    mocks.getSupabase.mockResolvedValue(client);
    render(<JobsPage />);
    expect(await screen.findByText("Roof replacement")).toBeInTheDocument();
    mocks.getSupabase.mockReset().mockResolvedValueOnce(client).mockResolvedValueOnce(null);
    fireEvent.click(screen.getByRole("button", { name: "New job" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Job title" }), {
      target: { value: "Leak repair" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Customer" }), {
      target: { value: "contact-one" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));

    expect(
      await screen.findByText(
        "The job was created, but the job list could not refresh. Reload Bontraco.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Create a job" })).not.toBeInTheDocument();
  });

  it("releases a stalled stage update", async () => {
    await renderLoadedJobs();
    const stalled = new Promise(() => undefined);
    mocks.getSupabase.mockReset().mockResolvedValue(jobsClient({ update: stalled }));
    vi.useFakeTimers();
    const stage = screen.getByRole("combobox", { name: "Stage for Roof replacement" });
    fireEvent.change(stage, { target: { value: "Estimate" } });
    expect(stage).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("stage may still be updated");
    expect(stage).toBeEnabled();
  });

  it("releases a stalled job-note write", async () => {
    await renderLoadedJobs();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(await screen.findByText("No notes on this job yet.")).toBeInTheDocument();
    const stalled = new Promise(() => undefined);
    mocks.getSupabase.mockReset().mockResolvedValue(jobsClient({ insert: stalled }));
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole("textbox", { name: "Job note" }), {
      target: { value: "Customer approved materials" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("note may still be added");
    expect(screen.getByRole("button", { name: "Add note" })).toBeEnabled();
  });

  it("releases a stalled checklist update", async () => {
    const checklist = [
      {
        id: "check-one",
        category: "Safety",
        label: "Confirm ladder safety",
        required: true,
        completed_at: null,
        completed_by: null,
      },
    ];
    mocks.getSupabase.mockResolvedValue(jobsClient({ checklist }));
    render(<JobsPage />);
    expect(await screen.findByText("Roof replacement")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    const checkbox = await screen.findByRole("checkbox", { name: /Confirm ladder safety/ });
    const stalled = new Promise(() => undefined);
    mocks.getSupabase.mockReset().mockResolvedValue(jobsClient({ update: stalled }));
    vi.useFakeTimers();
    fireEvent.click(checkbox);
    expect(checkbox).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("item may still be updated");
    expect(checkbox).toBeEnabled();
  });

  it("keeps a confirmed note when its detail refresh fails", async () => {
    const client = jobsClient();
    mocks.getSupabase.mockResolvedValue(client);
    render(<JobsPage />);
    expect(await screen.findByText("Roof replacement")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(await screen.findByText("No notes on this job yet.")).toBeInTheDocument();
    mocks.getSupabase.mockReset().mockResolvedValueOnce(client).mockResolvedValueOnce(null);
    fireEvent.change(screen.getByRole("textbox", { name: "Job note" }), {
      target: { value: "Customer approved materials" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));

    expect(
      await screen.findByText(
        "The note was added, but job details could not refresh. Reload Bontraco.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Job note" })).toHaveValue("");
  });

  it("releases a stalled private-file upload", async () => {
    await renderLoadedJobs();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    const input = await screen.findByLabelText("Attach job file");
    const stalled = new Promise(() => undefined);
    mocks.getSupabase.mockReset().mockResolvedValue(jobsClient({ upload: stalled }));
    vi.useFakeTimers();
    fireEvent.change(input, {
      target: { files: [new File(["scope"], "scope.txt", { type: "text/plain" })] },
    });
    expect(input).toBeDisabled();

    await act(async () => vi.advanceTimersByTimeAsync(authRequestTimeoutMs * 3 + 1));

    expect(screen.getByRole("alert")).toHaveTextContent("upload may still finish");
    expect(input).toBeEnabled();
  });

  it("does not clean up an upload while its metadata write is uncertain", async () => {
    await renderLoadedJobs();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    const input = await screen.findByLabelText("Attach job file");
    const stalled = new Promise(() => undefined);
    const remove = vi.fn(() => Promise.resolve({ error: null }));
    mocks.getSupabase.mockReset().mockResolvedValue(jobsClient({ insert: stalled, remove }));
    vi.useFakeTimers();
    fireEvent.change(input, {
      target: { files: [new File(["scope"], "scope.txt", { type: "text/plain" })] },
    });

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("record may still be saved");
    expect(remove).not.toHaveBeenCalled();
    expect(input).toBeEnabled();
  });

  it("removes an uploaded object after a known metadata failure", async () => {
    await renderLoadedJobs();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    const input = await screen.findByLabelText("Attach job file");
    const remove = vi.fn(() => Promise.resolve({ error: null }));
    mocks.getSupabase.mockReset().mockResolvedValue(
      jobsClient({
        insert: Promise.resolve({ error: new Error("metadata unavailable") }),
        remove,
      }),
    );
    fireEvent.change(input, {
      target: { files: [new File(["scope"], "scope.txt", { type: "text/plain" })] },
    });

    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));

    expect(remove).toHaveBeenCalledWith([expect.stringMatching(/scope\.txt$/)]);
    expect(screen.getByRole("alert")).toHaveTextContent("could not finish saving this file");
    expect(input).toBeEnabled();
  });

  it("releases a stalled signed-download request", async () => {
    const file = {
      id: "file-one",
      storage_path: "account-one/job-one/scope.txt",
      original_name: "scope.txt",
      byte_size: 5,
      created_at: "2026-09-13T12:00:00.000Z",
    };
    mocks.getSupabase.mockResolvedValue(jobsClient({ files: [file] }));
    render(<JobsPage />);
    expect(await screen.findByText("Roof replacement")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    const download = await screen.findByRole("button", { name: "Download scope.txt" });
    const stalled = new Promise(() => undefined);
    mocks.getSupabase.mockReset().mockResolvedValue(jobsClient({ signedUrl: stalled }));
    vi.useFakeTimers();
    fireEvent.click(download);
    expect(screen.getByRole("button", { name: "Preparing scope.txt" })).toBeDisabled();

    await advanceRequestDeadline();

    expect(screen.getByRole("alert")).toHaveTextContent("took too long");
    expect(screen.getByRole("button", { name: "Download scope.txt" })).toBeEnabled();
  });
});
