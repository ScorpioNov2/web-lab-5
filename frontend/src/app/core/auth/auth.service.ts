import { computed, inject, Injectable, signal } from '@angular/core';
import {
	catchError,
	finalize,
	map,
	Observable,
	of,
	shareReplay,
	Subject,
	tap,
	throwError,
} from 'rxjs';
import { DataCache } from '../cache/data-cache';
import { ApiError, SESSION_EXPIRED_MESSAGE } from '../http/api-error';
import { StorageManager } from '../storage/storage-manager';
import { AuthApi } from './auth.api';
import { AuthResponse, LoginRequest, RegisterRequest } from './auth.model';
import { canManageStudents } from './roles';
import { sessionRole } from './session';

/**
 * Owns the auth session. The cookie (via StorageManager) stays the source of truth; the signal
 * mirrors it so templates can react to login/logout. The cookie also carries the user, so the
 * server render knows who is signed in without calling the backend. (The backend has no
 * "current user" endpoint: the profile is the `user` of the last login / token refresh.)
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
	private readonly authApi = inject(AuthApi);
	private readonly storage = inject(StorageManager);
	private readonly cache = inject(DataCache);

	private readonly session = signal<AuthResponse | null>(this.storage.getAuthSession());

	readonly currentUser = computed(() => this.session()?.user ?? null);
	readonly isLoggedIn = computed(() => !!this.session()?.accessToken);
	/** ADMIN / USER, or null for a guest. */
	readonly role = computed(() => sessionRole(this.session()));
	readonly canManageStudents = computed(() => canManageStudents(this.role()));

	/** Emits when the refresh token no longer works and the UI must go back to guest state. */
	readonly sessionExpired$ = new Subject<void>();

	/**
	 * The backend refresh token is SINGLE-USE (rotation). If several concurrent requests get a 401
	 * and each refreshes on its own, the second one is rejected and the user is wrongly logged out
	 * -> all of them must share one refresh operation.
	 */
	private refreshInFlight$: Observable<void> | null = null;

	login(credentials: LoginRequest): Observable<AuthResponse> {
		return this.authApi.login(credentials).pipe(tap((response) => this.saveSession(response)));
	}

	register(data: RegisterRequest): Observable<unknown> {
		return this.authApi.register(data);
	}

	logout(): void {
		this.clearSession();
	}

	/** Refresh failed (refreshToken expired/revoked): revert to guest state. */
	handleSessionExpired(): void {
		this.clearSession();
		this.sessionExpired$.next();
	}

	/**
	 * Called by the interceptor when a request sent with `usedToken` got a 401.
	 * Completes once a valid token is in storage, errors when the session is fully expired.
	 */
	ensureFreshSession(usedToken: string): Observable<void> {
		const currentToken = this.storage.getAccessToken();
		// Session has been cleared (logged out / expired from another request)
		if (!currentToken) return throwError(() => this.sessionExpiredError());
		// Another request has already completed the refresh; just retry this request
		if (currentToken !== usedToken) return of(undefined);

		return this.refreshOnce().pipe(
			catchError(() => throwError(() => this.sessionExpiredError())),
		);
	}

	private refreshOnce(): Observable<void> {
		this.refreshInFlight$ ??= this.refresh().pipe(
			catchError((error: unknown) => {
				this.handleSessionExpired();
				return throwError(() => error);
			}),
			finalize(() => (this.refreshInFlight$ = null)),
			shareReplay({ bufferSize: 1, refCount: false }),
		);
		return this.refreshInFlight$;
	}

	/** Exchanges the refreshToken for a new token pair and persists it. */
	private refresh(): Observable<void> {
		const refreshToken = this.storage.getAuthSession()?.refreshToken;
		if (!refreshToken) return throwError(() => new Error('No refresh token'));

		return this.authApi.refreshAccessToken(refreshToken).pipe(
			tap((response) => this.saveSession(response)),
			map(() => undefined),
		);
	}

	private saveSession(response: AuthResponse): void {
		// Cached data belongs to the previous identity (or to a token that is being replaced).
		if (response.user?.id !== this.session()?.user?.id) this.cache.clear();
		this.storage.saveAuthSession(response);
		this.session.set(response);
	}

	private clearSession(): void {
		this.cache.clear();
		this.storage.clearAuth();
		this.session.set(null);
	}

	private sessionExpiredError(): ApiError {
		return new ApiError(SESSION_EXPIRED_MESSAGE, 401);
	}
}
