const rawEnvUrl = (import.meta.env.VITE_API_URL ?? "").trim();

const resolveBaseUrl = (): string => {
  if (rawEnvUrl) {
    return rawEnvUrl.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${protocol}//${hostname}:8000`;
    }
    const normalizedPort = port ? `:${port}` : "";
    return `${protocol}//${hostname}${normalizedPort}`;
  }

  return "";
};

const API_BASE_URL = resolveBaseUrl();

if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.info("[apiClient] API base URL:", API_BASE_URL || "(relative to frontend)");
}

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ApiError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

const buildUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  if (!API_BASE_URL) {
    return path;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
};

type RequestOptions = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
  skipAuth?: boolean;
};

export const apiRequest = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> => {
  const { skipAuth, headers: customHeaders, ...init } = options;
  const url = buildUrl(path);
  const headers = new Headers(customHeaders);

  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!skipAuth && authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[apiClient] request", url, init);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[apiClient] network failure", url, error);
    throw error;
  }

  if (response.status === 401) {
    throw new UnauthorizedError();
  }

  if (!response.ok) {
    const message = await response.text();
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("[apiClient] request failed", url, response.status, message);
    }
    throw new ApiError(response.status, message || response.statusText);
  }

  return parseResponse<T>(response);
};

export const downloadFile = async (path: string): Promise<Blob> => {
  const url = buildUrl(path);
  let response: Response;
  try {
    response = await fetch(url, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[apiClient] download failed", url, error);
    throw error;
  }

  if (response.status === 401) {
    throw new UnauthorizedError();
  }

  if (!response.ok) {
    const message = await response.text();
    throw new ApiError(response.status, message || response.statusText);
  }

  return response.blob();
};
