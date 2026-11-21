import type { AuthResponse } from './auth.model';
import { normalizeRole, Role } from './roles';

/** Cookie that holds the whole auth session (JSON of AuthResponse). */
export const AUTH_COOKIE = 'auth_secure_session';
export const AUTH_COOKIE_DAYS = 7;

/**
 * Helpers shared by the browser, the Angular server render and the Nitro middleware. No
 * framework imports on purpose: they must run in all three places.
 */

/** Value of cookie `name` in a `Cookie:` header / document.cookie string, URI-decoded. */
export function readCookie(header: string | null | undefined, name: string): string | null {
	if (!header) return null;
	const prefix = `${name}=`;
	for (const part of header.split(';')) {
		const cookie = part.trim();
		if (cookie.startsWith(prefix)) {
			try {
				return decodeURIComponent(cookie.substring(prefix.length));
			} catch {
				return null;
			}
		}
	}
	return null;
}

/** Parses the JSON stored in the auth cookie; anything that is not a usable session is null. */
export function parseSession(rawJson: string | null | undefined): AuthResponse | null {
	if (!rawJson) return null;
	try {
		const value: unknown = JSON.parse(rawJson);
		if (typeof value !== 'object' || value === null) return null;
		const candidate = value as Partial<AuthResponse>;
		if (typeof candidate.accessToken !== 'string' || candidate.accessToken === '') return null;
		if (typeof candidate.refreshToken !== 'string') return null;
		return candidate as AuthResponse;
	} catch {
		return null;
	}
}

export const sessionFromCookieHeader = (header: string | null | undefined): AuthResponse | null =>
	parseSession(readCookie(header, AUTH_COOKIE));

/** Payload (claims) of a JWT. The signature is NOT checked: only the backend can do that. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
	const part = token.split('.')[1];
	if (!part) return null;
	try {
		const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
		const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
		const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
		return typeof payload === 'object' && payload !== null
			? (payload as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

/**
 * Has the access token expired (or will it within `skewMs`)? A token that cannot be decoded is
 * reported as NOT expired: the backend is the one to judge it.
 */
export function isAccessTokenExpired(token: string, skewMs = 10_000, now = Date.now()): boolean {
	const exp = decodeJwtPayload(token)?.['exp'];
	return typeof exp === 'number' && exp * 1000 - skewMs <= now;
}

/**
 * Role of the signed-in user: the `role` claim of the access token, else the role of the user
 * object next to it. A session with an unknown role gets the least privileged one (USER).
 * No session at all -> null (guest).
 */
export function sessionRole(session: AuthResponse | null | undefined): Role | null {
	if (!session?.accessToken) return null;
	const fromToken = normalizeRole(decodeJwtPayload(session.accessToken)?.['role']);
	return fromToken ?? normalizeRole(session.user?.role) ?? 'USER';
}
