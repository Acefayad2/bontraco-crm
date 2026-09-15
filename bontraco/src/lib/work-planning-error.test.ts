import { describe, expect, it } from "vitest";
import { workPlanningErrorMessage, type WorkPlanningAction } from "./work-planning-error";

const expected: Array<[WorkPlanningAction, string]> = [
  [
    "appointment_create",
    "Bontraco could not schedule this appointment. Review the details and try again.",
  ],
  [
    "appointment_status",
    "Bontraco could not update this appointment's status. Refresh the schedule and try again.",
  ],
  [
    "appointment_assign",
    "Bontraco could not assign this appointment. Refresh the schedule and try again.",
  ],
  ["task_create", "Bontraco could not create this task. Review the task details and try again."],
  ["task_update", "Bontraco could not update this task. Refresh the task list and try again."],
];

describe("workPlanningErrorMessage", () => {
  it.each(expected)("returns a safe %s failure without backend details", (action, message) => {
    expect(workPlanningErrorMessage(action)).toBe(message);
  });

  it("warns before retrying uncertain timed-out planning actions", () => {
    const timeout = { code: "auth_request_timeout" };
    expect(workPlanningErrorMessage("appointment_create", timeout)).toMatch(
      /may still be scheduled/,
    );
    expect(workPlanningErrorMessage("appointment_status", timeout)).toMatch(/may still be updated/);
    expect(workPlanningErrorMessage("appointment_assign", timeout)).toMatch(/may still be saved/);
    expect(workPlanningErrorMessage("task_create", timeout)).toMatch(/may still be created/);
    expect(workPlanningErrorMessage("task_update", timeout)).toMatch(/may still be updated/);
  });
});
