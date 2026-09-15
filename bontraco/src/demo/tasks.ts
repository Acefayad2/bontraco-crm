export function createDemoTasksData() {
  return {
    tasks: [
      {
        id: "demo-task-1",
        title: "Call Maria to confirm material color",
        assigned_to: "demo-sales",
        due_at: new Date(Date.now() + 2 * 3600000).toISOString(),
        completed_at: null,
        job: { title: "Storm damage roof replacement" },
        lead: null,
      },
      {
        id: "demo-task-2",
        title: "Send commercial inspection proposal",
        assigned_to: "demo-owner",
        due_at: new Date(Date.now() + 86400000).toISOString(),
        completed_at: null,
        job: null,
        lead: { title: "Commercial roof inspection" },
      },
      {
        id: "demo-task-3",
        title: "Upload completed inspection photos",
        assigned_to: "demo-field",
        due_at: new Date(Date.now() - 86400000).toISOString(),
        completed_at: new Date().toISOString(),
        job: { title: "HOA spring maintenance" },
        lead: null,
      },
    ],
    members: [
      { user_id: "demo-owner", display_name: "Alex Morgan", email: "owner@example.com" },
      { user_id: "demo-sales", display_name: "Jordan Lee", email: "sales@example.com" },
      { user_id: "demo-field", display_name: "Marcus Reed", email: "field@example.com" },
    ],
    jobs: [
      { id: "demo-job-1", title: "Storm damage roof replacement" },
      { id: "demo-job-2", title: "HOA spring maintenance" },
    ],
    leads: [{ id: "demo-lead-1", title: "Commercial roof inspection" }],
  };
}
