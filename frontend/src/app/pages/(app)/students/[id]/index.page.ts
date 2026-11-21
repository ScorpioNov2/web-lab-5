import { RouteMeta } from '@analogjs/router';
import { accessGuard } from '../../../../core/auth/access.guard';
import { StudentViewRoute } from '../../../../features/students/student-routes/student-view-route';
import { studentResolver } from '../../../../features/students/student.resolvers';

// Dynamic route: /students/:id (the id is the student's ISU ID)
export const routeMeta = {
	title: (route) => `Студент ${route.paramMap.get('id')} - Система Заявок Студентов`,
	canActivate: [accessGuard],
	resolve: { result: studentResolver },
	// run the resolver again on every navigation to this route, also to the same URL ("reload")
	runGuardsAndResolvers: 'always',
} satisfies RouteMeta;

export default StudentViewRoute;
