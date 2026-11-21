import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, tap } from 'rxjs';
import { CacheOptions, DataCache } from '../../core/cache/data-cache';
import { API_BASE_URL } from '../../core/config/api-base-url';
import { PagedResponse, PagedResponseDto, toPagedResponse } from '../../core/models/paged-response';
import {
	Student,
	StudentDto,
	StudentPayload,
	StudentSearchRequest,
	toStudent,
} from './student.model';

/** Every cache key of this API starts with it; a mutation drops them all. */
export const STUDENTS_CACHE_PREFIX = 'students:';

/** (?page=0&size=20...) - skips null/undefined/empty values, same as the old toQueryString(). */
export function toSearchParams(request: StudentSearchRequest): HttpParams {
	const query: Record<string, unknown> = {
		search: request.search,
		fullName: request.fullName,
		groupName: request.groupName,
		isuId: request.isuId,
		dormitoryNumber: request.dormitoryNumber,
		foreigner: request.foreigner,
		page: request.page ?? 0,
		size: request.size ?? 20,
		sortBy: request.sortBy,
		sortDirection: request.sortDirection,
	};

	let params = new HttpParams();
	for (const [key, value] of Object.entries(query)) {
		if (value !== null && value !== undefined && value !== '') {
			params = params.set(key, String(value));
		}
	}
	return params;
}

/** Only the known fields go over the wire. */
function toPayload(data: StudentPayload): StudentPayload {
	return {
		fullName: data.fullName,
		groupName: data.groupName,
		isuId: data.isuId,
		dormitoryNumber: data.dormitoryNumber,
		roomNumber: data.roomNumber,
		settlementTerm: data.settlementTerm,
		foreigner: data.foreigner,
		notes: data.notes,
	};
}

/**
 * Students REST API. Reads go through the DataCache (the cache keeps the raw DTO, which is plain
 * JSON and can travel from the server render to the browser); every write invalidates the cached
 * students, so the next read is fresh.
 */
@Injectable({ providedIn: 'root' })
export class StudentApi {
	private readonly http = inject(HttpClient);
	private readonly cache = inject(DataCache);
	private readonly url = `${inject(API_BASE_URL)}/students`;

	/** Получить список студентов (GET с пагинацией и фильтрами) */
	search(
		request: StudentSearchRequest,
		options?: CacheOptions,
	): Observable<PagedResponse<Student>> {
		const params = toSearchParams(request);
		return this.cache
			.get(
				`${STUDENTS_CACHE_PREFIX}list?${params.toString()}`,
				() => this.http.get<PagedResponseDto<StudentDto>>(this.url, { params }),
				options,
			)
			.pipe(map((dto) => toPagedResponse(dto, toStudent)));
	}

	/** Получить детальную информацию о студенте по ISU ID (GET) */
	getByIsuId(isuId: number, options?: CacheOptions): Observable<Student> {
		return this.cache
			.get(
				`${STUDENTS_CACHE_PREFIX}item:${isuId}`,
				() => this.http.get<StudentDto>(`${this.url}/${isuId}`),
				options,
			)
			.pipe(map(toStudent));
	}

	/** Warm the cache before the user opens a student (hover over a link). Errors are ignored. */
	prefetch(isuId: number): void {
		this.getByIsuId(isuId).subscribe({ error: () => undefined });
	}

	/** Создать нового студента (POST) */
	create(data: StudentPayload): Observable<Student> {
		return this.http
			.post<StudentDto>(this.url, toPayload(data))
			.pipe(this.invalidateStudents(), map(toStudent));
	}

	/**
	 * Обновить информацию о студенте по ISU ID (PATCH)
	 * @param isuId ТЕКУЩИЙ ISU ID студента (в data.isuId может прийти новый)
	 */
	update(isuId: number, data: StudentPayload): Observable<Student> {
		return this.http
			.patch<StudentDto>(`${this.url}/${isuId}`, toPayload(data))
			.pipe(this.invalidateStudents(), map(toStudent));
	}

	/** Удалить студента по ISU ID (DELETE) */
	delete(isuId: number): Observable<void> {
		return this.http.delete<void>(`${this.url}/${isuId}`).pipe(this.invalidateStudents());
	}

	/** Event-based revalidation: after a successful write nothing cached about students is trusted. */
	private invalidateStudents<T>() {
		return tap<T>(() => this.cache.invalidate(STUDENTS_CACHE_PREFIX));
	}
}
