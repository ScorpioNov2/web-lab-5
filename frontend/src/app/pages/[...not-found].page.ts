import { RouteMeta } from '@analogjs/router';
import { NotFoundPage } from '../features/not-found/not-found-page';

export const routeMeta = {
	title: '404 — Страница не найдена',
} satisfies RouteMeta;

// Every address no other page matches. The component sets the HTTP status to 404.
export default NotFoundPage;
