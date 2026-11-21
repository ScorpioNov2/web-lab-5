import { RouteMeta } from '@analogjs/router';
import { accessGuard } from '../core/auth/access.guard';
import { GuestPage } from '../features/auth/guest-page/guest-page';

export const routeMeta = {
	title: 'Вход - Система Заявок Студентов',
	canActivate: [accessGuard],
	data: { mode: 'login' },
} satisfies RouteMeta;

export default GuestPage;
