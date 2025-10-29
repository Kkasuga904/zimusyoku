import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { type MockedFunction, vi } from "vitest";
import JobDetail from "./JobDetail";
import { ja as strings } from "../i18n/strings";
import { fetchJobById } from "../modules/jobsApi";

vi.mock("../modules/jobsApi", () => ({
  fetchJobById: vi.fn(),
}));

const fetchJobByIdMock =
  fetchJobById as MockedFunction<typeof fetchJobById>;

const baseJob = {
  fileName: "sample.csv",
  description: "test job",
  submittedAt: "2025-10-20T00:00:00.000Z",
  updatedAt: "2025-10-20T00:00:00.000Z",
};

const renderDetail = (id = "JOB-7777") =>
  render(
    <MemoryRouter initialEntries={[`/jobs/${id}`]}>
      <Routes>
        <Route path="/jobs/:id" element={<JobDetail />} />
      </Routes>
    </MemoryRouter>,
  );

describe("JobDetail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a completed job and disables polling controls", async () => {
    fetchJobByIdMock.mockResolvedValue({
      id: "JOB-7777",
      status: "approved",
      ...baseJob,
    });

    renderDetail();

    expect(
      await screen.findByText(strings.jobs.statusLabels.approved),
    ).toBeInTheDocument();
    const toggle = screen.getByRole("button", {
      name: strings.jobDetail.resumePolling,
    });
    expect(toggle).toBeDisabled();
    expect(
      screen.getByText(strings.jobDetail.pollingStopped),
    ).toBeInTheDocument();
  });

  it("allows pausing and resuming polling for a running job", async () => {
    fetchJobByIdMock.mockResolvedValueOnce({
      id: "JOB-8888",
      status: "queued",
      ...baseJob,
    });
    fetchJobByIdMock.mockResolvedValueOnce({
      id: "JOB-8888",
      status: "running",
      ...baseJob,
      updatedAt: "2025-10-20T00:05:00.000Z",
    });

    renderDetail("JOB-8888");

    await screen.findByText(strings.jobs.statusLabels.queued);

    const toggle = screen.getByRole("button", {
      name: strings.jobDetail.stopPolling,
    });
    fireEvent.click(toggle);
    expect(
      screen.getByText(strings.jobDetail.pollingStopped),
    ).toBeInTheDocument();
    expect(toggle).toHaveTextContent(strings.jobDetail.resumePolling);

    fireEvent.click(toggle);

    await waitFor(() => expect(fetchJobByIdMock).toHaveBeenCalledTimes(2));
    expect(
      screen.getByText(strings.jobs.statusLabels.running),
    ).toBeInTheDocument();
  });
});
