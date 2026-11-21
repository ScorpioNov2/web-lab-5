import { backendApiPath, backendApiUrl, backendOrigin } from './backend-url';

interface Holder {
	process?: { env?: Record<string, string | undefined> };
}

describe('backend-url', () => {
	const env = (globalThis as Holder).process!.env!;
	const saved = { url: env['BACKEND_URL'], path: env['BACKEND_API_PATH'] };

	afterEach(() => {
		for (const [key, value] of [
			['BACKEND_URL', saved.url],
			['BACKEND_API_PATH', saved.path],
		] as const) {
			if (value === undefined) delete env[key];
			else env[key] = value;
		}
	});

	it('defaults to a backend on localhost:8080 under /api', () => {
		delete env['BACKEND_URL'];
		delete env['BACKEND_API_PATH'];
		expect(backendApiUrl()).toBe('http://localhost:8080/api');
	});

	it('is configured through the environment, tolerating slashes', () => {
		env['BACKEND_URL'] = 'http://backend:8080/';
		env['BACKEND_API_PATH'] = 'v1/';
		expect(backendOrigin()).toBe('http://backend:8080');
		expect(backendApiPath()).toBe('/v1');
		expect(backendApiUrl()).toBe('http://backend:8080/v1');
	});

	it('supports a backend served at the root', () => {
		env['BACKEND_API_PATH'] = '';
		expect(backendApiUrl()).toBe(backendOrigin());
	});
});
