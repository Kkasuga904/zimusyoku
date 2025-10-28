import { apiRequest, downloadFile } from "./apiClient";

export type DocumentType = "invoice" | "receipt" | "estimate";

export type JobStatus = "Queued" | "Running" | "Ok" | "Failed";

export type JournalEntry = {
  vendor: string;
  account: string;
  memo: string;
  amount_gross: number;
  amount_net: number;
  tax: number;
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
  return response.jobs;
};

export const fetchJobById = async (id: string): Promise<JobDetail> => {
  const response = await apiRequest<JobDetail>(`/api/jobs/${id}`);
  return response;
};

export const exportJobsCsv = async (): Promise<Blob> => {
  return downloadFile("/api/jobs/export.csv");
};
