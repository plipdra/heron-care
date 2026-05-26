// localStorage-backed token store.
// Future Work: migrate to HttpOnly cookies for XSS resistance.

const ACCESS_KEY = 'heron:access';
const REFRESH_KEY = 'heron:refresh';

export const tokenStore = {
  getAccess(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  getRefresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string): void {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};
