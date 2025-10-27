import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
<<<<<<< HEAD
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

=======
import { vi } from "vitest";
>>>>>>> 5501a9a (feat(auth): improve local dev login defaults)
import App from "./App";
import { ja as strings } from "./i18n/strings";

vi.mock("./modules/authClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./modules/authClient")>();
  return {
    ...actual,
    initializeToken: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  };
});

vi.mock("./modules/summaryApi", () => ({
  fetchSummary: vi.fn().mockResolvedValue({
    month: "2025-08",
    total_spend: 120000,
    journal_count: 4,
    breakdown: [
      { label: "交通費", amount: 50000 },
      { label: "通信費", amount: 30000 },
    ],
  }),
}));

vi.mock("react-chartjs-2", () => ({
  Doughnut: () => null,
  Bar: () => null,
}));

const { initializeToken, login } = await import("./modules/authClient");

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

<<<<<<< HEAD
beforeEach(() => {
  vi.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => mockJobs,
  } as unknown as Response);
});

afterEach(() => {
  vi.restoreAllMocks();
=======
const originalGetContext = HTMLCanvasElement.prototype.getContext;
beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: vi.fn(() => ({})),
  });
});

afterAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: originalGetContext,
  });
>>>>>>> 5501a9a (feat(auth): improve local dev login defaults)
});

describe("App shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders login form when unauthenticated", () => {
    (initializeToken as unknown as vi.Mock).mockReturnValueOnce(null);

    renderWithRouter();

    expect(
      screen.getByRole("heading", { name: strings.auth.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: strings.auth.submit }),
    ).toBeInTheDocument();
<<<<<<< HEAD
    expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /jobs/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upload/i })).toBeInTheDocument();
=======
>>>>>>> 5501a9a (feat(auth): improve local dev login defaults)
  });

  it("shows navigation links after successful login", async () => {
    (initializeToken as unknown as vi.Mock).mockReturnValueOnce(null);
    (login as unknown as vi.Mock).mockResolvedValueOnce("token-123");

    renderWithRouter();

    fireEvent.change(screen.getByLabelText(strings.auth.email), {
      target: { value: "admin@example.com" },
    });
    fireEvent.change(screen.getByLabelText(strings.auth.password), {
      target: { value: "adminpass" },
    });
    fireEvent.click(screen.getByRole("button", { name: strings.auth.submit }));

    await waitFor(() =>
<<<<<<< HEAD
      expect(screen.queryByText(/loading current jobs/i)).not.toBeInTheDocument(),
    );

    expect(screen.getByText("Demo job")).toBeInTheDocument();
=======
      expect(
        screen.getByRole("heading", { name: strings.common.appTitle }),
      ).toBeInTheDocument(),
    );

    expect(
      screen.getByRole("link", { name: strings.nav.dashboard }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: strings.nav.upload }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: strings.nav.jobs })).toBeInTheDocument();
>>>>>>> 5501a9a (feat(auth): improve local dev login defaults)
  });
});
