import { describe, expect, it } from "vitest";
import { canShowWorkspaceNavigation, type BontracoRole } from "./role-navigation";

const labels = [
  "Overview",
  "Leads",
  "Lead Engine",
  "Customers",
  "Jobs",
  "Schedule",
  "Tasks",
  "Calls",
  "Reports",
  "Team",
  "Settings",
];
const features = { leadEngine: true, receptionist: true };

function visible(role: BontracoRole) {
  return labels.filter((label) => canShowWorkspaceNavigation(label, role, features));
}

describe("workspace role navigation", () => {
  it.each([
    ["owner", labels],
    ["admin", labels],
    [
      "dispatcher",
      [
        "Overview",
        "Leads",
        "Lead Engine",
        "Customers",
        "Jobs",
        "Schedule",
        "Tasks",
        "Calls",
        "Reports",
        "Settings",
      ],
    ],
    [
      "sales",
      [
        "Overview",
        "Leads",
        "Customers",
        "Jobs",
        "Schedule",
        "Tasks",
        "Calls",
        "Reports",
        "Settings",
      ],
    ],
    ["field", ["Overview", "Jobs", "Schedule", "Tasks"]],
  ] satisfies [BontracoRole, string[]][])("limits %s navigation", (role, expected) => {
    expect(visible(role)).toEqual(expected);
  });

  it("removes provider-backed modules when their feature is unavailable", () => {
    expect(
      labels.filter((label) =>
        canShowWorkspaceNavigation(label, "owner", {
          leadEngine: false,
          receptionist: false,
        }),
      ),
    ).not.toEqual(expect.arrayContaining(["Lead Engine", "Calls"]));
  });
});
