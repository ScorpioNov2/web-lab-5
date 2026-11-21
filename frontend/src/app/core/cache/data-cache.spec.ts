import { PLATFORM_ID, TransferState, makeStateKey } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { defer, delay, Observable, of, throwError } from 'rxjs';
import { DataCache } from './data-cache';

function setup(platform: 'browser' | 'server' = 'browser') {
	TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: platform }] });
	return TestBed.inject(DataCache);
}

/** A fetcher that counts how often the "network" was used. */
function counting<T>(...answers: T[]) {
	const fetcher = vi.fn(() =>
		of(answers[Math.min(fetcher.mock.calls.length - 1, answers.length - 1)]),
	);
	return fetcher;
}

const read = <T>(source: Observable<T>): T => {
	let value: T | undefined;
	source.subscribe((v) => (value = v));
	return value as T;
};

describe('DataCache', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-11-20T12:00:00Z'));
	});
	afterEach(() => vi.useRealTimers());

	it('cache MISS goes to the network and stores the answer', () => {
		const cache = setup();
		const fetcher = counting('A');
		expect(read(cache.get('k', fetcher))).toBe('A');
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(cache.has('k')).toBe(true);
	});

	it('cache HIT (fresh) answers without any request', () => {
		const cache = setup();
		const fetcher = counting('A', 'B');
		cache.get('k', fetcher).subscribe();
		vi.advanceTimersByTime(5_000);
		expect(read(cache.get('k', fetcher, { staleMs: 15_000 }))).toBe('A');
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('STALE entry is served at once and refreshed in the background (stale-while-revalidate)', () => {
		const cache = setup();
		const fetcher = counting('old', 'new');
		cache.get('k', fetcher).subscribe();

		vi.advanceTimersByTime(60_000); // older than staleMs, younger than maxAgeMs
		expect(read(cache.get('k', fetcher, { staleMs: 15_000, maxAgeMs: 300_000 }))).toBe('old');
		expect(fetcher).toHaveBeenCalledTimes(2); // background revalidation happened
		expect(read(cache.get('k', fetcher))).toBe('new'); // and updated the entry
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('an entry older than maxAge is a miss', () => {
		const cache = setup();
		const fetcher = counting('old', 'new');
		cache.get('k', fetcher).subscribe();
		vi.advanceTimersByTime(10 * 60_000);
		expect(read(cache.get('k', fetcher, { staleMs: 15_000, maxAgeMs: 300_000 }))).toBe('new');
	});

	it('force skips the lookup but still refreshes the entry', () => {
		const cache = setup();
		const fetcher = counting('A', 'B');
		cache.get('k', fetcher).subscribe();
		expect(read(cache.get('k', fetcher, { force: true }))).toBe('B');
		expect(read(cache.get('k', fetcher))).toBe('B');
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('invalidate(prefix) drops matching entries only (event-based revalidation)', () => {
		const cache = setup();
		cache.get('students:list?page=0', counting('l')).subscribe();
		cache.get('students:item:5', counting('i')).subscribe();
		cache.get('other', counting('o')).subscribe();

		const seen: string[] = [];
		cache.invalidated$.subscribe((prefix) => seen.push(prefix));
		cache.invalidate('students:');

		expect(cache.has('students:list?page=0')).toBe(false);
		expect(cache.has('students:item:5')).toBe(false);
		expect(cache.has('other')).toBe(true);
		expect(seen).toEqual(['students:']);
	});

	it('clear() forgets everything', () => {
		const cache = setup();
		cache.get('a', counting(1)).subscribe();
		cache.clear();
		expect(cache.has('a')).toBe(false);
	});

	it('concurrent callers share one in-flight request', () => {
		const cache = setup();
		const fetcher = vi.fn(() => of('A').pipe(delay(100)));
		const results: string[] = [];
		cache.get('k', fetcher).subscribe((v) => results.push(v));
		cache.get('k', fetcher).subscribe((v) => results.push(v));
		vi.advanceTimersByTime(100);
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(results).toEqual(['A', 'A']);
	});

	it('a response that was on its way when the data was invalidated is NOT stored', () => {
		const cache = setup();
		const slow = vi.fn(() => of('stale-answer').pipe(delay(100)));
		cache.get('students:k', slow).subscribe();
		cache.invalidate('students:'); // e.g. a student was edited meanwhile
		vi.advanceTimersByTime(100);
		expect(cache.has('students:k')).toBe(false);
	});

	it('does not cache failures; the next call tries again', () => {
		const cache = setup();
		let attempts = 0;
		const flaky = () =>
			defer(() => (++attempts === 1 ? throwError(() => new Error('down')) : of('ok')));
		let error: unknown;
		cache.get('k', flaky).subscribe({ error: (e) => (error = e) });
		expect((error as Error).message).toBe('down');
		expect(read(cache.get('k', flaky))).toBe('ok');
		expect(attempts).toBe(2);
	});

	it('keeps at most 200 entries, dropping the oldest', () => {
		const cache = setup();
		for (let i = 0; i < 201; i++) cache.get(`k${i}`, counting(i)).subscribe();
		expect(cache.has('k0')).toBe(false);
		expect(cache.has('k1')).toBe(true);
		expect(cache.has('k200')).toBe(true);
	});

	describe('server -> browser hand-off (TransferState)', () => {
		const key = makeStateKey<{ data: unknown }>('data-cache:students:list');

		it('the server render writes what it fetched to TransferState', () => {
			const cache = setup('server');
			cache.get('students:list', counting({ rows: 3 })).subscribe();
			expect(TestBed.inject(TransferState).get(key, null)).toEqual({ data: { rows: 3 } });
		});

		it('the browser picks it up on first use: no request, and it is consumed', () => {
			TestBed.configureTestingModule({
				providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
			});
			const state = TestBed.inject(TransferState);
			state.set(key, { data: { rows: 3 } });
			const cache = TestBed.inject(DataCache);

			const fetcher = counting({ rows: 99 });
			expect(read(cache.get('students:list', fetcher))).toEqual({ rows: 3 });
			expect(fetcher).not.toHaveBeenCalled();
			expect(state.hasKey(key)).toBe(false);
		});

		it('the browser never writes to TransferState', () => {
			const cache = setup('browser');
			cache.get('students:list', counting(1)).subscribe();
			expect(TestBed.inject(TransferState).hasKey(key)).toBe(false);
		});
	});
});
