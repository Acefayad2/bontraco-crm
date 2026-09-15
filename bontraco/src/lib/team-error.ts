export type TeamAction = "invite" | "update" | "cancel";

type ErrorShape = {
  code?: unknown;
  message?: unknown;
};

function details(cause: unknown) {
  if (!cause || typeof cause !== "object") return { code: "", message: "" };
  const error = cause as ErrorShape;
  return {
    code: typeof error.code === "string" ? error.code.toLowerCase() : "",
    message: typeof error.message === "string" ? error.message.toLowerCase() : "",
  };
}

export function teamErrorMessage(
  cause: unknown,
  action: TeamAction,
  planName: string,
  seatLimit: number,
) {
  const error = details(cause);

  if (error.code === "auth_request_timeout") {
    if (action === "invite")
      return "Bontraco did not respond in time. The invitation may still be created; refresh the team list before trying again.";
    if (action === "update")
      return "Bontraco did not respond in time. The teammate change may still be saved; refresh the team list before trying again.";
    return "Bontraco did not respond in time. The invitation may still be canceled; refresh the team list before trying again.";
  }

  if (action === "invite") {
    if (error.code === "23505") return "That email already has a pending invitation.";
    if (error.message.includes("plan user limit reached"))
      return `The ${planName} plan's ${seatLimit}-user limit has been reached.`;
    if (error.message.includes("active subscription required"))
      return "An active subscription is required before teammates can be added.";
    return "Bontraco could not create this invitation. Check the email and try again.";
  }

  if (action === "update")
    return "Bontraco could not update this teammate. Refresh the team list and try again.";
  return "Bontraco could not cancel this invitation. Refresh the team list and try again.";
}
