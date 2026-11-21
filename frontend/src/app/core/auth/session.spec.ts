import { canManageStudents, normalizeRole } from './roles';
import {
	AUTH_COOKIE,
	decodeJwtPayload,
	isAccessTokenExpired,
	parseSession,
	readCookie,
	sessionFromCookieHeader,
	sessionRole,
} from './session';
import { fakeJwt, fakeSession } from './test-tokens';

describe('cookie helpers', () => {
	it('finds a cookie among others and URI-decodes it', () => {
		const header = `a=1; ${AUTH_COOKIE}=${encodeURIComponent('{"x":"Иван"}')}; b=2`;
		expect(readCookie(header, AUTH_COOKIE)).toBe('{"x":"Иван"}');
		expect(readCookie(header, 'b')).toBe('2');
		expect(readCookie(header, 'missing')).toBeNull();
		expect(readCookie(undefined, 'a')).toBeNull();
		expect(readCookie('a=%E0%A4%A', 'a')).toBeNull(); // malformed encoding is not an error
	});

	it('does not match a cookie whose name only ends the same way', () => {
		expect(readCookie('x_auth_secure_session=1', AUTH_COOKIE)).toBeNull();
	});

	it('round-trips the session through a Cookie header, as the browser sends it', () => {
		const session = fakeSession('ADMIN');
		const header = `${AUTH_COOKIE}=${encodeURIComponent(JSON.stringify(session))}`;
		expect(sessionFromCookieHeader(header)).toEqual(session);
	});
});

describe('parseSession', () => {
	it('accepts a session with both tokens', () => {
		expect(parseSession('{"accessToken":"a","refreshToken":"r"}')).toMatchObject({
			accessToken: 'a',
		});
	});

	it('rejects anything else', () => {
		for (const raw of [
			null,
			undefined,
			'',
			'not json',
			'[]',
			'null',
			'{}',
			'{"accessToken":""}',
			'{"accessToken":"a"}',
		]) {
			expect(parseSession(raw)).toBeNull();
		}
	});
});

describe('JWT helpers', () => {
	it('decodes the claims, including non-ASCII text', () => {
		expect(decodeJwtPayload(fakeJwt({ role: 'ADMIN', name: 'Иван' }))).toEqual({
			role: 'ADMIN',
			name: 'Иван',
		});
		expect(decodeJwtPayload('garbage')).toBeNull();
		expect(decodeJwtPayload('a.!!!.c')).toBeNull();
	});

	it('knows when the access token has expired (with a small safety margin)', () => {
		const now = Date.now();
		const exp = (offsetSeconds: number) =>
			fakeJwt({ exp: Math.floor(now / 1000) + offsetSeconds });
		expect(isAccessTokenExpired(exp(600), 10_000, now)).toBe(false);
		expect(isAccessTokenExpired(exp(-5), 10_000, now)).toBe(true);
		expect(isAccessTokenExpired(exp(5), 10_000, now)).toBe(true); // expires within the margin
	});

	it('leaves the verdict on an undecodable token to the backend', () => {
		expect(isAccessTokenExpired('opaque-token')).toBe(false);
		expect(isAccessTokenExpired(fakeJwt({ sub: 'no exp claim' }))).toBe(false);
	});
});

describe('roles', () => {
	it('takes the role from the token claim', () => {
		expect(sessionRole(fakeSession('ADMIN'))).toBe('ADMIN');
		expect(sessionRole(fakeSession('USER'))).toBe('USER');
	});

	it('prefers the signed claim over the user object next to it', () => {
		const session = fakeSession('USER');
		session.user = { ...session.user!, role: 'ADMIN' };
		expect(sessionRole(session)).toBe('USER');
	});

	it('falls back to the user object, then to the least privileged role', () => {
		const opaque = fakeSession('ADMIN', { accessToken: 'opaque' });
		expect(sessionRole(opaque)).toBe('ADMIN');
		expect(sessionRole({ ...opaque, user: null })).toBe('USER');
		expect(sessionRole(fakeSession('SUPERHERO', { user: null }))).toBe('USER');
	});

	it('is null for a guest', () => {
		expect(sessionRole(null)).toBeNull();
		expect(sessionRole(undefined)).toBeNull();
	});

	it('normalises backend spellings and only ADMIN may manage students', () => {
		expect(normalizeRole('ROLE_ADMIN')).toBe('ADMIN');
		expect(normalizeRole(' admin ')).toBe('ADMIN');
		expect(normalizeRole('user')).toBe('USER');
		expect(normalizeRole('root')).toBeNull();
		expect(normalizeRole(5)).toBeNull();
		expect(canManageStudents('ADMIN')).toBe(true);
		expect(canManageStudents('USER')).toBe(false);
		expect(canManageStudents(null)).toBe(false);
	});
});
