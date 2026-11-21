import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { StudentApi, toSearchParams } from './student.api';
import { toStudent } from './student.model';

const BASE = '/api/students';

describe('StudentApi', () => {
	describe('toSearchParams', () => {
		it('skips empty values and keeps page 0', () => {
			expect(
				toSearchParams({
					search: '',
					sortBy: '',
					sortDirection: '',
					page: 0,
					size: 10,
				}).toString(),
			).toBe('page=0&size=10');
		});

		it('sends every non-empty value, in the order of the API', () => {
			const params = toSearchParams({
				search: 'ив',
				sortBy: 'fullName',
				sortDirection: 'asc',
				page: 2,
				size: 10,
				foreigner: false,
			});
			expect(params.toString()).toBe(
				`search=${encodeURIComponent('ив')}&foreigner=false&page=2&size=10&sortBy=fullName&sortDirection=asc`,
			);
		});

		it('defaults to page 0, size 20', () => {
			expect(toSearchParams({}).toString()).toBe('page=0&size=20');
		});
	});

	describe('toStudent', () => {
		it('fills safe defaults for missing fields and casts the dates', () => {
			expect(toStudent({})).toEqual({
				fullName: '',
				groupName: '',
				isuId: 0,
				dormitoryNumber: 0,
				roomNumber: '',
				settlementTerm: null,
				foreigner: false,
				notes: '',
				createdAt: null,
			});

			const student = toStudent({
				isuId: '123456',
				settlementTerm: '2026-09-01',
				notes: null,
			});
			expect(student.isuId).toBe(123456);
			expect(student.settlementTerm).toEqual(new Date('2026-09-01'));
			expect(student.notes).toBe('');
		});
	});

	describe('requests', () => {
		let api: StudentApi;
		let controller: HttpTestingController;

		beforeEach(() => {
			TestBed.configureTestingModule({
				providers: [provideHttpClient(), provideHttpClientTesting()],
			});
			api = TestBed.inject(StudentApi);
			controller = TestBed.inject(HttpTestingController);
		});

		afterEach(() => controller.verify());

		it('maps the paged response', () => {
			let page: unknown;
			api.search({ page: 1, size: 10 }).subscribe((value) => (page = value));

			const request = controller.expectOne((r) => r.url === BASE);
			expect(request.request.params.get('page')).toBe('1');
			request.flush({
				content: [{ fullName: 'Иван Петров', isuId: 1, settlementTerm: '2026-09-01' }],
				page: 1,
				size: 10,
				totalElements: 11,
				totalPages: 2,
			});

			expect(page).toMatchObject({ page: 1, size: 10, totalElements: 11, totalPages: 2 });
			expect((page as { content: { fullName: string }[] }).content[0].fullName).toBe(
				'Иван Петров',
			);
		});

		it('PATCHes the CURRENT isuId and sends only the known fields', () => {
			api.update(5, {
				fullName: 'A',
				groupName: 'G',
				isuId: 6,
				dormitoryNumber: 1,
				roomNumber: '10',
				settlementTerm: '2026-09-01',
				foreigner: true,
				notes: '',
				extra: 'dropped',
			} as never).subscribe();

			const request = controller.expectOne(`${BASE}/5`);
			expect(request.request.method).toBe('PATCH');
			expect(request.request.body).toEqual({
				fullName: 'A',
				groupName: 'G',
				isuId: 6,
				dormitoryNumber: 1,
				roomNumber: '10',
				settlementTerm: '2026-09-01',
				foreigner: true,
				notes: '',
			});
			request.flush({});
		});

		it('DELETE accepts an empty 204 answer', () => {
			let done = false;
			api.delete(7).subscribe(() => (done = true));
			controller
				.expectOne(`${BASE}/7`)
				.flush(null, { status: 204, statusText: 'No Content' });
			expect(done).toBe(true);
		});
	});
});

