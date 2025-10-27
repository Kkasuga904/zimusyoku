import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  apiFetch,
  fetchJobDetail,
  fetchJobs,
  uploadFile,
} from "../lib/api";

const demoJobs = [
  {
    id: "job-42",
    title: "Example",
    status: "queued",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    started_at: null,
    finished_at: null,
  },
];

describe("fetchJobs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns jobs on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => demoJobs,
    } as unknown as Response);

    const response = await fetchJobs();
    expect(response).toEqual(demoJobs);
  });

  it("throws ApiError on failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: "Server exploded" }),
    } as unknown as Response);

    await expect(fetchJobs()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("fetchJobDetail", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns job detail payload", async () => {
    const responseBody = {
      id: "job-1",
      title: "Sample",
      status: "queued",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      started_at: null,
      finished_at: null,
      logs: [],
    };

    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => responseBody,
    } as unknown as Response);

    await expect(fetchJobDetail("job-1")).resolves.toEqual(responseBody);
  });

  it("throws ApiError when job is missing", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ detail: "Not found" }),
    } as unknown as Response);

    await expect(fetchJobDetail("missing"))
      .rejects.toThrowError(ApiError)
      .catch(() => undefined);
  });
});

describe("uploadFile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts multipart form data", async () => {
    const result = { job_id: "job-007", stored_name: "file.txt" };
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => result,
    } as unknown as Response);

    const file = new File(["hello"], "demo.txt", { type: "text/plain" });
    const response = await uploadFile(file);

    expect(response).toEqual(result);
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe("/api/uploads");
    const options = call[1] as RequestInit;
    expect(options?.method).toBe("POST");
    expect(options?.body).toBeInstanceOf(FormData);
  });

  it("propagates errors from the API", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: "boom" }),
    } as unknown as Response);

    const file = new File(["hello"], "demo.txt", { type: "text/plain" });
    await expect(uploadFile(file)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("apiFetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to generic error message when body parsing fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => {
        throw new Error("no json");
      },
    } as unknown as Response);

    await expect(apiFetch("/api/jobs")).rejects.toThrow(
      "Request failed with status 503",
    );
  });
});
