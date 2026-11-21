import { evaluateAccess, loginUrlFor, safeRedirectTarget } from './route-access';

const redirect = (to: string) => expect.objectContaining({ allowed: false, redirectTo: to });

describe('evaluateAccess', () => {
	describe('guest', () => {
		it('is sent from protected pages to /login and remembers where it wanted to go', () => {
			expect(evaluateAccess('/students', null)).toEqual(
				redirect('/login?redirect=%2Fstudents'),
			);
			expect(evaluateAccess('/students/42', null)).toEqual(
				redirect('/login?redirect=%2Fstudents%2F42'),
			);
			expect(evaluateAccess('/profile', null)).toEqual(
				redirect('/login?redirect=%2Fprofile'),
			);
			// the query string is part of the page to return to
			expect(evaluateAccess('/students?page=2&search=ив', null)).toEqual(
				redirect(loginUrlFor('/students?page=2&search=ив')),
			);
		});

		it('may open the login and registration pages and unknown pages', () => {
			expect(evaluateAccess('/login', null)).toEqual({ allowed: true });
			expect(evaluateAccess('/register', null)).toEqual({ allowed: true });
			expect(evaluateAccess('/forbidden', null)).toEqual({ allowed: true });
			expect(evaluateAccess('/no/such/page', null)).toEqual({ allowed: true });
		});

		it('is sent from admin pages to /login too (not to /forbidden)', () => {
			expect(evaluateAccess('/students/new', null)).toEqual(
				redirect('/login?redirect=%2Fstudents%2Fnew'),
			);
		});

		it('is sent from the root page to /login', () => {
			expect(evaluateAccess('/', null)).toEqual(redirect('/login'));
		});
	});

	describe('USER', () => {
		it('may read students and open the profile', () => {
			for (const url of ['/students', '/students?page=3', '/students/42', '/profile']) {
				expect(evaluateAccess(url, 'USER')).toEqual({ allowed: true });
			}
		});

		it('cannot open the pages that create or edit students', () => {
			expect(evaluateAccess('/students/new', 'USER')).toEqual(redirect('/forbidden'));
			expect(evaluateAccess('/students/42/edit', 'USER')).toEqual(redirect('/forbidden'));
			expect(evaluateAccess('/students/42/edit/', 'USER')).toEqual(redirect('/forbidden'));
		});

		it('is sent away from /login, /register and the root page', () => {
			expect(evaluateAccess('/login', 'USER')).toEqual(redirect('/students'));
			expect(evaluateAccess('/register', 'USER')).toEqual(redirect('/students'));
			expect(evaluateAccess('/', 'USER')).toEqual(redirect('/students'));
		});
	});

	describe('ADMIN', () => {
		it('may open every protected page', () => {
			for (const url of [
				'/students',
				'/students/new',
				'/students/42',
				'/students/42/edit',
				'/profile',
			]) {
				expect(evaluateAccess(url, 'ADMIN')).toEqual({ allowed: true });
			}
		});
	});

	it('ignores a trailing slash and the #fragment when matching', () => {
		expect(evaluateAccess('/students/', null)).toEqual(
			redirect('/login?redirect=%2Fstudents%2F'),
		);
		expect(evaluateAccess('/students/new#top', 'USER')).toEqual(redirect('/forbidden'));
	});

	it('does not mistake a student named "new" or "edit" for the admin pages', () => {
		expect(evaluateAccess('/students/edit', 'USER')).toEqual({ allowed: true });
		expect(evaluateAccess('/students/new/edit', 'USER')).toEqual(redirect('/forbidden'));
	});
});

describe('safeRedirectTarget', () => {
	it('follows same-site paths, with their query', () => {
		expect(safeRedirectTarget('/students?page=2')).toBe('/students?page=2');
		expect(safeRedirectTarget('/students/42/edit')).toBe('/students/42/edit');
	});

	it('falls back for anything that could leave the site', () => {
		for (const hostile of [
			'https://evil.example',
			'//evil.example',
			'/\\evil.example',
			'javascript:alert(1)',
			'students',
			'/ok\nSet-Cookie: a=b',
		]) {
			expect(safeRedirectTarget(hostile)).toBe('/students');
		}
		expect(safeRedirectTarget(null)).toBe('/students');
		expect(safeRedirectTarget(undefined)).toBe('/students');
		expect(safeRedirectTarget(42)).toBe('/students');
	});

	it('never loops back into the login pages', () => {
		expect(safeRedirectTarget('/login')).toBe('/students');
		expect(safeRedirectTarget('/register?x=1')).toBe('/students');
	});

	it('uses the given fallback', () => {
		expect(safeRedirectTarget('//x', '/profile')).toBe('/profile');
	});
});
