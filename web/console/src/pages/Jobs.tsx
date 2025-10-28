import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { exportJobsCsv, fetchJobs, type JobSummary } from "../modules/jobsApi";
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

  const handleExport = async () => {
    setExportError(null);
    setIsExporting(true);
    try {
      const blob = await exportJobsCsv();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "jobs.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (_error) {
      setExportError(strings.jobs.exportError);
    } finally {
      setIsExporting(false);
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
        <button
          type="button"
          className="secondary-button"
          onClick={handleExport}
          disabled={isExporting || jobs.length === 0}
        >
          {isExporting ? strings.jobs.exporting : strings.jobs.exportCsv}
        </button>
        {exportError && <span className="error-text">{exportError}</span>}
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
                <th scope="col">{strings.jobs.columns.extractedTotal}</th>
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
                      {strings.jobs.statusLabels[job.status] ?? job.status}
                    </span>
                  </td>
                  <td>
                    {job.classification
                      ? job.classification
                      : strings.jobs.pendingClassification}
                  </td>
                  <td>
                    {(() => {
                      const metadata = job.metadata as Record<string, unknown> | undefined;
                      const amounts = (metadata?.amounts ?? null) as
                        | { total?: number | null }
                        | null;
                      if (amounts?.total === null || amounts?.total === undefined) {
                        return strings.jobs.amountUnavailable;
                      }
                      return `¥${amounts.total.toLocaleString("ja-JP")}`;
                    })()}
                  </td>
                  <td>
                    {formatCurrency(
                      job.journalEntry?.amount_gross ?? null,
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
