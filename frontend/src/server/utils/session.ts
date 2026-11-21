import { createHash } from 'node:crypto';
import { H3Event, setCookie, deleteCookie } from 'h3';
import type { AuthResponse } from '../../app/core/auth/auth.model';
import {
	AUTH_COOKIE,
	AUTH_COOKIE_DAYS,
	isAccessTokenExpired,
	sessionFromCookieHeader,
} from '../../app/core/auth/session';
import { backendApiUrl } from '../../app/core/config/backend-url';

/**
 * Server-side handling of the auth session cookie (the same cookie the browser writes).
 *
 * The backend's refresh token is single-use, so exactly ONE party may renew an expired session
 * for a page request: this code, BEFORE the page is rendered. It asks the backend for a new token
 * pair, sends it to the browser in Set-Cookie and rewrites the cookie of the current request so
 * the render that follows sees the fresh tokens. (The render itself never refreshes.)
 */

type RefreshResult =
	{ status: 'ok'; session: AuthResponse } | { status: 'invalid' } | { status: 'unavailable' };

const REFRESH_TIMEOUT_MS = 8_000;

async function callRefresh(refreshToken: string): Promise<RefreshResult> {
	try {
		const response = await fetch(`${backendApiUrl()}/auth/refresh`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json' },
			body: JSON.stringify({ refreshToken }),
			signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
		});

		if (response.ok) {
			const body = (await response.json()) as Partial<AuthResponse>;
			if (typeof body.accessToken === 'string' && typeof body.refreshToken === 'string') {
				return { status: 'ok', session: body as AuthResponse };
			}
			return { status: 'unavailable' };
		}
		// The backend understood the token and rejected it: the session is over.
		return [400, 401, 403].includes(response.status)
			? { status: 'invalid' }
			: { status: 'unavailable' };
	} catch {
		return { status: 'unavailable' };
	}
}

/**
 * Page requests that carry the same old refresh token must share ONE backend call. This happens
 * for real: after a break the browser restores several tabs at once, all with the same expired
 * cookie. The backend accepts a refresh token once, so without sharing, every tab but the first
 * would be logged out.
 *
 * A successful result is kept for a short grace period, so a request that arrives just after the
 * first one finished is still served. The map is keyed by a hash of the token (the token itself
 * is never kept) and a failed attempt is never kept.
 */
const REFRESH_GRACE_MS = 10_000;
const shared = new Map<string, { result: Promise<RefreshResult>; until: number }>();

function refreshSession(refreshToken: string): Promise<RefreshResult> {
	const key = createHash('sha256').update(refreshToken).digest('hex');

	const existing = shared.get(key);
	if (existing && existing.until > Date.now()) return existing.result;

	const entry = { result: callRefresh(refreshToken), until: Number.POSITIVE_INFINITY };
	shared.set(key, entry);

	void entry.result.then((result) => {
		if (result.status !== 'ok') {
			shared.delete(key);
			return;
		}
		entry.until = Date.now() + REFRESH_GRACE_MS;
		setTimeout(() => shared.delete(key), REFRESH_GRACE_MS).unref();
	});
	return entry.result;
}

const isHttps = (event: H3Event): boolean =>
	event.node.req.headers['x-forwarded-proto'] === 'https' ||
	Boolean((event.node.req.socket as { encrypted?: boolean }).encrypted);

function writeSessionCookie(event: H3Event, session: AuthResponse): void {
	const json = JSON.stringify(session);
	setCookie(event, AUTH_COOKIE, json, {
		path: '/',
		sameSite: 'strict',
		expires: new Date(Date.now() + AUTH_COOKIE_DAYS * 24 * 60 * 60 * 1000),
		secure: isHttps(event),
		httpOnly: false, // the browser app reads it too
	});

	// Make the rest of THIS request (the SSR render) see the new cookie value as well.
	const others = (event.node.req.headers.cookie ?? '')
		.split(';')
		.map((part) => part.trim())
		.filter((part) => part !== '' && !part.startsWith(`${AUTH_COOKIE}=`));
	event.node.req.headers.cookie = [...others, `${AUTH_COOKIE}=${encodeURIComponent(json)}`].join(
		'; ',
	);
}

function dropSessionCookie(event: H3Event): void {
	deleteCookie(event, AUTH_COOKIE, { path: '/', sameSite: 'strict' });
	event.node.req.headers.cookie = (event.node.req.headers.cookie ?? '')
		.split(';')
		.map((part) => part.trim())
		.filter((part) => part !== '' && !part.startsWith(`${AUTH_COOKIE}=`))
		.join('; ');
}

/**
 * The session of this page request, renewed if its access token has expired.
 * null = guest (no cookie, or the refresh token was rejected and the cookie was removed).
 * When the backend cannot be reached the old session is kept: the user is not logged out
 * because of an outage; the page shows its own "server unavailable" state.
 */
export async function resolveSession(event: H3Event): Promise<AuthResponse | null> {
	const session = sessionFromCookieHeader(event.node.req.headers.cookie);
	if (!session) return null;
	if (!isAccessTokenExpired(session.accessToken)) return session;

	if (!session.refreshToken) {
		dropSessionCookie(event);
		return null;
	}

	const result = await refreshSession(session.refreshToken);
	if (result.status === 'ok') {
		writeSessionCookie(event, result.session);
		return result.session;
	}
	if (result.status === 'invalid') {
		dropSessionCookie(event);
		return null;
	}
	return session;
}
