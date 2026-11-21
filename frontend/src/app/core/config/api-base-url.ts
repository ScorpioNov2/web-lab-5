import { isPlatformServer } from '@angular/common';
import { inject, InjectionToken, PLATFORM_ID } from '@angular/core';
import { backendApiUrl } from './backend-url';

/** Path of the same-origin proxy (src/server/routes/api) the browser talks to. */
export const BROWSER_API_PATH = '/api';

/**
 * The single place where the backend address is declared.
 *  - browser: the same-origin `/api` proxy (no CORS, the cookie stays first-party)
 *  - server (SSR): the backend itself, reached directly over the internal network
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
	providedIn: 'root',
	factory: () => (isPlatformServer(inject(PLATFORM_ID)) ? backendApiUrl() : BROWSER_API_PATH),
});
