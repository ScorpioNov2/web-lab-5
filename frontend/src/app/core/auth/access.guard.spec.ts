import { TestBed } from '@angular/core/testing';
import {
	ActivatedRouteSnapshot,
	provideRouter,
	Router,
	RouterStateSnapshot,
	UrlTree,
} from '@angular/router';
import { StorageManager } from '../storage/storage-manager';
import { accessGuard } from './access.guard';
import { fakeSession } from './test-tokens';

function run(url: string): boolean | UrlTree {
	return TestBed.runInInjectionContext(() =>
		accessGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
	) as boolean | UrlTree;
}

describe('accessGuard', () => {
	let storage: StorageManager;

	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideRouter([])] });
		storage = TestBed.inject(StorageManager);
		storage.clearAuth();
	});
	afterEach(() => storage.clearAuth());

	it('sends a guest to /login and remembers the page', () => {
		const result = run('/students/5');
		expect(result).toBeInstanceOf(UrlTree);
		expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
			'/login?redirect=%2Fstudents%2F5',
		);
	});

	it('lets a signed-in user through, and an ADMIN to the edit pages', () => {
		storage.saveAuthSession(fakeSession('USER'));
		expect(run('/students')).toBe(true);
		expect(run('/profile')).toBe(true);
	});

	it('sends a USER away from the pages of administrators', () => {
		storage.saveAuthSession(fakeSession('USER'));
		const result = run('/students/new');
		expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/forbidden');
	});

	it('lets an ADMIN open the pages of administrators', () => {
		storage.saveAuthSession(fakeSession('ADMIN'));
		expect(run('/students/new')).toBe(true);
		expect(run('/students/5/edit')).toBe(true);
	});

	it('keeps signed-in users off the login page', () => {
		storage.saveAuthSession(fakeSession('USER'));
		expect(TestBed.inject(Router).serializeUrl(run('/login') as UrlTree)).toBe('/students');
	});
});
