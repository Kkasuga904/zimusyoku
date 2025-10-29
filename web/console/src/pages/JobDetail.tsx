import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchJobById, type JobDetail as JobDetailType, type JobStatus } from "../modules/jobsApi";
import { useStrings } from "../i18n/strings";

const statusIcons: Record<JobStatus, string> = {
  queued: "⏳",
  running: "⚙️",
  pending: "📝",
  pending_approval: "📝",
  approved: "✅",
  rejected: "❌",
  failed: "❌",
  ok: "✅",
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

const formatCurrency = (value: number | null | undefined, fallback: string) => {
  if (value === null || value === undefined) {
    return fallback;
  }
  return `¥${value.toLocaleString("ja-JP", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
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

    const normalized = job.status.toLowerCase();
    return (
      strings.jobDetail.statusDescriptions[normalized] ??
      strings.jobs.statusLabels[normalized] ??
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

      if (["ok", "failed", "approved", "rejected"].includes(result.status.toLowerCase())) {
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

    if (!job || ["ok", "failed", "approved", "rejected"].includes(job.status.toLowerCase())) {
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
      </section>
    );
  }

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

  const normalizedStatus = job.status.toLowerCase() as JobStatus;
  const statusLabel =
    strings.jobs.statusLabels[normalizedStatus] ?? strings.jobDetail.title;

  const isFinalStatus = ["ok", "failed", "approved", "rejected"].includes(
    normalizedStatus,
  );

  const ocrFields = job.ocr?.fields as Record<string, unknown> | undefined;
  const lineItemsRaw =
    (ocrFields?.lineItems as unknown[] | undefined) ??
    (ocrFields?.line_items as unknown[] | undefined);
  const lineItems = Array.isArray(lineItemsRaw)
    ? lineItemsRaw.map((item) => {
        const source = item as {
          description?: string;
          quantity?: number;
          unit_price?: number;
          unitPrice?: number;
          amount?: number;
        };
        return {
          description: source.description,
          quantity: source.quantity,
          unitPrice: source.unit_price ?? source.unitPrice,
          amount: source.amount,
        };
      }) 
    : [];
  const approvalHistory = job.approvalHistory ?? [];

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
        {statusIcons[normalizedStatus]}
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
        <div>
          <dt>{strings.jobDetail.amountGross}</dt>
          <dd>
            {formatCurrency(
              job.journalEntry?.amount_gross ?? null,
              strings.jobDetail.amountUnavailable,
            )}
          </dd>
        </div>
        <div>
          <dt>{strings.jobDetail.amountNet}</dt>
          <dd>
            {formatCurrency(
              job.journalEntry?.amount_net ?? null,
              strings.jobDetail.amountUnavailable,
            )}
          </dd>
        </div>
        <div>
      <dt>{strings.jobDetail.tax}</dt>
      <dd>
        {formatCurrency(
          job.journalEntry?.tax ?? null,
          strings.jobDetail.amountUnavailable,
        )}
      </dd>
    </div>
  </dl>

      {lineItems.length > 0 && (
        <div className="line-items">
          <h3>{strings.jobDetail.lineItemsTitle}</h3>
          <table>
            <thead>
              <tr>
                <th scope="col">{strings.jobDetail.lineItemHeaders.description}</th>
                <th scope="col">{strings.jobDetail.lineItemHeaders.quantity}</th>
                <th scope="col">{strings.jobDetail.lineItemHeaders.unitPrice}</th>
                <th scope="col">{strings.jobDetail.lineItemHeaders.amount}</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => (
                <tr key={`${item.description ?? "item"}-${index}`}>
                  <td>{item.description ?? "—"}</td>
                  <td>{item.quantity ?? "-"}</td>
                  <td>
                    {typeof item.unitPrice === "number"
                      ? formatCurrency(item.unitPrice, strings.jobs.amountUnavailable)
                      : strings.jobs.amountUnavailable}
                  </td>
                  <td>
                    {typeof item.amount === "number"
                      ? formatCurrency(item.amount, strings.jobs.amountUnavailable)
                      : strings.jobs.amountUnavailable}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {approvalHistory.length > 0 && (
        <div className="approval-history">
          <h3>{strings.approvals.approvalHistory}</h3>
          <ul>
            {approvalHistory.map((event, index) => (
              <li key={`${event.actor}-${event.recordedAt}-${index}`}>
                <span>{new Date(event.recordedAt).toLocaleString()}</span>
                <span>
                  {strings.jobs.statusLabels[event.action] ?? event.action} — {event.actor}
                </span>
                {event.note && <span className="note">“{event.note}”</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

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
    </section>
  );
};

export default JobDetail;

