export type SafetyIntakeValue = boolean | number | string;
export type SafetyIntake = Record<string, SafetyIntakeValue>;

export type SafetyIntakeField = {
  key: string;
  label: string;
  kind: "checkbox" | "number" | "text";
  help?: string;
  urgentWhenTrue?: boolean;
  min?: number;
  max?: number;
};

const commonFields: SafetyIntakeField[] = [
  {
    key: "site_occupied",
    label: "Home or building is currently occupied",
    kind: "checkbox",
  },
  {
    key: "access_notes",
    label: "Site access or occupant safety notes",
    kind: "text",
    help: "Pets, children, locked areas, mobility needs, or access restrictions",
  },
];

const tradeFields: Record<string, SafetyIntakeField[]> = {
  roofing: [
    {
      key: "active_leak",
      label: "Active interior leak",
      kind: "checkbox",
      urgentWhenTrue: true,
    },
    { key: "stories", label: "Building stories", kind: "number", min: 1, max: 99 },
    {
      key: "roof_access_notes",
      label: "Roof access or fall-hazard notes",
      kind: "text",
    },
  ],
  plumbing: [
    {
      key: "active_leak",
      label: "Water is actively leaking",
      kind: "checkbox",
      urgentWhenTrue: true,
    },
    { key: "water_shutoff_known", label: "Water shutoff is known", kind: "checkbox" },
    {
      key: "sewage_backup",
      label: "Sewage backup or contaminated water",
      kind: "checkbox",
      urgentWhenTrue: true,
    },
    {
      key: "gas_odor",
      label: "Gas odor reported",
      kind: "checkbox",
      urgentWhenTrue: true,
    },
    { key: "shutoff_notes", label: "Shutoff or affected-area notes", kind: "text" },
  ],
  electrical: [
    { key: "power_isolated", label: "Power has been isolated", kind: "checkbox" },
    {
      key: "burning_smell",
      label: "Burning smell or visible smoke",
      kind: "checkbox",
      urgentWhenTrue: true,
    },
    {
      key: "sparks_or_arcing",
      label: "Sparks or arcing reported",
      kind: "checkbox",
      urgentWhenTrue: true,
    },
    { key: "panel_location", label: "Electrical panel location or access notes", kind: "text" },
  ],
  general: [],
};

export function getSafetyIntakeFields(trade: string) {
  return [...commonFields, ...(tradeFields[trade] || tradeFields.general)];
}

export function hasUrgentSafetySignal(trade: string, intake: SafetyIntake) {
  return getSafetyIntakeFields(trade).some(
    (field) => field.urgentWhenTrue && intake[field.key] === true,
  );
}

export function formatSafetyIntakeValue(field: SafetyIntakeField, value: SafetyIntakeValue) {
  if (field.kind === "checkbox") return value === true ? "Yes" : "No";
  if (field.kind === "number") return String(value);
  return String(value).trim();
}
