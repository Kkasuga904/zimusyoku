import { apiRequest } from "./apiClient";

export type SummaryBucket = {
  label: string;
  amount: number;
};

export type SummaryCategoryRatio = {
  label: string;
  ratio: number;
};

export type SummaryMonthlyTotal = {
  month: string;
  total: number;
};

export type SummaryAccountTotal = {
  account: string;
  amount: number;
};

export type SummaryResponse = {
  month: string;
  total_spend: number;
  journal_count: number;
  breakdown: SummaryBucket[];
  category_ratios: SummaryCategoryRatio[];
  approval_rate: number;
  monthly_totals: SummaryMonthlyTotal[];
  top_accounts: SummaryAccountTotal[];
};

export const fetchSummary = async (): Promise<SummaryResponse> => {
  return apiRequest<SummaryResponse>("/api/summary");
};
