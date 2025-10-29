import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  exportInvoicesPdf,
  exportJobsCsv,
  exportJournalCsv,
  fetchJobs,
  type JobSummary,
} from "../modules/jobsApi";
import { syncFreee, syncYayoi } from "../modules/syncApi";
import { executePayments } from "../modules/paymentsApi";
import { ApiError, NetworkError } from "../modules/apiClient";
import { useStrings } from "../i18n/strings";

type LoadState = "loading" | "success" | "empty" | "error";

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCurrency = (value: number | null | undefined, fallback: string) => {
  if (value === null || value === undefined) {
    return fallback;
  }
  return `¥${value.toLocaleString("ja-JP", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
};

const Jobs = () => {
  const strings = useStrings();
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExportingInvoices, setIsExportingInvoices] = useState(false);
  const [isExportingJournal, setIsExportingJournal] = useState(false);
  const [exportInvoicesError, setExportInvoicesError] = useState<string | null>(null);
  const [exportJournalError, setExportJournalError] = useState<string | null>(null);
  const [syncingTarget, setSyncingTarget] = useState<"freee" | "yayoi" | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsMessage, setPaymentsMessage] = useState<string | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);

  const refreshJobs = useCallback(
    async (withSpinner: boolean) => {
      if (withSpinner) {
        setLoadState("loading");
        setLoadError(null);
      }

      try {
        const data = await fetchJobs();
        setJobs(data);
        setLoadState(data.length > 0 ? "success" : "empty");
        setLastUpdated(
          new Date().toLocaleString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
          }),
        );
        setPollingError(null);
      } catch (_error) {
        if (withSpinner) {
          setLoadError(strings.jobs.error);
          setLoadState("error");
        } else {
          setPollingError(strings.jobs.pollError);
        }
      }
    },
    [strings.jobs.error, strings.jobs.pollError],
  );

  useEffect(() => {
    void refreshJobs(true);
  }, [refreshJobs]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshJobs(false);
    }, 15000);

    return () => window.clearInterval(interval);
  }, [refreshJobs]);

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setExportError(null);
    setIsExporting(true);
    try {
      const blob = await exportJobsCsv();
      triggerDownload(blob, "jobs.csv");
    } catch (_error) {
      setExportError(strings.jobs.exportError);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportInvoices = async () => {
    setExportInvoicesError(null);
    setIsExportingInvoices(true);
    try {
      const blob = await exportInvoicesPdf();
      triggerDownload(blob, "invoices.pdf");
    } catch (_error) {
      setExportInvoicesError(strings.jobs.exportInvoicesError);
    } finally {
      setIsExportingInvoices(false);
    }
  };

  const handleExportJournal = async () => {
    setExportJournalError(null);
    setIsExportingJournal(true);
    try {
      const blob = await exportJournalCsv();
      triggerDownload(blob, "journal.csv");
    } catch (_error) {
      setExportJournalError(strings.jobs.exportJournalError);
    } finally {
      setIsExportingJournal(false);
    }
  };

  const approvedJobs = useMemo(() => jobs.filter((job) => job.approvalStatus === "approved"), [jobs]);

  const handleSync = async (target: "freee" | "yayoi") => {
    setSyncError(null);
    setSyncMessage(null);
    setSyncingTarget(target);
    try {
      const jobIds = approvedJobs.map((job) => job.id);
      const response = target === "freee" ? await syncFreee(jobIds) : await syncYayoi(jobIds);
      setSyncMessage(strings.jobs.syncSuccess.replace("{count}", String(response.processed.length)));
    } catch (error) {
      if (error instanceof NetworkError) {
        setSyncError(strings.summary.offline);
      } else {
        setSyncError(strings.jobs.syncError);
      }
    } finally {
      setSyncingTarget(null);
    }
  };

  const handleExecutePayments = async () => {
    setPaymentsError(null);
    setPaymentsMessage(null);
    setPaymentsLoading(true);
    try {
      const jobIds = approvedJobs.map((job) => job.id);
      const response = await executePayments(jobIds);
      setPaymentsMessage(strings.jobs.executePaymentsSuccess.replace("{batch}", response.batch_id));
    } catch (error) {
      if (error instanceof NetworkError) {
        setPaymentsError(strings.summary.offline);
      } else if (error instanceof ApiError) {
        setPaymentsError(strings.jobs.executePaymentsError);
      } else {
        setPaymentsError(strings.jobs.executePaymentsError);
      }
    } finally {
      setPaymentsLoading(false);
    }
  };

  return (
    <section className="panel jobs-panel">
      <header className="panel-header">
        <h2>{strings.jobs.title}</h2>
        {lastUpdated && (
          <p className="meta">{strings.jobs.updatedAt(lastUpdated)}</p>
        )}
      </header>
      <p>{strings.jobs.description}</p>
      <div className="jobs-toolbar">
        <div className="button-group">
          <button
            type="button"
            className="secondary-button"
            onClick={handleExport}
            disabled={isExporting || jobs.length === 0}
          >
            {isExporting ? strings.jobs.exporting : strings.jobs.exportCsv}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleExportInvoices}
            disabled={isExportingInvoices || jobs.length === 0}
          >
            {isExportingInvoices ? strings.jobs.exporting : strings.jobs.exportInvoices}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleExportJournal}
            disabled={isExportingJournal || jobs.length === 0}
          >
            {isExportingJournal ? strings.jobs.exporting : strings.jobs.exportJournal}
          </button>
        </div>
        <div className="button-group">
          <button
            type="button"
            className="primary-button"
            onClick={() => handleSync("freee")}
            disabled={approvedJobs.length === 0 || syncingTarget !== null}
          >
            {syncingTarget === "freee" ? strings.jobs.syncing : `${strings.jobs.syncLabel} (${strings.jobs.syncTargets.freee})`}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => handleSync("yayoi")}
            disabled={approvedJobs.length === 0 || syncingTarget !== null}
          >
            {syncingTarget === "yayoi" ? strings.jobs.syncing : `${strings.jobs.syncLabel} (${strings.jobs.syncTargets.yayoi})`}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleExecutePayments}
            disabled={approvedJobs.length === 0 || paymentsLoading}
          >
            {paymentsLoading ? strings.jobs.executingPayments : strings.jobs.executePayments}
          </button>
        </div>
      </div>

      <div className="jobs-feedback">
        {exportError && <span className="error-text">{exportError}</span>}
        {exportInvoicesError && <span className="error-text">{exportInvoicesError}</span>}
        {exportJournalError && <span className="error-text">{exportJournalError}</span>}
        {syncError && <span className="error-text">{syncError}</span>}
        {syncMessage && <span className="success-text">{syncMessage}</span>}
        {paymentsError && <span className="error-text">{paymentsError}</span>}
        {paymentsMessage && <span className="success-text">{paymentsMessage}</span>}
      </div>

      {pollingError && (
        <div className="info-banner" role="status">
          <span>{pollingError}</span>
          <button
            type="button"
            className="link-button"
            onClick={() => refreshJobs(true)}
          >
            {strings.common.retry}
          </button>
        </div>
      )}

      {loadState === "loading" && (
        <p role="status" aria-live="polite">
          {strings.jobs.loading}
        </p>
      )}

      {loadState === "error" && (
        <div className="error-banner" role="alert">
          <p>{loadError}</p>
          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              onClick={() => refreshJobs(true)}
            >
              {strings.jobs.reload}
            </button>
            <Link className="secondary-button" to="/upload">
              {strings.jobs.openUpload}
            </Link>
          </div>
        </div>
      )}

      {loadState === "empty" && (
        <div className="empty-state" role="region" aria-live="polite">
          <p>{strings.jobs.empty}</p>
          <Link className="primary-button" to="/upload">
            {strings.jobs.openUpload}
          </Link>
        </div>
      )}

      {loadState === "success" && (
        <div className="table-wrapper" role="region" aria-live="polite">
          <table className="job-table">
            <caption className="sr-only">{strings.jobs.tableCaption}</caption>
            <thead>
              <tr>
                <th scope="col">{strings.jobs.columns.id}</th>
                <th scope="col">{strings.jobs.columns.fileName}</th>
                <th scope="col">{strings.jobs.columns.documentType}</th>
                <th scope="col">{strings.jobs.columns.status}</th>
                <th scope="col">{strings.jobs.columns.classification}</th>
                <th scope="col">{strings.jobs.columns.amount}</th>
                <th scope="col">{strings.jobs.columns.submittedAt}</th>
                <th scope="col">{strings.jobs.columns.updatedAt}</th>
                <th scope="col">{strings.jobs.viewDetail}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>{job.id}</td>
                  <td>{job.fileName}</td>
                  <td>{strings.upload.types[job.documentType] ?? job.documentType}</td>
                  <td>
                    <span
                      className={`status-pill status-${job.status.toLowerCase()}`}
                    >
                      {strings.jobs.statusLabels[job.status as keyof typeof strings.jobs.statusLabels] ?? job.status}
                    </span>
                    <div className="approval-pill">
                      <span className={`status-pill status-${job.approvalStatus}`}>
                        {strings.jobs.statusLabels[job.approvalStatus as keyof typeof strings.jobs.statusLabels] ?? job.approvalStatus}
                      </span>
                    </div>
                  </td>
                  <td>
                    {job.classification
                      ? job.classification
                      : strings.jobs.pendingClassification}
                  </td>
                  <td>
                    {formatCurrency(
                      job.journalEntry?.amount_gross ?? job.journalEntry?.amount ?? null,
                      strings.jobs.amountUnavailable,
                    )}
                  </td>
                  <td>{formatDateTime(job.submittedAt)}</td>
                  <td>{formatDateTime(job.updatedAt)}</td>
                  <td>
                    <Link className="link-button" to={`/jobs/${job.id}`}>
                      {strings.jobs.viewDetail}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default Jobs;
