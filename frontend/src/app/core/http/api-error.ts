import { HttpErrorResponse } from '@angular/common/http';

/** HTTP error carrying the status code so callers can tell failures apart (was HttpError). */
export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = 'ApiError';
	}
}

export const CONNECTION_ERROR_MESSAGE = 'Ошибка подключения к серверу Backend!';
export const SESSION_EXPIRED_MESSAGE = 'Сессия истекла. Пожалуйста, войдите снова.';
export const ACCESS_DENIED_MESSAGE = 'Недостаточно прав для этого действия.';

/** 0 = the request never reached a server; 502-504 = the proxy could not reach the backend. */
const isConnectionFailure = (status: number): boolean =>
	status === 0 || status === 502 || status === 503 || status === 504;

/**
 * Message of the backend's ApiError body ({ message, validationErrors: { field: text } }).
 * For a failed validation the first field error is appended: "Request validation failed" alone
 * does not tell the user what to fix.
 */
function backendMessage(body: unknown): string | null {
	if (typeof body !== 'object' || body === null) return null;
	const { message, validationErrors } = body as Record<string, unknown>;
	if (typeof message !== 'string' || message === '') return null;

	if (typeof validationErrors === 'object' && validationErrors !== null) {
		const [first] = Object.entries(validationErrors);
		if (first) return `${message}: ${first[0]} - ${String(first[1])}`;
	}
	return message;
}

/** Normalises anything thrown by HttpClient into an ApiError with the backend's message. */
export function toApiError(error: unknown): ApiError {
	if (error instanceof ApiError) return error;

	if (error instanceof HttpErrorResponse) {
		if (isConnectionFailure(error.status))
			return new ApiError(CONNECTION_ERROR_MESSAGE, error.status);
		if (error.status === 403) return new ApiError(ACCESS_DENIED_MESSAGE, 403);
		return new ApiError(
			backendMessage(error.error) ?? `API Error: ${error.status}`,
			error.status,
		);
	}

	return new ApiError(error instanceof Error ? error.message : String(error), 0);
}

/** Message to show the user: the error's own message, or the fallback when it has none. */
export function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message ? error.message : fallback;
}
