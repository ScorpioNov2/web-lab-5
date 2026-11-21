import { defineEventHandler, getRequestURL, sendRedirect, setResponseHeader } from 'h3';
import { evaluateAccess } from '../../app/core/auth/route-access';
import { sessionRole } from '../../app/core/auth/session';
import { resolveSession } from '../utils/session';

/**
 * Route protection on the server. Runs before every page request (Nitro middleware):
 *
 *  1. renews an expired session (see utils/session.ts),
 *  2. applies the access rules (core/auth/route-access.ts): guest -> /login?redirect=..., signed-in
 *     user on /login -> /students, USER on an ADMIN page -> /forbidden.
 *
 * A violation is answered with a real HTTP 302 before any rendering happens. The role comes from
 * the cookie, so this is navigation control, not a security boundary: the Java backend checks the
 * JWT on every API call and refuses what the role does not allow.
 */

/** Static files, bundler / Nitro internals and the API proxy are not pages. */
const isNotAPage = (path: string): boolean =>
	path === '/api' ||
	path.startsWith('/api/') ||
	path.startsWith('/_') ||
	path.startsWith('/@') ||
	path.startsWith('/assets/') ||
	/\.[a-z0-9]+$/i.test(path);

export default defineEventHandler(async (event) => {
	if (event.method !== 'GET' && event.method !== 'HEAD') return;

	const url = getRequestURL(event);
	if (isNotAPage(url.pathname)) return;

	// Pages differ per user: never let a shared cache keep one.
	setResponseHeader(event, 'Cache-Control', 'private, no-store');
	setResponseHeader(event, 'Vary', 'Cookie');

	const session = await resolveSession(event);
	const decision = evaluateAccess(url.pathname + url.search, sessionRole(session));

	if (!decision.allowed) {
		return sendRedirect(event, decision.redirectTo, 302);
	}
});
