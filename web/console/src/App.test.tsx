import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

const renderWithRouter = () =>
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  );

describe("App shell", () => {
  it("renders navigation links", () => {
    renderWithRouter();

    expect(
      screen.getByRole("heading", { name: /zimusyoku console/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /jobs/i })).toBeInTheDocument();
  });

  it("shows job listings after navigation", async () => {
    renderWithRouter();

    const jobsLink = screen.getByRole("link", { name: /jobs/i });
    fireEvent.click(jobsLink);

    await waitFor(() =>
      expect(
        screen.queryByText(/loading current jobs/i),
      ).not.toBeInTheDocument(),
    );

    expect(screen.getByText("JOB-1001")).toBeInTheDocument();
    expect(screen.getByText("Accounts Specialist")).toBeInTheDocument();
  });
});
