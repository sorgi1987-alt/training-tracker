// Relative path: Catalyst proxies /server/{function_name}/* to the Advanced
// I/O function on the same domain once hosted (or via `catalyst serve`
// locally). The function name here is "api" (functions/api).
const BASE_PATH = '/server/api';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_PATH}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? `Request failed with status ${res.status}`, res.status, body);
  }

  return res.json() as Promise<T>;
}
