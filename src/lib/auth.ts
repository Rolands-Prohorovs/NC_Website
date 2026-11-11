import { useMemo, useSyncExternalStore } from 'react';

// Accounts: nickname + password, no email (DECISIONS.md D6, D12; API.md "Accounts").
// Accounts are optional (D-open-1): nothing on the site may require one.
//
// Same function shapes as the real API. While Timofei's backend doesn't exist, a MOCK in
// localStorage answers instead. Switching to the real API = set USE_MOCK_API to false.
//
// State lives in this module (like progress.ts), so the header and the form islands on the
// same page share it through `useAuth()`.

/** true = localStorage mock below; false = fetch('/api/...') to the real backend. */
const USE_MOCK_API: boolean = true;

export type User = { nickname: string; createdAt: string };

/** Stable codes from API.md, plus `network` (the request never got an answer; frontend only). */
export type AuthErrorCode =
  | 'nickname_taken'
  | 'invalid_nickname'
  | 'weak_password'
  | 'wrong_credentials'
  | 'too_many_attempts'
  | 'not_logged_in'
  | 'network';

export type ApiError = { error: { code: AuthErrorCode; message?: string } };
export type ApiResult<T> = { data: T } | ApiError;

// ---------- Rules (D12). The client checks them for UX only; the server is the source of truth. ----------

export const NICKNAME_RE = /^[A-Za-z0-9_-]{3,20}$/;
export const PASSWORD_MIN = 8;
/** bcrypt ignores everything after 72 bytes, so longer passwords are refused (API.md). */
export const PASSWORD_MAX_BYTES = 72;

export const passwordBytes = (password: string) => new TextEncoder().encode(password).length;

/**
 * Where to go after logging in. Only relative same-site paths ("/lahti/progress") are accepted;
 * "//evil.com", "https://...", "javascript:..." and anything else falls back to `fallback`.
 */
export function safeNext(raw: string | null, fallback: string): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.includes('://')) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

// ---------- Real API (API.md). Used when USE_MOCK_API is false. ----------

async function call<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin', // session cookie (API.md Q1)
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { error: { code: 'network' } };
  }
  if (res.status === 204) return { data: undefined as T };
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = undefined;
  }
  if (res.ok) return { data: json as T };
  const err = (json as ApiError | undefined)?.error;
  if (err && typeof err.code === 'string') return { error: err };
  if (res.status === 429) return { error: { code: 'too_many_attempts' } };
  if (res.status === 401) return { error: { code: 'not_logged_in' } };
  return { error: { code: 'network', message: `HTTP ${res.status}` } };
}

const real = {
  register: (nickname: string, password: string) =>
    call<User>('POST', '/api/auth/register', { nickname, password }),
  login: (nickname: string, password: string) =>
    call<User>('POST', '/api/auth/login', { nickname, password }),
  logout: () => call<void>('POST', '/api/auth/logout'),
  me: () => call<User>('GET', '/api/me'),
};

// ---------- MOCK ----------
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// !! TEMPORARY MOCK. NOT SECURE. Stores users AND THEIR PASSWORDS IN PLAIN TEXT in this browser's  !!
// !! localStorage. It exists only so the UI can be built before the backend. Never ship it to real !!
// !! users: set USE_MOCK_API = false and delete this block once Timofei's API is live.            !!
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

type MockUser = User & { password: string /* PLAIN TEXT: mock only */ };
const MOCK_USERS = 'MOCK-auth:users'; // { [lowercase nickname]: MockUser }
const MOCK_SESSION = 'MOCK-auth:session'; // lowercase nickname of the logged-in user
const MOCK_DELAY_MS = 400; // so the busy state is visible
const MOCK_LIMIT = { tries: 10, windowMs: 15 * 60 * 1000 }; // failed tries per nickname (API.md)

const mockFailures = new Map<string, number[]>(); // in memory: resets on reload, fine for a mock

const wait = () => new Promise((r) => setTimeout(r, MOCK_DELAY_MS));

function mockUsers(): Record<string, MockUser> {
  try {
    return JSON.parse(localStorage.getItem(MOCK_USERS) ?? '{}') as Record<string, MockUser>;
  } catch {
    return {};
  }
}

const publicUser = ({ nickname, createdAt }: MockUser): User => ({ nickname, createdAt });

function mockLimited(key: string): boolean {
  const now = Date.now();
  const recent = (mockFailures.get(key) ?? []).filter((t) => now - t < MOCK_LIMIT.windowMs);
  mockFailures.set(key, recent);
  return recent.length >= MOCK_LIMIT.tries;
}

