import { apiRequest } from "./apiClient";

export type ApprovalEvent = {
  action: "approved" | "rejected" | "pending";
  actor: string;
  recordedAt: string;
  note?: string | null;
};

export type ApprovalRecord = {
  jobId: string;
  status: "pending" | "approved" | "rejected";
  updatedAt: string;
  history: ApprovalEvent[];
};

export type ApprovalsResponse = {
  approvals: ApprovalRecord[];
};

export type ApprovalActionRequest = {
  note?: string;
};

export const fetchApprovals = async (): Promise<ApprovalRecord[]> => {
  const response = await apiRequest<ApprovalsResponse>("/api/approvals");
  return response.approvals;
};

export const approveJob = async (jobId: string, payload?: ApprovalActionRequest): Promise<ApprovalRecord> => {
  return apiRequest<ApprovalRecord>(`/api/approvals/${jobId}/approve`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
};

export const rejectJob = async (jobId: string, payload?: ApprovalActionRequest): Promise<ApprovalRecord> => {
  return apiRequest<ApprovalRecord>(`/api/approvals/${jobId}/reject`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
};
