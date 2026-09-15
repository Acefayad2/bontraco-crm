import { describe, expect, it } from "vitest";
import { jobErrorMessage, type JobAction } from "./job-error";

const expected: Array<[JobAction, string]> = [
  ["create", "Bontraco could not create this job. Review the job details and try again."],
  ["assign", "Bontraco could not assign this job. Refresh the job list and try again."],
  ["stage", "Bontraco could not update this job's stage. Refresh the job list and try again."],
  ["note", "Bontraco could not add this note. Refresh the job and try again."],
  ["checklist", "Bontraco could not update this checklist item. Refresh the job and try again."],
  ["upload", "Bontraco could not upload this file. Check your connection and try again."],
  ["save_file", "Bontraco could not finish saving this file. Try uploading it again."],
  ["download", "Bontraco could not prepare this file for download. Refresh the job and try again."],
];

describe("jobErrorMessage", () => {
  it.each(expected)("returns a safe %s failure without backend details", (action, message) => {
    expect(jobErrorMessage(action)).toBe(message);
  });

  it("warns before retrying uncertain core job writes", () => {
    const timeout = { code: "auth_request_timeout" };
    expect(jobErrorMessage("create", timeout)).toContain("may still be created");
    expect(jobErrorMessage("assign", timeout)).toContain("assignment may still be saved");
    expect(jobErrorMessage("stage", timeout)).toContain("stage may still be updated");
    expect(jobErrorMessage("note", timeout)).toContain("note may still be added");
    expect(jobErrorMessage("checklist", timeout)).toContain("item may still be updated");
    expect(jobErrorMessage("upload", timeout)).toContain("upload may still finish");
    expect(jobErrorMessage("save_file", timeout)).toContain("record may still be saved");
    expect(jobErrorMessage("download", timeout)).toContain("took too long");
  });
});
