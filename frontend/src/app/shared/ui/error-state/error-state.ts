import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

interface StatusView {
	title: string;
	hint: string;
	canRetry: boolean;
	action: { label: string; url: string };
}

const BACK_TO_LIST = { label: 'К списку студентов', url: '/students' };

/** Title, hint and the way out for an HTTP status (shared by every error / 404 / 403 screen). */
export function describeStatus(status: number): StatusView {
	switch (status) {
		case 401:
			return {
				title: 'Нужно войти в систему',
				hint: 'Сессия истекла или недействительна. Войдите снова, чтобы продолжить.',
				canRetry: false,
				action: { label: 'Войти', url: '/login' },
			};
		case 403:
			return {
				title: 'Недостаточно прав',
				hint: 'У вашей учётной записи нет доступа к этой странице.',
				canRetry: false,
				action: BACK_TO_LIST,
			};
		case 404:
			return {
				title: 'Ничего не найдено',
				hint: 'Такой страницы или записи нет. Проверьте адрес или вернитесь к списку.',
				canRetry: false,
				action: BACK_TO_LIST,
			};
		case 0:
		case 502:
		case 503:
		case 504:
			return {
				title: 'Сервер недоступен',
				hint: 'Не удалось связаться с сервером. Проверьте соединение и повторите попытку.',
				canRetry: true,
				action: BACK_TO_LIST,
			};
		default:
			return {
				title: 'Что-то пошло не так',
				hint: 'Запрос не удалось выполнить. Повторите попытку чуть позже.',
				canRetry: true,
				action: BACK_TO_LIST,
			};
	}
}

/** A failed load or a missing page: what happened and what to do next. */
@Component({
	selector: 'app-error-state',
	imports: [RouterLink],
	templateUrl: './error-state.html',
	styleUrl: './error-state.scss',
})
export class ErrorState {
	readonly status = input.required<number>();
	/** Overrides the default hint (e.g. the backend's own message). */
	readonly message = input('');
	readonly retryable = input(true);

	readonly retry = output<void>();

	protected readonly view = computed(() => describeStatus(this.status()));
}
