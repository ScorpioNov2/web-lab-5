import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { errorMessage } from '../../../core/http/api-error';
import { Loaded } from '../../../core/http/loaded';
import { AlertService } from '../../../shared/ui/alert/alert.service';
import { ErrorState } from '../../../shared/ui/error-state/error-state';
import { ModalShell } from '../../../shared/ui/modal-shell/modal-shell';
import { StudentModal } from '../student-modal/student-modal';
import { StudentApi } from '../student.api';
import { Student } from '../student.model';

/** /students/[id]: the read-only student popup on top of the table (dynamic route). */
@Component({
	selector: 'app-student-view-route',
	imports: [StudentModal, ModalShell, ErrorState],
	template: `
		@if (student(); as student) {
			<app-student-modal
				[state]="{ mode: 'view', student }"
				[canManage]="auth.canManageStudents()"
				(closed)="close()"
				(remove)="remove($event)"
				(switchToEdit)="edit($event)"
			/>
		} @else if (error(); as failure) {
			<app-modal-shell
				[title]="failure.status === 404 ? 'Студент не найден' : 'Информация о студенте'"
				(closed)="close()"
			>
				<app-error-state
					[status]="failure.status"
					[message]="
						failure.status === 404
							? 'Студента с таким ИСУ ID нет в базе. Возможно, его уже удалили.'
							: failure.message
					"
					(retry)="reload()"
				/>
			</app-modal-shell>
		}
	`,
})
export class StudentViewRoute {
	private readonly api = inject(StudentApi);
	private readonly alert = inject(AlertService);
	private readonly router = inject(Router);
	protected readonly auth = inject(AuthService);

	/** The resolver's answer (`resolve: { result: studentResolver }`), bound by the router. */
	readonly result = input.required<Loaded<Student>>();

	protected readonly student = computed(() => {
		const result = this.result();
		return result.ok ? result.data : null;
	});
	protected readonly error = computed(() => {
		const result = this.result();
		return result.ok ? null : result.error;
	});

	protected close(): void {
		void this.router.navigate(['/students'], { queryParamsHandling: 'preserve' });
	}

	protected edit(isuId: number): void {
		void this.router.navigate(['/students', isuId, 'edit'], {
			queryParamsHandling: 'preserve',
		});
	}

	protected reload(): void {
		void this.router.navigate([], {
			queryParamsHandling: 'preserve',
			onSameUrlNavigation: 'reload',
		});
	}

	protected async remove(isuId: number): Promise<void> {
		this.close(); // the popup closes right away
		try {
			await firstValueFrom(this.api.delete(isuId));
			this.alert.success('Студент успешно удален.');
		} catch (error) {
			this.alert.error(errorMessage(error, 'Не удалось удалить студента.'));
		}
	}
}
