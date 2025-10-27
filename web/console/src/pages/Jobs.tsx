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

  return (
    <section className="panel jobs-panel">
      <header className="panel-header">
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

      {pollingError && (
        <div className="info-banner" role="status">
          <span>{pollingError}</span>
          <button
            type="button"
            className="link-button"
            onClick={handleRetry}
          >
            再読み込み
          </button>
        </div>
      )}

      {loadState === "error" && (
        <div className="error-banner" role="alert">
          <p>{errorMessage}</p>
          <div className="button-row">
            <button type="button" className="primary-button" onClick={handleRetry}>
              再読み込み
            </button>
            <Link className="secondary-button" to="/upload">
              アップロードを開く
            </Link>
          </div>
        </div>
      )}

      {loadState === "empty" && (
        <div className="empty-state" role="region" aria-live="polite">
          <p>ジョブはまだありません。ファイルを送信して開始しましょう。</p>
          <Link className="primary-button" to="/upload">
            アップロード画面を開く
          </Link>
        </div>
      )}

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
    </section>
  );
};

export default Jobs;
