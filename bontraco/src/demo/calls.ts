export function createDemoCallsData() {
  return {
    calls: [
      {
        id: "demo-call-1",
        assigned_to: "demo-sales",
        caller_name: "Lena Ortiz",
        from_number: "(630) 555-0148",
        status: "completed",
        disposition: "Inspection booked",
        summary:
          "Storm lifted shingles on the rear slope. Inspection scheduled for tomorrow morning.",
        duration_seconds: 224,
        started_at: new Date(Date.now() - 35 * 60000).toISOString(),
        emergency_flag: false,
      },
      {
        id: "demo-call-2",
        assigned_to: "demo-owner",
        caller_name: "Marcus Hill",
        from_number: "(312) 555-0182",
        status: "completed",
        disposition: "Transferred",
        summary: "Active plumbing leak; caller was transferred to the on-call technician.",
        duration_seconds: 96,
        started_at: new Date(Date.now() - 3 * 3600000).toISOString(),
        emergency_flag: true,
      },
    ],
    members: [
      {
        user_id: "demo-owner",
        display_name: "Alex Morgan",
        email: "owner@example.com",
        role: "owner",
      },
      {
        user_id: "demo-sales",
        display_name: "Jordan Lee",
        email: "sales@example.com",
        role: "sales",
      },
    ],
    settings: {
      enabled: true,
      provider: "retell",
      phone_number: "+16305550101",
      transfer_number: "(630) 555-0100",
      greeting: "Thank you for calling Blue Ridge Exteriors. How can we help today?",
      recording_enabled: true,
    },
    usage: { minutes: 412, providerCostCents: 2874 },
  };
}
