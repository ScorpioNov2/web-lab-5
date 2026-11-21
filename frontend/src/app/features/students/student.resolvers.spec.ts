import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, convertToParamMap, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { Loaded } from '../../core/http/loaded';
import { parseIsuId, studentResolver, studentsResolver } from './student.resolvers';

const route = (params: Record<string, string> = {}, query: Record<string, string> = {}) =>
	({
		paramMap: convertToParamMap(params),
		queryParamMap: convertToParamMap(query),
	}) as ActivatedRouteSnapshot;

function resolve<T>(
	resolver: (r: ActivatedRouteSnapshot, s: RouterStateSnapshot) => unknown,
	r: ActivatedRouteSnapshot,
) {
	let result: Loaded<T> | undefined;
	const source = TestBed.runInInjectionContext(() =>
		resolver(r, {} as RouterStateSnapshot),
	) as Observable<Loaded<T>>;
	source.subscribe((value) => (result = value));
	return () => result;
}

describe('parseIsuId', () => {
	it('accepts positive integers only', () => {
		expect(parseIsuId('400123')).toBe(400123);
		for (const bad of [
			null,
			'',
			'0',
			'-5',
			'007',
			'1.5',
			'abc',
			'12abc',
			' 5',
			'1'.repeat(16),
		]) {
			expect(parseIsuId(bad)).toBeNull();
		}
	});
});

describe('route resolvers', () => {
	let controller: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting()],
		});
		controller = TestBed.inject(HttpTestingController);
	});
	afterEach(() => controller.verify());

	it('studentsResolver asks for the page described by the URL query (0-based page)', () => {
		const result = resolve(
			studentsResolver,
			route({}, { page: '3', search: 'Анна', sort: 'isuId', direction: 'desc' }),
		);
		const request = controller.expectOne((r) => r.url === '/api/students');
		expect(request.request.params.get('page')).toBe('2');
		expect(request.request.params.get('size')).toBe('10');
		expect(request.request.params.get('search')).toBe('Анна');
		expect(request.request.params.get('sortBy')).toBe('isuId');
		expect(request.request.params.get('sortDirection')).toBe('desc');
		request.flush({ content: [], page: 2, size: 10, totalElements: 0, totalPages: 0 });
		expect(result()).toMatchObject({ ok: true });
	});

	it('a failed load becomes a value with the status, never an exception', () => {
		const result = resolve(studentsResolver, route());
		controller
			.expectOne((r) => r.url === '/api/students')
			.flush({ message: 'boom' }, { status: 500, statusText: 'x' });
		expect(result()).toMatchObject({ ok: false, error: { status: 500 } });
	});

	it('studentResolver loads one student by the :id of the URL', () => {
		const result = resolve(studentResolver, route({ id: '400123' }));
		controller
			.expectOne('/api/students/400123')
			.flush({ fullName: 'Иван Петров', isuId: 400123 });
		expect(result()).toMatchObject({
			ok: true,
			data: { fullName: 'Иван Петров', isuId: 400123 },
		});
	});

	it('a student the backend does not know is a 404 value', () => {
		const result = resolve(studentResolver, route({ id: '1' }));
		controller
			.expectOne('/api/students/1')
			.flush({ message: 'Student was not found' }, { status: 404, statusText: 'x' });
		expect(result()).toMatchObject({
			ok: false,
			error: { status: 404, message: 'Student was not found' },
		});
	});

	it('a malformed id is a 404 without bothering the backend', () => {
		const result = resolve(studentResolver, route({ id: 'abc' }));
		controller.expectNone(() => true);
		expect(result()).toMatchObject({ ok: false, error: { status: 404 } });
	});
});
