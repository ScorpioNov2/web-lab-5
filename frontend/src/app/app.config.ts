import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
	provideClientHydration,
	withEventReplay,
	withNoHttpTransferCache,
} from '@angular/platform-browser';
import {
	PreloadAllModules,
	withComponentInputBinding,
	withInMemoryScrolling,
	withPreloading,
} from '@angular/router';
import { provideFileRouter } from '@analogjs/router';
import { authInterceptor } from './core/http/auth.interceptor';

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),
		// File-based routes from src/app/pages. Resolver results and path params reach the page
		// components as inputs; lazy route chunks are preloaded in the background (prefetch).
		provideFileRouter(
			withComponentInputBinding(),
			withPreloading(PreloadAllModules),
			withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
		),
		provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
		// Hydration reuses the server-rendered DOM. Data hand-off has its own mechanism
		// (DataCache + TransferState), so Angular's HTTP transfer cache stays off.
		provideClientHydration(withEventReplay(), withNoHttpTransferCache()),
	],
};
