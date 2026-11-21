import {
	createError,
	defineEventHandler,
	getRequestHeader,
	getRequestURL,
	readRawBody,
	sendProxy,
} from 'h3';
import { backendApiPath, backendOrigin } from '../../../app/core/config/backend-url';

/**
 * Same-origin gateway to the Java backend:  /api/**  ->  ${BACKEND_URL}${BACKEND_API_PATH}/**
 *
 * It exists so the browser only ever talks to its own origin: no CORS (the backend only allows a
 * few fixed localhost origins) and one address to configure. It is a pass-through: no business
 * logic, no authorization, no database. Authentication stays with the backend, which reads the
 * `Authorization: Bearer ...` header the browser sends.
 */

/** Only these request headers are forwarded. In particular NOT `Origin` (the backend would take
 *  this server-to-server call for a cross-site browser request and reject it with
 *  "Invalid CORS request"), NOT `Cookie` and NOT `Referer`. */
const FORWARDED_HEADERS = ['authorization', 'content-type', 'accept', 'accept-language'];
const PROXY_TIMEOUT_MS = 15_000;

export default defineEventHandler(async (event) => {
	const url = getRequestURL(event);
	if (!url.pathname.startsWith('/api/')) {
		throw createError({ statusCode: 400, statusMessage: 'Bad Request' });
	}

	const target =
		backendOrigin() + backendApiPath() + url.pathname.slice('/api'.length) + url.search;

	const headers = new Headers();
	for (const name of FORWARDED_HEADERS) {
		const value = getRequestHeader(event, name);
		if (value) headers.set(name, value);
	}

	const hasBody = event.method !== 'GET' && event.method !== 'HEAD';
	const raw = hasBody ? await readRawBody(event, false) : undefined;
	const body = raw ? new Uint8Array(raw) : undefined;

	try {
		return await sendProxy(event, target, {
			fetchOptions: {
				method: event.method,
				headers,
				body,
				redirect: 'manual',
				signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
			},
		});
	} catch {
		throw createError({
			statusCode: 502,
			statusMessage: 'Bad Gateway',
			message: 'The backend is not reachable',
		});
	}
});
