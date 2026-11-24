import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig)
	.then(async (appRef) => {
		// Wait until Angular is stable.
		await appRef.whenStable();

		// Remove initial loading.
		requestAnimationFrame(() => {
			document.getElementById('initial-loading')?.remove();
		});
	})
	.catch((err) => {
		console.error(err);

		const loader = document.getElementById('initial-loading');

		if (loader) {
			loader.textContent = 'Ошибка загрузки приложения. Обновите страницу.';
		}
	});
