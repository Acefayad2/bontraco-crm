import { ChartLineUp } from "@phosphor-icons/react/ChartLineUp";
import { DownloadSimple } from "@phosphor-icons/react/DownloadSimple";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { withAuthRequestDeadline } from "../lib/auth-request-deadline";
import {
  createReportCsv,
  reportCsvFilename,
  reportExportState,
  type ReportMetrics,
} from "../lib/report-csv";
import { getSupabase } from "../lib/supabase";
import { useWorkspaceAutoRefresh } from "../lib/workspace-auto-refresh";
import { useWorkspace } from "../workspace/WorkspaceContext";

const emptyReport: ReportMetrics = {
  leads: 0,
  qualified: 0,
  jobs: 0,
  pipeline: 0,
  estimates: 0,
  accepted: 0,
  invoiced: 0,
  collected: 0,
  calls: 0,
  answered: 0,
};
const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function ReportsPage() {
  const { demoMode } = useAuth();
  const { workspace } = useWorkspace();
  const [report, setReport] = useState<ReportMetrics>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [hasLoadedReport, setHasLoadedReport] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!workspace) {
      setLoading(false);
      return false;
    }
    try {
      if (demoMode && import.meta.env.VITE_DEMO_MODE === "true") {
        const { demoReport } = await import("../demo/reports");
        setReport(demoReport);
        setHasLoadedReport(true);
        setError("");
        return true;
      }
      const supabase = await withAuthRequestDeadline(getSupabase());
      if (!supabase) throw new Error("client_unavailable");
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [leads, jobs, estimates, invoices, payments, calls] = await withAuthRequestDeadline(
        Promise.all([
          supabase
            .from("leads")
            .select("status")
            .eq("account_id", workspace.id)
            .gte("discovered_at", since),
          supabase
            .from("jobs")
            .select("estimated_value")
            .eq("account_id", workspace.id)
            .gte("created_at", since),
          supabase
            .from("estimates")
            .select("status")
            .eq("account_id", workspace.id)
            .gte("created_at", since),
          supabase
            .from("invoices")
            .select("total")
            .eq("account_id", workspace.id)
            .gte("created_at", since),
          supabase
            .from("payments")
            .select("amount,status")
            .eq("account_id", workspace.id)
            .gte("received_at", since),
          supabase
            .from("calls")
            .select("status")
            .eq("account_id", workspace.id)
            .gte("started_at", since),
        ]),
      );
      if ([leads, jobs, estimates, invoices, payments, calls].some((item) => item.error))
        throw new Error("report_load_failed");
      setReport({
        leads: leads.data?.length || 0,
        qualified:
          leads.data?.filter((x) => ["qualified", "appointment", "won"].includes(x.status))
            .length || 0,
        jobs: jobs.data?.length || 0,
        pipeline: jobs.data?.reduce((sum, x) => sum + Number(x.estimated_value || 0), 0) || 0,
        estimates: estimates.data?.length || 0,
        accepted: estimates.data?.filter((x) => x.status === "accepted").length || 0,
        invoiced: invoices.data?.reduce((sum, x) => sum + Number(x.total || 0), 0) || 0,
        collected:
          payments.data
            ?.filter((x) => x.status === "succeeded")
            .reduce((sum, x) => sum + Number(x.amount || 0), 0) || 0,
        calls: calls.data?.length || 0,
        answered: calls.data?.filter((x) => x.status === "completed").length || 0,
      });
      setHasLoadedReport(true);
      setError("");
      return true;
    } catch {
      setError("Report data could not be loaded. Try again in a moment.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [demoMode, workspace]);
  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);
  useWorkspaceAutoRefresh(!demoMode, load, workspace?.id);
  const conversion = report.leads ? Math.round((report.qualified / report.leads) * 100) : 0;
  const closeRate = report.estimates ? Math.round((report.accepted / report.estimates) * 100) : 0;
  const answerRate = report.calls ? Math.round((report.answered / report.calls) * 100) : 0;
  const exportState = reportExportState(loading, Boolean(error));
  function exportCsv() {
    const blob = new Blob([createReportCsv(report)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = reportCsvFilename();
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return (
    <section className="reports-page">
      <header className="section-heading">
        <div>
          <p>Last 30 days</p>
          <h1>Reports</h1>
          <span>Lead, sales, revenue, and receptionist performance.</span>
        </div>
        <button
          className="button button-secondary"
          disabled={exportState.disabled}
          onClick={exportCsv}
        >
          <DownloadSimple /> {exportState.label}
        </button>
      </header>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="panel-state">Calculating workspace performance…</p>
      ) : error && !hasLoadedReport ? (
        <p className="panel-state">Report unavailable</p>
      ) : (
        <>
          <div className="report-kpis">
            <article>
              <span>Pipeline created</span>
              <strong>{money.format(report.pipeline)}</strong>
              <small>{report.jobs} new jobs</small>
            </article>
            <article>
              <span>Invoiced</span>
              <strong>{money.format(report.invoiced)}</strong>
              <small>{report.estimates} estimates</small>
            </article>
            <article>
              <span>Collected</span>
              <strong>{money.format(report.collected)}</strong>
              <small>Successful payments</small>
            </article>
            <article>
              <span>Answer rate</span>
              <strong>{answerRate}%</strong>
              <small>
                {report.answered} of {report.calls} calls
              </small>
            </article>
          </div>
          <div className="report-grid">
            <article className="panel">
              <div className="panel-header">
                <div>
                  <h2>Sales funnel</h2>
                  <p>Conversion through key stages</p>
                </div>
                <ChartLineUp />
              </div>
              <div className="funnel-bars">
                <div>
                  <span>
                    Leads <b>{report.leads}</b>
                  </span>
                  <i style={{ width: "100%" }} />
                </div>
                <div>
                  <span>
                    Qualified <b>{report.qualified}</b>
                  </span>
                  <i style={{ width: `${Math.max(conversion, 3)}%` }} />
                </div>
                <div>
                  <span>
                    Estimates accepted <b>{report.accepted}</b>
                  </span>
                  <i
                    style={{
                      width: `${Math.max(report.leads ? (report.accepted / report.leads) * 100 : 0, 3)}%`,
                    }}
                  />
                </div>
              </div>
            </article>
            <article className="panel rate-panel">
              <div>
                <span>Lead qualification</span>
                <strong>{conversion}%</strong>
              </div>
              <div>
                <span>Estimate close rate</span>
                <strong>{closeRate}%</strong>
              </div>
              <div>
                <span>Call answer rate</span>
                <strong>{answerRate}%</strong>
              </div>
            </article>
          </div>
        </>
      )}
    </section>
  );
}
