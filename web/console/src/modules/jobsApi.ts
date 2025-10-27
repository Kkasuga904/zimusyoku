import { apiRequest, downloadFile } from "./apiClient";

export type DocumentType = "invoice" | "receipt" | "estimate";

export type JobStatus = "Queued" | "Running" | "Ok" | "Failed";

export type JobSummary = {
  id: string;
  fileName: string;
  documentType: DocumentType;
  status: JobStatus;
  classification?: string | null;
  submittedAt: string;
  updatedAt: string;
};

export type JobDetail = JobSummary & {
  error?: string | null;
  ocr?: {
    text: string;
    fields: Record<string, unknown>;
  } | null;
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
): Promise<JobSummary> => {
  const formData = new FormData();
  formData.append("document", file);
  formData.append("document_type", documentType);

  const response = await apiRequest<UploadResponse>("/api/ocr/upload", {
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
