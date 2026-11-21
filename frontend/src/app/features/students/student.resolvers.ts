import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { of } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { Loaded, loadedError, toLoaded } from '../../core/http/loaded';
import { PagedResponse } from '../../core/models/paged-response';
import { injectStatusSetter, setStatusOnError } from '../../core/ssr/http-status';
import { readCriteria, toSearchRequest } from './student-criteria';
import { StudentApi } from './student.api';
import { Student } from './student.model';

/**
 * Route-level data loading. A resolver runs BEFORE the page is shown: on the server for the first
 * render (so the HTML already contains the data), in the browser for in-app navigation. Failures
 * are returned as values (never thrown) and set the HTTP status of the server response.
 */

/** /students: the page of students described by the URL query. */
export const studentsResolver: ResolveFn<Loaded<PagedResponse<Student>>> = (route) => {
	const setStatus = injectStatusSetter();
	const request = toSearchRequest(readCriteria(route.queryParamMap));

	return toLoaded(inject(StudentApi).search(request)).pipe(setStatusOnError(setStatus));
};

/** Valid ISU ID: a positive integer that fits a JS number exactly. */
export function parseIsuId(raw: string | null): number | null {
	if (raw === null || !/^[1-9]\d{0,14}$/.test(raw)) return null;
	return Number(raw);
}

/** /students/[id] and /students/[id]/edit: one student. */
export const studentResolver: ResolveFn<Loaded<Student>> = (route) => {
	const setStatus = injectStatusSetter();
	const api = inject(StudentApi);
	const isuId = parseIsuId(route.paramMap.get('id'));

	// "/students/abc" cannot exist: answer 404 without bothering the backend.
	const loaded$ =
		isuId === null
			? of(loadedError<Student>(new ApiError('Некорректный ИСУ ID', 404)))
			: toLoaded(api.getByIsuId(isuId));

	return loaded$.pipe(setStatusOnError(setStatus));
};
