export function createDemoCustomersData() {
  return {
    contacts: [
      {
        id: "demo-c1",
        assigned_to: "demo-sales",
        first_name: "Maria",
        last_name: "Torres",
        company_name: null,
        email: "maria@example.com",
        phone: "(630) 555-0186",
        source: "web search",
        updated_at: new Date().toISOString(),
      },
      {
        id: "demo-c2",
        assigned_to: "demo-owner",
        first_name: "Eric",
        last_name: "Coleman",
        company_name: "Lakeshore Property Group",
        email: "eric@example.com",
        phone: "(312) 555-0139",
        source: "google places",
        updated_at: new Date().toISOString(),
      },
      {
        id: "demo-c3",
        assigned_to: null,
        first_name: "Nina",
        last_name: "Patel",
        company_name: "Willow Creek HOA",
        email: "nina@example.com",
        phone: "(847) 555-0174",
        source: "referral",
        updated_at: new Date().toISOString(),
      },
      {
        id: "demo-c4",
        assigned_to: "demo-sales",
        first_name: "Derrick",
        last_name: "James",
        company_name: null,
        email: null,
        phone: "(708) 555-0142",
        source: "phone",
        updated_at: new Date().toISOString(),
      },
    ],
    members: [
      { user_id: "demo-owner", display_name: "Alex Morgan", email: "owner@example.com" },
      { user_id: "demo-sales", display_name: "Jordan Lee", email: "sales@example.com" },
      { user_id: "demo-field", display_name: "Marcus Reed", email: "field@example.com" },
    ],
    properties: {
      "demo-c1": [
        {
          id: "demo-p1",
          label: "Home",
          address_line_1: "1012 Aurora Avenue",
          address_line_2: null,
          city: "Naperville",
          region: "IL",
          postal_code: "60540",
          active: true,
        },
      ],
      "demo-c2": [
        {
          id: "demo-p2",
          label: "Commercial property",
          address_line_1: "455 North Harbor Drive",
          address_line_2: "Building C",
          city: "Chicago",
          region: "IL",
          postal_code: "60611",
          active: true,
        },
      ],
    },
    jobs: {
      "demo-c1": [
        {
          id: "demo-j1",
          title: "Storm damage roof replacement",
          trade: "roofing",
          stage: "Inspection",
          status: "open",
          property_id: "demo-p1",
        },
      ],
      "demo-c2": [
        {
          id: "demo-j2",
          title: "Commercial flat-roof assessment",
          trade: "roofing",
          stage: "Estimate",
          status: "open",
          property_id: "demo-p2",
        },
      ],
    },
  };
}

export function createDemoCustomerDetails(contactId: string) {
  if (contactId !== "demo-c1") return { suppressions: [], consents: [] };
  return {
    suppressions: [
      {
        id: "demo-s1",
        channel: "sms",
        destination: "+16305550186",
        reason: "Recipient requested no text messages",
        source: "recipient_request",
        suppressed_at: new Date().toISOString(),
        lifted_at: null,
      },
    ],
    consents: [
      {
        id: "demo-consent-1",
        channel: "voice",
        purpose: "transactional",
        destination: "+16305550186",
        status: "granted",
        source: "written",
        disclosure_version: "sample-v1",
        recorded_at: new Date().toISOString(),
      },
    ],
  };
}
