const STORAGE_KEY = "zimusyoku.jwt";

const getStorage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const loadToken = (): string | null => {
  const storage = getStorage();
  return storage?.getItem(STORAGE_KEY) ?? null;
};

export const saveToken = (token: string) => {
  const storage = getStorage();
  storage?.setItem(STORAGE_KEY, token);
};

export const clearToken = () => {
  const storage = getStorage();
  storage?.removeItem(STORAGE_KEY);
};
