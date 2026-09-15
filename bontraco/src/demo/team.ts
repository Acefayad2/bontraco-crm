export function createDemoTeamData() {
  return {
    members: [
      {
        user_id: "demo-owner",
        display_name: "Alex Morgan",
        email: "owner@example.com",
        role: "owner" as const,
        active: true,
      },
      {
        user_id: "demo-sales",
        display_name: "Jordan Lee",
        email: "sales@example.com",
        role: "sales" as const,
        active: true,
      },
      {
        user_id: "demo-field",
        display_name: "Marcus Reed",
        email: "field@example.com",
        role: "field" as const,
        active: true,
      },
    ],
    invitations: [
      {
        id: "demo-invite",
        email: "newrep@example.com",
        role: "sales" as const,
        expires_at: new Date(Date.now() + 604800000).toISOString(),
      },
    ],
  };
}
