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
      </section>
    );
  }

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
    </section>
  );
};

export default JobDetail;
