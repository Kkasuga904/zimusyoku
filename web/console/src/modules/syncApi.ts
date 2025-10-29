import { apiRequest } from "./apiClient";

export type SyncRequest = {
  jobIds?: string[];
};

export type SyncReceipt = {
  job_id: string;
  integration: string;
  id?: string;
  status?: string;
};

export type SyncResponse = {
  processed: string[];
  receipts: SyncReceipt[];
};

export const syncFreee = async (jobIds: string[]): Promise<SyncResponse> => {
  return apiRequest<SyncResponse>("/api/sync/freee", {
    method: "POST",
    body: JSON.stringify({ jobIds }),
  });
};

export const syncYayoi = async (jobIds: string[]): Promise<SyncResponse> => {
  return apiRequest<SyncResponse>("/api/sync/yayoi", {
    method: "POST",
    body: JSON.stringify({ jobIds }),
  });
};
