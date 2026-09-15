export type GuestRouteState = "loading" | "authenticated" | "guest";

export function guestRouteState(loading: boolean, hasUser: boolean): GuestRouteState {
  if (loading) return "loading";
  return hasUser ? "authenticated" : "guest";
}
