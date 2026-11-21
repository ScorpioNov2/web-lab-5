import { AUTH_COOKIE_DAYS, readCookie } from '../auth/session';

export interface StorageDriver {
	get(key: string): string | null;
	set(key: string, value: string): void;
	remove(key: string): void;
}

/** Cookie db (browser): read and written through document.cookie. */
export class CookieStorageDriver implements StorageDriver {
	get(key: string): string | null {
		return readCookie(document.cookie, key);
	}

	set(key: string, value: string): void {
		const expires = new Date(Date.now() + AUTH_COOKIE_DAYS * 24 * 60 * 60 * 1000);
		document.cookie = `${key}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Strict${this.secure()}`;
	}

	/** A cookie is deleted by giving it an expiry date in the past (same path as in set()). */
	remove(key: string): void {
		document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict${this.secure()}`;
	}

	private secure(): string {
		return location.protocol === 'https:' ? '; Secure' : '';
	}
}

/**
 * Cookie db (server render): the cookies the browser sent with the page request. Read-only:
 * the server render never writes cookies. A refreshed session is written by the Nitro
 * middleware (src/server/middleware/auth.ts), before the render starts.
 */
export class RequestCookieDriver implements StorageDriver {
	constructor(private readonly cookieHeader: () => string | undefined) {}

	get(key: string): string | null {
		return readCookie(this.cookieHeader(), key);
	}

	set(): void {
		/* no-op on the server */
	}

	remove(): void {
		/* no-op on the server */
	}
}

/** LocalStorage db */
export class LocalStorageDriver implements StorageDriver {
	get(key: string): string | null {
		return localStorage.getItem(key);
	}

	set(key: string, value: string): void {
		localStorage.setItem(key, value);
	}

	remove(key: string): void {
		localStorage.removeItem(key);
	}
}

/** Stands in for LocalStorage on the server, where it does not exist. */
export class NullStorageDriver implements StorageDriver {
	get(): string | null {
		return null;
	}

	set(): void {
		/* no-op */
	}

	remove(): void {
		/* no-op */
	}
}
