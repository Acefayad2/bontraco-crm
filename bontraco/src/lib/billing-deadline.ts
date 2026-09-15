type BillingDeadlineInput = {
  status: string;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  grace_ends_at: string | null;
};

export function getBillingDeadline(subscription: BillingDeadlineInput | null) {
  if (!subscription) return null;
  if (subscription.status === "past_due" && subscription.grace_ends_at)
    return { label: "Grace period ends", date: subscription.grace_ends_at };
  if (subscription.status === "trialing" && subscription.trial_ends_at)
    return { label: "Trial ends", date: subscription.trial_ends_at };
  if (subscription.current_period_ends_at)
    return { label: "Current period ends", date: subscription.current_period_ends_at };
  return null;
}
