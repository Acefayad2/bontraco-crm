import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceErrorBoundary } from "./WorkspaceErrorBoundary";

let shouldThrow = true;

function Section() {
  if (shouldThrow) throw new Error("section failed");
  return <h1>Recovered section</h1>;
}

describe("WorkspaceErrorBoundary", () => {
  afterEach(() => {
    shouldThrow = true;
    vi.restoreAllMocks();
  });

  it("keeps a failed section inside the workspace and retries it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const user = userEvent.setup();

    render(
      <WorkspaceErrorBoundary section="Leads" onReturnToOverview={vi.fn()}>
        <Section />
      </WorkspaceErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Leads could not load");
    shouldThrow = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("heading", { name: "Recovered section" })).toBeVisible();
  });

  it("offers a route back to the stable overview", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const onReturnToOverview = vi.fn();
    const user = userEvent.setup();

    render(
      <WorkspaceErrorBoundary section="Jobs" onReturnToOverview={onReturnToOverview}>
        <Section />
      </WorkspaceErrorBoundary>,
    );

    await user.click(screen.getByRole("button", { name: "Return to Overview" }));
    expect(onReturnToOverview).toHaveBeenCalledOnce();
  });
});
