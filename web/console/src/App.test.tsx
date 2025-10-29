import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { vi } from "vitest";
import App from "./App";
import { ja as strings } from "./i18n/strings";
import { UnauthorizedError } from "./modules/apiClient";

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
      { label: "莠､騾夊ｲｻ", amount: 50000 },
      { label: "騾壻ｿ｡雋ｻ", amount: 30000 },
    ],
  }),
}));

vi.mock("react-chartjs-2", () => ({
  Doughnut: () => null,
  Bar: () => null,
}));

const { initializeToken, login, logout } = await import("./modules/authClient");

const renderWithRouter = () =>
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  );

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
  });

  it("opens and closes the help modal", async () => {
    (initializeToken as unknown as vi.Mock).mockReturnValueOnce("token-xyz");

    renderWithRouter();

    const helpButton = screen.getByRole("button", { name: strings.nav.help });
    fireEvent.click(helpButton);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();

    const closeButtons = screen.getAllByRole("button", {
      name: strings.help.close,
    });
    fireEvent.click(closeButtons[0]);

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(helpButton).toHaveFocus();
  });

  it("logs out and returns to login view", async () => {
    (initializeToken as unknown as vi.Mock).mockReturnValueOnce("token-abc");

    renderWithRouter();

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: strings.common.appTitle }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: strings.auth.logout }));
    expect(logout).toHaveBeenCalled();

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: strings.auth.title }),
      ).toBeInTheDocument(),
    );
  });

  it("shows error message when login fails with unauthorized error", async () => {
    (initializeToken as unknown as vi.Mock).mockReturnValueOnce(null);
    (login as unknown as vi.Mock).mockRejectedValueOnce(new UnauthorizedError());

    renderWithRouter();

    fireEvent.change(screen.getByLabelText(strings.auth.email), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText(strings.auth.password), {
      target: { value: "wrongpass" },
    });
    fireEvent.click(screen.getByRole("button", { name: strings.auth.submit }));

    await waitFor(() =>
      expect(screen.getByText(strings.auth.invalid)).toBeInTheDocument(),
    );
  });
});
