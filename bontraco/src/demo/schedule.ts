export function createDemoScheduleData() {
  const appointments = [
    {
      id: "demo-a1",
      assigned_to: "demo-field",
      title: "Emergency leak inspection",
      starts_at: new Date(new Date().setHours(9, 30, 0, 0)).toISOString(),
      ends_at: new Date(new Date().setHours(10, 30, 0, 0)).toISOString(),
      status: "confirmed",
      notes: "Bring tarp and moisture meter",
      job: { title: "Storm damage roof replacement" },
      contact: { first_name: "Maria", last_name: "Torres" },
    },
    {
      id: "demo-a2",
      assigned_to: "demo-sales",
      title: "Commercial roof walkthrough",
      starts_at: new Date(new Date().setHours(13, 0, 0, 0)).toISOString(),
      ends_at: new Date(new Date().setHours(14, 30, 0, 0)).toISOString(),
      status: "scheduled",
      notes: null,
      job: { title: "Commercial flat-roof assessment" },
      contact: {
        first_name: "Eric",
        last_name: "Coleman",
        company_name: "Lakeshore Property Group",
      },
    },
    {
      id: "demo-a3",
      assigned_to: "demo-owner",
      title: "HOA proposal review",
      starts_at: new Date(Date.now() + 86400000).toISOString(),
      ends_at: new Date(Date.now() + 90000000).toISOString(),
      status: "scheduled",
      notes: "Video meeting",
      job: { title: "HOA spring maintenance program" },
      contact: { first_name: "Nina", last_name: "Patel", company_name: "Willow Creek HOA" },
    },
  ];
  return {
    appointments,
    contacts: appointments.map((item, index) => ({ id: `demo-c${index}`, ...item.contact })),
    jobs: appointments.map((item, index) => ({ id: `demo-j${index}`, ...item.job })),
    members: [
      { user_id: "demo-owner", display_name: "Alex Morgan", email: "owner@example.com" },
      { user_id: "demo-sales", display_name: "Jordan Lee", email: "sales@example.com" },
      { user_id: "demo-field", display_name: "Marcus Reed", email: "field@example.com" },
    ],
  };
}
