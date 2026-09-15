export type AuthAction = "login" | "signup" | "forgot" | "reset" | "invite" | "logout";

type ErrorShape = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
};

function details(cause: unknown) {
  if (!cause || typeof cause !== "object") return { code: "", message: "", status: 0 };
  const error = cause as ErrorShape;
  return {
    code: typeof error.code === "string" ? error.code.toLowerCase() : "",
    message: typeof error.message === "string" ? error.message.toLowerCase() : "",
    status: typeof error.status === "number" ? error.status : 0,
  };
}

export function authErrorMessage(cause: unknown, action: AuthAction) {
  const error = details(cause);
  const combined = `${error.code} ${error.message}`;

  if (combined.includes("passwords do not match")) return "Passwords do not match.";
  if (combined.includes("auth_request_timeout"))
    return "Bontraco did not respond in time. Your request may still finish; wait a minute before trying again.";
  if (combined.includes("rate") || error.status === 429)
    return "Too many attempts. Wait a few minutes and try again.";
  if (combined.includes("weak_password") || combined.includes("password should"))
    return "Use a stronger password with at least 8 characters.";
  if (combined.includes("email_not_confirmed") || combined.includes("email not confirmed"))
    return "Verify your email address before signing in.";
  if (
    action === "login" &&
    (combined.includes("invalid_credentials") || combined.includes("invalid login credentials"))
  )
    return "Email or password is incorrect.";
  if (
    action === "reset" &&
    (combined.includes("session") || combined.includes("expired") || combined.includes("token"))
  )
    return "This password-reset link is invalid or expired. Request a new link.";
  if (action === "invite" && combined.includes("email") && combined.includes("match"))
    return "Sign in with the email address that received this invitation.";
  if (
    combined.includes("failed to fetch") ||
    combined.includes("network") ||
    combined.includes("offline")
  )
    return "Bontraco could not connect. Check your internet connection and try again.";
  if (action === "invite")
    return "This invitation could not be accepted. It may be invalid, expired, or already used.";

  if (action === "login")
    return "Bontraco could not sign you in. Check your details and try again.";
  if (action === "signup")
    return "Bontraco could not create the workspace. Check your details or try signing in.";
  if (action === "forgot")
    return "Bontraco could not send a reset link. Wait a moment and try again.";
  if (action === "logout")
    return "Bontraco could not sign you out. Your session is still active; wait a moment and try again.";
  return "Bontraco could not update your password. Request a new reset link and try again.";
}
