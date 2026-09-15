export type ReportMetrics = {
  leads: number;
  qualified: number;
  jobs: number;
  pipeline: number;
  estimates: number;
  accepted: number;
  invoiced: number;
  collected: number;
  calls: number;
  answered: number;
};

export function reportExportState(loading: boolean, hasError: boolean) {
  if (loading) return { disabled: true, label: "Preparing report" };
  if (hasError) return { disabled: true, label: "Export unavailable" };
  return { disabled: false, label: "Export CSV" };
}

export function createReportCsv(report: ReportMetrics) {
  const rows: Array<[string, string | number]> = [
    ["Metric", "Last 30 days"],
    ["Leads", report.leads],
    ["Qualified leads", report.qualified],
    ["Jobs", report.jobs],
    ["Pipeline", report.pipeline],
    ["Estimates", report.estimates],
    ["Accepted estimates", report.accepted],
    ["Invoiced", report.invoiced],
    ["Collected", report.collected],
    ["Calls", report.calls],
    ["Answered calls", report.answered],
  ];
  return `${rows.map((row) => row.join(",")).join("\r\n")}\r\n`;
}

export function reportCsvFilename(date = new Date()) {
  return `bontraco-report-${date.toISOString().slice(0, 10)}.csv`;
}
