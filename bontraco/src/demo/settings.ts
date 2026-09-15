export function createDemoSettingsData() {
  return {
    plans: [
      {
        slug: "starter",
        display_name: "Starter",
        monthly_price_cents: 29900,
        included_users: 5,
        included_lead_profiles: 1,
        summary: "CRM, jobs, estimates, invoices, and basic reporting.",
      },
      {
        slug: "growth",
        display_name: "Growth",
        monthly_price_cents: 49900,
        included_users: 10,
        included_lead_profiles: 3,
        summary: "Starter plus lead generation and advanced reporting.",
      },
      {
        slug: "pro",
        display_name: "AI Pro",
        monthly_price_cents: 89900,
        included_users: 10,
        included_lead_profiles: 5,
        summary: "Growth plus the AI receptionist and calling tools.",
      },
    ],
    company: {
      legalName: "Blue Ridge Exteriors LLC",
      timezone: "America/Chicago",
      serviceArea: "Chicagoland and surrounding Illinois communities",
      businessHours: "Monday-Friday 8:00 AM-5:00 PM; Saturday by appointment",
      emergencyRules: "Escalate active leaks, gas odors, smoke, sparks, and flooding to a person.",
      businessPhone: "(630) 555-0100",
      businessEmail: "estimates@blueridge.example",
      businessWebsite: "https://blueridge.example",
      proposalLogoPath: "",
      proposalAccentColor: "#0F5B4F",
      estimateDefaultTaxRate: "6.25",
      estimateDefaultValidDays: "30",
      estimateDefaultCustomerNote: "Thank you for trusting our team with your property.",
      estimateDefaultTerms:
        "A 30% deposit schedules production. Remaining balance is due at substantial completion.",
    },
    subscription: {
      plan_slug: "pro",
      status: "trialing",
      trial_ends_at: new Date(Date.now() + 11 * 86400000).toISOString(),
      current_period_ends_at: null,
      past_due_since: null,
      grace_ends_at: null,
      cancel_at_period_end: false,
      stripe_customer_id: "demo",
    },
    integrations: {
      providers: {
        public_web_search: true,
        google_places: false,
        stripe: false,
        retell: false,
        operations_alerts: false,
      },
      receptionist_workspace: false,
    },
  };
}
