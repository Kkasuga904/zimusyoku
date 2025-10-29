import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAuthToken } from "./apiClient";
import {
  exportInvoicesPdf,
  exportJobsCsv,
  exportJournalCsv,
  fetchJobById,
  fetchJobs,
  registerJob,
} from "./jobsApi";

const mockFetch = vi.fn();

describe("jobsApi", () => {
  beforeEach(() => {
    setAuthToken("test-token");
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads a file via registerJob", async () => {
    const jobResponse = {
      job: {
        id: "JOB-1",
        fileName: "sample.pdf",
        documentType: "invoice",
        status: "Queued",
        classification: null,
        submittedAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    };

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(jobResponse), { status: 202 }),
    );

    const file = new File(["dummy"], "sample.pdf", { type: "application/pdf" });
    const result = await registerJob(file, "invoice");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/ocr/upload"),
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
        headers: expect.not.objectContaining({ "Content-Type": expect.any(String) }),
      }),
    );
    expect(result.id).toBe("JOB-1");
  });

  it("fetches job summaries", async () => {
    const jobs = [
      {
        id: "JOB-1",
        fileName: "a.pdf",
        documentType: "invoice",
        status: "Queued",
        classification: null,
        submittedAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    ];

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ jobs }), { status: 200 }),
    );

    const result = await fetchJobs();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit | undefined];
    expect(url).toContain("/api/jobs");
    expect(init).toBeDefined();
    const headers = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-token");
    expect(result).toHaveLength(1);
  });

  it("fetches job detail", async () => {
    const job = {
      id: "JOB-1",
      fileName: "sample.pdf",
      documentType: "invoice",
      status: "Queued",
      classification: null,
      submittedAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(job), { status: 200 }),
    );

    const result = await fetchJobById("JOB-1");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/jobs/JOB-1"),
      expect.any(Object),
    );
    expect(result.id).toBe("JOB-1");
  });

  it("downloads CSV via exportJobsCsv", async () => {
    const blob = new Blob(["id,file"]);
    mockFetch.mockResolvedValueOnce(
      new Response(blob, {
        status: 200,
        headers: { "Content-Type": "text/csv" },
      }),
    );

    const result = await exportJobsCsv();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit | undefined];
    expect(url).toContain("/api/jobs/export.csv");
    const headers = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-token");
    expect(result.size).toBeGreaterThan(0);
    expect(typeof result.type).toBe("string");
  });

  it("downloads invoice PDF via exportInvoicesPdf", async () => {
    const blob = new Blob(["pdf-content"], { type: "application/pdf" });
    mockFetch.mockResolvedValueOnce(
      new Response(blob, {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      }),
    );

    const result = await exportInvoicesPdf();
    const [url] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1] as [
      string,
      RequestInit | undefined,
    ];
    expect(url).toContain("/api/export/invoices");
    expect(result.type).toBe("application/pdf");
  });

  it("downloads journal CSV via exportJournalCsv", async () => {
    const blob = new Blob(["id,debit,credit"], { type: "text/csv" });
    mockFetch.mockResolvedValueOnce(
      new Response(blob, {
        status: 200,
        headers: { "Content-Type": "text/csv" },
      }),
    );

    const result = await exportJournalCsv();
    const [url] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1] as [
      string,
      RequestInit | undefined,
    ];
    expect(url).toContain("/api/export/journal");
    expect(result.size).toBeGreaterThan(0);
  });
});
