import { apiRequest } from "./apiClient";

export type PaymentExecutionRequest = {
  jobIds?: string[];
};

export type PaymentExecutionResponse = {
  batch_id: string;
  processed: string[];
  requested_at: string;
};

export const executePayments = async (jobIds: string[]): Promise<PaymentExecutionResponse> => {
  return apiRequest<PaymentExecutionResponse>("/api/payments/execute", {
    method: "POST",
    body: JSON.stringify({ jobIds }),
  });
};
