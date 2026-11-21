import { catchError, map, Observable, of } from 'rxjs';
import { ApiError, toApiError } from './api-error';

/**
 * What a route resolver hands to its page. Resolvers never throw: a failed load is a value, so
 * the page can render an error / not-found state itself and the server can pick the HTTP status.
 */
export type Loaded<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export const loadedOk = <T>(data: T): Loaded<T> => ({ ok: true, data });
export const loadedError = <T = never>(error: ApiError): Loaded<T> => ({ ok: false, error });

export function toLoaded<T>(source: Observable<T>): Observable<Loaded<T>> {
	return source.pipe(
		map((data) => loadedOk(data)),
		catchError((error: unknown) => of(loadedError<T>(toApiError(error)))),
	);
}
