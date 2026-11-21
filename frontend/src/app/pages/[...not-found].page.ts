import { RouteMeta } from '@analogjs/router';
import { Component } from '@angular/core';
import { injectStatusSetter } from '../core/ssr/http-status';
import { ErrorState } from '../shared/ui/error-state/error-state';

export const routeMeta = {
	title: 'Страница не найдена - Система Заявок Студентов',
} satisfies RouteMeta;

/** HTTP 404 for every address no page matches. */
@Component({
	selector: 'app-not-found-page',
	imports: [ErrorState],
	template: `<app-error-state [status]="404" />`,
})
export default class NotFoundPage {
	constructor() {
		injectStatusSetter()(404);
	}
}
