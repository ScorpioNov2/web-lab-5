import { RouteMeta } from '@analogjs/router';
import { accessGuard } from '../../../../core/auth/access.guard';
import { StudentEditRoute } from '../../../../features/students/student-routes/student-edit-route';
import { studentResolver } from '../../../../features/students/student.resolvers';

// ADMIN only: enforced by accessGuard (client) and the Nitro middleware (server)
export const routeMeta = {
	title: (route) => `Редактирование ${route.paramMap.get('id')} - Система Заявок Студентов`,
	canActivate: [accessGuard],
	resolve: { result: studentResolver },
	runGuardsAndResolvers: 'always',
} satisfies RouteMeta;

export default StudentEditRoute;
