import { apiRequest, downloadFile } from "./apiClient";

export type DocumentType = "invoice" | "receipt" | "estimate";

export type JobStatus =
  | "queued"
  | "running"
  | "pending"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "failed"
  | "ok";

export type ApprovalEvent = {
  action: "approved" | "rejected" | "pending";
  actor: string;
  recordedAt: string;
  note?: string | null;
};

export type JournalEntry = {
  vendor: string;
  account: string;
  memo: string;
  description?: string | null;
  amount: number;
  amount_gross: number;
  amount_net: number;
  tax: number;
  debitAccount?: string | null;
  creditAccount?: string | null;
  taxAccount?: string | null;
  journalLines: {
    account: string;
    debit: number;
    credit: number;
    description?: string | null;
  }[];
  currency: string;
  document_type: string;
  recorded_at: string;
};

export type JobSummary = {
  id: string;
  fileName: string;
  documentType: DocumentType;
  status: JobStatus;
  classification?: string | null;
  submittedAt: string;
  updatedAt: string;
  journalEntry?: JournalEntry | null;
  metadata?: Record<string, unknown>;
  approvalStatus: "pending" | "approved" | "rejected";
  approvalHistory: ApprovalEvent[];
};

export type JobDetail = JobSummary & {
  error?: string | null;
  ocr?: {
    text: string;
    fields: Record<string, unknown>;
  } | null;
  journalEntry?: JournalEntry | null;
};

type UploadResponse = {
  job: JobSummary;
};

type JobsResponse = {
  jobs: JobSummary[];
};

export const registerJob = async (
  file: File,
  documentType: DocumentType,
  opts?: { enhance?: boolean },
): Promise<JobSummary> => {
  const formData = new FormData();
  formData.append("document", file);
  formData.append("document_type", documentType);

  const endpoint = opts?.enhance ? "/api/ocr/upload?enhance=true" : "/api/ocr/upload";

  const response = await apiRequest<UploadResponse>(endpoint, {
    method: "POST",
    body: formData,
  });

  return response.job;
};

export const fetchJobs = async (): Promise<JobSummary[]> => {
  const response = await apiRequest<JobsResponse>("/api/jobs");
  return response.jobs.map((job) => normalizeJob(job));
};

export const fetchJobById = async (id: string): Promise<JobDetail> => {
  const response = await apiRequest<JobDetail>(`/api/jobs/${id}`);
  return normalizeJob(response) as JobDetail;
};

export const exportJobsCsv = async (): Promise<Blob> => {
  return downloadFile("/api/jobs/export.csv");
};

export const exportInvoicesPdf = async (): Promise<Blob> => {
  return downloadFile("/api/export/invoices");
};

export const exportJournalCsv = async (): Promise<Blob> => {
  return downloadFile("/api/export/journal");
};

const normalizeJob = <T extends JobSummary>(job: T): T => {
  const normalizedStatus = (job.status ?? "queued").toLowerCase() as JobStatus;
  const approvalStatus = (job.approvalStatus ?? "pending") as "pending" | "approved" | "rejected";
  return {
    ...job,
    status: normalizedStatus,
    approvalStatus,
    approvalHistory: job.approvalHistory ?? [],
  };
};
