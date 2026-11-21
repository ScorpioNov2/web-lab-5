import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, makeStateKey, PLATFORM_ID, TransferState } from '@angular/core';
import { defer, finalize, Observable, of, shareReplay, Subject, tap } from 'rxjs';

export interface CacheOptions {
	/** Younger than this the entry is FRESH: served as is, no request (cache hit). */
	staleMs?: number;
	/**
	 * Younger than this (but not fresh) the entry is STALE: it is served immediately AND
	 * re-fetched in the background (stale-while-revalidate). Older -> cache miss.
	 */
	maxAgeMs?: number;
	/** Skip the lookup and go to the network; the answer still refreshes the entry. */
	force?: boolean;
}

export const DEFAULT_STALE_MS = 15_000;
export const DEFAULT_MAX_AGE_MS = 5 * 60_000;
const MAX_ENTRIES = 200;

interface Entry {
	data: unknown;
	fetchedAt: number;
}

interface TransferredEntry {
	data: unknown;
}

const stateKeyFor = (key: string) => makeStateKey<TransferredEntry>(`data-cache:${key}`);

/**
 * Client-side data cache for GET requests. One instance lives as long as the application:
 *  - in the BROWSER: for the whole visit, shared by every page;
 *  - on the SERVER: one per rendered request (a fresh application is bootstrapped for each), so
 *    nothing is ever shared between users.
 *
 * Cache hit / miss / stale-while-revalidate: see {@link get}.
 * Revalidation by time: entries age (staleMs / maxAgeMs), and callers can force a refresh.
 * Revalidation by event: {@link invalidate} drops entries after a mutation.
 *
 * SSR -> browser hand-off: whatever the server fetched while rendering is written to Angular's
 * TransferState; the browser seeds the cache from it, so hydration does not repeat the requests.
 */
@Injectable({ providedIn: 'root' })
export class DataCache {
	private readonly transferState = inject(TransferState);
	private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

	private readonly entries = new Map<string, Entry>();
	private readonly inflight = new Map<string, Observable<unknown>>();
	private readonly invalidations = new Subject<string>();
	/** Bumped by every invalidation, so a response that was already on its way is not stored. */
	private generation = 0;

	/** Emits the key prefix of every invalidation (e.g. "students:"). */
	readonly invalidated$ = this.invalidations.asObservable();

	get<T>(key: string, fetcher: () => Observable<T>, options: CacheOptions = {}): Observable<T> {
		const {
			staleMs = DEFAULT_STALE_MS,
			maxAgeMs = DEFAULT_MAX_AGE_MS,
			force = false,
		} = options;

		if (!force) {
			const entry = this.lookup(key);
			if (entry) {
				const age = Date.now() - entry.fetchedAt;
				// CACHE HIT (fresh): no request at all.
				if (age < staleMs) return of(entry.data as T);
				// CACHE HIT (stale): answer now, refresh behind the scenes.
				if (age < maxAgeMs) {
					this.fetchAndStore(key, fetcher).subscribe({ error: () => undefined });
					return of(entry.data as T);
				}
			}
		}

		// CACHE MISS (or forced): go to the network.
		return this.fetchAndStore(key, fetcher);
	}

	/** Event-based revalidation: drops every entry whose key starts with `prefix`. */
	invalidate(prefix: string): void {
		this.generation++;
		for (const key of [...this.entries.keys()]) {
			if (key.startsWith(prefix)) this.entries.delete(key);
		}
		for (const key of [...this.inflight.keys()]) {
			if (key.startsWith(prefix)) this.inflight.delete(key);
		}
		this.invalidations.next(prefix);
	}

	/** Forget everything (login / logout: the next user must never see the previous one's data). */
	clear(): void {
		this.generation++;
		this.entries.clear();
		this.inflight.clear();
	}

	has(key: string): boolean {
		return this.entries.has(key);
	}

	/** One request per key at a time: concurrent callers share the same in-flight request. */
	private fetchAndStore<T>(key: string, fetcher: () => Observable<T>): Observable<T> {
		const running = this.inflight.get(key);
		if (running) return running as Observable<T>;

		const generation = this.generation;
		const request$ = defer(fetcher).pipe(
			tap((data) => {
				if (generation === this.generation) this.store(key, data);
			}),
			finalize(() => {
				if (this.inflight.get(key) === request$) this.inflight.delete(key);
			}),
			shareReplay({ bufferSize: 1, refCount: false }),
		);
		this.inflight.set(key, request$);
		return request$;
	}

	private store(key: string, data: unknown): void {
		this.entries.delete(key); // re-insert: Map keeps insertion order, the oldest sits first
		this.entries.set(key, { data, fetchedAt: Date.now() });
		if (this.entries.size > MAX_ENTRIES) {
			const oldest = this.entries.keys().next().value;
			if (oldest !== undefined) this.entries.delete(oldest);
		}
		if (!this.isBrowser) {
			this.transferState.set(stateKeyFor(key), { data });
		}
	}

	private lookup(key: string): Entry | null {
		const entry = this.entries.get(key);
		if (entry) return entry;

		// First read in the browser: pick up what the server rendered the page with.
		if (this.isBrowser) {
			const stateKey = stateKeyFor(key);
			if (this.transferState.hasKey(stateKey)) {
				const transferred = this.transferState.get(stateKey, null);
				this.transferState.remove(stateKey);
				if (transferred) {
					const seeded: Entry = { data: transferred.data, fetchedAt: Date.now() };
					this.entries.set(key, seeded);
					return seeded;
				}
			}
		}
		return null;
	}
}
