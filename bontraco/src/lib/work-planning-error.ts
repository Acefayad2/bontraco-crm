export type WorkPlanningAction =
  | "appointment_create"
  | "appointment_status"
  | "appointment_assign"
  | "task_create"
  | "task_update";

type ErrorShape = { code?: unknown } | null | undefined;

function errorCode(error: unknown) {
  return typeof (error as ErrorShape)?.code === "string" ? (error as { code: string }).code : "";
}

export function workPlanningErrorMessage(action: WorkPlanningAction, error?: unknown) {
  if (errorCode(error) === "auth_request_timeout") {
    if (action === "appointment_create")
      return "This appointment may still be scheduled. Refresh the schedule before trying again.";
    if (action === "appointment_status")
      return "This appointment status may still be updated. Refresh the schedule before trying again.";
    if (action === "appointment_assign")
      return "This appointment assignment may still be saved. Refresh the schedule before trying again.";
    if (action === "task_create")
      return "This task may still be created. Refresh the task list before trying again.";
    return "This task may still be updated. Refresh the task list before trying again.";
  }
  if (action === "appointment_create")
    return "Bontraco could not schedule this appointment. Review the details and try again.";
  if (action === "appointment_status")
    return "Bontraco could not update this appointment's status. Refresh the schedule and try again.";
  if (action === "appointment_assign")
    return "Bontraco could not assign this appointment. Refresh the schedule and try again.";
  if (action === "task_create")
    return "Bontraco could not create this task. Review the task details and try again.";
  return "Bontraco could not update this task. Refresh the task list and try again.";
}
