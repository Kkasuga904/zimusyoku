<<<<<<< HEAD
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ApiError, fetchJobDetail } from "../lib/api";
import type { JobDetail as JobDetailType } from "../types/job";

const POLL_INTERVAL_MS = 1_000;

const JobDetail = () => {
  const params = useParams();
  const navigate = useNavigate();
  const jobId = params.id ?? "";
  const [job, setJob] = useState<JobDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    let disposed = false;
    let controller: AbortController | null = null;

    const load = async () => {
      if (controller) {
        controller.abort();
      }
      controller = new AbortController();
      try {
        const data = await fetchJobDetail(jobId, controller.signal);
        if (!disposed) {
          setJob(data);
          setError(null);
        }
      } catch (cause) {
        if (disposed) {
          return;
        }
        if (cause instanceof ApiError && cause.status === 404) {
          setError("Job not found");
          return;
        }
        setError("Failed to load job details");
      }
    };

    load();
    const timer = window.setInterval(load, POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      if (controller) {
        controller.abort();
      }
      window.clearInterval(timer);
    };
  }, [jobId]);

  const statusBadge = useMemo(() => {
    if (!job) {
      return null;
    }
    return (
      <span className={"badge badge-" + job.status}>
        {job.status.toUpperCase()}
      </span>
    );
  }, [job]);

  if (!jobId) {
    return (
      <section className="panel">
        <h2>Job Details</h2>
        <p>Missing job identifier.</p>
=======
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchJobById, type JobDetail as JobDetailType, type JobStatus } from "../modules/jobsApi";
import { useStrings } from "../i18n/strings";

const statusIcons: Record<JobStatus, string> = {
  Queued: "⏳",
  Running: "⚙️",
  Ok: "✅",
  Failed: "❗",
};

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

const JobDetail = () => {
  const strings = useStrings();
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<JobDetailType | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "error" | "success">(
    "loading",
  );
  const [isPolling, setIsPolling] = useState(true);

  const statusDescription = useMemo(() => {
    if (!job) {
      return "";
    }

    return (
      strings.jobDetail.statusDescriptions[job.status] ??
      strings.jobs.statusLabels[job.status] ??
      job.status
    );
  }, [job, strings.jobDetail.statusDescriptions, strings.jobs.statusLabels]);

  const loadJob = useCallback(async () => {
    if (!id) {
      setLoadState("error");
      return;
    }

    try {
      const result = await fetchJobById(id);
      setJob(result);
      setLoadState("success");

      if (result.status === "Ok" || result.status === "Failed") {
        setIsPolling(false);
      }
    } catch (_error) {
      setLoadState("error");
    }
  }, [id]);

  useEffect(() => {
    void loadJob();
  }, [loadJob]);

  useEffect(() => {
    if (!isPolling) {
      return;
    }

    if (!job || job.status === "Ok" || job.status === "Failed") {
      return;
    }

    const interval = window.setInterval(() => {
      void loadJob();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [isPolling, job, loadJob]);

  const togglePolling = () => {
    if (isPolling) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    void loadJob();
  };

  if (loadState === "loading") {
    return (
      <section className="panel job-detail-panel">
        <p role="status" aria-live="polite">
          {strings.common.loading}
        </p>
>>>>>>> 5501a9a (feat(auth): improve local dev login defaults)
      </section>
    );
  }

<<<<<<< HEAD
  return (
    <section className="panel">
      <button type="button" className="link-button" onClick={() => navigate(-1)}>
        ← Back
      </button>
      <h2>Job {jobId}</h2>
      {error && <p role="alert">{error}</p>}
      {!error && !job && <p>Loading job details…</p>}
      {job && (
        <div className="job-detail">
          <dl>
            <div>
              <dt>Title</dt>
              <dd>{job.title}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{statusBadge}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{new Date(job.created_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{new Date(job.updated_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Started</dt>
              <dd>
                {job.started_at
                  ? new Date(job.started_at).toLocaleString()
                  : "Pending"}
              </dd>
            </div>
            <div>
              <dt>Finished</dt>
              <dd>
                {job.finished_at
                  ? new Date(job.finished_at).toLocaleString()
                  : "Pending"}
              </dd>
            </div>
          </dl>
          <section>
            <h3>Logs</h3>
            {job.logs.length === 0 ? (
              <p>No audit entries yet.</p>
            ) : (
              <ul className="logs">
                {job.logs.map((entry, index) => (
                  <li key={index}>{entry}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
=======
  if (loadState === "error" || !job) {
    return (
      <section className="panel job-detail-panel">
        <h2>{strings.jobDetail.title}</h2>
        <div className="error-banner" role="alert">
          <p>{strings.jobDetail.notFound}</p>
          <Link className="primary-button" to="/jobs">
            {strings.jobDetail.backToJobs}
          </Link>
        </div>
      </section>
    );
  }

  const statusLabel =
    strings.jobs.statusLabels[job.status] ?? strings.jobDetail.title;

  const isFinalStatus = job.status === "Ok" || job.status === "Failed";

  return (
    <section className="panel job-detail-panel">
      <header className="panel-header">
        <h2>{strings.jobDetail.title}</h2>
        <p className="meta">
          {strings.jobDetail.lastChecked(formatDateTime(job.updatedAt))}
        </p>
      </header>
      <p>{strings.jobDetail.intro}</p>

      <div
        className={`status-callout status-${job.status.toLowerCase()}`}
        role="status"
        aria-live="polite"
      >
        <span className="status-icon" aria-hidden="true">
          {statusIcons[job.status]}
        </span>
        <div>
          <p className="status-label">
            {statusLabel}
            <span className="sr-only">: </span>
          </p>
          <p>{statusDescription}</p>
        </div>
      </div>

      {job.classification && (
        <div className="info-banner" role="status">
          <span>{strings.jobs.columns.classification}: {job.classification}</span>
        </div>
      )}

      <dl className="detail-grid">
        <div>
          <dt>{strings.jobDetail.fileName}</dt>
          <dd>{job.fileName}</dd>
        </div>
        <div>
          <dt>{strings.jobs.columns.documentType}</dt>
          <dd>{strings.upload.types[job.documentType] ?? job.documentType}</dd>
        </div>
        <div>
          <dt>{strings.jobDetail.startedAt}</dt>
          <dd>{formatDateTime(job.submittedAt)}</dd>
        </div>
        <div>
          <dt>{strings.jobDetail.updatedAt}</dt>
          <dd>{formatDateTime(job.updatedAt)}</dd>
        </div>
      </dl>

      <div className="button-row">
        <button
          type="button"
          className="secondary-button"
          onClick={togglePolling}
          disabled={isFinalStatus}
        >
          {isPolling
            ? strings.jobDetail.stopPolling
            : strings.jobDetail.resumePolling}
        </button>
        <Link className="link-button" to="/jobs">
          {strings.jobDetail.backToJobs}
        </Link>
      </div>

      <p className="helper-text" role="status" aria-live="polite">
        {isFinalStatus
          ? strings.jobDetail.pollingStopped
          : isPolling
            ? strings.jobDetail.pollingInfo
            : strings.jobDetail.pollingStopped}
      </p>
>>>>>>> 5501a9a (feat(auth): improve local dev login defaults)
    </section>
  );
};

export default JobDetail;
