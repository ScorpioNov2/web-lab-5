import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { injectRequest } from '@analogjs/router/tokens';
import type { AuthResponse } from '../auth/auth.model';
import { AUTH_COOKIE, parseSession } from '../auth/session';
import {
	CookieStorageDriver,
	LocalStorageDriver,
	NullStorageDriver,
	RequestCookieDriver,
	StorageDriver,
} from './storage-drivers';

/** Centralised definition of all storage keys. */
export const STORAGE_KEYS = {
	/** The package containing the accessToken, refreshToken, user... */
	AUTH_DATA: AUTH_COOKIE,
	APP_THEME: 'user_theme_preference',
} as const;

/**
 * Two separate channels:
 *  - secure: cookie-based, holds the auth session. The cookie is what lets the SERVER render the
 *    same signed-in page as the browser.
 *  - public: LocalStorage-based, holds general preferences (browser only)
 */
@Injectable({ providedIn: 'root' })
export class StorageManager {
	private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly request = injectRequest();

	private readonly secureStorage: StorageDriver = this.isBrowser
		? new CookieStorageDriver()
		: new RequestCookieDriver(() => this.request?.headers.cookie);
	private readonly publicStorage: StorageDriver = this.isBrowser
		? new LocalStorageDriver()
		: new NullStorageDriver();

	// ---- secure layer (cookie-only) ----
	saveAuthSession(session: AuthResponse | null | undefined): void {
		if (!session) return;
		this.secureStorage.set(STORAGE_KEYS.AUTH_DATA, JSON.stringify(session));
	}

	getAuthSession(): AuthResponse | null {
		const rawJson = this.secureStorage.get(STORAGE_KEYS.AUTH_DATA);
		if (!rawJson) return null;
		const session = parseSession(rawJson);
		if (!session) this.clearAuth();
		return session;
	}

	getAccessToken(): string | null {
		return this.getAuthSession()?.accessToken || null;
	}

	clearAuth(): void {
		this.secureStorage.remove(STORAGE_KEYS.AUTH_DATA);
	}

	// ---- general layer (LocalStorage-only) ----
	saveTheme(themeName: string): void {
		this.publicStorage.set(STORAGE_KEYS.APP_THEME, themeName);
	}

	getTheme(): string {
		return this.publicStorage.get(STORAGE_KEYS.APP_THEME) || 'light';
	}
}