function mockFail(key: string, code: AuthErrorCode): ApiError {
  mockFailures.set(key, [...(mockFailures.get(key) ?? []), Date.now()]);
  return { error: { code, message: 'mock' } };
}

const mock = {
  async register(nickname: string, password: string): Promise<ApiResult<User>> {
    await wait();
    const key = nickname.toLowerCase();
    if (mockLimited(key)) return { error: { code: 'too_many_attempts' } };
    if (!NICKNAME_RE.test(nickname)) return mockFail(key, 'invalid_nickname');
    if (password.length < PASSWORD_MIN || passwordBytes(password) > PASSWORD_MAX_BYTES)
      return mockFail(key, 'weak_password');
    const users = mockUsers();
    if (users[key]) return mockFail(key, 'nickname_taken');
    const user: MockUser = { nickname, password, createdAt: new Date().toISOString() };
    users[key] = user;
    localStorage.setItem(MOCK_USERS, JSON.stringify(users));
    localStorage.setItem(MOCK_SESSION, key);
    return { data: publicUser(user) };
  },

  async login(nickname: string, password: string): Promise<ApiResult<User>> {
    await wait();
    const key = nickname.toLowerCase();
    if (mockLimited(key)) return { error: { code: 'too_many_attempts' } };
    const user = mockUsers()[key];
    // Same code for an unknown nickname and a wrong password (API.md).
    if (!user || user.password !== password) return mockFail(key, 'wrong_credentials');
    mockFailures.delete(key);
    localStorage.setItem(MOCK_SESSION, key);
    return { data: publicUser(user) };
  },

  async logout(): Promise<ApiResult<void>> {
    await wait();
    localStorage.removeItem(MOCK_SESSION);
    return { data: undefined };
  },

  async me(): Promise<ApiResult<User>> {
    let key: string | null = null;
    try {
      key = localStorage.getItem(MOCK_SESSION);
    } catch {
      /* storage unavailable: logged out */
    }
    const user = key ? mockUsers()[key] : undefined;
    return user ? { data: publicUser(user) } : { error: { code: 'not_logged_in' } };
  },
};
// ---------- END MOCK ----------

const api = USE_MOCK_API ? mock : real;

// ---------- Progress import (API.md: POST /api/cities/:city/todo/import) ----------

/**
 * Merges this device's to-do ticks (localStorage `progress:<cityId>`) into the account.
 * Called after every successful login/register: the import is a union, so repeating it is harmless.
 * Never blocks logging in; failures are only logged.
 *
 * TODO (with the real API): after a successful import, clear `progress:<cityId>` and load
 * progress from the server instead (ROADMAP "Connect frontend to Timofei's API").
 * Until that exists the local data is NOT deleted.
 */
export async function importProgress(cityId: string): Promise<void> {
  let done: string[] = [];
  try {
    done = JSON.parse(localStorage.getItem(`progress:${cityId}`) ?? '[]') as string[];
  } catch {
    return;
  }
  if (!done.length) return;
  if (USE_MOCK_API) {
    // TODO: nothing to merge into while mocked; progress stays on the device.
    return;
  }
  const result = await call('POST', `/api/cities/${encodeURIComponent(cityId)}/todo/import`, { done });
  if ('error' in result) console.warn('Progress import failed', result.error);
}

// ---------- Shared state ----------

/** `unknown` until the first `me()` answers (also during server render and hydration). */
export type AuthState = { status: 'unknown' | 'ready'; user: User | null };

const UNKNOWN: AuthState = { status: 'unknown', user: null };
let state: AuthState = UNKNOWN;
let loading = false;
const listeners = new Set<() => void>();

function set(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (state.status === 'unknown' && !loading) {
    loading = true;
    api
      .me()
      .then((r) => set({ status: 'ready', user: 'data' in r ? r.data : null }))
      .catch(() => set({ status: 'ready', user: null }));
  }
  return () => {
    listeners.delete(listener);
  };
}

async function register(nickname: string, password: string) {
  const result = await api.register(nickname, password);
  if ('data' in result) set({ status: 'ready', user: result.data });
  return result;
}

async function login(nickname: string, password: string) {
  const result = await api.login(nickname, password);
  if ('data' in result) set({ status: 'ready', user: result.data });
  return result;
}

async function logout() {
  const result = await api.logout();
  if ('data' in result) set({ status: 'ready', user: null });
  return result;
}

export type Auth = AuthState & {
  register: typeof register;
  login: typeof login;
  logout: typeof logout;
};

export function useAuth(): Auth {
  const current = useSyncExternalStore(subscribe, () => state, () => UNKNOWN);
  return useMemo(() => ({ ...current, register, login, logout }), [current]);
}
