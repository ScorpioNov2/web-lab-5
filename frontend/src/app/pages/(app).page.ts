import { RouteMeta } from '@analogjs/router';
import { accessGuard } from '../core/auth/access.guard';
import { StudentsPage } from '../features/students/students-page/students-page';
import { studentsResolver } from '../features/students/student.resolvers';

/**
 * Pathless layout of everything behind the login: the student table. /students, /students/new,
 * /students/:id, /students/:id/edit and /profile are its children; the popups they show are
 * rendered in the table's <router-outlet>, so the table stays on screen behind them.
 *
 * The students are loaded here once, when the query (page, search, sort) changes. Opening or
 * closing a popup does not load the table again.
 */
export const routeMeta = {
	canActivate: [accessGuard],
	resolve: { result: studentsResolver },
	runGuardsAndResolvers: 'paramsOrQueryParamsChange',
} satisfies RouteMeta;

export default StudentsPage;
