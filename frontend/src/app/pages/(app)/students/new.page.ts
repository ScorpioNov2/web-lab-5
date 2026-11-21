import { RouteMeta } from '@analogjs/router';
import { accessGuard } from '../../../core/auth/access.guard';
import { StudentAddRoute } from '../../../features/students/student-routes/student-add-route';

// ADMIN only: enforced by accessGuard (client) and the Nitro middleware (server)
export const routeMeta = {
	title: 'Новый студент - Система Заявок Студентов',
	canActivate: [accessGuard],
} satisfies RouteMeta;

export default StudentAddRoute;
