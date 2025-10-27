import type { Job, JobDetail, UploadResult } from "../types/job";

export class ApiError extends Error {
  readonly status: number;
  readonly detail?: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function parseError(response: Response) {
  try {
    return await response.json();
  } catch (error) {
    return undefined;
  }
}

export async function apiFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const detail = await parseError(response);
    const detailMessage =
      typeof detail === "object" && detail && "detail" in detail
        ? String((detail as Record<string, unknown>).detail)
        : null;
    const message =
      detailMessage ?? "Request failed with status " + response.status;
    throw new ApiError(message, response.status, detail);
  }
  return (await response.json()) as T;
}

export async function fetchJobs(signal?: AbortSignal): Promise<Job[]> {
  return apiFetch<Job[]>("/api/jobs", { signal });
}

export async function fetchJobDetail(
  jobId: string,
  signal?: AbortSignal,
): Promise<JobDetail> {
  return apiFetch<JobDetail>("/api/jobs/" + jobId, { signal });
}

export async function uploadFile(
  file: File,
  signal?: AbortSignal,
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<UploadResult>("/api/uploads", {
    method: "POST",
    body: formData,
    signal,
  });
}
