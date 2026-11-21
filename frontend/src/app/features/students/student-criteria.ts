import { ParamMap, Params } from '@angular/router';
import { StudentSearchRequest } from './student.model';

export type SortDirection = 'asc' | 'desc' | '';

/** Rows in one page of the table. */
export const ROWS_PER_PAGE = 10;

/** Everything that defines which students the table shows. Mirrored into the URL query. */
export interface StudentCriteria {
	searchKeyword: string;
	sortField: string;
	/** Circle: asc -> desc -> '' (off) */
	sortDirection: SortDirection;
	/** 1-based */
	pageNumber: number;
}

export const DEFAULT_CRITERIA: StudentCriteria = {
	searchKeyword: '',
	sortField: '',
	sortDirection: 'asc',
	pageNumber: 1,
};

/** Read the entire criteria from the URL query (was UrlStateManager.loadCriteriaFromUrl). */
export function readCriteria(params: ParamMap): StudentCriteria {
	const direction = params.get('direction');
	const page = Math.floor(Number(params.get('page')));

	return {
		searchKeyword: params.get('search') ?? DEFAULT_CRITERIA.searchKeyword,
		sortField: params.get('sort') ?? DEFAULT_CRITERIA.sortField,
		sortDirection:
			direction === 'asc' || direction === 'desc'
				? direction
				: DEFAULT_CRITERIA.sortDirection,
		pageNumber: page >= 1 ? page : DEFAULT_CRITERIA.pageNumber,
	};
}

/** Query params for the URL; `null` removes a param (was UrlStateManager.saveCriteriaToUrl). */
export function toQueryParams(criteria: StudentCriteria): Params {
	const hasSort = !!criteria.sortField && !!criteria.sortDirection;
	return {
		page: criteria.pageNumber,
		search: criteria.searchKeyword.trim() || null,
		sort: hasSort ? criteria.sortField : null,
		direction: hasSort ? criteria.sortDirection : null,
	};
}

/** The backend query (0-based page) for the criteria of the screen. */
export function toSearchRequest(criteria: StudentCriteria): StudentSearchRequest {
	// Circle (asc -> desc -> off[isuId])
	const hasSort = !!criteria.sortField && !!criteria.sortDirection;
	return {
		search: criteria.searchKeyword,
		sortBy: hasSort ? criteria.sortField : '',
		sortDirection: hasSort ? criteria.sortDirection : '',
		page: criteria.pageNumber - 1,
		size: ROWS_PER_PAGE,
	};
}

/** Click on a column header: asc -> desc -> off; a different column starts at asc. */
export function nextSort(
	current: Pick<StudentCriteria, 'sortField' | 'sortDirection'>,
	field: string,
): Pick<StudentCriteria, 'sortField' | 'sortDirection'> {
	if (current.sortField !== field) {
		return { sortField: field, sortDirection: 'asc' };
	}
	const sortDirection: SortDirection =
		current.sortDirection === 'asc' ? 'desc' : current.sortDirection === 'desc' ? '' : 'asc';
	return { sortField: field, sortDirection };
}

/**
 * Keeps the page number inside 1..totalPages. After the last student of the last page is deleted
 * (or a hand-typed `?page=99`) the table would be empty: this is the page to show instead.
 */
export function clampPage(currentPage: number, totalPages: number): number {
	return Math.max(1, Math.min(currentPage, totalPages));
}
