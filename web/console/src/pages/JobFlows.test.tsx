import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import JobDetail from "./JobDetail";
import Upload from "./Upload";
import { ApiError } from "../modules/apiClient";
import * as jobsApi from "../modules/jobsApi";
import { ja as strings } from "../i18n/strings";
import type {
  JobDetail as JobDetailType,
  JobSummary,
} from "../modules/jobsApi";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("JobDetail page", () => {
  it("renders job details from the API", async () => {
    const payload: JobDetailType = {
      id: "job-123",
      fileName: "invoice-job-123.pdf",
      documentType: "invoice",
      status: "running",
      submittedAt: "2024-01-01T00:01:00Z",
      updatedAt: "2024-01-01T00:05:00Z",
      approvalStatus: "pending",
      approvalHistory: [],
      classification: "Utilities",
      journalEntry: null,
      metadata: {},
      ocr: {
        text: "OCR text",
        fields: {},
      },
      error: null,
    };

    vi.spyOn(jobsApi, "fetchJobById").mockResolvedValue(payload);

    render(
      <MemoryRouter initialEntries={["/jobs/job-123"]}>
        <Routes>
          <Route path="/jobs/:id" element={<JobDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: strings.jobDetail.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(payload.fileName)).toBeInTheDocument();
    expect(
      screen.getByText(strings.jobs.statusLabels.running),
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(jobsApi.fetchJobById).toHaveBeenCalledWith("job-123"),
    );
  });

  it("shows an error when the job cannot be found", async () => {
    vi.spyOn(jobsApi, "fetchJobById").mockRejectedValue(
      new ApiError(404, "Not found"),
    );

    render(
      <MemoryRouter initialEntries={["/jobs/missing"]}>
        <Routes>
          <Route path="/jobs/:id" element={<JobDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      strings.jobDetail.notFound,
    );
  });

  it("handles rendering without a job id", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<JobDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(strings.jobDetail.notFound)).toBeInTheDocument();
  });
});

describe("Upload page", () => {
  it("uploads a file and shows the success message with job link", async () => {
    const job: JobSummary = {
      id: "job-999",
      fileName: "demo.pdf",
      documentType: "invoice",
      status: "queued",
      submittedAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:10Z",
      approvalStatus: "pending",
      approvalHistory: [],
      classification: null,
      journalEntry: null,
      metadata: {},
    };

    const registerSpy = vi
      .spyOn(jobsApi, "registerJob")
      .mockResolvedValue(job);

    render(
      <MemoryRouter initialEntries={["/upload"]}>
        <Routes>
          <Route path="/upload" element={<Upload />} />
        </Routes>
      </MemoryRouter>,
    );

    const fileInput = screen.getByLabelText(strings.upload.selectButton);
    const file = new File(["sample"], "demo.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const submitButton = screen.getByRole("button", {
      name: strings.upload.submitButton,
    });
    fireEvent.click(submitButton);

    await waitFor(() =>
      expect(registerSpy).toHaveBeenCalledWith(file, "invoice", {
        enhance: false,
      }),
    );

    expect(
      await screen.findByText(strings.upload.success(job.id)),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: `${strings.upload.viewJobDetail} (${job.id})`,
      }),
    ).toBeInTheDocument();
  });

  it("prevents submission when no file is selected", () => {
    render(
      <MemoryRouter initialEntries={["/upload"]}>
        <Routes>
          <Route path="/upload" element={<Upload />} />
        </Routes>
      </MemoryRouter>,
    );

    const submitButton = screen.getByRole("button", {
      name: strings.upload.submitButton,
    });
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(strings.upload.noFile)).toBeInTheDocument();
  });

  it("shows an error when the API call fails", async () => {
    vi.spyOn(jobsApi, "registerJob").mockRejectedValue(new Error("failed"));

    render(
      <MemoryRouter initialEntries={["/upload"]}>
        <Routes>
          <Route path="/upload" element={<Upload />} />
        </Routes>
      </MemoryRouter>,
    );

    const fileInput = screen.getByLabelText(strings.upload.selectButton);
    const file = new File(["sample"], "demo.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const submitButton = screen.getByRole("button", {
      name: strings.upload.submitButton,
    });
    fireEvent.click(submitButton);

    expect(await screen.findByRole("alert")).toHaveTextContent(strings.upload.failed);
  });
});
