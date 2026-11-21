import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthModalService } from '../auth/auth-modal.service';
import { isBrokenImage, NotFoundPage, STANDALONE_PAGE_CLASS } from './not-found-page';

describe('NotFoundPage', () => {
	let fixture: ComponentFixture<NotFoundPage>;
	const root = () => fixture.nativeElement as HTMLElement;
	const html = () => document.documentElement;

	function historyLength(length: number) {
		Object.defineProperty(window.history, 'length', { value: length, configurable: true });
	}

	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideRouter([])] });
		fixture = TestBed.createComponent(NotFoundPage);
		fixture.detectChanges();
	});

	afterEach(() => {
		fixture.destroy();
		delete (window.history as { length?: number }).length;
	});

	it('shows the code, the title, the text and both buttons', () => {
		const text = root().textContent!;
		expect(text).toContain('ОШИБКА 404');
		expect(root().querySelector('h1')!.textContent).toContain('Страница не найдена');
		expect(text).toContain('затерялась в открытом космосе');
		expect(root().querySelector('a')!.textContent).toContain('На главную');
		expect(root().querySelector('button')!.textContent).toContain('Вернуться назад');
	});

	it('"На главную" is a link to the root page', () => {
		expect(root().querySelector('a')!.getAttribute('href')).toBe('/');
	});

	it('uses the artwork the project provides (assets/app/404-image.png)', () => {
		expect(root().querySelector('img')!.getAttribute('src')).toBe('/assets/app/404-image.png');
		expect(root().querySelector('svg.artwork')).toBeNull();
	});

	it('draws the built-in planet when the artwork cannot be loaded', () => {
		root().querySelector('img')!.dispatchEvent(new Event('error'));
		fixture.detectChanges();
		expect(root().querySelector('img')).toBeNull();
		expect(root().querySelector('svg.artwork')).not.toBeNull();
	});

	it('marks <html> as a full-screen page while it is open, and only then', () => {
		expect(html().classList.contains(STANDALONE_PAGE_CLASS)).toBe(true);
		fixture.destroy();
		expect(html().classList.contains(STANDALONE_PAGE_CLASS)).toBe(false);
	});

	it('closes a login popup that was left open: it would sit on top of this page', () => {
		const modal = TestBed.inject(AuthModalService);
		fixture.destroy();
		modal.open('login');
		fixture = TestBed.createComponent(NotFoundPage);
		fixture.detectChanges();
		expect(modal.mode()).toBeNull();
	});

	describe('"Вернуться назад"', () => {
		it('goes back when there is a page to go back to', () => {
			historyLength(3);
			const back = vi
				.spyOn(TestBed.inject(Location), 'back')
				.mockImplementation(() => undefined);
			root().querySelector('button')!.click();
			expect(back).toHaveBeenCalledTimes(1);
		});

		it('goes to the root page when the 404 was opened directly (nothing to go back to)', () => {
			historyLength(1);
			const back = vi
				.spyOn(TestBed.inject(Location), 'back')
				.mockImplementation(() => undefined);
			const navigate = vi
				.spyOn(TestBed.inject(Router), 'navigateByUrl')
				.mockResolvedValue(true);
			root().querySelector('button')!.click();
			expect(back).not.toHaveBeenCalled();
			expect(navigate).toHaveBeenCalledWith('/');
		});
	});
});

describe('isBrokenImage', () => {
	const image = (complete: boolean, naturalWidth: number) =>
		({ complete, naturalWidth }) as HTMLImageElement;

	it('is true only for an image that finished loading with nothing to show', () => {
		expect(isBrokenImage(image(true, 0))).toBe(true);
		expect(isBrokenImage(image(true, 240))).toBe(false); // loaded fine
		expect(isBrokenImage(image(false, 0))).toBe(false); // still loading
	});
});
