export type JobAction =
  | "create"
  | "assign"
  | "stage"
  | "note"
  | "checklist"
  | "upload"
  | "save_file"
  | "download";

export function jobErrorMessage(action: JobAction, cause?: unknown) {
  if (
    cause &&
    typeof cause === "object" &&
    "code" in cause &&
    (cause as { code?: unknown }).code === "auth_request_timeout"
  ) {
    if (action === "create")
      return "This job may still be created. Refresh the job list before trying again.";
    if (action === "assign")
      return "This job assignment may still be saved. Refresh the job list before trying again.";
    if (action === "stage")
      return "This job stage may still be updated. Refresh the job list before trying again.";
    if (action === "note")
      return "This job note may still be added. Refresh the job before trying again.";
    if (action === "checklist")
      return "This checklist item may still be updated. Refresh the job before trying again.";
    if (action === "upload")
      return "This file upload may still finish. Refresh job files before trying again.";
    if (action === "save_file")
      return "This file record may still be saved. Refresh job files before uploading it again.";
    if (action === "download")
      return "Preparing this download took too long. Check your connection and try again.";
  }
  if (action === "create")
    return "Bontraco could not create this job. Review the job details and try again.";
  if (action === "assign")
    return "Bontraco could not assign this job. Refresh the job list and try again.";
  if (action === "stage")
    return "Bontraco could not update this job's stage. Refresh the job list and try again.";
  if (action === "note") return "Bontraco could not add this note. Refresh the job and try again.";
  if (action === "checklist")
    return "Bontraco could not update this checklist item. Refresh the job and try again.";
  if (action === "upload")
    return "Bontraco could not upload this file. Check your connection and try again.";
  if (action === "save_file")
    return "Bontraco could not finish saving this file. Try uploading it again.";
  return "Bontraco could not prepare this file for download. Refresh the job and try again.";
}
