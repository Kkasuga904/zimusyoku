import { useCallback, useEffect, useMemo, useState } from "react";
import { approveJob, fetchApprovals, rejectJob, type ApprovalRecord } from "../modules/approvalsApi";
import { fetchJobs, type JobSummary } from "../modules/jobsApi";
import { ApiError, NetworkError } from "../modules/apiClient";
import { useStrings } from "../i18n/strings";

type ApprovalTab = "pending" | "approved" | "rejected";

const Approvals = () => {
  const strings = useStrings();
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [jobs, setJobs] = useState<Record<string, JobSummary>>({});
  const [statusFilter, setStatusFilter] = useState<ApprovalTab>("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [approvalsResponse, jobsResponse] = await Promise.all([fetchApprovals(), fetchJobs()]);
      const jobMap: Record<string, JobSummary> = {};
      jobsResponse.forEach((job) => {
        jobMap[job.id] = job;
      });
      setJobs(jobMap);
      setApprovals(approvalsResponse);
    } catch (err) {
      if (err instanceof NetworkError) {
        setError(strings.summary.offline);
      } else if (err instanceof ApiError && err.status >= 500) {
        setError(strings.summary.error);
      } else {
        setError(strings.approvals.actionError);
      }
    } finally {
      setIsLoading(false);
    }
  }, [strings]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredApprovals = useMemo(() => approvals.filter((record) => record.status === statusFilter), [approvals, statusFilter]);

  const handleApprove = async (jobId: string) => {
    setIsSubmitting((prev) => ({ ...prev, [jobId]: true }));
    setSuccessMessage(null);
    try {
      await approveJob(jobId, notes[jobId] ? { note: notes[jobId] } : undefined);
      setSuccessMessage(strings.approvals.approveSuccess);
      await load();
    } catch (err) {
      if (err instanceof NetworkError) {
        setError(strings.summary.offline);
      } else {
        setError(strings.approvals.actionError);
      }
    } finally {
      setIsSubmitting((prev) => ({ ...prev, [jobId]: false }));
    }
  };

  const handleReject = async (jobId: string) => {
    setIsSubmitting((prev) => ({ ...prev, [jobId]: true }));
    setSuccessMessage(null);
    try {
      await rejectJob(jobId, notes[jobId] ? { note: notes[jobId] } : undefined);
      setSuccessMessage(strings.approvals.rejectSuccess);
      await load();
    } catch (err) {
      if (err instanceof NetworkError) {
        setError(strings.summary.offline);
      } else {
        setError(strings.approvals.actionError);
      }
    } finally {
      setIsSubmitting((prev) => ({ ...prev, [jobId]: false }));
    }
  };

  return (
    <section className="panel approvals-panel">
      <header className="panel-header">
        <h2>{strings.approvals.title}</h2>
        <p>{strings.approvals.description}</p>
      </header>
      <div className="tab-controls" role="tablist" aria-label={strings.approvals.title}>
        {(
          [
            { key: "pending", label: strings.approvals.tabs.pending },
            { key: "approved", label: strings.approvals.tabs.approved },
            { key: "rejected", label: strings.approvals.tabs.rejected },
          ] as { key: ApprovalTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={statusFilter === tab.key}
            className={statusFilter === tab.key ? "tab active" : "tab"}
            onClick={() => setStatusFilter(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && <p>{strings.common.loading}</p>}
      {error && !isLoading && (
        <div className="error-banner" role="alert">
          <p>{error}</p>
        </div>
      )}
      {successMessage && (
        <div className="success-banner" role="status">
          <p>{successMessage}</p>
        </div>
      )}

      {!isLoading && filteredApprovals.length === 0 && !error && <p>{strings.approvals.empty}</p>}

      {!isLoading && filteredApprovals.length > 0 && (
        <div className="table-wrapper">
          <table>
            <caption>{strings.approvals.tableCaption}</caption>
            <thead>
              <tr>
                <th scope="col">{strings.approvals.columns.jobId}</th>
                <th scope="col">{strings.approvals.columns.vendor}</th>
                <th scope="col">{strings.approvals.columns.amount}</th>
                <th scope="col">{strings.approvals.columns.updated}</th>
                <th scope="col">{strings.approvals.columns.status}</th>
                <th scope="col">{strings.approvals.columns.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filteredApprovals.map((record) => {
                const job = jobs[record.jobId];
                const latestEvent = record.history[record.history.length - 1];
                const amount = job?.journalEntry?.amount ?? job?.metadata?.amounts?.total;
                const formattedAmount = typeof amount === "number" ? `¥${amount.toLocaleString("ja-JP")}` : strings.jobs.amountUnavailable;
                const isPending = record.status === "pending";
                return (
                  <tr key={record.jobId}>
                    <th scope="row">{record.jobId}</th>
                    <td>{job?.journalEntry?.vendor ?? job?.metadata?.vendor ?? "—"}</td>
                    <td>{formattedAmount}</td>
                    <td>{new Date(record.updatedAt).toLocaleString()}</td>
                    <td>{strings.jobs.statusLabels[record.status as keyof typeof strings.jobs.statusLabels] ?? record.status}</td>
                    <td>
                      {isPending ? (
                        <div className="approval-actions">
                          <label className="sr-only" htmlFor={`note-${record.jobId}`}>
                            {strings.approvals.notePlaceholder}
                          </label>
                          <input
                            id={`note-${record.jobId}`}
                            type="text"
                            value={notes[record.jobId] ?? ""}
                            placeholder={strings.approvals.notePlaceholder}
                            onChange={(event) =>
                              setNotes((prev) => ({ ...prev, [record.jobId]: event.target.value }))
                            }
                          />
                          <div className="button-group">
                            <button
                              type="button"
                              onClick={() => handleApprove(record.jobId)}
                              disabled={isSubmitting[record.jobId]}
                            >
                              {isSubmitting[record.jobId] ? strings.common.loading : strings.approvals.approve}
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => handleReject(record.jobId)}
                              disabled={isSubmitting[record.jobId]}
                            >
                              {isSubmitting[record.jobId] ? strings.common.loading : strings.approvals.reject}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="approval-history">
                          <p>
                            <strong>{strings.approvals.latestAction}:</strong> {latestEvent?.action ?? record.status} — {latestEvent?.actor ?? "system"}
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default Approvals;
