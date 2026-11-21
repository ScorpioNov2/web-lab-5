import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT } from '@angular/common';
import {
	afterNextRender,
	Component,
	computed,
	DestroyRef,
	effect,
	ElementRef,
	inject,
	input,
	linkedSignal,
	PLATFORM_ID,
	signal,
	untracked,
	viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import {
	catchError,
	distinctUntilChanged,
	EMPTY,
	filter,
	finalize,
	firstValueFrom,
	from,
	interval,
	map,
	Subject,
	switchMap,
	tap,
	timer,
} from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { DataCache } from '../../../core/cache/data-cache';
import { errorMessage } from '../../../core/http/api-error';
import { Loaded, loadedOk } from '../../../core/http/loaded';
import { PagedResponse } from '../../../core/models/paged-response';
import { AlertService } from '../../../shared/ui/alert/alert.service';
import { ErrorState } from '../../../shared/ui/error-state/error-state';
import { LoadingOverlay } from '../../../shared/ui/loading/loading-overlay';
import { LoadingService } from '../../../shared/ui/loading/loading.service';
import { Pagination } from '../../../shared/ui/pagination/pagination';
import {
	clampPage,
	nextSort,
	readCriteria,
	StudentCriteria,
	toQueryParams,
	toSearchRequest,
} from '../student-criteria';
import { StudentModal, StudentModalState } from '../student-modal/student-modal';
import { StudentTable } from '../student-table/student-table';
import { STUDENTS_CACHE_PREFIX, StudentApi } from '../student.api';
import { Student } from '../student.model';

/** Pause after the last keystroke before the search is sent. */
const SEARCH_DEBOUNCE_MS = 1000;
/** Time-based revalidation: how often the open table is silently refreshed in the browser. */
export const AUTO_REFRESH_MS = 5000;

/**
 * The students screen: toolbar, table, pagination. It is the LAYOUT of the student routes: the
 * add / view / edit popups and the profile popup are child routes rendered in its outlet, so the
 * table stays on screen behind them. The criteria live in the URL query; the route's resolver
 * loads the page of students (on the server for the first render).
 */
@Component({
	selector: 'app-students-page',
	imports: [RouterOutlet, StudentTable, Pagination, LoadingOverlay, ErrorState, StudentModal],
	templateUrl: './students-page.html',
	styleUrl: './students-page.scss',
	host: { '(document:click)': 'onDocumentClick($event)' },
})
export class StudentsPage {
	private readonly api = inject(StudentApi);
	private readonly cache = inject(DataCache);
	private readonly alert = inject(AlertService);
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);
	private readonly destroyRef = inject(DestroyRef);
	private readonly document = inject(DOCUMENT);
	private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	protected readonly loading = inject(LoadingService);
	protected readonly auth = inject(AuthService);

	/** The resolver's answer (`resolve: { result: studentsResolver }`), bound by the router. */
	readonly result = input.required<Loaded<PagedResponse<Student>>>();

	protected readonly criteria = toSignal(this.route.queryParamMap.pipe(map(readCriteria)), {
		initialValue: readCriteria(this.route.snapshot.queryParamMap),
	});

	/** What the table shows: the resolver's data, replaced silently by background refreshes. */
	private readonly live = linkedSignal<Loaded<PagedResponse<Student>>>(() => this.result());

	protected readonly error = computed(() => {
		const live = this.live();
		return live.ok ? null : live.error;
	});
	private readonly page = computed(() => {
		const live = this.live();
		return live.ok ? live.data : null;
	});
	protected readonly students = computed(() => this.page()?.content ?? []);
	protected readonly totalStudents = computed(() => this.page()?.totalElements ?? 0);
	protected readonly totalPages = computed(() => this.page()?.totalPages || 1);

	/** ISU ID of the selected row */
	protected readonly focusedIsuId = signal<number | null>(null);

	/** The popup opened by the "Удаление" button (view popup with the confirmation already shown). */
	protected readonly deleteState = signal<StudentModalState | null>(null);

	private readonly tableContainer = viewChild.required<ElementRef<HTMLElement>>('tableContainer');
	private readonly search$ = new Subject<string>();

	constructor() {
		// Search: wait for the user to stop typing, then put the keyword into the URL.
		this.search$
			.pipe(
				map((keyword) => keyword.trim()),
				distinctUntilChanged(),
				// Show the loader from the first keystroke, not only when the request starts
				tap(() => this.loading.show()),
				switchMap((searchKeyword) =>
					timer(SEARCH_DEBOUNCE_MS).pipe(
						switchMap(() => from(this.navigate({ searchKeyword, pageNumber: 1 }))),
						finalize(() => this.loading.hide()),
					),
				),
				takeUntilDestroyed(),
			)
			.subscribe();

		// Revalidation by event: any add / edit / delete drops the cached students, and the open
		// table re-reads its page right away (behind the popup that is closing).
		this.cache.invalidated$
			.pipe(
				filter((prefix) => prefix === STUDENTS_CACHE_PREFIX),
				switchMap(() => this.fetchCurrentPage()),
				takeUntilDestroyed(),
			)
			.subscribe((page) => this.live.set(loadedOk(page)));

		// A page that does not exist (the last student of the last page was deleted, or a
		// hand-typed ?page=99) is replaced by the nearest one. Browser only: the server render
		// must show exactly what the URL says, otherwise hydration would not match.
		effect(() => {
			const page = this.page();
			const current = this.criteria().pageNumber;
			if (!this.isBrowser || !page) return;
			const target = clampPage(current, page.totalPages);
			if (target !== current) {
				untracked(() => void this.navigate({ pageNumber: target }));
			}
		});

		// Browser only (afterNextRender never runs during server rendering).
		afterNextRender(() => this.startAutoRefresh());
	}

	/** Revalidation by time: re-read the current page every few seconds, without any loader. */
	private startAutoRefresh(): void {
		interval(AUTO_REFRESH_MS)
			.pipe(
				filter(() => !this.document.hidden && !this.loading.isLoading()),
				switchMap(() => this.fetchCurrentPage()),
				takeUntilDestroyed(this.destroyRef),
			)
			.subscribe((page) => this.live.set(loadedOk(page)));
	}

	private fetchCurrentPage() {
		return this.api
			.search(toSearchRequest(this.criteria()), { force: true })
			.pipe(catchError(() => EMPTY));
	}

	// ---------- toolbar ----------

	protected onSearch(event: Event): void {
		this.search$.next((event.target as HTMLInputElement).value);
	}

	protected openAdd(): void {
		void this.router.navigate(['/students', 'new'], { queryParamsHandling: 'preserve' });
	}

	protected editSelected(): void {
		const isuId = this.focusedIsuId();
		if (isuId !== null) this.openEdit(isuId);
		else this.alert.error('Пожалуйста, выберите студента!');
	}

	/** Delete from the toolbar: open the student's popup with the confirmation already shown. */
	protected async deleteSelected(): Promise<void> {
		const isuId = this.focusedIsuId();
		if (isuId === null) {
			this.alert.error('Пожалуйста, выберите (кликните) студента в таблице для удаления!');
			return;
		}

		try {
			const student = await firstValueFrom(this.api.getByIsuId(isuId));
			this.deleteState.set({ mode: 'view', student, confirmDelete: true });
		} catch (error) {
			this.alert.error(errorMessage(error, 'Не удалось загрузить данные студента.'));
		}
	}

	// ---------- table & pagination ----------

	protected onSort(field: string): void {
		void this.navigate({ ...nextSort(this.criteria(), field), pageNumber: 1 });
	}

	protected onPageChange(pageNumber: number): void {
		void this.navigate({ pageNumber });
	}

	protected prefetch(isuId: number): void {
		this.api.prefetch(isuId);
	}

	/** Double click on a row: open the read-only popup (the /students/:id route). */
	protected openDetails(isuId: number): void {
		void this.router.navigate(['/students', isuId], { queryParamsHandling: 'preserve' });
	}

	private openEdit(isuId: number): void {
		void this.router.navigate(['/students', isuId, 'edit'], {
			queryParamsHandling: 'preserve',
		});
	}

	/** A click outside of the table drops the row selection. */
	protected onDocumentClick(event: MouseEvent): void {
		if (!this.tableContainer().nativeElement.contains(event.target as Node)) {
			this.focusedIsuId.set(null);
		}
	}

	// ---------- the delete popup of the toolbar ----------

	protected closeDeletePopup(): void {
		this.deleteState.set(null);
	}

	/** "Обновить" inside the delete popup: continue on the edit route. */
	protected editFromDeletePopup(isuId: number): void {
		this.deleteState.set(null);
		this.openEdit(isuId);
	}

	protected async deleteStudent(isuId: number): Promise<void> {
		this.deleteState.set(null); // the popup closes right away
		try {
			await firstValueFrom(this.api.delete(isuId));
			this.alert.success('Студент успешно удален.');
			this.focusedIsuId.set(null);
			// The delete dropped the cached students: the table re-reads itself (invalidated$).
		} catch (error) {
			this.alert.error(errorMessage(error, 'Не удалось удалить студента.'));
		}
	}

	/** "Повторить" after a failed load */
	protected reload(): void {
		this.fetchCurrentPage().subscribe((page) => this.live.set(loadedOk(page)));
	}

	/** Put new criteria into the URL; the route re-runs its resolver and the table updates. */
	private navigate(changes: Partial<StudentCriteria>): Promise<boolean> {
		return this.router.navigate([], {
			queryParams: toQueryParams({ ...this.criteria(), ...changes }),
			queryParamsHandling: 'merge',
			replaceUrl: true,
		});
	}
}
