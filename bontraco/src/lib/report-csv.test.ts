import { describe, expect, it } from "vitest";
import {
  createReportCsv,
  reportCsvFilename,
  reportExportState,
  type ReportMetrics,
} from "./report-csv";

const report: ReportMetrics = {
  leads: 84,
  qualified: 31,
  jobs: 18,
  pipeline: 303400,
  estimates: 22,
  accepted: 11,
  invoiced: 187900,
  collected: 126450,
  calls: 137,
  answered: 129,
};

describe("report CSV", () => {
  it("exports every displayed report metric with spreadsheet line endings", () => {
    expect(createReportCsv(report)).toBe(
      [
        "Metric,Last 30 days",
        "Leads,84",
        "Qualified leads,31",
        "Jobs,18",
        "Pipeline,303400",
        "Estimates,22",
        "Accepted estimates,11",
        "Invoiced,187900",
        "Collected,126450",
        "Calls,137",
        "Answered calls,129",
        "",
      ].join("\r\n"),
    );
  });

  it("uses an ISO calendar date in the download filename", () => {
    expect(reportCsvFilename(new Date("2026-09-12T01:02:03Z"))).toBe(
      "bontraco-report-2026-09-12.csv",
    );
  });

  it("disables export until the initial report is complete", () => {
    expect(reportExportState(true, false)).toEqual({
      disabled: true,
      label: "Preparing report",
    });
  });

  it("disables export when any report query failed", () => {
    expect(reportExportState(false, true)).toEqual({
      disabled: true,
      label: "Export unavailable",
    });
  });

  it("enables export only for a complete report", () => {
    expect(reportExportState(false, false)).toEqual({
      disabled: false,
      label: "Export CSV",
    });
  });
});
