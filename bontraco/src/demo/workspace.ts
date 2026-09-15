import type { Workspace, WorkspaceOption } from "../workspace/WorkspaceContext";

export const demoWorkspaceOption: WorkspaceOption = {
  id: "demo",
  name: "Blue Ridge Exteriors",
  slug: "demo",
  trades: ["roofing"],
  role: "owner",
};

export const demoWorkspace: Workspace = {
  ...demoWorkspaceOption,
  entitlements: ["core_crm", "lead_engine", "ai_receptionist", "advanced_reporting"],
};
