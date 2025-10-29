import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { type MockedFunction, vi } from "vitest";
import Jobs from "./Jobs";
import { ja as strings } from "../i18n/strings";
import { exportJobsCsv, fetchJobs, type JobSummary } from "../modules/jobsApi";

vi.mock("../modules/jobsApi", () => ({
  fetchJobs: vi.fn(),
  exportJobsCsv: vi.fn(),
}));

const fetchJobsMock = fetchJobs as MockedFunction<typeof fetchJobs>;
const exportJobsCsvMock = exportJobsCsv as MockedFunction<typeof exportJobsCsv>;

const renderJobs = () =>
  render(
    <MemoryRouter>
      <Jobs />
    </MemoryRouter>,
  );

describe("Jobs page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the job table with classification and document type", async () => {
    fetchJobsMock.mockResolvedValueOnce([
      {
        id: "JOB-3333",
        fileName: "受注一覧.csv",
        documentType: "invoice",
        status: "approved",
        classification: "交通費",
        submittedAt: "2025-10-20T00:00:00.000Z",
        updatedAt: "2025-10-20T00:00:00.000Z",
        approvalStatus: "approved",
        approvalHistory: [],
        journalEntry: {
          vendor: "Metro",
          account: "旅費交通費",
          memo: "",
          description: "",
          amount: 12345,
          amount_gross: 12345,
          amount_net: 11223,
          tax: 1222,
          journalLines: [],
          currency: "JPY",
          document_type: "invoice",
          recorded_at: "2025-10-20T00:00:00.000Z",
        },
        metadata: {},
      },
    ] as unknown as JobSummary[]);

    renderJobs();

    await waitFor(() => expect(fetchJobsMock).toHaveBeenCalled());
    expect(await screen.findByText("JOB-3333")).toBeInTheDocument();
    expect(screen.getByText("受注一覧.csv")).toBeInTheDocument();
    expect(screen.getByText(strings.upload.types.invoice)).toBeInTheDocument();
    const statusLabels = screen.getAllByText(strings.jobs.statusLabels.approved);
    expect(statusLabels.length).toBeGreaterThan(0);
    expect(screen.getByText("交通費")).toBeInTheDocument();
  });

  it("shows an empty message when no jobs exist", async () => {
    fetchJobsMock.mockResolvedValueOnce([]);

    renderJobs();

    await waitFor(() => expect(fetchJobsMock).toHaveBeenCalled());
    expect(await screen.findByText(strings.jobs.empty)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: strings.jobs.openUpload }),
    ).toBeInTheDocument();
  });

  it("displays an error when loading fails", async () => {
    fetchJobsMock.mockRejectedValueOnce(new Error("network"));

    renderJobs();

    await waitFor(() => expect(fetchJobsMock).toHaveBeenCalled());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      strings.jobs.error,
    );
  });

  it("exports jobs as CSV", async () => {
    fetchJobsMock.mockResolvedValueOnce([
      {
        id: "JOB-3333",
        fileName: "受注一覧.csv",
        documentType: "invoice",
        status: "approved",
        classification: "交通費",
        submittedAt: "2025-10-20T00:00:00.000Z",
        updatedAt: "2025-10-20T00:00:00.000Z",
        approvalStatus: "approved",
        approvalHistory: [],
        journalEntry: {
          vendor: "Metro",
          account: "旅費交通費",
          memo: "",
          description: "",
          amount: 12345,
          amount_gross: 12345,
          amount_net: 11223,
          tax: 1222,
          journalLines: [],
          currency: "JPY",
          document_type: "invoice",
          recorded_at: "2025-10-20T00:00:00.000Z",
        },
        metadata: {},
      },
    ] as unknown as JobSummary[]);
    exportJobsCsvMock.mockResolvedValueOnce(new Blob(["id,file"], { type: "text/csv" }));
    const originalCreate = window.URL.createObjectURL;
    const originalRevoke = window.URL.revokeObjectURL;
    const originalAnchorClick = HTMLAnchorElement.prototype.click;
    const createMock = vi.fn(() => "blob:mock");
    const revokeMock = vi.fn();
    Object.defineProperty(window.URL, "createObjectURL", { configurable: true, value: createMock });
    Object.defineProperty(window.URL, "revokeObjectURL", { configurable: true, value: revokeMock });
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderJobs();

    await waitFor(() => expect(fetchJobsMock).toHaveBeenCalled());

    fireEvent.click(
      await screen.findByRole("button", { name: strings.jobs.exportCsv }),
    );

    await waitFor(() => expect(exportJobsCsvMock).toHaveBeenCalled());

    expect(createMock).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(revokeMock).toHaveBeenCalledWith("blob:mock");
    expect(clickSpy).toHaveBeenCalled();

    Object.defineProperty(window.URL, "createObjectURL", { configurable: true, value: originalCreate });
    Object.defineProperty(window.URL, "revokeObjectURL", { configurable: true, value: originalRevoke });
    appendSpy.mockRestore();
    removeSpy.mockRestore();
    clickSpy.mockRestore();
    HTMLAnchorElement.prototype.click = originalAnchorClick;
  });

  it.skip("surfaces polling errors during background refresh", async () => {
    vi.useFakeTimers();

    try {
      fetchJobsMock.mockResolvedValueOnce([
        {
          id: "JOB-3333",
          fileName: "受注一覧.csv",
          documentType: "invoice",
          status: "queued",
          classification: null,
          submittedAt: "2025-10-20T00:00:00.000Z",
          updatedAt: "2025-10-20T00:00:00.000Z",
          approvalStatus: "pending",
          approvalHistory: [],
          metadata: {},
        },
      ] as unknown as JobSummary[]);
      fetchJobsMock.mockRejectedValueOnce(new Error("poll failure"));

      renderJobs();

      await waitFor(() => expect(fetchJobsMock).toHaveBeenCalledTimes(1));

      await act(async () => {
        await vi.advanceTimersToNextTimerAsync();
      });

      await waitFor(() => expect(fetchJobsMock).toHaveBeenCalledTimes(2));
      expect(
        await screen.findByText(strings.jobs.pollError),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
