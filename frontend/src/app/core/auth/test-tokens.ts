import type { AuthResponse } from './auth.model';

/** Test helper: an unsigned JWT-shaped token with the given claims. */
export function fakeJwt(claims: Record<string, unknown>): string {
	const encode = (value: unknown) => {
		const bytes = new TextEncoder().encode(JSON.stringify(value));
		const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
		return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	};
	return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.signature`;
}

export function fakeSession(
	role: string,
	overrides: Partial<AuthResponse> = {},
	expiresInSeconds = 900,
): AuthResponse {
	return {
		accessToken: fakeJwt({
			sub: 'ivan',
			role,
			token_type: 'access',
			exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
		}),
		refreshToken: 'refresh-token',
		tokenType: 'Bearer',
		accessExpiresInSeconds: expiresInSeconds,
		user: { id: 7, fullName: 'Иван Петров', username: 'ivan', email: 'ivan@mail.ru', role },
		...overrides,
	};
}
