import { apiRequest } from "./apiClient";

export type SummaryBucket = {
  label: string;
  amount: number;
};

export type SummaryResponse = {
  month: string;
  total_spend: number;
  journal_count: number;
  breakdown: SummaryBucket[];
};

export const fetchSummary = async (): Promise<SummaryResponse> => {
  return apiRequest<SummaryResponse>("/api/summary");
};
