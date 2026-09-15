export const authRequestTimeoutMs = 15_000;

export class AuthRequestTimeoutError extends Error {
  readonly code = "auth_request_timeout";

  constructor() {
    super("Authentication request exceeded its safety deadline.");
    this.name = "AuthRequestTimeoutError";
  }
}

export async function withAuthRequestDeadline<T>(
  request: Promise<T>,
  timeoutMs = authRequestTimeoutMs,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new AuthRequestTimeoutError()), timeoutMs);
  });

  try {
    return await Promise.race([request, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
