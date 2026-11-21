import { RouteMeta } from '@analogjs/router';
import { Component } from '@angular/core';
import { injectStatusSetter } from '../core/ssr/http-status';
import { ErrorState } from '../shared/ui/error-state/error-state';

export const routeMeta = {
	title: 'Нет доступа - Система Заявок Студентов',
} satisfies RouteMeta;

/** HTTP 403: the user is signed in, but their role does not allow this page. */
@Component({
	selector: 'app-forbidden-page',
	imports: [ErrorState],
	template: `<app-error-state
		[status]="403"
		message="Эта страница доступна только администратору. Если доступ нужен, обратитесь к администратору системы."
	/>`,
})
export default class ForbiddenPage {
	constructor() {
		injectStatusSetter()(403);
	}
}
