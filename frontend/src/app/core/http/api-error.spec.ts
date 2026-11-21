import { HttpErrorResponse } from '@angular/common/http';
import { ApiError, CONNECTION_ERROR_MESSAGE, errorMessage, toApiError } from './api-error';
import { loadedOk, toLoaded } from './loaded';
import { of, throwError } from 'rxjs';

const http = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

describe('toApiError', () => {
	it('uses the message of the backend body', () => {
		const error = toApiError(
			http(409, { message: 'A student with this ISU ID already exists' }),
		);
		expect(error).toBeInstanceOf(ApiError);
		expect([error.status, error.message]).toEqual([
			409,
			'A student with this ISU ID already exists',
		]);
	});

	it('adds the first field error to a failed validation (the bare message does not say what to fix)', () => {
		const error = toApiError(
			http(400, {
				message: 'Request validation failed',
				validationErrors: { password: 'size must be between 8 and 72' },
			}),
		);
		expect(error.message).toBe(
			'Request validation failed: password - size must be between 8 and 72',
		);
	});

	it('explains 403 in the interface language', () => {
		expect(toApiError(http(403, { message: 'Access is denied' })).message).toBe(
			'Недостаточно прав для этого действия.',
		);
	});

	it('treats "no connection" and a dead backend behind the proxy alike', () => {
		for (const status of [0, 502, 503, 504]) {
			expect(toApiError(http(status, null)).message).toBe(CONNECTION_ERROR_MESSAGE);
		}
	});

	it('falls back to the status for a body without a message', () => {
		expect(toApiError(http(500, '<html>')).message).toBe('API Error: 500');
	});

	it('keeps an ApiError as it is and wraps anything else', () => {
		const original = new ApiError('x', 404);
		expect(toApiError(original)).toBe(original);
		expect(toApiError(new Error('boom'))).toMatchObject({ message: 'boom', status: 0 });
		expect(toApiError('text')).toMatchObject({ message: 'text', status: 0 });
	});

	it('errorMessage falls back when there is no message', () => {
		expect(errorMessage(new Error('real'), 'fallback')).toBe('real');
		expect(errorMessage(null, 'fallback')).toBe('fallback');
	});
});

describe('toLoaded', () => {
	it('turns a value into ok and a failure into a value (resolvers never throw)', () => {
		const results: unknown[] = [];
		toLoaded(of(5)).subscribe((r) => results.push(r));
		toLoaded(throwError(() => http(404, { message: 'nope' }))).subscribe((r) =>
			results.push(r),
		);
		expect(results[0]).toEqual(loadedOk(5));
		expect(results[1]).toMatchObject({ ok: false, error: { status: 404, message: 'nope' } });
	});
});
