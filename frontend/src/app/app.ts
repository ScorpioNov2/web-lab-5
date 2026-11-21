import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
	NavigationCancel,
	NavigationEnd,
	NavigationError,
	NavigationSkipped,
	NavigationStart,
	Router,
	RouterOutlet,
} from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { SESSION_EXPIRED_MESSAGE } from './core/http/api-error';
import { AuthModal } from './features/auth/auth-modal/auth-modal';
import { Header } from './layout/header/header';
import { AlertContainer } from './shared/ui/alert/alert-container';
import { AlertService } from './shared/ui/alert/alert.service';
import { LoadingService } from './shared/ui/loading/loading.service';
import { FallingEffect } from './theme/falling-effect/falling-effect';
import { ThemeFrame } from './theme/theme-frame/theme-frame';
import { WelcomePigeon } from './theme/welcome-pigeon/welcome-pigeon';

/** Application shell: themed page frame, header, the routed screen and the global overlays. */
@Component({
	selector: 'app-root',
	imports: [
		RouterOutlet,
		Header,
		ThemeFrame,
		FallingEffect,
		AuthModal,
		AlertContainer,
		WelcomePigeon,
	],
	templateUrl: './app.html',
	styleUrl: './app.scss',
})
export class App {
	private readonly router = inject(Router);
	private readonly auth = inject(AuthService);
	private readonly alert = inject(AlertService);
	protected readonly loading = inject(LoadingService);

	constructor() {
		// Loading state: a navigation is "loading" while its resolvers fetch data. The first
		// navigation (id 1) is skipped: it is the page the server already rendered.
		const tracked = new Set<number>();
		this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
			if (event instanceof NavigationStart && event.id !== 1) {
				tracked.add(event.id);
				this.loading.show();
			} else if (
				(event instanceof NavigationEnd ||
					event instanceof NavigationCancel ||
					event instanceof NavigationError ||
					event instanceof NavigationSkipped) &&
				tracked.delete(event.id)
			) {
				this.loading.hide();
			}
		});

		// The refresh token no longer works: back to the login page, then return here.
		this.auth.sessionExpired$.pipe(takeUntilDestroyed()).subscribe(() => {
			this.alert.info(SESSION_EXPIRED_MESSAGE);
			this.router.navigate(['/login'], { queryParams: { redirect: this.router.url } });
		});
	}
}
