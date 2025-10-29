import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Approvals from "./Approvals";
import { ja as strings } from "../i18n/strings";
import * as approvalsApi from "../modules/approvalsApi";
import * as jobsApi from "../modules/jobsApi";

vi.mock("../modules/approvalsApi", () => ({
  fetchApprovals: vi.fn(),
  approveJob: vi.fn(),
  rejectJob: vi.fn(),
}));

vi.mock("../modules/jobsApi", () => ({
  fetchJobs: vi.fn(),
}));

describe("Approvals page", () => {

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(approvalsApi.fetchApprovals).mockResolvedValue([
      {
        jobId: "JOB-1234",
        status: "pending",
        updatedAt: new Date().toISOString(),
        history: [
          {
            action: "pending",
            actor: "system",
            recordedAt: new Date().toISOString(),
            note: null,
          },
        ],
      },
    ]);
    vi.mocked(jobsApi.fetchJobs).mockResolvedValue([
      {
        id: "JOB-1234",
        fileName: "invoice.pdf",
        documentType: "invoice",
        status: "pending_approval",
        classification: "交通費",
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        journalEntry: {
          vendor: "Metro Transport",
          account: "旅費交通費",
          memo: "",
          description: "",
          amount: 12345,
          amount_gross: 12345,
          amount_net: 11123,
          tax: 1222,
          journalLines: [],
          currency: "JPY",
          document_type: "invoice",
          recorded_at: new Date().toISOString(),
        },
        metadata: {},
        approvalStatus: "pending",
        approvalHistory: [],
      },
    ]);
  });

  it("renders pending approvals and triggers approve", async () => {
    vi.mocked(approvalsApi.approveJob).mockResolvedValue({ status: "approved", history: [] });

    render(<Approvals />);

    await waitFor(() => {
      expect(screen.getByText("Metro Transport")).toBeInTheDocument();
    });

    const approveButton = screen.getByRole("button", { name: strings.approvals.approve });
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(approvalsApi.approveJob).toHaveBeenCalledWith("JOB-1234", undefined);
    });
  });
});
