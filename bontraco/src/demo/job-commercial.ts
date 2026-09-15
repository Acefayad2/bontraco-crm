export function createDemoCommercialData() {
  return {
    estimateDefaults: {
      taxRate: "6.25",
      validDays: 30,
      customerNote: "Thank you for trusting our team with your property.",
      terms:
        "A 30% deposit schedules production. Remaining balance is due at substantial completion.",
    },
    estimates: [
      {
        id: "demo-estimate",
        estimate_number: "EST-1048",
        status: "accepted",
        subtotal: 17250,
        tax_amount: 1078.13,
        total: 18328.13,
        valid_until: null,
        customer_note: "Thank you for trusting our team with your home.",
        terms:
          "A 30% deposit schedules production. Remaining balance is due at substantial completion.",
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    invoices: [
      {
        id: "demo-invoice",
        estimate_id: "demo-estimate",
        invoice_number: "INV-1048",
        status: "partial",
        subtotal: 17250,
        tax_amount: 1078.13,
        total: 18328.13,
        amount_paid: 5500,
        balance_due: 12828.13,
        issued_at: new Date(Date.now() - 86400000).toISOString(),
        due_date: new Date(Date.now() + 13 * 86400000).toISOString().slice(0, 10),
        paid_at: null,
        customer_note: "Thank you for trusting our team with your home.",
        created_at: new Date().toISOString(),
      },
    ],
  };
}

export function createDemoCommercialDocument() {
  return {
    items: [
      {
        id: "demo-item-1",
        description: "Architectural shingle roof replacement",
        quantity: 25,
        unit: "square",
        unit_price: 600,
        taxable: true,
        line_total: 15000,
      },
      {
        id: "demo-item-2",
        description: "Permit and disposal",
        quantity: 1,
        unit: "allowance",
        unit_price: 750,
        taxable: true,
        line_total: 750,
      },
      {
        id: "demo-item-3",
        description: "Aluminum gutter replacement",
        quantity: 150,
        unit: "linear ft",
        unit_price: 10,
        taxable: true,
        line_total: 1500,
      },
    ],
    legalName: "Blue Ridge Exteriors LLC",
    jobTitle: "Storm damage roof replacement",
    customerName: "Maria Torres",
    customerPhone: "(630) 555-0148",
    customerEmail: "maria@example.com",
    propertyAddress: "1012 Aurora Avenue, Naperville, IL 60540",
    businessPhone: "(630) 555-0100",
    estimateBusinessEmail: "estimates@blueridge.example",
    invoiceBusinessEmail: "billing@blueridge.example",
    businessWebsite: "https://blueridge.example",
    accentColor: "#0F5B4F",
  };
}
