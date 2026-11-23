import { TestBed } from '@angular/core/testing';
import { ThemeService } from '../theme.service';
import { FallingEffect } from './falling-effect';

describe('FallingEffect', () => {
	let cssVariables: Record<string, string>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.spyOn(Math, 'random').mockReturnValue(0.5); // fall 6.5 s after a 2 s delay
		cssVariables = { '--has-falling-effect': 'true', '--theme-falling-item-count': '7' };
		TestBed.configureTestingModule({
			providers: [
				{
					provide: ThemeService,
					useValue: { cssVariable: (name: string) => cssVariables[name] ?? '' },
				},
			],
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	const items = (root: HTMLElement) => root.querySelectorAll<HTMLElement>('.falling-item');

	it('spawns items while the theme has the effect, capped at 25', () => {
		const fixture = TestBed.createComponent(FallingEffect);
		const root: HTMLElement = fixture.nativeElement;

		vi.advanceTimersByTime(350);
		fixture.detectChanges();
		expect(items(root)).toHaveLength(1);
		expect(items(root)[0].dataset['index']).toBe('4'); // floor(0.5 * 6) + 1
		expect(items(root)[0].style.animationDelay).toBe('2s, 0s');

		vi.advanceTimersByTime(350 * 60);
		fixture.detectChanges();
		expect(items(root).length).toBeLessThanOrEqual(25);
	});

	it('lands an item, lets it lie there, fades it out and removes it', () => {
		const fixture = TestBed.createComponent(FallingEffect);
		const root: HTMLElement = fixture.nativeElement;

		vi.advanceTimersByTime(350);
		cssVariables['--has-falling-effect'] = 'false'; // no further items: follow just the first one
		fixture.detectChanges();
		expect(items(root)).toHaveLength(1);

		vi.advanceTimersByTime(8500); // delay 2 s + fall 6.5 s
		fixture.detectChanges();
		expect(items(root)[0].classList.contains('landed')).toBe(true);
		expect(items(root)[0].style.transform).toBe('rotate(180deg)');

		vi.advanceTimersByTime(4000);
		fixture.detectChanges();
		expect(items(root)[0].style.opacity).toBe('0');

		vi.advanceTimersByTime(1000);
		fixture.detectChanges();
		expect(items(root)).toHaveLength(0);
	});

	describe('theme settings', () => {
		/** Spawns items for a while and returns what ended up on screen. */
		function spawned(random: number, spawns = 1) {
			vi.spyOn(Math, 'random').mockReturnValue(random);
			const fixture = TestBed.createComponent(FallingEffect);
			vi.advanceTimersByTime(350 * spawns);
			fixture.detectChanges();
			return Array.from(
				fixture.nativeElement.querySelectorAll('.falling-item') as NodeListOf<HTMLElement>,
			);
		}

		it('uses all the sprites of a bigger set (16): the last one stays for the ground', () => {
			cssVariables['--theme-falling-item-count'] = '16';
			expect(spawned(0)[0].dataset['index']).toBe('1');
			TestBed.resetTestingModule();
			// the highest random value still gives sprite 15, never 16
			TestBed.configureTestingModule({
				providers: [
					{
						provide: ThemeService,
						useValue: { cssVariable: (n: string) => cssVariables[n] ?? '' },
					},
				],
			});
			expect(spawned(0.999)[0].dataset['index']).toBe('15');
		});

		it('never uses a sprite number the stylesheet has no rule for (max 24)', () => {
			cssVariables['--theme-falling-item-count'] = '99';
			expect(spawned(0.999)[0].dataset['index']).toBe('23');
		});

		it('takes size and fall time from the theme (snow is small and slow)', () => {
			Object.assign(cssVariables, {
				'--theme-falling-size-min': '14',
				'--theme-falling-size-max': '34',
				'--theme-falling-fall-min': '7',
				'--theme-falling-fall-max': '14',
			});
			const [small] = spawned(0);
			expect(small.style.width).toBe('14px');
			expect(small.style.animationDuration.startsWith('7s,')).toBe(true);
			TestBed.resetTestingModule();
			TestBed.configureTestingModule({
				providers: [
					{
						provide: ThemeService,
						useValue: { cssVariable: (n: string) => cssVariables[n] ?? '' },
					},
				],
			});
			const [big] = spawned(0.999);
			expect(parseFloat(big.style.width)).toBeCloseTo(34, 0);
			expect(parseFloat(big.style.animationDuration)).toBeCloseTo(14, 0);
		});

		it('takes the number of objects on screen from the theme', () => {
			cssVariables['--theme-falling-max-items'] = '3';
			expect(spawned(0.5, 40)).toHaveLength(3);
		});

		it('ignores nonsense values and keeps the defaults', () => {
			Object.assign(cssVariables, {
				'--theme-falling-size-min': 'big',
				'--theme-falling-size-max': '-5',
				'--theme-falling-max-items': '0',
			});
			const [item] = spawned(0.5);
			expect(item.style.width).toBe('30px'); // default 20..40 at 0.5
		});

		it('a maximum below the minimum cannot turn the range upside down', () => {
			Object.assign(cssVariables, {
				'--theme-falling-size-min': '30',
				'--theme-falling-size-max': '10',
			});
			expect(spawned(0.5)[0].style.width).toBe('30px');
		});
	});

	it('spawns nothing when the theme has no falling effect', () => {
		cssVariables['--has-falling-effect'] = '';
		const fixture = TestBed.createComponent(FallingEffect);
		vi.advanceTimersByTime(5000);
		fixture.detectChanges();
		expect(items(fixture.nativeElement)).toHaveLength(0);
	});

	it('stops all timers when destroyed', () => {
		const fixture = TestBed.createComponent(FallingEffect);
		vi.advanceTimersByTime(1000);
		expect(vi.getTimerCount()).toBeGreaterThan(0);

		fixture.destroy();
		expect(vi.getTimerCount()).toBe(0);
	});
});
