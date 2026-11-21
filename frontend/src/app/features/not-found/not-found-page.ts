import { DOCUMENT, Location } from '@angular/common';
import {
	afterNextRender,
	Component,
	DestroyRef,
	ElementRef,
	inject,
	signal,
	viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { injectStatusSetter } from '../../core/ssr/http-status';
import { AuthModalService } from '../auth/auth-modal.service';

/**
 * Class on <html> while a full-screen page is shown: the shell hides its header, theme frame and
 * falling effect (see styles/_base.scss), so they neither show through nor take keyboard focus.
 */
export const STANDALONE_PAGE_CLASS = 'standalone-page';

/** The picture could not be loaded (missing file, network error). */
export function isBrokenImage(image: HTMLImageElement): boolean {
	return image.complete && image.naturalWidth === 0;
}

/** HTTP 404: the full-screen "page not found" screen (any address no route matches). */
@Component({
	selector: 'app-not-found-page',
	imports: [RouterLink],
	templateUrl: './not-found-page.html',
	styleUrl: './not-found-page.scss',
})
export class NotFoundPage {
	private readonly document = inject(DOCUMENT);
	private readonly location = inject(Location);
	private readonly router = inject(Router);

	/** The artwork failed to load: the built-in planet is drawn instead. */
	protected readonly imageFailed = signal(false);
	private readonly artwork = viewChild<ElementRef<HTMLImageElement>>('artwork');

	constructor() {
		// The server answers with the real status code, not "200 OK" with a not-found page.
		injectStatusSetter()(404);

		// A login popup left open (e.g. the browser's Back button led here) would stay on top of this
		// page with no header to reopen or close it from.
		inject(AuthModalService).close();

		const root = this.document.documentElement;
		root.classList.add(STANDALONE_PAGE_CLASS);
		inject(DestroyRef).onDestroy(() => root.classList.remove(STANDALONE_PAGE_CLASS));

		// The picture may have failed before the page became interactive (the `error` event is
		// gone by then): look at its state once, as soon as the browser has the page.
		afterNextRender(() => {
			const image = this.artwork()?.nativeElement;
			if (image && isBrokenImage(image)) this.imageFailed.set(true);
		});
	}

	/** "Вернуться назад"; a page opened directly has no history, so it goes home instead. */
	protected back(): void {
		const history = this.document.defaultView?.history;
		if (history && history.length > 1) this.location.back();
		else void this.router.navigateByUrl('/');
	}
}
