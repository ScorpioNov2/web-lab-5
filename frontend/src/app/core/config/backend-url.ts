/**
 * Where the Java backend lives. Read from the environment of the Node process, so it is only
 * meaningful on the server (SSR render, the /api proxy, the auth middleware). The browser never
 * talks to the backend directly: it calls the same-origin `/api/*` proxy.
 *
 *   BACKEND_URL       origin of the backend, e.g. http://backend:8080 (default http://localhost:8080)
 *   BACKEND_API_PATH  base path of its REST API (default /api)
 *
 * Pure TypeScript with no framework imports: shared by the Angular server bundle and Nitro.
 */
type Env = Record<string, string | undefined>;

function env(): Env {
	return (globalThis as { process?: { env?: Env } }).process?.env ?? {};
}

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, '');

export function backendOrigin(): string {
	return trimTrailingSlashes(env()['BACKEND_URL'] || 'http://localhost:8080');
}

export function backendApiPath(): string {
	const path = trimTrailingSlashes(env()['BACKEND_API_PATH'] ?? '/api');
	return path === '' || path.startsWith('/') ? path : `/${path}`;
}

/** Absolute base URL of the backend REST API, e.g. http://backend:8080/api */
export function backendApiUrl(): string {
	return backendOrigin() + backendApiPath();
}