describe('StudentApi caching', () => {
	let api: StudentApi;
	let controller: HttpTestingController;
	const page = {
		content: [{ fullName: 'Иван', isuId: 1 }],
		page: 0,
		size: 10,
		totalElements: 1,
		totalPages: 1,
	};

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting()],
		});
		api = TestBed.inject(StudentApi);
		controller = TestBed.inject(HttpTestingController);
	});
	afterEach(() => controller.verify());

	it('answers a repeated search from the cache (hit): one request only', () => {
		api.search({ page: 0, size: 10 }).subscribe();
		controller.expectOne((r) => r.url === BASE).flush(page);

		let again: unknown;
		api.search({ page: 0, size: 10 }).subscribe((v) => (again = v));
		controller.expectNone(BASE);
		expect(again).toMatchObject({ totalElements: 1 });
	});

	it('another page or another keyword is a different cache entry (miss)', () => {
		api.search({ page: 0, size: 10 }).subscribe();
		controller.expectOne((r) => r.url === BASE).flush(page);
		api.search({ page: 1, size: 10 }).subscribe();
		controller.expectOne((r) => r.url === BASE).flush(page);
	});

	it('keeps Date objects intact when a cached answer is read again', () => {
		const dto = {
			content: [{ isuId: 1, settlementTerm: '2026-09-01' }],
			page: 0,
			size: 10,
			totalElements: 1,
			totalPages: 1,
		};
		api.search({ page: 0 }).subscribe();
		controller.expectOne((r) => r.url === BASE).flush(dto);
		let cached: { content: { settlementTerm: unknown }[] } | undefined;
		api.search({ page: 0 }).subscribe((v) => (cached = v as never));
		expect(cached!.content[0].settlementTerm).toBeInstanceOf(Date);
	});

	it('caches single students too, and prefetch warms that cache', () => {
		api.prefetch(5);
		controller.expectOne(`${BASE}/5`).flush({ fullName: 'Пётр', isuId: 5 });
		let student: unknown;
		api.getByIsuId(5).subscribe((v) => (student = v));
		controller.expectNone(`${BASE}/5`);
		expect(student).toMatchObject({ fullName: 'Пётр' });
	});

	it('a prefetch that fails is silent', () => {
		api.prefetch(9);
		controller.expectOne(`${BASE}/9`).flush({ message: 'x' }, { status: 404, statusText: 'x' });
	});

	it.each<[string, () => Observable<unknown>, string, string]>([
		['create', () => api.create({ isuId: 2 } as never), 'POST', BASE],
		['update', () => api.update(1, { isuId: 1 } as never), 'PATCH', `${BASE}/1`],
		['delete', () => api.delete(1), 'DELETE', `${BASE}/1`],
	])(
		'%s invalidates everything cached about students (event-based revalidation)',
		(_name, write, method, url) => {
			api.search({ page: 0, size: 10 }).subscribe();
			controller.expectOne((r) => r.url === BASE).flush(page);
			api.getByIsuId(1).subscribe();
			controller.expectOne(`${BASE}/1`).flush({ isuId: 1 });

			write().subscribe();
			const request = controller.expectOne((r) => r.url === url && r.method === method);
			request.flush(
				method === 'DELETE' ? null : { isuId: 1 },
				method === 'DELETE' ? { status: 204, statusText: 'No Content' } : {},
			);

			api.search({ page: 0, size: 10 }).subscribe();
			controller.expectOne((r) => r.url === BASE).flush(page); // fetched again: the cache was dropped
			api.getByIsuId(1).subscribe();
			controller.expectOne(`${BASE}/1`).flush({ isuId: 1 });
		},
	);

	it('a FAILED write leaves the cache alone', () => {
		api.search({ page: 0, size: 10 }).subscribe();
		controller.expectOne((r) => r.url === BASE).flush(page);
		api.delete(1).subscribe({ error: () => undefined });
		controller
			.expectOne(`${BASE}/1`)
			.flush({ message: 'no' }, { status: 500, statusText: 'x' });
		api.search({ page: 0, size: 10 }).subscribe();
		controller.expectNone(BASE);
	});
});
