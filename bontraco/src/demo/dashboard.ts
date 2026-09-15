export type DemoDashboardData = ReturnType<typeof createDemoDashboardData>;

export function createDemoDashboardData() {
  return {
    badges: { Leads: "12", Calls: "4" } as Record<string, string>,
    metrics: {
      leads: "12",
      leadHint: "5 need a response",
      appointments: "7",
      appointmentHint: "Next at 9:30 AM",
      pipelineValue: "$303K",
      pipelineHint: "28 active opportunities",
      answerRate: "94%",
      answerHint: "4 recovered after hours",
    },
    pipeline: [
      { stage: "New leads", count: 12, value: "$48.6K" },
      { stage: "Inspection", count: 7, value: "$86.2K" },
      { stage: "Estimate sent", count: 5, value: "$71.4K" },
      { stage: "Approved", count: 4, value: "$96.8K" },
    ],
    activities: [
      {
        title: "Lead assigned to Jordan Lee: Schaumburg roof leak",
        meta: "Assignment changed",
        time: "5 min",
      },
      {
        title: "AI receptionist booked an inspection",
        meta: "Lena Ortiz, Naperville",
        time: "8 min",
      },
      {
        title: "Estimate viewed by customer",
        meta: "Glenview roof replacement",
        time: "24 min",
      },
      { title: "Job moved to Approved", meta: "Mason Restoration", time: "41 min" },
      { title: "Call transferred to Jordan", meta: "Emergency roof leak", time: "1 hr" },
    ],
    notifications: [
      {
        id: "demo-assignment-notification",
        title: "Lead assigned to you",
        body: "Schaumburg roof leak",
        kind: "assignment",
        metadata: { source_table: "leads" },
        read_at: null,
        created_at: new Date().toISOString(),
      },
    ],
    searchResults: [
      {
        id: "demo-customer",
        section: "Customers" as const,
        title: "Maria Torres",
        detail: "Naperville customer",
      },
      {
        id: "demo-job",
        section: "Jobs" as const,
        title: "Glenview roof replacement",
        detail: "Approved job",
      },
      {
        id: "demo-call",
        section: "Calls" as const,
        title: "Emergency roof leak",
        detail: "Transferred call",
      },
    ],
    receptionist: {
      status: "Online",
      calls: "31 calls",
      callsHint: "answered this week",
      appointments: "9",
      qualified: "14",
      transfers: "5",
    },
  };
}
