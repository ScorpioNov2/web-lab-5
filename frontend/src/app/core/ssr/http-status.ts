import { injectResponse } from '@analogjs/router/tokens';
import { Observable, tap } from 'rxjs';
import { Loaded } from '../http/loaded';

/**
 * Lets a resolver choose the HTTP status of the page that is being server-rendered (404 for an
 * unknown student, 403, 5xx...). In the browser there is no response object, so it does nothing.
 * Call it in an injection context (the body of a resolver); the returned function may be called
 * later.
 */
export function injectStatusSetter(): (status: number) => void {
	const response = injectResponse();
	return (status) => {
		if (response && !response.headersSent && status >= 400) {
			response.statusCode = status;
		}
	};
}

/** Pipe operator: when the load failed, the server answers with the error's status code. */
export function setStatusOnError<T>(
	setStatus: (status: number) => void,
): (source: Observable<Loaded<T>>) => Observable<Loaded<T>> {
	return tap((result: Loaded<T>) => {
		// status 0 = the backend could not be reached at all
		if (!result.ok) setStatus(result.error.status || 503);
	});
}
