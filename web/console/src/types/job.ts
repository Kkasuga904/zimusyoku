export type JobStatus =
  | "queued"
  | "running"
  | "pending"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "ok"
  | "failed";

export type Job = {
  id: string;
  title: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type JobDetail = Job & {
  logs: string[];
};

export type UploadResult = {
  job_id: string;
  stored_name: string;
};
