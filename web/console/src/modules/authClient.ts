import { apiRequest, setAuthToken } from "./apiClient";
import { clearToken, loadToken, saveToken } from "./authStorage";

type TokenResponse = {
  access_token: string;
  token_type: string;
};

export const getStoredToken = () => loadToken();

export const initializeToken = () => {
  const token = loadToken();
  if (token) {
    setAuthToken(token);
  }
  return token;
};

export const login = async (email: string, password: string) => {
  const response = await apiRequest<TokenResponse>("/api/auth/token", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  });
  setAuthToken(response.access_token);
  saveToken(response.access_token);
  return response.access_token;
};

export const logout = () => {
  clearToken();
  setAuthToken(null);
};
