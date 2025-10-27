<<<<<<< HEAD
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError, fetchJobs } from "../lib/api";
import type { Job, JobStatus } from "../types/job";

const POLL_INTERVAL_MS = 10_000;

type LoadState = "loading" | "success" | "empty" | "error";

const STATUS_LABELS: Record<JobStatus, { label: string; className: string }> = {
  queued: { label: "順番待ち", className: "status-queued" },
  running: { label: "処理中", className: "status-running" },
  ok: { label: "完了", className: "status-ok" },
  failed: { label: "失敗", className: "status-failed" },
};

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const Jobs = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const navigate = useNavigate();

  const fetchAndSetJobs = useCallback(
    async ({
      showSpinner = false,
      signal,
    }: {
      showSpinner?: boolean;
      signal?: AbortSignal;
    } = {}) => {
      if (showSpinner) {
        setLoadState("loading");
        setErrorMessage(null);
        setPollingError(null);
      }

      try {
        const items = await fetchJobs(signal);
        setJobs(items);
        setLoadState(items.length > 0 ? "success" : "empty");
        setErrorMessage(null);
        setPollingError(null);
        setLastUpdated(new Date());
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") {
          return;
        }
        const message =
          cause instanceof ApiError
            ? cause.message
            : "読み込みに失敗しました。もう一度お試しください。";

        if (showSpinner) {
          setErrorMessage(message);
          setLoadState("error");
        } else {
          setPollingError(
            "最新情報の取得に失敗しました。通信環境を確認して再読み込みしてください。",
          );
        }
      }
    },
    [],
  );

  useEffect(() => {
    let controller: AbortController | null = null;

    const runFetch = (showSpinner: boolean) => {
      if (controller) {
        controller.abort();
      }
      controller = new AbortController();
      void fetchAndSetJobs({
        showSpinner,
        signal: controller.signal,
      });
    };

    runFetch(true);
    const timer = window.setInterval(() => runFetch(false), POLL_INTERVAL_MS);

    return () => {
      if (controller) {
        controller.abort();
      }
      window.clearInterval(timer);
    };
  }, [fetchAndSetJobs]);

  const handleRowClick = useCallback(
    (jobId: string) => {
      navigate(`/jobs/${jobId}`);
    },
    [navigate],
  );

  const tableBody = useMemo(() => {
    if (loadState === "loading") {
      return (
        <tr>
          <td colSpan={5}>ジョブを読み込み中です...</td>
        </tr>
      );
    }

    if (loadState === "empty") {
      return (
        <tr>
          <td colSpan={5}>ジョブはまだありません。</td>
        </tr>
      );
    }

    if (loadState === "error") {
      return (
        <tr>
          <td colSpan={5}>
            取得に失敗しました: {errorMessage ?? "不明なエラーです。"}
          </td>
        </tr>
      );
    }

    return jobs.map((job) => {
      const statusInfo = STATUS_LABELS[job.status];
      return (
        <tr
          key={job.id}
          tabIndex={0}
          role="button"
          onClick={() => handleRowClick(job.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleRowClick(job.id);
            }
          }}
          className="clickable-row"
        >
          <td>{job.id}</td>
          <td>{job.title}</td>
          <td>
            <span className={`status-pill ${statusInfo.className}`}>
              {statusInfo.label}
            </span>
          </td>
          <td>{formatDateTime(job.created_at)}</td>
          <td>{formatDateTime(job.updated_at)}</td>
        </tr>
      );
    });
  }, [handleRowClick, jobs, loadState, errorMessage]);

  const handleRetry = () => {
    void fetchAndSetJobs({ showSpinner: true });
  };

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) {
      return null;
    }
    return lastUpdated.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [lastUpdated]);
=======
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
>>>>>>> 5501a9a (feat(auth): improve local dev login defaults)

  return (
    <section className="panel jobs-panel">
      <header className="panel-header">
<<<<<<< HEAD
        <div>
          <h2>ジョブ一覧</h2>
          <p className="panel-subtitle">
            送信したファイルの処理状況が順番に表示されます。
          </p>
        </div>
        {lastUpdatedLabel && (
          <p className="meta">最終更新: {lastUpdatedLabel}</p>
        )}
      </header>
=======
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
>>>>>>> 5501a9a (feat(auth): improve local dev login defaults)

      {pollingError && (
        <div className="info-banner" role="status">
          <span>{pollingError}</span>
          <button
            type="button"
            className="link-button"
<<<<<<< HEAD
            onClick={handleRetry}
          >
            再読み込み
=======
            onClick={() => refreshJobs(true)}
          >
            {strings.common.retry}
>>>>>>> 5501a9a (feat(auth): improve local dev login defaults)
          </button>
        </div>
      )}

<<<<<<< HEAD
      {loadState === "error" && (
        <div className="error-banner" role="alert">
          <p>{errorMessage}</p>
          <div className="button-row">
            <button type="button" className="primary-button" onClick={handleRetry}>
              再読み込み
            </button>
            <Link className="secondary-button" to="/upload">
              アップロードを開く
=======
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
>>>>>>> 5501a9a (feat(auth): improve local dev login defaults)
            </Link>
          </div>
        </div>
      )}

      {loadState === "empty" && (
        <div className="empty-state" role="region" aria-live="polite">
<<<<<<< HEAD
          <p>ジョブはまだありません。ファイルを送信して開始しましょう。</p>
          <Link className="primary-button" to="/upload">
            アップロード画面を開く
=======
          <p>{strings.jobs.empty}</p>
          <Link className="primary-button" to="/upload">
            {strings.jobs.openUpload}
>>>>>>> 5501a9a (feat(auth): improve local dev login defaults)
          </Link>
        </div>
      )}

<<<<<<< HEAD
      <div className="table-wrapper" role="region" aria-live="polite">
        <table className="job-table">
          <caption className="sr-only">送信済みジョブの一覧</caption>
          <thead>
            <tr>
              <th scope="col">ジョブID</th>
              <th scope="col">ファイル名</th>
              <th scope="col">状態</th>
              <th scope="col">受付日時</th>
              <th scope="col">最終更新</th>
            </tr>
          </thead>
          <tbody>{tableBody}</tbody>
        </table>
      </div>
=======
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
>>>>>>> 5501a9a (feat(auth): improve local dev login defaults)
    </section>
  );
};

export default Jobs;
