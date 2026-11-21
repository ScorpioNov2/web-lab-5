import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describeStatus, ErrorState } from './error-state';

describe('describeStatus', () => {
	it('sends a signed-out user to login, the others back to the list', () => {
		expect(describeStatus(401).action.url).toBe('/login');
		for (const status of [403, 404, 500])
			expect(describeStatus(status).action.url).toBe('/students');
	});

	it('offers a retry only where retrying can help', () => {
		for (const status of [0, 502, 503, 504, 500])
			expect(describeStatus(status).canRetry).toBe(true);
		for (const status of [401, 403, 404]) expect(describeStatus(status).canRetry).toBe(false);
	});
});

describe('ErrorState', () => {
	function render(status: number, message = '', retryable = true) {
		TestBed.configureTestingModule({ providers: [provideRouter([])] });
		const fixture = TestBed.createComponent(ErrorState);
		fixture.componentRef.setInput('status', status);
		fixture.componentRef.setInput('message', message);
		fixture.componentRef.setInput('retryable', retryable);
		fixture.detectChanges();
		return fixture;
	}

	it('shows the status, its title and its default hint', () => {
		const text = (render(404).nativeElement as HTMLElement).textContent!;
		expect(text).toContain('Ничего не найдено');
		expect(text).toContain('(404)');
	});

	it('shows a custom message instead of the default hint', () => {
		const text = (render(404, 'Студента нет в базе').nativeElement as HTMLElement).textContent!;
		expect(text).toContain('Студента нет в базе');
		expect(text).not.toContain('Проверьте адрес');
	});

	it('emits retry from the "Повторить" button of a failure that may be temporary', () => {
		const fixture = render(503);
		const retried = vi.fn();
		fixture.componentInstance.retry.subscribe(retried);
		const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
		expect(button.textContent).toContain('Повторить');
		button.click();
		expect(retried).toHaveBeenCalledTimes(1);
	});

	it('has no retry button for a 404, or when the page says it is not retryable', () => {
		expect((render(404).nativeElement as HTMLElement).querySelector('button')).toBeNull();
		TestBed.resetTestingModule();
		expect(
			(render(503, '', false).nativeElement as HTMLElement).querySelector('button'),
		).toBeNull();
	});

	it('hides the status number when the request never reached a server (status 0)', () => {
		const text = (render(0).nativeElement as HTMLElement).textContent!;
		expect(text).toContain('Сервер недоступен');
		expect(text).not.toContain('(0)');
	});
});
