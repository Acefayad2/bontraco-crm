export function createDemoJobsData() {
  const contacts = [
    { id: "demo-c1", first_name: "Maria", last_name: "Torres", company_name: null },
    {
      id: "demo-c2",
      first_name: "Eric",
      last_name: "Coleman",
      company_name: "Lakeshore Property Group",
    },
    {
      id: "demo-c3",
      first_name: "Nina",
      last_name: "Patel",
      company_name: "Willow Creek HOA",
    },
  ];
  const properties = [
    {
      id: "demo-p1",
      contact_id: "demo-c1",
      label: "Home",
      address_line_1: "1012 Aurora Avenue",
      city: "Naperville",
      region: "IL",
      active: true,
    },
    {
      id: "demo-p2",
      contact_id: "demo-c2",
      label: "Commercial property",
      address_line_1: "455 North Harbor Drive",
      city: "Chicago",
      region: "IL",
      active: true,
    },
    {
      id: "demo-p3",
      contact_id: "demo-c3",
      label: "HOA community",
      address_line_1: "800 Willow Creek Lane",
      city: "Glenview",
      region: "IL",
      active: true,
    },
  ];
  return {
    contacts,
    properties,
    jobs: [
      {
        id: "demo-j1",
        assigned_to: "demo-field",
        title: "Storm damage roof replacement",
        trade: "roofing",
        stage: "Inspection",
        status: "open",
        estimated_value: 18600,
        scheduled_start: new Date(Date.now() + 86400000).toISOString(),
        safety_intake: {
          site_occupied: true,
          active_leak: true,
          stories: 2,
          roof_access_notes: "Rear driveway access; overhead service line on east side.",
        },
        contact: contacts[0],
        property: properties[0],
      },
      {
        id: "demo-j2",
        assigned_to: "demo-sales",
        title: "Commercial flat-roof assessment",
        trade: "roofing",
        stage: "Estimate",
        status: "open",
        estimated_value: 42000,
        scheduled_start: new Date(Date.now() + 172800000).toISOString(),
        safety_intake: { site_occupied: true, stories: 4 },
        contact: contacts[1],
        property: properties[1],
      },
      {
        id: "demo-j3",
        assigned_to: null,
        title: "HOA spring maintenance program",
        trade: "roofing",
        stage: "Approved",
        status: "open",
        estimated_value: 74500,
        scheduled_start: new Date(Date.now() + 604800000).toISOString(),
        safety_intake: {},
        contact: contacts[2],
        property: properties[2],
      },
    ],
    members: [
      { user_id: "demo-owner", display_name: "Alex Morgan", email: "owner@example.com" },
      { user_id: "demo-sales", display_name: "Jordan Lee", email: "sales@example.com" },
      { user_id: "demo-field", display_name: "Marcus Reed", email: "field@example.com" },
    ],
  };
}

export function createDemoJobDetails() {
  return {
    notes: [
      {
        id: "demo-note",
        body: "Homeowner confirmed attic access. Bring moisture meter and document the north slope.",
        pinned: true,
        created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
      },
    ],
    files: [
      {
        id: "demo-file",
        storage_path: "demo/inspection-photo.jpg",
        original_name: "north-slope-inspection.jpg",
        byte_size: 1840000,
        created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
      },
    ],
    checklist: [
      {
        id: "demo-check-1",
        category: "safety",
        label: "Confirm weather, roof access, and site hazards before climbing",
        required: true,
        completed_at: new Date().toISOString(),
        completed_by: "demo-owner",
      },
      {
        id: "demo-check-2",
        category: "safety",
        label: "Set ladder, fall-protection, and ground-control plan",
        required: true,
        completed_at: new Date().toISOString(),
        completed_by: "demo-owner",
      },
      {
        id: "demo-check-3",
        category: "diagnosis",
        label: "Inspect and document interior leak or moisture locations",
        required: true,
        completed_at: null,
        completed_by: null,
      },
      {
        id: "demo-check-4",
        category: "documentation",
        label: "Capture measurements and required slope, flashing, and damage photos",
        required: true,
        completed_at: null,
        completed_by: null,
      },
      {
        id: "demo-check-5",
        category: "closeout",
        label: "Complete ground sweep, magnet cleanup, and customer handoff",
        required: true,
        completed_at: null,
        completed_by: null,
      },
    ],
  };
}
