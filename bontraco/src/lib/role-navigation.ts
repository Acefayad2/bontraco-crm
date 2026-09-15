export type BontracoRole = "owner" | "admin" | "dispatcher" | "sales" | "field";

const navigationRoles: Record<string, BontracoRole[]> = {
  Overview: ["owner", "admin", "dispatcher", "sales", "field"],
  Leads: ["owner", "admin", "dispatcher", "sales"],
  "Lead Engine": ["owner", "admin", "dispatcher"],
  Customers: ["owner", "admin", "dispatcher", "sales"],
  Jobs: ["owner", "admin", "dispatcher", "sales", "field"],
  Schedule: ["owner", "admin", "dispatcher", "sales", "field"],
  Tasks: ["owner", "admin", "dispatcher", "sales", "field"],
  Calls: ["owner", "admin", "dispatcher", "sales"],
  Reports: ["owner", "admin", "dispatcher", "sales"],
  Team: ["owner", "admin"],
  Settings: ["owner", "admin", "dispatcher", "sales"],
};

export function canShowWorkspaceNavigation(
  label: string,
  role: BontracoRole,
  features: { leadEngine: boolean; receptionist: boolean },
) {
  if (!navigationRoles[label]?.includes(role)) return false;
  if (label === "Lead Engine") return features.leadEngine;
  if (label === "Calls") return features.receptionist;
  return true;
}
