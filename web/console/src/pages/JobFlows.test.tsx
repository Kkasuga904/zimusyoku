import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import JobDetail from "./JobDetail";
import Upload from "./Upload";
import { ApiError } from "../lib/api";
import * as api from "../lib/api";
import type { JobDetail as JobDetailType, UploadResult } from "../types/job";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("JobDetail page", () => {
  it("renders job details from the API", async () => {
    const payload: JobDetailType = {
      id: "job-123",
      title: "Processing invoice",
      status: "running",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:05:00Z",
      started_at: "2024-01-01T00:01:00Z",
      finished_at: null,
      logs: ["2024-01-01T00:01:00Z Job picked up by worker"],
    };

    vi.spyOn(api, "fetchJobDetail").mockResolvedValue(payload);

    render(
      <MemoryRouter initialEntries={["/jobs/job-123"]}>
        <Routes>
          <Route path="/jobs/:id" element={<JobDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Job job-123/i)).toBeInTheDocument();
    expect(screen.getByText("Processing invoice")).toBeInTheDocument();
    expect(
      screen.getByText("2024-01-01T00:01:00Z Job picked up by worker"),
    ).toBeInTheDocument();

    await waitFor(() => expect(api.fetchJobDetail).toHaveBeenCalled());
  });

  it("shows an error when the job cannot be found", async () => {
    vi.spyOn(api, "fetchJobDetail").mockRejectedValue(
      new ApiError("Job not found", 404),
    );

    render(
      <MemoryRouter initialEntries={["/jobs/missing"]}>
        <Routes>
          <Route path="/jobs/:id" element={<JobDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Job not found");
  });

  it("handles rendering without a job id", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<JobDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Missing job identifier/i)).toBeInTheDocument();
  });
});

describe("Upload page", () => {
  it("uploads a file and navigates to the new job", async () => {
    const response: UploadResult = {
      job_id: "job-999",
      stored_name: "stored-demo.txt",
    };

    vi.spyOn(api, "uploadFile").mockResolvedValue(response);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={["/upload"]}>
        <Routes>
          <Route path="/upload" element={<Upload />} />
          <Route path="/jobs/:id" element={<div>Job detail stub</div>} />
        </Routes>
      </MemoryRouter>,
    );

    const fileInput = screen.getByLabelText("Select file");
    const file = new File(["sample"], "demo.txt", { type: "text/plain" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const submitButton = screen.getByRole("button", {
      name: /submit for processing/i,
    });
    fireEvent.click(submitButton);

    await waitFor(() => expect(api.uploadFile).toHaveBeenCalledWith(file));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(await screen.findByText("Job detail stub")).toBeInTheDocument();

    alertSpy.mockRestore();
  });

  it("prompts for a file when none is selected", async () => {
    render(
      <MemoryRouter initialEntries={["/upload"]}>
        <Routes>
          <Route path="/upload" element={<Upload />} />
        </Routes>
      </MemoryRouter>,
    );

    const submitButton = screen.getByRole("button", {
      name: /submit for processing/i,
    });
    fireEvent.click(submitButton);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Select a file to process",
    );
  });

  it("shows an error when the API call fails", async () => {
    vi.spyOn(api, "uploadFile").mockRejectedValue(new Error("failed"));

    render(
      <MemoryRouter initialEntries={["/upload"]}>
        <Routes>
          <Route path="/upload" element={<Upload />} />
        </Routes>
      </MemoryRouter>,
    );

    const fileInput = screen.getByLabelText("Select file");
    const file = new File(["sample"], "demo.txt", { type: "text/plain" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const submitButton = screen.getByRole("button", {
      name: /submit for processing/i,
    });
    fireEvent.click(submitButton);

    expect(await screen.findByRole("alert")).toHaveTextContent("Upload failed");
  });
});
