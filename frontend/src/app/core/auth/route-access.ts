import { Role, STUDENT_WRITE_ROLES } from './roles';

/**
 * Who may open which page. ONE table, used twice:
 *  - on the server by the Nitro middleware (src/server/middleware/auth.ts) -> a real HTTP 302
 *  - in the browser by the router guard (access.guard.ts) -> client-side navigation
 * Pure functions, no framework imports.
 */

export type AccessDecision =
	| { allowed: true }
	| {
			allowed: false;
			redirectTo: string;
			reason: 'unauthenticated' | 'forbidden' | 'guest-only';
	  };

type Guard = 'guest' | 'auth' | { roles: readonly Role[] };

interface Rule {
	matches: (path: string) => boolean;
	guard: Guard;
}

export const HOME_AFTER_LOGIN = '/students';
export const LOGIN_PATH = '/login';
export const FORBIDDEN_PATH = '/forbidden';

/** First match wins, so the specific write routes come before the general /students rule. */
const RULES: readonly Rule[] = [
	{ matches: (path) => path === '/login' || path === '/register', guard: 'guest' },
	{
		matches: (path) => path === '/students/new' || /^\/students\/[^/]+\/edit$/.test(path),
		guard: { roles: STUDENT_WRITE_ROLES },
	},
	{ matches: (path) => path === '/students' || path.startsWith('/students/'), guard: 'auth' },
	{ matches: (path) => path === '/profile', guard: 'auth' },
];

/** "/students/?a=1#x" -> { path: "/students", full: "/students/?a=1" } */
function splitUrl(url: string): { path: string; full: string } {
	const withoutHash = url.split('#')[0];
	const rawPath = withoutHash.split('?')[0];
	const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') || '/' : rawPath || '/';
	return { path, full: withoutHash || '/' };
}

export function loginUrlFor(target: string): string {
	return `${LOGIN_PATH}?redirect=${encodeURIComponent(target)}`;
}

/**
 * @param url  path (+ query) being opened
 * @param role role of the signed-in user, or null for a guest
 */
export function evaluateAccess(url: string, role: Role | null): AccessDecision {
	const { path, full } = splitUrl(url);

	// The root page is only a doorway.
	if (path === '/') {
		return role
			? { allowed: false, redirectTo: HOME_AFTER_LOGIN, reason: 'guest-only' }
			: { allowed: false, redirectTo: LOGIN_PATH, reason: 'unauthenticated' };
	}

	const rule = RULES.find((candidate) => candidate.matches(path));
	if (!rule) return { allowed: true };

	if (rule.guard === 'guest') {
		return role
			? { allowed: false, redirectTo: HOME_AFTER_LOGIN, reason: 'guest-only' }
			: { allowed: true };
	}

	if (!role) {
		return { allowed: false, redirectTo: loginUrlFor(full), reason: 'unauthenticated' };
	}

	if (rule.guard !== 'auth' && !rule.guard.roles.includes(role)) {
		return { allowed: false, redirectTo: FORBIDDEN_PATH, reason: 'forbidden' };
	}
	return { allowed: true };
}

/**
 * `?redirect=` comes from the URL, so it is untrusted: only same-site paths are followed
 * (never `//evil.com`, `/\evil.com` or a full URL), and never back into the login pages.
 */
export function safeRedirectTarget(raw: unknown, fallback = HOME_AFTER_LOGIN): string {
	if (typeof raw !== 'string' || !raw.startsWith('/')) return fallback;
	if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
	// control characters (e.g. a line break that could split a header) are never legitimate
	if ([...raw].some((char) => char.charCodeAt(0) < 32)) return fallback;
	const { path } = splitUrl(raw);
	return path === '/login' || path === '/register' ? fallback : raw;
}
