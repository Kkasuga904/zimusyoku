import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const mockJobs = [
  {
    id: "job-1",
    title: "Demo job",
    status: "queued",
    created_at: new Date("2024-01-01T00:00:00Z").toISOString(),
    updated_at: new Date("2024-01-01T00:00:00Z").toISOString(),
    started_at: null,
    finished_at: null,
  },
];

const renderWithRouter = () =>
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  );

beforeEach(() => {
  vi.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => mockJobs,
  } as unknown as Response);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("App shell", () => {
  it("renders navigation links", () => {
    renderWithRouter();

    expect(
      screen.getByRole("heading", { name: /zimusyoku console/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /jobs/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upload/i })).toBeInTheDocument();
  });

  it("shows job listings after navigation", async () => {
    renderWithRouter();

    const jobsLink = screen.getByRole("link", { name: /jobs/i });
    fireEvent.click(jobsLink);

    await waitFor(() =>
      expect(screen.queryByText(/loading current jobs/i)).not.toBeInTheDocument(),
    );

    expect(screen.getByText("Demo job")).toBeInTheDocument();
  });
});
