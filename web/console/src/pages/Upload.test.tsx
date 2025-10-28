import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { type MockedFunction, vi } from "vitest";
import Upload from "./Upload";
import { ja as strings } from "../i18n/strings";
import { registerJob } from "../modules/jobsApi";

vi.mock("../modules/jobsApi", () => ({
  registerJob: vi.fn(),
}));

const registerJobMock = registerJob as MockedFunction<typeof registerJob>;

const renderUpload = () =>
  render(
    <MemoryRouter>
      <Upload />
    </MemoryRouter>,
  );

describe("Upload page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads a supported file, triggers the pipeline, and shows the success message", async () => {
    registerJobMock.mockResolvedValueOnce({
      id: "JOB-2001",
      fileName: "report.csv",
      documentType: "invoice",
      status: "Queued",
      classification: null,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    renderUpload();

    const input = screen.getByLabelText(strings.upload.selectButton, {
      selector: "input",
    });
    const file = new File(["sample"], "report.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(screen.getByRole("button", { name: strings.upload.submitButton }));

    await waitFor(() =>
      expect(registerJobMock).toHaveBeenCalledWith(file, "invoice"),
    );
    expect(
      await screen.findByText(strings.upload.success("JOB-2001")),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${strings.upload.viewJobDetail} (JOB-2001)`),
    ).toBeInTheDocument();
    expect(screen.getByText(strings.upload.pipeline.posted)).toBeInTheDocument();
  });

  it("allows selecting a different document type", async () => {
    registerJobMock.mockResolvedValueOnce({
      id: "JOB-2002",
      fileName: "receipt.pdf",
      documentType: "receipt",
      status: "Queued",
      classification: null,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    renderUpload();

    const input = screen.getByLabelText(strings.upload.selectButton, {
      selector: "input",
    });
    const file = new File(["sample"], "receipt.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.change(screen.getByLabelText(strings.upload.selectType), {
      target: { value: "receipt" },
    });

    fireEvent.click(screen.getByRole("button", { name: strings.upload.submitButton }));

    await waitFor(() =>
      expect(registerJobMock).toHaveBeenCalledWith(file, "receipt"),
    );
  });

  it("uploads multiple files sequentially", async () => {
    registerJobMock
      .mockResolvedValueOnce({
        id: "JOB-3001",
        fileName: "first.pdf",
        documentType: "invoice",
        status: "Queued",
        classification: null,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .mockResolvedValueOnce({
        id: "JOB-3002",
        fileName: "second.jpeg",
        documentType: "invoice",
        status: "Queued",
        classification: null,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

    renderUpload();

    const input = screen.getByLabelText(strings.upload.selectButton, {
      selector: "input",
    });
    const firstFile = new File(["one"], "first.pdf", { type: "application/pdf" });
    const secondFile = new File(["two"], "second.jpeg", { type: "image/jpeg" });

    fireEvent.change(input, { target: { files: [firstFile, secondFile] } });
    fireEvent.click(screen.getByRole("button", { name: strings.upload.submitButton }));

    await waitFor(() =>
      expect(registerJobMock).toHaveBeenNthCalledWith(1, firstFile, "invoice"),
    );
    await waitFor(() =>
      expect(registerJobMock).toHaveBeenNthCalledWith(2, secondFile, "invoice"),
    );

    expect(
      await screen.findByText(strings.upload.successMultiple(2)),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(`${strings.upload.viewJobDetail} (JOB-3001)`)).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByText(`${strings.upload.viewJobDetail} (JOB-3002)`)).toBeInTheDocument(),
    );
  });

  it("blocks files that exceed the size limit", async () => {
    renderUpload();

    const input = screen.getByLabelText(strings.upload.selectButton, {
      selector: "input",
    });
    const bigFile = new File(["big"], "large.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(bigFile, "size", { value: 60 * 1024 * 1024 });

    fireEvent.change(input, { target: { files: [bigFile] } });
    fireEvent.click(screen.getByRole("button", { name: strings.upload.submitButton }));

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(strings.upload.fileTooLarge("large.pdf"));
    expect(registerJobMock).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: strings.upload.changeFile }),
    );
    expect(screen.getByText(strings.upload.noFile)).toBeInTheDocument();
  });

  it("rejects unsupported file extensions", async () => {
    renderUpload();

    const input = screen.getByLabelText(strings.upload.selectButton, {
      selector: "input",
    });
    const unsupported = new File(["img"], "image.gif", {
      type: "image/gif",
    });

    fireEvent.change(input, { target: { files: [unsupported] } });
    fireEvent.click(
      screen.getByRole("button", { name: strings.upload.submitButton }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(strings.upload.fileUnsupported("image.gif"));
  });
});
